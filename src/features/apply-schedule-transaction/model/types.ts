import type { ValidationViolation } from '@/entities/schedule-transaction'
import type { Teacher } from '@/entities/teacher'
import type {
  AppliedScope,
  TimetableCell,
  TimetableSnapshot,
} from '@/entities/timetable'
import type { WeekTag } from '@/shared/lib/week-tag'

export interface TransactionWeekPlan {
  weekTag: WeekTag
  sourceSnapshot: TimetableSnapshot
  nextCells: Array<TimetableCell>
  appliedScope: AppliedScope
}

export interface ApplyScheduleTransactionInput {
  kind: 'EDIT_SAVE' | 'REPLACEMENT_SCOPE' | 'VERSION_RESTORE'
  actor?: string
  plans: Array<TransactionWeekPlan>
  preferredCommitActionType?: 'TRANSACTION_COMMIT' | 'VERSION_RESTORE'
  impactAlternatives?: Array<string>
  prevalidatedViolations?: Array<ValidationViolation>
  teachers?: Array<Teacher>
  impactSummary?: string
}

export interface ApplyScheduleTransactionResult {
  ok: boolean
  draftId: string
  status: 'COMMITTED' | 'ROLLED_BACK'
  savedSnapshots: Array<TimetableSnapshot>
  violations: Array<ValidationViolation>
  rollbackReason: string | null
}
