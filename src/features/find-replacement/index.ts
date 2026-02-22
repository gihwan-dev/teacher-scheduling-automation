export { useReplacementStore } from './model/store'
export { findReplacementCandidates } from './lib/replacement-finder'
export { findMultiReplacementCandidates } from './lib/multi-replacement-finder'
export {
  findSubstituteCandidates,
  buildSubstituteLoadByTeacher,
  isSubstituteSourceEditable,
} from './lib/substitute-finder'
export { rankCandidate } from './lib/candidate-ranker'
export type {
  ReplacementCandidate,
  ReplacementSearchConfig,
  ReplacementSearchMode,
  ReplacementSearchResult,
  ReplacementType,
  CandidateRanking,
  RelaxationSuggestion,
  MultiReplacementCandidate,
  MultiReplacementSearchResult,
  CombinedRanking,
  ScopeBlockingReason,
  ScopedAlternativeCandidate,
  ScopeValidationIssue,
  ScopeValidationSummary,
  ReplacementApplyScopeState,
} from './model/types'
