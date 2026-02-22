import type { ValidationViolation } from '@/entities/schedule-transaction'
import type { CellKey, TimetableCell } from '@/entities/timetable'
import type { ImpactRiskLevel } from '@/entities/impact-analysis'
import type { WeekTag } from '@/shared/lib/week-tag'

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
  violations: Array<ValidationViolation>
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
  perSourceResults: Array<{
    sourceKey: CellKey
    result: ReplacementSearchResult
  }>
}

export type ScopeBlockingReason =
  | 'MISSING_SEMESTER_END'
  | 'INVALID_RANGE'
  | 'MISSING_WEEK_SNAPSHOT'
  | 'SOURCE_CELL_NOT_FOUND'
  | 'SOURCE_CELL_NOT_EDITABLE'
  | 'TARGET_CELL_NOT_FOUND'
  | 'TARGET_CELL_NOT_EDITABLE'
  | 'TARGET_SLOT_OCCUPIED'
  | 'VALIDATION_FAILED'

export interface ScopedAlternativeCandidate {
  id: string
  weekTag: WeekTag
  label: string
  riskLevel: ImpactRiskLevel
  scoreDelta: number
  violationCount: number
}

export interface ScopeValidationIssue {
  weekTag: WeekTag
  reason: ScopeBlockingReason
  message: string
  violations: Array<ValidationViolation>
  alternatives: Array<ScopedAlternativeCandidate>
}

export interface ScopeValidationSummary {
  status: 'IDLE' | 'BLOCKED' | 'APPLIED'
  targetWeeks: Array<WeekTag>
  issues: Array<ScopeValidationIssue>
}

export interface ReplacementApplyScopeState {
  type: 'THIS_WEEK' | 'FROM_NEXT_WEEK' | 'RANGE'
  fromWeek: WeekTag | null
  toWeek: WeekTag | null
}
