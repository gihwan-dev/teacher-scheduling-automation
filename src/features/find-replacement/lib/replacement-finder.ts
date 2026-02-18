import { rankCandidate } from './candidate-ranker'
import type {
  RelaxationSuggestion,
  ReplacementCandidate,
  ReplacementSearchConfig,
  ReplacementSearchResult,
} from '../model/types'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { FixedEvent } from '@/entities/fixed-event'
import type { SchoolConfig } from '@/entities/school'
import type { CellKey, TimetableCell } from '@/entities/timetable'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { DayOfWeek } from '@/shared/lib/types'
import { getDayPeriodCount, getMaxPeriodsPerDay } from '@/entities/school'
import { makeCellKey } from '@/features/edit-timetable-cell'
import { isCellEditable } from '@/features/edit-timetable-cell/lib/edit-validator'
import {
  TimetableGrid,
  buildBlockedSlots,
  expandGradeBlockedSlots,
  isPlacementValid,
} from '@/features/generate-timetable'
import { generateId } from '@/shared/lib/id'

export interface ReplacementFinderContext {
  schoolConfig: SchoolConfig
  constraintPolicy: ConstraintPolicy
  teacherPolicies: Array<TeacherPolicy>
  fixedEvents: Array<FixedEvent>
}

/**
 * 교체 후보를 탐색한다.
 */
export function findReplacementCandidates(
  sourceCellKey: CellKey,
  sourceCell: TimetableCell,
  allCells: Array<TimetableCell>,
  config: ReplacementSearchConfig,
  ctx: ReplacementFinderContext,
  _skipRelaxation = false,
): ReplacementSearchResult {
  const startTime = performance.now()
  let totalExamined = 0

  // 고정/잠금 셀은 교체 불가
  if (sourceCell.isFixed || sourceCell.status === 'LOCKED') {
    return emptyResult(startTime)
  }
  if ((sourceCell.subjectType ?? 'CLASS') !== 'CLASS') {
    return emptyResult(startTime)
  }

  const { schoolConfig, constraintPolicy, teacherPolicies, fixedEvents } = ctx
  const { activeDays } = schoolConfig
  const maxPeriodsPerDay = getMaxPeriodsPerDay(schoolConfig)

  // blocked slots
  let blockedSlots = buildBlockedSlots(fixedEvents, teacherPolicies)
  blockedSlots = expandGradeBlockedSlots(
    blockedSlots,
    schoolConfig.classCountByGrade,
  )

  const candidates: Array<ReplacementCandidate> = []

  // 같은 반 셀만 대상 (SAME_CLASS scope)
  const { grade, classNumber } = sourceCell

  // SWAP 후보 탐색
  for (const targetCell of allCells) {
    if (targetCell.grade !== grade || targetCell.classNumber !== classNumber)
      continue
    if (
      targetCell.day === sourceCell.day &&
      targetCell.period === sourceCell.period
    )
      continue
    // 같은 교사+과목 조합은 교환해도 결과가 동일하므로 제외
    if (
      targetCell.teacherId === sourceCell.teacherId &&
      targetCell.subjectId === sourceCell.subjectId
    )
      continue
    if ((targetCell.subjectType ?? 'CLASS') !== 'CLASS') continue
    if (!isCellEditable(targetCell)) continue

    totalExamined++

    const swapCandidate = trySwap(
      sourceCellKey,
      sourceCell,
      targetCell,
      allCells,
      constraintPolicy,
      teacherPolicies,
      blockedSlots,
      activeDays,
      maxPeriodsPerDay,
      config.includeViolating,
    )
    if (swapCandidate) candidates.push(swapCandidate)
  }

  // MOVE 후보 탐색 (빈 슬롯으로 이동)
  for (const day of activeDays) {
    for (let period = 1; period <= getDayPeriodCount(schoolConfig, day); period++) {
      if (day === sourceCell.day && period === sourceCell.period) continue

      // 해당 슬롯이 비어있는지 확인
      const slotKey = makeCellKey(grade, classNumber, day, period)
      const existingCell = allCells.find(
        (c) =>
          c.grade === grade &&
          c.classNumber === classNumber &&
          c.day === day &&
          c.period === period,
      )
      if (existingCell) continue

      totalExamined++

      const moveCandidate = tryMove(
        sourceCellKey,
        sourceCell,
        slotKey,
        day,
        period,
        allCells,
        constraintPolicy,
        teacherPolicies,
        blockedSlots,
        activeDays,
        maxPeriodsPerDay,
        config.includeViolating,
      )
      if (moveCandidate) candidates.push(moveCandidate)
    }
  }

  // 정렬 + 제한
  candidates.sort((a, b) => b.ranking.totalRank - a.ranking.totalRank)
  const limitedCandidates = candidates.slice(0, config.maxCandidates)

  // 완화 제안 (재귀 호출 방지를 위해 skipRelaxation 플래그 사용)
  const relaxationSuggestions: Array<RelaxationSuggestion> =
    limitedCandidates.length === 0 && !_skipRelaxation
      ? simulateRelaxations(sourceCellKey, sourceCell, allCells, ctx)
      : []

  const searchTimeMs = Math.round(performance.now() - startTime)

  return {
    candidates: limitedCandidates,
    stats: {
      totalExamined,
      validCandidates: limitedCandidates.length,
      searchTimeMs,
    },
    relaxationSuggestions,
  }
}

