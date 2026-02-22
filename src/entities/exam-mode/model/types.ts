import type { WeekTag } from '@/shared/lib/week-tag'
import type { DayOfWeek } from '@/shared/lib/types'

export type InvigilationConflictType =
  | 'TEACHER_DOUBLE_BOOKED'
  | 'TEACHER_UNAVAILABLE'

export interface ExamModeWeekState {
  weekTag: WeekTag
  isEnabled: boolean
  enabledAt: string | null
  enabledBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ExamSlot {
  id: string
  weekTag: WeekTag
  date: string
  day: DayOfWeek
  period: number
  grade: number
  classNumber: number
  subjectId: string | null
  subjectName: string
  durationMinutes: number
  createdAt: string
  updatedAt: string
}

export type InvigilationAssignmentStatus = 'ASSIGNED' | 'UNRESOLVED'

export interface InvigilationAssignment {
  id: string
  weekTag: WeekTag
  slotId: string
  teacherId: string | null
  status: InvigilationAssignmentStatus
  isManual: boolean
  reason: string | null
  createdAt: string
  updatedAt: string
}

export interface InvigilationConflict {
  type: InvigilationConflictType
  teacherId: string
  slotIds: Array<string>
  message: string
}

export interface InvigilationStats {
  weekTag: WeekTag
  totalSlots: number
  assignedSlots: number
  unassignedSlots: number
  teacherLoad: Array<{
    teacherId: string
    count: number
  }>
  updatedAt: string
}
