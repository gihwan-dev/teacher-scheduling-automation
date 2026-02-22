import type { DayOfWeek } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'

export type ScheduleTransactionStatus = 'DRAFT' | 'COMMITTED' | 'ROLLED_BACK'

export interface ValidationViolation {
  ruleId: string
  severity: 'error' | 'warning'
  humanMessage: string
  location: {
    weekTag?: WeekTag
    date?: string
    grade?: number
    classNumber?: number
    teacherName?: string
    day?: DayOfWeek
    period?: number
  }
  relatedEntities: Array<{
    type: 'TEACHER' | 'CLASS' | 'ROOM' | 'CALENDAR_EVENT' | 'LESSON'
    label: string
  }>
}

export interface ScheduleTransaction {
  draftId: string
  targetWeeks: Array<WeekTag>
  validationResult: {
    passed: boolean
    violations: Array<ValidationViolation>
  }
  impactReportId: string
  status: ScheduleTransactionStatus
  createdAt: string
  updatedAt: string
}
