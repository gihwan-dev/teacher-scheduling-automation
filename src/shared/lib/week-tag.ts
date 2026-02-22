export type WeekTag = `${number}-W${string}`

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000

export const WEEK_TAG_REGEX = /^\d{4}-W\d{2}$/

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
