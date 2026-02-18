import type { DayOfWeek } from '@/shared/lib/types'

export interface SchoolConfig {
  id: string
  gradeCount: number
  classCountByGrade: Record<number, number>
  activeDays: Array<DayOfWeek>
  periodsByDay?: Record<DayOfWeek, number>
  periodsPerDay: number // legacy compatibility
  createdAt: string
  updatedAt: string
}
