import type { DayOfWeek } from '@/shared/lib/types'

export interface SchoolConfig {
  id: string
  gradeCount: number
  classCountByGrade: Record<number, number>
  activeDays: Array<DayOfWeek>
  periodsPerDay: number
  createdAt: string
  updatedAt: string
}
