import { findReplacementCandidates } from './replacement-finder'
import type { ReplacementFinderContext } from './replacement-finder'
import type { CellKey, TimetableCell } from '@/entities/timetable'
import type {
  MultiReplacementCandidate,
  MultiReplacementSearchResult,
  ReplacementCandidate,
  ReplacementSearchConfig,
  ReplacementSearchResult,
} from '../model/types'
import { generateId } from '@/shared/lib/id'

const TIME_BUDGET_MS = 2000
const PER_SOURCE_MAX = 20

/**
 * 다중 셀 교체 후보를 탐색한다.
 * 각 소스 셀에 대해 독립 후보를 구한 뒤, 조합의 호환성을 검증하여 종합 랭킹한다.
 */
export function findMultiReplacementCandidates(
  sourceKeys: Array<CellKey>,
  allCells: Array<TimetableCell>,
  config: ReplacementSearchConfig,
  ctx: ReplacementFinderContext,
): MultiReplacementSearchResult {
  const startTime = performance.now()

  const cellMap = new Map<string, TimetableCell>()
  for (const cell of allCells) {
    const key = `${cell.grade}-${cell.classNumber}-${cell.day}-${cell.period}`
    cellMap.set(key, cell)
  }

  // 1. 각 소스 셀에 대해 독립 탐색
  const perSourceResults: Array<{
    sourceKey: CellKey
    result: ReplacementSearchResult
  }> = []

  for (const sourceKey of sourceKeys) {
    const sourceCell = cellMap.get(sourceKey)
    if (!sourceCell) {
      perSourceResults.push({
        sourceKey,
        result: {
          candidates: [],
          stats: { totalExamined: 0, validCandidates: 0, searchTimeMs: 0 },
          relaxationSuggestions: [],
        },
      })
      continue
    }

    const perSourceConfig = { ...config, maxCandidates: PER_SOURCE_MAX }
    const result = findReplacementCandidates(
      sourceKey,
      sourceCell,
      allCells,
      perSourceConfig,
      ctx,
    )
    perSourceResults.push({ sourceKey, result })
  }

  // 2. 소스별 후보 배열 준비
  const candidateArrays = perSourceResults.map((r) =>
    r.result.candidates.map((c) => ({ sourceKey: r.sourceKey, candidate: c })),
  )

  // 비어 있는 소스가 있으면 조합 불가
  if (candidateArrays.some((arr) => arr.length === 0)) {
    return {
      candidates: [],
      stats: {
        totalCombinationsExamined: 0,
        validCombinations: 0,
        searchTimeMs: Math.round(performance.now() - startTime),
        timedOut: false,
      },
      perSourceResults,
    }
  }

  // 3. 카테시안 곱 생성 + 호환성 검증 + 시간 예산
  const validCombinations: Array<MultiReplacementCandidate> = []
  let totalCombinationsExamined = 0
  let timedOut = false

  const indices = new Array(candidateArrays.length).fill(0)

  let done = false
  while (!done) {
    // 시간 예산 체크
    if (performance.now() - startTime > TIME_BUDGET_MS) {
      timedOut = true
      break
    }

    totalCombinationsExamined++

    const combo = indices.map((idx, i) => candidateArrays[i][idx])

    if (isCombinationCompatible(combo)) {
      const multiCandidate = buildMultiCandidate(combo)
      validCombinations.push(multiCandidate)
    }

    // 다음 조합으로 인덱스 증가
    let carry = true
    for (let i = indices.length - 1; i >= 0 && carry; i--) {
      indices[i]++
      if (indices[i] < candidateArrays[i].length) {
        carry = false
      } else {
        indices[i] = 0
      }
    }
    if (carry) done = true // 모든 조합 소진
  }

  // 4. 종합 점수로 정렬
  validCombinations.sort(
    (a, b) =>
      b.combinedRanking.aggregateScore - a.combinedRanking.aggregateScore,
  )

  return {
    candidates: validCombinations.slice(0, config.maxCandidates),
    stats: {
      totalCombinationsExamined,
      validCombinations: validCombinations.length,
      searchTimeMs: Math.round(performance.now() - startTime),
      timedOut,
    },
    perSourceResults,
  }
}

/**
 * 조합의 호환성 검증:
 * 1. 어떤 두 후보도 같은 슬롯을 건드리면 안 됨
 * 2. 모든 교체 적용 후 같은 교사가 같은 day-period에 2곳 배치되면 안 됨
 */
export function isCombinationCompatible(
  combo: Array<{ sourceKey: CellKey; candidate: ReplacementCandidate }>,
): boolean {
  // 1. 슬롯 중복 검사
  const touchedSlots = new Set<string>()
  for (const { candidate } of combo) {
    const sourceSlot = candidate.sourceCellKey
    const targetSlot = candidate.targetCellKey

    if (touchedSlots.has(sourceSlot) || touchedSlots.has(targetSlot)) {
      return false
    }
    touchedSlots.add(sourceSlot)
    touchedSlots.add(targetSlot)
  }

  // 2. 교사 충돌 검사: 각 교체 후의 교사-슬롯 배치 수집
  const teacherSlots = new Map<string, Set<string>>()

  const addTeacherSlot = (teacherId: string, day: string, period: number) => {
    const slotStr = `${day}-${period}`
    if (!teacherSlots.has(teacherId)) {
      teacherSlots.set(teacherId, new Set())
    }
    const existing = teacherSlots.get(teacherId)!
    if (existing.has(slotStr)) return false
    existing.add(slotStr)
    return true
  }

  for (const { candidate } of combo) {
    // resultTargetCell: 소스 교사가 타겟 위치로 이동한 결과
    const rtc = candidate.resultTargetCell
    if (!addTeacherSlot(rtc.teacherId, rtc.day, rtc.period)) return false

    // SWAP인 경우: resultSourceCell — 타겟 교사가 소스 위치로 이동한 결과
    if (candidate.type === 'SWAP' && candidate.resultSourceCell) {
      const rsc = candidate.resultSourceCell
      if (!addTeacherSlot(rsc.teacherId, rsc.day, rsc.period)) return false
    }
  }

  return true
}

function buildMultiCandidate(
  combo: Array<{ sourceKey: CellKey; candidate: ReplacementCandidate }>,
): MultiReplacementCandidate {
  let aggregateScore = 0
  let totalViolationCount = 0
  let combinedScoreDelta = 0

  for (const { candidate } of combo) {
    aggregateScore += candidate.ranking.totalRank
    totalViolationCount += candidate.ranking.violationCount
    combinedScoreDelta += candidate.ranking.scoreDelta
  }

  return {
    id: generateId(),
    sources: combo.map(({ sourceKey, candidate }) => ({
      sourceKey,
      candidate,
    })),
    combinedRanking: {
      aggregateScore: Math.round(aggregateScore * 100) / 100,
      totalViolationCount,
      combinedScoreDelta: Math.round(combinedScoreDelta * 100) / 100,
      isFullyCompatible: true,
    },
  }
}
