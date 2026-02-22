export type {
  TimetableCell,
  CellStatus,
  CellKey,
  EditAction,
  EditValidationResult,
  AppliedScopeType,
  AppliedScope,
  TimetableSnapshot,
} from './model/types'
export {
  timetableCellSchema,
  cellStatusSchema,
  appliedScopeTypeSchema,
  appliedScopeSchema,
  timetableSnapshotSchema,
} from './model/schema'
export {
  getCellStatusStyle,
  getCellStatusClasses,
  getStatusLabel,
  getStatusIcon,
} from './lib/cell-status'
export type { CellStatusStyle } from './lib/cell-status'
export { StatusIndicator, StatusLegend } from './lib/cell-status-ui'
