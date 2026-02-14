import type { DayOfWeek } from '@/shared/lib/types'

export type FixedEventType = 'FIXED_CLASS' | 'BUSINESS_TRIP' | 'SCHOOL_EVENT'

export interface FixedEvent {
  id: string
  type: FixedEventType
  description: string
  teacherId: string | null
  subjectId: string | null
  grade: number | null
  classNumber: number | null
  day: DayOfWeek
  period: number
  createdAt: string
  updatedAt: string
}
