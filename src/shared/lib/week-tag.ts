import type { DayOfWeek } from './types'

export type WeekTag = `${number}-W${string}`

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000

export const WEEK_TAG_REGEX = /^\d{4}-W\d{2}$/
const WEEK_TAG_PARSE_REGEX = /^(\d{4})-W(\d{2})$/

const DAY_OFFSET: Record<DayOfWeek, number> = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4,
  SAT: 5,
}

export function isWeekTag(value: string): value is WeekTag {
  return WEEK_TAG_REGEX.test(value)
}

export function computeWeekTagFromTimestamp(timestamp: number): WeekTag {
  const date = new Date(timestamp)
  const { year, week } = getISOWeek(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function computeWeekTagFromIso(
  createdAt: string,
  fallbackTimestamp = Date.now(),
): WeekTag {
  const parsed = Date.parse(createdAt)
  if (Number.isNaN(parsed)) {
    return computeWeekTagFromTimestamp(fallbackTimestamp)
  }
  return computeWeekTagFromTimestamp(parsed)
}

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((d.getTime() - yearStart.getTime() + 86400000) / WEEK_IN_MS)

  return { year: d.getUTCFullYear(), week }
}

export function getWeekStartDate(weekTag: WeekTag): Date {
  const parsed = WEEK_TAG_PARSE_REGEX.exec(weekTag)
  if (!parsed) {
    throw new Error(`Invalid weekTag: ${weekTag}`)
  }

  const year = Number(parsed[1])
  const week = Number(parsed[2])

  // ISO week 1 is the week with Jan 4th.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7 // 1..7, Monday=1
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1)

  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return monday
}

export function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getIsoDateForWeekDay(weekTag: WeekTag, day: DayOfWeek): string {
  const monday = getWeekStartDate(weekTag)
  const target = new Date(monday)
  target.setUTCDate(monday.getUTCDate() + DAY_OFFSET[day])
  return formatIsoDate(target)
}

export function getWeekDateRange(
  weekTag: WeekTag,
  activeDays?: Array<DayOfWeek>,
): { startDate: string; endDate: string } {
  const monday = getWeekStartDate(weekTag)
  const startDate = formatIsoDate(monday)

  const maxOffset =
    activeDays && activeDays.length > 0
      ? Math.max(...activeDays.map((day) => DAY_OFFSET[day]))
      : 5

  const end = new Date(monday)
  end.setUTCDate(monday.getUTCDate() + maxOffset)

  return {
    startDate,
    endDate: formatIsoDate(end),
  }
}

export function shiftWeekTag(weekTag: WeekTag, offsetWeeks: number): WeekTag {
  if (!Number.isInteger(offsetWeeks)) {
    throw new Error(`offsetWeeks must be an integer: ${offsetWeeks}`)
  }

  const start = getWeekStartDate(weekTag)
  const shifted = new Date(start)
  shifted.setUTCDate(start.getUTCDate() + offsetWeeks * 7)

  return computeWeekTagFromTimestamp(shifted.getTime())
}

export function compareWeekTag(a: WeekTag, b: WeekTag): number {
  const parsedA = WEEK_TAG_PARSE_REGEX.exec(a)
  const parsedB = WEEK_TAG_PARSE_REGEX.exec(b)

  if (!parsedA || !parsedB) {
    throw new Error(`Invalid weekTag compare input: ${a}, ${b}`)
  }

  const yearA = Number(parsedA[1])
  const weekA = Number(parsedA[2])
  const yearB = Number(parsedB[1])
  const weekB = Number(parsedB[2])

  if (yearA !== yearB) {
    return yearA - yearB
  }
  return weekA - weekB
}

export function listWeekTagsBetween(from: WeekTag, to: WeekTag): Array<WeekTag> {
  if (compareWeekTag(from, to) > 0) {
    throw new Error(`from must be before to: ${from} > ${to}`)
  }

  const weeks: Array<WeekTag> = []
  let current = from

  // Safety guard against unexpected infinite loops.
  for (let i = 0; i < 1000; i += 1) {
    weeks.push(current)
    if (current === to) {
      return weeks
    }
    current = shiftWeekTag(current, 1)
  }

  throw new Error(`week range exceeds safety guard: ${from} -> ${to}`)
}

export function buildForwardWeekWindow(
  baseWeekTag: WeekTag,
  futureCount: number,
): Array<WeekTag> {
  if (!Number.isInteger(futureCount) || futureCount < 0) {
    throw new Error(`futureCount must be a non-negative integer: ${futureCount}`)
  }

  const weeks: Array<WeekTag> = []
  for (let offset = 0; offset <= futureCount; offset += 1) {
    weeks.push(shiftWeekTag(baseWeekTag, offset))
  }
  return weeks
}