function trySwap(
  sourceCellKey: CellKey,
  sourceCell: TimetableCell,
  targetCell: TimetableCell,
  allCells: Array<TimetableCell>,
  constraintPolicy: ConstraintPolicy,
  teacherPolicies: Array<TeacherPolicy>,
  blockedSlots: Set<string>,
  activeDays: Array<DayOfWeek>,
  maxPeriodsPerDay: number,
  includeViolating: boolean,
): ReplacementCandidate | null {
  // 그리드: source와 target 모두 제거
  const grid = new TimetableGrid()
  for (const cell of allCells) {
    const isSource =
      cell.grade === sourceCell.grade &&
      cell.classNumber === sourceCell.classNumber &&
      cell.day === sourceCell.day &&
      cell.period === sourceCell.period
    const isTarget =
      cell.grade === targetCell.grade &&
      cell.classNumber === targetCell.classNumber &&
      cell.day === targetCell.day &&
      cell.period === targetCell.period
    if (isSource || isTarget) continue
    grid.placeCell(cell)
  }

  // source 교사를 target 위치에 배치 가능한지 검증
  const sourceUnit = {
    teacherId: sourceCell.teacherId,
    subjectId: sourceCell.subjectId,
    subjectType: 'CLASS' as const,
    grade: sourceCell.grade,
    classNumber: sourceCell.classNumber,
    totalHours: 1,
    remainingHours: 1,
  }
  const sourceToTargetValid = isPlacementValid(
    grid,
    sourceUnit,
    targetCell.day,
    targetCell.period,
    constraintPolicy,
    blockedSlots,
    teacherPolicies,
  )

  // target 교사를 source 위치에 배치 가능한지 검증
  // (source가 target 위치에 배치된 상태에서 검증)
  const targetUnit = {
    teacherId: targetCell.teacherId,
    subjectId: targetCell.subjectId,
    subjectType: 'CLASS' as const,
    grade: targetCell.grade,
    classNumber: targetCell.classNumber,
    totalHours: 1,
    remainingHours: 1,
  }

  const swappedSourceCell: TimetableCell = {
    ...sourceCell,
    day: targetCell.day,
    period: targetCell.period,
    status: 'TEMP_MODIFIED',
  }
  grid.placeCell(swappedSourceCell)

  const targetToSourceValid = isPlacementValid(
    grid,
    targetUnit,
    sourceCell.day,
    sourceCell.period,
    constraintPolicy,
    blockedSlots,
    teacherPolicies,
  )

  grid.removeCell(swappedSourceCell)

  if (!sourceToTargetValid || !targetToSourceValid) {
    if (!includeViolating) return null
  }

  const targetCellKey = makeCellKey(
    targetCell.grade,
    targetCell.classNumber,
    targetCell.day,
    targetCell.period,
  )

  // 교환 결과 셀
  const resultTargetCell: TimetableCell = swappedSourceCell
  const resultSourceCell: TimetableCell = {
    ...targetCell,
    day: sourceCell.day,
    period: sourceCell.period,
    status: 'TEMP_MODIFIED',
  }

  // 교환 후 전체 셀 목록
  const afterCells = allCells.map((c) => {
    if (
      c.grade === sourceCell.grade &&
      c.classNumber === sourceCell.classNumber &&
      c.day === sourceCell.day &&
      c.period === sourceCell.period
    ) {
      return resultSourceCell
    }
    if (
      c.grade === targetCell.grade &&
      c.classNumber === targetCell.classNumber &&
      c.day === targetCell.day &&
      c.period === targetCell.period
    ) {
      return resultTargetCell
    }
    return c
  })

  const ranking = rankCandidate(
    { type: 'SWAP' } as ReplacementCandidate,
    afterCells,
    {
      allCells,
      constraintPolicy,
      teacherPolicies,
      activeDays,
      periodsPerDay: maxPeriodsPerDay,
    },
  )

  if (!includeViolating && ranking.violationCount > 0) return null

  return {
    id: generateId(),
    type: 'SWAP',
    sourceCell,
    sourceCellKey,
    targetCellKey,
    targetCell,
    resultSourceCell,
    resultTargetCell,
    ranking,
  }
}

