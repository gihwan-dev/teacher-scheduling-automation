import type { ConstraintViolation } from '@/entities/constraint-policy'
import type { CellKey, TimetableCell } from '@/entities/timetable'

export type ReplacementType = 'SWAP' | 'MOVE'

export interface ReplacementCandidate {
  id: string
  type: ReplacementType
  sourceCell: TimetableCell
  sourceCellKey: CellKey
  targetCellKey: CellKey
  targetCell: TimetableCell | null // SWAP=셀, MOVE=null
  resultSourceCell: TimetableCell | null // SWAP=상대셀이 이동, MOVE=null(빈)
  resultTargetCell: TimetableCell // 소스셀이 이동한 결과
  ranking: CandidateRanking
}

export interface CandidateRanking {
  violationCount: number
  violations: Array<ConstraintViolation>
  scoreDelta: number
  similarityScore: number
  idleMinimizationScore: number
  totalRank: number
}

export interface ReplacementSearchConfig {
  scope: 'SAME_CLASS'
  includeViolating: boolean
  maxCandidates: number
}

export interface ReplacementSearchResult {
  candidates: Array<ReplacementCandidate>
  stats: {
    totalExamined: number
    validCandidates: number
    searchTimeMs: number
  }
  relaxationSuggestions: Array<RelaxationSuggestion>
}

export interface RelaxationSuggestion {
  type: string
  message: string
  priority: 'high' | 'medium' | 'low'
  candidatesFound: number
}

// --- 다중 교체 (F9) ---

export interface MultiReplacementCandidate {
  id: string
  sources: Array<{
    sourceKey: CellKey
    candidate: ReplacementCandidate
  }>
  combinedRanking: CombinedRanking
}

export interface CombinedRanking {
  aggregateScore: number
  totalViolationCount: number
  combinedScoreDelta: number
  isFullyCompatible: boolean
}

export interface MultiReplacementSearchResult {
  candidates: Array<MultiReplacementCandidate>
  stats: {
    totalCombinationsExamined: number
    validCombinations: number
    searchTimeMs: number
    timedOut: boolean
  }
  perSourceResults: Array<{ sourceKey: CellKey; result: ReplacementSearchResult }>
}
