export type WeekNavigationInput = {
  trafficWeeklyData: { weekNumber: number }[]
  selectedWeekNumber: number
  currentCampusWeek: number | null
}

export type WeekNavigation = {
  availableWeeks: number[]
  prevWeek: number | null
  nextWeek: number | null
}

export { parseWeekParam } from "@/lib/format/campus-week"

export function computeWeekNavigation(input: WeekNavigationInput): WeekNavigation {
  const availableWeeks = Array.from(
    new Set([
      ...input.trafficWeeklyData.map((entry) => entry.weekNumber),
      input.selectedWeekNumber,
      ...(input.currentCampusWeek != null ? [input.currentCampusWeek] : []),
    ])
  ).sort((a, b) => a - b)

  const weekIndex = availableWeeks.indexOf(input.selectedWeekNumber)
  const prevWeek = weekIndex > 0 ? availableWeeks[weekIndex - 1] : null
  const nextWeek = weekIndex >= 0 && weekIndex < availableWeeks.length - 1 ? availableWeeks[weekIndex + 1] : null

  return { availableWeeks, prevWeek, nextWeek }
}