function tryMove(
  sourceCellKey: CellKey,
  sourceCell: TimetableCell,
  targetSlotKey: CellKey,
  targetDay: DayOfWeek,
  targetPeriod: number,
  allCells: Array<TimetableCell>,
  constraintPolicy: ConstraintPolicy,
  teacherPolicies: Array<TeacherPolicy>,
  blockedSlots: Set<string>,
  activeDays: Array<DayOfWeek>,
  maxPeriodsPerDay: number,
  includeViolating: boolean,
): ReplacementCandidate | null {
  const grid = new TimetableGrid()
  for (const cell of allCells) {
    if (
      cell.day === sourceCell.day &&
      cell.period === sourceCell.period &&
      cell.grade === sourceCell.grade &&
      cell.classNumber === sourceCell.classNumber
    ) {
      continue
    }
    grid.placeCell(cell)
  }

  const unit = {
    teacherId: sourceCell.teacherId,
    subjectId: sourceCell.subjectId,
    subjectType: 'CLASS' as const,
    grade: sourceCell.grade,
    classNumber: sourceCell.classNumber,
    totalHours: 1,
    remainingHours: 1,
  }

  const valid = isPlacementValid(
    grid,
    unit,
    targetDay,
    targetPeriod,
    constraintPolicy,
    blockedSlots,
    teacherPolicies,
  )

  if (!valid && !includeViolating) return null

  const resultTargetCell: TimetableCell = {
    ...sourceCell,
    day: targetDay,
    period: targetPeriod,
    status: 'TEMP_MODIFIED',
  }

  // 이동 후 전체 셀 목록: source 제거 + target에 추가
  const afterCells = allCells
    .filter(
      (c) =>
        !(
          c.grade === sourceCell.grade &&
          c.classNumber === sourceCell.classNumber &&
          c.day === sourceCell.day &&
          c.period === sourceCell.period
        ),
    )
    .concat(resultTargetCell)

  const ranking = rankCandidate(
    { type: 'MOVE' } as ReplacementCandidate,
    afterCells,
    {
      allCells,
      constraintPolicy,
      teacherPolicies,
      activeDays,
      periodsPerDay: maxPeriodsPerDay,
    },
  )

  if (!includeViolating && ranking.violationCount > 0) return null

  return {
    id: generateId(),
    type: 'MOVE',
    sourceCell,
    sourceCellKey,
    targetCellKey: targetSlotKey,
    targetCell: null,
    resultSourceCell: null,
    resultTargetCell,
    ranking,
  }
}

