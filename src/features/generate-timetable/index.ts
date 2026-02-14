export type {
  GenerationInput,
  GenerationResult,
  UnplacedAssignment,
  RelaxationSuggestion,
  AssignmentUnit,
} from './model/types'
export {
  generateTimetable,
  runPlacementPipeline,
  buildAssignmentUnitsFromCells,
} from './lib/solver'
export { TimetableGrid } from './lib/grid'
export {
  isPlacementValid,
  findCandidateSlots,
  buildBlockedSlots,
  expandGradeBlockedSlots,
} from './lib/constraint-checker'
export { scoreSlot, computeTotalScore } from './lib/scorer'
export { suggestRelaxations, diagnoseFailure } from './lib/failure-analyzer'
