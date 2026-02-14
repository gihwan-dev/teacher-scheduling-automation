export { useReplacementStore } from './model/store'
export { findReplacementCandidates } from './lib/replacement-finder'
export { rankCandidate } from './lib/candidate-ranker'
export type {
  ReplacementCandidate,
  ReplacementSearchConfig,
  ReplacementSearchResult,
  ReplacementType,
  CandidateRanking,
  RelaxationSuggestion,
} from './model/types'
