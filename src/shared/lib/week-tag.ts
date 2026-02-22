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
