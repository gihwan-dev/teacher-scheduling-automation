import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { SchoolConfig } from '@/entities/school'
import type { ValidationViolation } from '@/entities/schedule-transaction'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell } from '@/entities/timetable'
import type { WeekTag } from '@/shared/lib/week-tag'

export interface ValidateScheduleChangeInput {
  cells: Array<TimetableCell>
  constraintPolicy: ConstraintPolicy
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
  weekTag: WeekTag
  academicCalendarEvents?: Array<AcademicCalendarEvent>
}

export interface ValidateScheduleChangeOutput {
  passed: boolean
  violations: Array<ValidationViolation>
}

export interface BuildAcademicCalendarBlockedSlotsInput {
  schoolConfig: SchoolConfig
  weekTag: WeekTag
  academicCalendarEvents: Array<AcademicCalendarEvent>
}
