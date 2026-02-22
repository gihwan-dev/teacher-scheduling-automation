import type { SchoolConfig } from '@/entities/school'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { FixedEvent } from '@/entities/fixed-event'
import type {
  ConstraintPolicy,
} from '@/entities/constraint-policy'
import type { ValidationViolation } from '@/entities/schedule-transaction'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { TimetableSnapshot } from '@/entities/timetable'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { SubjectType } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'

export interface GenerationInput {
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
  fixedEvents: Array<FixedEvent>
  constraintPolicy: ConstraintPolicy
  teacherPolicies?: Array<TeacherPolicy>
  targetWeekTag?: WeekTag
  academicCalendarEvents?: Array<AcademicCalendarEvent>
  options?: { maxRetries?: number; seed?: number }
}

export interface GenerationResult {
  success: boolean
  snapshot: TimetableSnapshot | null
  violations: Array<ValidationViolation>
  unplacedAssignments: Array<UnplacedAssignment>
  suggestions: Array<RelaxationSuggestion>
  stats: {
    totalSlots: number
    filledSlots: number
    fixedSlots: number
    generationTimeMs: number
  }
}

export interface UnplacedAssignment {
  teacherId: string
  subjectId: string
  grade: number
  classNumber: number
  remainingHours: number
  reason:
    | 'TEACHER_NO_AVAILABLE_SLOTS'
    | 'CLASS_NO_AVAILABLE_SLOTS'
    | 'TEACHER_CLASS_NO_OVERLAP'
    | 'BACKTRACKING_EXHAUSTED'
}

export interface RelaxationSuggestion {
  type: string
  message: string
  priority: 'high' | 'medium' | 'low'
}

export interface AssignmentUnit {
  teacherId: string
  subjectId: string
  subjectType?: SubjectType
  grade: number
  classNumber: number
  totalHours: number
  remainingHours: number
}
