const { join } = require("node:path");

/**
 * Keep Chrome in the backend package so we do not depend on ~/.cache/puppeteer
 * (that directory is often root-owned or missing the version Puppeteer expects).
 *
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
