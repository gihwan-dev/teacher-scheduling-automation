import type { SchoolConfig } from '@/entities/school'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { FixedEvent } from '@/entities/fixed-event'
import type { ConstraintPolicy, ConstraintViolation } from '@/entities/constraint-policy'
import type { TimetableSnapshot } from '@/entities/timetable'

export interface GenerationInput {
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
  fixedEvents: Array<FixedEvent>
  constraintPolicy: ConstraintPolicy
  options?: { maxRetries?: number; seed?: number }
}

export interface GenerationResult {
  success: boolean
  snapshot: TimetableSnapshot | null
  violations: Array<ConstraintViolation>
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
  grade: number
  classNumber: number
  totalHours: number
  remainingHours: number
}
