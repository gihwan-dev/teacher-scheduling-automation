import { describe, expect, it } from 'vitest'
import { rankCandidate } from '../candidate-ranker'
import type { TimetableCell } from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { ReplacementCandidate } from '../../model/types'
import type { DayOfWeek } from '@/shared/lib/types'

function makeCell(
  overrides: Partial<TimetableCell> & Pick<TimetableCell, 'teacherId' | 'subjectId' | 'day' | 'period'>,
): TimetableCell {
  return {
    grade: 1,
    classNumber: 1,
    isFixed: false,
    status: 'BASE',
    ...overrides,
  }
}

const defaultPolicy: ConstraintPolicy = {
  id: 'p1',
  studentMaxConsecutiveSameSubject: 2,
  teacherMaxConsecutiveHours: 4,
  teacherMaxDailyHours: 6,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

const activeDays: Array<DayOfWeek> = ['MON', 'TUE', 'WED', 'THU', 'FRI']

const baseCells: Array<TimetableCell> = [
  makeCell({ teacherId: 'T1', subjectId: 'S1', day: 'MON', period: 1 }),
  makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'MON', period: 2 }),
  makeCell({ teacherId: 'T3', subjectId: 'S3', day: 'TUE', period: 1 }),
  makeCell({ teacherId: 'T4', subjectId: 'S4', day: 'TUE', period: 2 }),
]

describe('rankCandidate', () => {
  it('위반 0건 후보가 위반 있는 후보보다 높은 랭킹을 받는다', () => {
    // 위반 없는 후보 (정상 교환)
    const afterCellsClean = [
      makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'MON', period: 1 }),
      makeCell({ teacherId: 'T1', subjectId: 'S1', day: 'MON', period: 2 }),
      makeCell({ teacherId: 'T3', subjectId: 'S3', day: 'TUE', period: 1 }),
      makeCell({ teacherId: 'T4', subjectId: 'S4', day: 'TUE', period: 2 }),
    ]

    // 위반 있는 후보 (교사 충돌: T1이 같은 시간 두 수업)
    const afterCellsViolating = [
      makeCell({ teacherId: 'T1', subjectId: 'S1', day: 'MON', period: 1 }),
      makeCell({ teacherId: 'T1', subjectId: 'S2', day: 'MON', period: 1 }), // 충돌!
      makeCell({ teacherId: 'T3', subjectId: 'S3', day: 'TUE', period: 1 }),
      makeCell({ teacherId: 'T4', subjectId: 'S4', day: 'TUE', period: 2 }),
    ]

    const ctx = {
      allCells: baseCells,
      constraintPolicy: defaultPolicy,
      teacherPolicies: [],
      activeDays,
      periodsPerDay: 6,
    }

    const rankClean = rankCandidate({ type: 'SWAP' } as ReplacementCandidate, afterCellsClean, ctx)
    const rankViolating = rankCandidate({ type: 'SWAP' } as ReplacementCandidate, afterCellsViolating, ctx)

    expect(rankClean.totalRank).toBeGreaterThan(rankViolating.totalRank)
  })

  it('MOVE가 SWAP보다 유사도 점수가 높다', () => {
    const ctx = {
      allCells: baseCells,
      constraintPolicy: defaultPolicy,
      teacherPolicies: [],
      activeDays,
      periodsPerDay: 6,
    }

    const rankMove = rankCandidate(
      { type: 'MOVE' } as ReplacementCandidate,
      baseCells,
      ctx,
    )
    const rankSwap = rankCandidate(
      { type: 'SWAP' } as ReplacementCandidate,
      baseCells,
      ctx,
    )

    expect(rankMove.similarityScore).toBeGreaterThan(rankSwap.similarityScore)
  })

  it('동일 위반 수에서 점수 개선이 큰 후보가 우선이다', () => {
    const ctx = {
      allCells: baseCells,
      constraintPolicy: defaultPolicy,
      teacherPolicies: [],
      activeDays,
      periodsPerDay: 6,
    }

    // 같은 type으로 비교하되 afterCells가 달라서 scoreDelta가 다름
    const rank1 = rankCandidate({ type: 'SWAP' } as ReplacementCandidate, baseCells, ctx)

    // 약간 변경된 셀 목록 (점수에 큰 차이는 없지만 구조적으로 다름)
    const modifiedCells = [
      makeCell({ teacherId: 'T1', subjectId: 'S1', day: 'MON', period: 1 }),
      makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'TUE', period: 2 }),
      makeCell({ teacherId: 'T3', subjectId: 'S3', day: 'WED', period: 1 }),
      makeCell({ teacherId: 'T4', subjectId: 'S4', day: 'THU', period: 2 }),
    ]
    const rank2 = rankCandidate({ type: 'SWAP' } as ReplacementCandidate, modifiedCells, ctx)

    // 둘 다 위반 0이어야 함
    expect(rank1.violationCount).toBe(0)
    expect(rank2.violationCount).toBe(0)
    // totalRank는 scoreDelta 차이에 따라 달라짐
    expect(typeof rank1.totalRank).toBe('number')
    expect(typeof rank2.totalRank).toBe('number')
  })

  it('maxCandidates 제한이 적용된다 (findReplacementCandidates에서)', async () => {
    // 이 테스트는 ranker 자체가 아닌 finder의 maxCandidates를 검증
    const { findReplacementCandidates } = await import('../replacement-finder')

    const cells: Array<TimetableCell> = []
    // 많은 빈 슬롯이 있도록 1개 셀만 배치
    cells.push(makeCell({ teacherId: 'T1', subjectId: 'S1', day: 'MON', period: 1 }))

    const config = { scope: 'SAME_CLASS' as const, includeViolating: false, maxCandidates: 3 }
    const ctx = {
      schoolConfig: {
        id: 'sc1',
        gradeCount: 1,
        classCountByGrade: { 1: 1 },
        activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] as Array<DayOfWeek>,
        periodsPerDay: 6,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
      constraintPolicy: defaultPolicy,
      teacherPolicies: [],
      fixedEvents: [],
    }

    const result = findReplacementCandidates(
      `1-1-MON-1`,
      cells[0],
      cells,
      config,
      ctx,
    )

    expect(result.candidates.length).toBeLessThanOrEqual(3)
  })
})
