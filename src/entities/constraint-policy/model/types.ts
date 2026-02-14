import type { DayOfWeek } from '@/shared/lib/types'

export interface ConstraintPolicy {
  id: string
  studentMaxConsecutiveSameSubject: number
  teacherMaxConsecutiveHours: number
  teacherMaxDailyHours: number
  createdAt: string
  updatedAt: string
}

export type ViolationType =
  | 'TEACHER_CONFLICT'
  | 'STUDENT_CONSECUTIVE_EXCEEDED'
  | 'TEACHER_CONSECUTIVE_EXCEEDED'
  | 'TEACHER_DAILY_OVERLOAD'
  | 'HOURS_MISMATCH'

export interface ConstraintViolation {
  type: ViolationType
  severity: 'error' | 'warning'
  message: string
  location: {
    grade?: number
    classNumber?: number
    day?: DayOfWeek
    period?: number
    teacherId?: string
    subjectId?: string
  }
}
