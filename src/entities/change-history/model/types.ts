import type { CellKey, TimetableCell } from '@/entities/timetable'

export type WeekTag = `${number}-W${string}` // "2026-W07"

export type ChangeActionType = 'EDIT' | 'CLEAR' | 'LOCK' | 'UNLOCK' | 'MOVE' | 'CONFIRM' | 'RECOMPUTE'

export interface ChangeEvent {
  id: string
  snapshotId: string
  weekTag: WeekTag
  actionType: ChangeActionType
  cellKey: CellKey
  before: TimetableCell | null
  after: TimetableCell | null
  timestamp: number
  isUndone: boolean
}
