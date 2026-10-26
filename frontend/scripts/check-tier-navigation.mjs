/** Real-browser CSS regression. Run after installing both apps: node scripts/check-tier-navigation.mjs */
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import { existsSync } from "node:fs"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/postcss"
import { createServer } from "vite"

const root = fileURLToPath(new URL("../", import.meta.url))
// Reuse the project's existing Chrome/Puppeteer dependency; do not install a second browser stack.
const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url))
const { default: puppeteer } = await import(pathToFileURL(backendRequire.resolve("puppeteer")).href)
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const server = await createServer({
  configFile: false, root, plugins: [react()], appType: "custom",
  // Next accepts string plugin names; Vite's inline PostCSS API expects plugin instances.
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: {
    "@/lib/client/api-client": fileURLToPath(new URL("./fixtures/mentee-api.ts", import.meta.url)),
    "@": root,
  } },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**"] } },
})
server.middlewares.use(async (req, res, next) => {
  if (!req.headers.accept?.includes("text/html")) return next()
  const html = await server.transformIndexHtml(req.url, '<!doctype html><html><body><div id="root"></div><script type="module" src="/scripts/fixtures/tier-navigation.tsx"></script></body></html>')
  res.setHeader("Content-Type", "text/html")
  res.end(html)
})
let browser
try {
  await server.listen()
  const address = server.httpServer.address()
  const origin = `http://127.0.0.1:${address.port}`
  browser = await puppeteer.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROME_EXECUTABLE_PATH }
      : existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
  })
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }])
  await page.goto(`${origin}/dashboard/mentee`, { waitUntil: "networkidle0" })
  await page.waitForSelector('[data-tier="legendary"]')

  // Match the captured bug: the retained global stylesheet has no tier variables.
  // Keep all feature CSS intact, so the regression proves the mounted UI owns its palette.
  await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      if (!sheet.ownerNode?.getAttribute("data-vite-dev-id")?.endsWith("/app/globals.css")) continue
      for (const rule of sheet.cssRules) {
        if (!rule.style) continue
        for (const name of [...rule.style]) if (name.startsWith("--tier-")) rule.style.removeProperty(name)
      }
    }
  })
  const palette = {
    light: { rare: ["201, 241, 248", "21, 150, 173", "6, 75, 85"], epic: ["228, 214, 255", "123, 77, 255", "59, 29, 120"], legendary: ["251, 208, 251", "207, 43, 221", "107, 20, 117"] },
    dark: { rare: ["15, 46, 54", "63, 198, 220", "166, 240, 251"], epic: ["39, 24, 69", "155, 107, 255", "220, 203, 255"], legendary: ["58, 18, 64", "224, 92, 255", "246, 194, 255"] },
  }
  let checks = 0
  async function checkColors(theme) {
    const colors = await page.evaluate(() => [...document.querySelectorAll("[data-tier]")].map(el => {
      const css = getComputedStyle(el)
      return { tier: el.dataset.tier, background: css.backgroundColor, border: css.borderColor,
        color: css.color, isCard: el.dataset.slot === "card" }
    }))
    assert.equal(colors.length, 21, "Legend tags, six grid cells, six cards, and six card tags must render")
    for (const { tier, background, border, color, isCard } of colors) {
      assert.equal(background, `rgb(${palette[theme][tier][0]})`, `${theme} ${tier} fill after navigation`)
      assert.equal(border, `rgb(${palette[theme][tier][1]})`, `${theme} ${tier} border after navigation`)
      if (!isCard) assert.equal(color, `rgb(${palette[theme][tier][2]})`, `${theme} ${tier} ink after navigation`)
      checks++
    }
    for (const bar of await page.$$eval('[role="progressbar"]', els => els.map(el => ({
      width: el.firstElementChild.style.width,
      color: getComputedStyle(el.firstElementChild).backgroundColor,
      tier: el.closest('[data-slot="card"]').dataset.tier,
    })))) {
      assert.equal(bar.width, "100%")
      assert.equal(bar.color, `rgb(${palette[theme][bar.tier][1]})`)
    }
    const motion = await page.evaluate(() => ({
      epic: getComputedStyle(document.querySelector('[data-slot="card"][data-tier="epic"]')).animationName,
      glow: getComputedStyle(document.querySelector('[data-slot="card"][data-tier="rare"]')).boxShadow,
      sheen: getComputedStyle(document.querySelector('button[data-tier="legendary"]'), "::after").display,
      ring: getComputedStyle(document.querySelector('button[data-tier="legendary"]')).getPropertyValue("--tw-ring-offset-width"),
    }))
    assert.equal(motion.epic, "none")
    assert.equal(motion.sheen, "none")
    assert.notEqual(motion.glow, "none")
    assert.equal(motion.ring, "2px")
  }
  async function click(text, view) {
    await page.locator(`text/${text}`).click()
    await page.waitForSelector(`[data-view="${view}"]`)
  }
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.className = theme, theme)
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tier-rare-bg").trim()), "")
    await checkColors(theme)
    for (const source of ["Memo", "Directory"]) {
      await click(source, `/dashboard/${source.toLowerCase()}`)
      await click("Scholar", "/dashboard/directory/scholar")
      await checkColors(theme)
      await click("Mentee", "/dashboard/mentee")
      await checkColors(theme)
      await page.goBack()
      await page.waitForSelector('[data-view="/dashboard/directory/scholar"]')
      await checkColors(theme)
      await click("Mentee", "/dashboard/mentee")
    }
  }
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }])
  assert.equal(await page.$eval('[data-slot="card"][data-tier="epic"]', el => getComputedStyle(el).animationDuration), "2.6s")
  assert.equal(await page.$eval('button[data-tier="legendary"]', el => getComputedStyle(el, "::after").animationDuration), "3.4s")

  // Use real coordinates: jsdom cannot prove that the gaps belong to a column.
  const rowGap = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('td[data-week="1"] button')]
    const first = buttons[0].getBoundingClientRect()
    const second = buttons[1].getBoundingClientRect()
    const x = first.x + first.width / 2
    const y = (first.bottom + second.top) / 2
    const target = document.elementFromPoint(x, y)
    return { x, y, week: target.closest("[data-week]")?.dataset.week, button: !!target.closest("button") }
  })
  assert.equal(rowGap.week, "1")
  assert.equal(rowGap.button, false, "The row-gap test must not hit a button")
  await page.mouse.move(rowGap.x, rowGap.y)
  await page.waitForFunction(() => [...document.querySelectorAll('[data-week="1"]')].every(el => el.classList.contains("bg-muted")))
  assert.equal(await page.$$eval('td[data-week="1"]', cells => cells.every(cell =>
    cell.querySelector('button > span[aria-hidden="true"]') !== null)), true, "Hover must emphasize all four cells")
  await page.mouse.click(rowGap.x, rowGap.y)
  await page.waitForSelector('[data-selected-week="1"][data-selection-count="1"]')

  const columnGap = await page.evaluate(() => {
    const cell = document.querySelector('td[data-week="2"]')
    const rect = cell.getBoundingClientRect()
    const x = rect.left + 1
    const y = rect.top + rect.height / 2
    const target = document.elementFromPoint(x, y)
    return { x, y, week: target.closest("[data-week]")?.dataset.week, button: !!target.closest("button") }
  })
  assert.equal(columnGap.week, "2")
  assert.equal(columnGap.button, false, "The column-gap test must not hit a button")
  await page.mouse.click(columnGap.x, columnGap.y)
  await page.waitForSelector('[data-selected-week="2"][data-selection-count="2"]')
  await page.locator('th[data-week="3"] button').click()
  await page.waitForSelector('[data-selected-week="3"][data-selection-count="3"]')

  for (const width of [1280, 390]) {
    await page.setViewport({ width, height: 900 })
    const heightBefore = await page.$eval('[data-testid="mcf-banner"]', el => el.getBoundingClientRect().height)
    await page.locator('button[aria-label="Change meeting time"]').click()
    await page.waitForSelector('[role="dialog"]')
    const layout = await page.evaluate(() => {
      const banner = document.querySelector('[data-testid="mcf-banner"]')
      const dialog = document.querySelector('[role="dialog"]')
      return { height: banner.getBoundingClientRect().height, inlineEditor: banner.contains(dialog),
        summary: banner.textContent.includes("Your meeting: Wednesday at 3:00pm") }
    })
    assert.equal(layout.height, heightBefore, `Opening the editor must not expand the ${width}px banner`)
    assert.equal(layout.inlineEditor, false)
    assert.equal(layout.summary, true)
    await page.keyboard.press("Escape")
    await page.waitForSelector('[role="dialog"]', { hidden: true })
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Change meeting time")
  }
  console.log(`Tier navigation: ${checks} computed-color checks passed (both entry points, return/back, light/dark, reduced motion, missing root tokens).`)
  console.log("Column interaction: continuous hover, row-gap and column-gap clicks, and single activation passed in Chrome.")
  console.log("Meeting editor: stable banner height and restored focus passed at desktop and mobile widths.")
} finally {
  await browser?.close()
  await server.close()
}
