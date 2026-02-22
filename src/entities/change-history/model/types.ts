import type { CellKey, TimetableCell } from '@/entities/timetable'
import type { WeekTag } from '@/shared/lib/week-tag'

export type ChangeActionType =
  | 'EDIT'
  | 'CLEAR'
  | 'LOCK'
  | 'UNLOCK'
  | 'MOVE'
  | 'CONFIRM'
  | 'RECOMPUTE'
  | 'VERSION_CLONE'
  | 'VERSION_RESTORE'

export interface ChangeEvent {
  id: string
  snapshotId: string
  weekTag: WeekTag
  actionType: ChangeActionType
  actor: string
  cellKey: CellKey
  before: TimetableCell | null
  after: TimetableCell | null
  beforePayload: unknown | null
  afterPayload: unknown | null
  impactSummary: string | null
  conflictDetected: boolean
  rollbackRef: string | null
  timestamp: number
  isUndone: boolean
}
