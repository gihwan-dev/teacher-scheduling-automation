export { useReplacementStore } from './model/store'
export { findReplacementCandidates } from './lib/replacement-finder'
export { findMultiReplacementCandidates } from './lib/multi-replacement-finder'
export { rankCandidate } from './lib/candidate-ranker'
export type {
  ReplacementCandidate,
  ReplacementSearchConfig,
  ReplacementSearchResult,
  ReplacementType,
  CandidateRanking,
  RelaxationSuggestion,
  MultiReplacementCandidate,
  MultiReplacementSearchResult,
  CombinedRanking,
} from './model/types'
