import type { WeekTag } from '../model/types'

/**
 * ISO 8601 주차 번호를 계산한다.
 * 주차 경계: 월요일 00:00
 */
export function computeWeekTag(timestamp: number): WeekTag {
  const date = new Date(timestamp)
  const { year, week } = getISOWeek(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function getCurrentWeekTag(): WeekTag {
  return computeWeekTag(Date.now())
}

/**
 * 해당 타임스탬프가 속하는 주의 월요일 00:00 (UTC) 밀리초를 반환한다.
 */
export function getWeekBoundary(timestamp: number): number {
  const date = new Date(timestamp)
  const day = date.getUTCDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day // 월요일로 이동
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff))
  return monday.getTime()
}

function getISOWeek(date: Date): { year: number; week: number } {
  // ISO 8601: 주는 월요일에 시작, 해당 연도의 첫 번째 목요일을 포함하는 주가 1주
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7 // 1=Mon, 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // 해당 주의 목요일
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}
