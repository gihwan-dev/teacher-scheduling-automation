import type { WeekTag } from '@/shared/lib/week-tag'
import { computeWeekTagFromTimestamp } from '@/shared/lib/week-tag'

/**
 * ISO 8601 주차 번호를 계산한다.
 * 주차 경계: 월요일 00:00
 */
export function computeWeekTag(timestamp: number): WeekTag {
  return computeWeekTagFromTimestamp(timestamp)
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
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + diff,
    ),
  )
  return monday.getTime()
}
