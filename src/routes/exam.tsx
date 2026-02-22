import { createFileRoute } from '@tanstack/react-router'
import type { WeekTag } from '@/shared/lib/week-tag'
import { isWeekTag } from '@/shared/lib/week-tag'
import { ExamPage } from '@/pages/exam'

export const Route = createFileRoute('/exam')({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    week?: WeekTag
  } => {
    const week = search.week
    if (typeof week === 'string' && isWeekTag(week)) {
      return { week }
    }
    return {}
  },
  component: ExamPage,
})
