import type {
  ConstraintPolicy,
  ConstraintViolation,
} from '@/entities/constraint-policy'
import type { TimetableCell } from '@/entities/timetable'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { DayOfWeek } from '@/shared/lib/types'
import type { CandidateRanking, ReplacementCandidate } from '../model/types'
import { validateTimetable } from '@/entities/constraint-policy'
import { TimetableGrid, computeTotalScore } from '@/features/generate-timetable'

interface RankingContext {
  allCells: Array<TimetableCell>
  constraintPolicy: ConstraintPolicy
  teacherPolicies: Array<TeacherPolicy>
  activeDays: Array<DayOfWeek>
  periodsPerDay: number
}

/**
 * 후보의 랭킹을 계산한다.
 */
export function rankCandidate(
  candidate: ReplacementCandidate,
  afterCells: Array<TimetableCell>,
  ctx: RankingContext,
): CandidateRanking {
  // 1. 제약 위반 수
  const violations: Array<ConstraintViolation> = validateTimetable(
    afterCells,
    ctx.constraintPolicy,
  )
  const violationCount = violations.filter((v) => v.severity === 'error').length

  // 2. 점수 변화량 (before → after)
  const beforeGrid = buildGrid(ctx.allCells)
  const afterGrid = buildGrid(afterCells)
  const beforeScore = computeTotalScore(
    beforeGrid,
    ctx.constraintPolicy,
    ctx.activeDays,
    ctx.periodsPerDay,
    ctx.teacherPolicies,
  )
  const afterScore = computeTotalScore(
    afterGrid,
    ctx.constraintPolicy,
    ctx.activeDays,
    ctx.periodsPerDay,
    ctx.teacherPolicies,
  )
  const scoreDelta = Math.round((afterScore - beforeScore) * 100) / 100

  // 3. 유사도: MOVE(1셀 변경) > SWAP(2셀 변경)
  const totalCells = ctx.allCells.length || 1
  const changedCells = candidate.type === 'MOVE' ? 1 : 2
  const similarityScore = Math.round((1 - changedCells / totalCells) * 100)

  // 4. 공강 최소화 점수
  const idleMinimizationScore = computeIdleScore(
    afterCells,
    ctx.activeDays,
    ctx.periodsPerDay,
  )

  // 5. 종합 점수
  const totalRank =
    -violationCount * 1000 +
    similarityScore * 0.4 +
    scoreDelta * 0.35 +
    idleMinimizationScore * 0.25

  return {
    violationCount,
    violations,
    scoreDelta,
    similarityScore,
    idleMinimizationScore,
    totalRank: Math.round(totalRank * 100) / 100,
  }
}

function buildGrid(cells: Array<TimetableCell>): TimetableGrid {
  const grid = new TimetableGrid()
  for (const cell of cells) {
    grid.placeCell(cell)
  }
  return grid
}

/**
 * 관련 교사들의 빈 교시(첫~마지막 수업 사이 빈칸) 기반 점수 (높을수록 공강 적음)
 */
function computeIdleScore(
  cells: Array<TimetableCell>,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
): number {
  const teacherIds = new Set(cells.map((c) => c.teacherId))
  if (teacherIds.size === 0) return 100

  let totalIdle = 0
  let totalSlots = 0

  for (const teacherId of teacherIds) {
    for (const day of activeDays) {
      const periods = cells
        .filter((c) => c.teacherId === teacherId && c.day === day)
        .map((c) => c.period)
        .sort((a, b) => a - b)

      if (periods.length < 2) continue

      const first = periods[0]
      const last = periods[periods.length - 1]
      const span = last - first + 1
      const idle = span - periods.length
      totalIdle += idle
      totalSlots += periodsPerDay
    }
  }

  if (totalSlots === 0) return 100
  return Math.round(Math.max(0, 100 - (totalIdle / totalSlots) * 400))
}
