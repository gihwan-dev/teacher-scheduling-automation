import type { DayOfWeek } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'

export type SubstituteAssignmentSource = 'REPLACEMENT' | 'MANUAL'

export interface SubstituteAssignment {
  id: string
  weekTag: WeekTag
  date: string
  day: DayOfWeek
  period: number
  grade: number
  classNumber: number
  subjectId: string
  absentTeacherId: string
  substituteTeacherId: string
  source: SubstituteAssignmentSource
  reason: string
  createdAt: string
}
