import { createFileRoute } from '@tanstack/react-router'
import type { WeekTag } from '@/shared/lib/week-tag'
import { HistoryPage } from '@/pages/history'
import { isWeekTag } from '@/shared/lib/week-tag'

function parseVersion(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined
  }
  return parsed
}

export const Route = createFileRoute('/history')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { week?: WeekTag; version?: number } => {
    const week = search.week
    const version = parseVersion(search.version)

    if (typeof week === 'string' && isWeekTag(week)) {
      return version ? { week, version } : { week }
    }
    return {}
  },
  component: HistoryPage,
})
