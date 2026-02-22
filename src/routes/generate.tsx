import { createFileRoute } from '@tanstack/react-router'
import type { WeekTag } from '@/shared/lib/week-tag'
import { GeneratePage } from '@/pages/generate'
import { isWeekTag } from '@/shared/lib/week-tag'

export const Route = createFileRoute('/generate')({
  validateSearch: (search: Record<string, unknown>): { week?: WeekTag } => {
    const week = search.week
    if (typeof week === 'string' && isWeekTag(week)) {
      return { week }
    }
    return {}
  },
  component: GeneratePage,
})