function simulateRelaxations(
  sourceCellKey: CellKey,
  sourceCell: TimetableCell,
  allCells: Array<TimetableCell>,
  ctx: ReplacementFinderContext,
): Array<RelaxationSuggestion> {
  const suggestions: Array<RelaxationSuggestion> = []
  const baseConfig: ReplacementSearchConfig = {
    scope: 'SAME_CLASS',
    includeViolating: false,
    maxCandidates: 5,
  }

  // 1. teacherMaxDailyHours + 1
  {
    const relaxed = {
      ...ctx,
      constraintPolicy: {
        ...ctx.constraintPolicy,
        teacherMaxDailyHours: ctx.constraintPolicy.teacherMaxDailyHours + 1,
      },
    }
    const result = findReplacementCandidates(
      sourceCellKey,
      sourceCell,
      allCells,
      baseConfig,
      relaxed,
      true,
    )
    if (result.candidates.length > 0) {
      suggestions.push({
        type: 'INCREASE_DAILY_LIMIT',
        message: `교사 일일 최대 시수를 ${ctx.constraintPolicy.teacherMaxDailyHours}에서 ${ctx.constraintPolicy.teacherMaxDailyHours + 1}로 완화하면 ${result.candidates.length}개 후보를 찾을 수 있습니다.`,
        priority: 'medium',
        candidatesFound: result.candidates.length,
      })
    }
  }

  // 2. teacherMaxConsecutiveHours + 1
  {
    const relaxed = {
      ...ctx,
      constraintPolicy: {
        ...ctx.constraintPolicy,
        teacherMaxConsecutiveHours:
          ctx.constraintPolicy.teacherMaxConsecutiveHours + 1,
      },
    }
    const result = findReplacementCandidates(
      sourceCellKey,
      sourceCell,
      allCells,
      baseConfig,
      relaxed,
      true,
    )
    if (result.candidates.length > 0) {
      suggestions.push({
        type: 'INCREASE_CONSECUTIVE_LIMIT',
        message: `교사 연속 수업 한도를 ${ctx.constraintPolicy.teacherMaxConsecutiveHours}에서 ${ctx.constraintPolicy.teacherMaxConsecutiveHours + 1}로 완화하면 ${result.candidates.length}개 후보를 찾을 수 있습니다.`,
        priority: 'medium',
        candidatesFound: result.candidates.length,
      })
    }
  }

  // 3. 해당 교사 회피 슬롯 해제
  {
    const relaxedPolicies = ctx.teacherPolicies.map((p) =>
      p.teacherId === sourceCell.teacherId ? { ...p, avoidanceSlots: [] } : p,
    )
    const relaxed = { ...ctx, teacherPolicies: relaxedPolicies }
    const result = findReplacementCandidates(
      sourceCellKey,
      sourceCell,
      allCells,
      baseConfig,
      relaxed,
      true,
    )
    if (result.candidates.length > 0) {
      suggestions.push({
        type: 'REMOVE_AVOIDANCE',
        message: `해당 교사의 회피 슬롯을 해제하면 ${result.candidates.length}개 후보를 찾을 수 있습니다.`,
        priority: 'low',
        candidatesFound: result.candidates.length,
      })
    }
  }

  // 4. 잠긴 셀 일시 해제
  {
    const unlockedCells = allCells.map((c) =>
      c.status === 'LOCKED' ? { ...c, status: 'BASE' as const } : c,
    )
    const result = findReplacementCandidates(
      sourceCellKey,
      sourceCell,
      unlockedCells,
      baseConfig,
      ctx,
      true,
    )
    if (result.candidates.length > 0) {
      suggestions.push({
        type: 'UNLOCK_CELLS',
        message: `잠긴 셀을 일시 해제하면 ${result.candidates.length}개 후보를 찾을 수 있습니다.`,
        priority: 'high',
        candidatesFound: result.candidates.length,
      })
    }
  }

  return suggestions
}

function emptyResult(startTime: number): ReplacementSearchResult {
  return {
    candidates: [],
    stats: {
      totalExamined: 0,
      validCandidates: 0,
      searchTimeMs: Math.round(performance.now() - startTime),
    },
    relaxationSuggestions: [],
  }
}
