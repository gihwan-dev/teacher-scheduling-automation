import { describe, expect, it } from 'vitest'
import {
  applyMultiCandidateToWeekCells,
  applySingleCandidateToWeekCells,
  filterAcademicCalendarEventsForWeek,
  resolveReplacementScopeTargetWeeks,
} from '../apply-replacement-scope'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { TimetableCell } from '@/entities/timetable'
import type { MultiReplacementCandidate, ReplacementCandidate } from '../../model/types'

function makeCell(overrides: Partial<TimetableCell>): TimetableCell {
  return {
    teacherId: 'T1',
    subjectId: 'S1',
    grade: 1,
    classNumber: 1,
    day: 'MON',
    period: 1,
    isFixed: false,
    status: 'BASE',
    ...overrides,
  }
}

function makeMoveCandidate(overrides: Partial<ReplacementCandidate> = {}): ReplacementCandidate {
  return {
    id: 'candidate-1',
    type: 'MOVE',
    sourceCell: makeCell({ day: 'MON', period: 1 }),
    sourceCellKey: '1-1-MON-1',
    targetCellKey: '1-1-MON-2',
    targetCell: null,
    resultSourceCell: null,
    resultTargetCell: makeCell({ day: 'MON', period: 2, status: 'TEMP_MODIFIED' }),
    ranking: {
      violationCount: 0,
      violations: [],
      scoreDelta: 0.1,
      similarityScore: 100,
      idleMinimizationScore: 100,
      fairnessScore: 100,
      candidateReasons: [],
      totalRank: 10,
    },
    ...overrides,
  }
}

function makeCalendarEvent(
  overrides: Partial<AcademicCalendarEvent>,
): AcademicCalendarEvent {
  return {
    id: 'ac-1',
    eventType: 'SEMESTER_END',
    startDate: '2026-03-27',
    endDate: '2026-03-27',
    scopeType: 'SCHOOL',
    scopeValue: null,
    periodOverride: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('resolveReplacementScopeTargetWeeks', () => {
  it('THIS_WEEK 범위를 단일 주차로 계산한다', () => {
    const result = resolveReplacementScopeTargetWeeks({
      selectedWeek: '2026-W09',
      scopeState: {
        type: 'THIS_WEEK',
        fromWeek: null,
        toWeek: null,
      },
      academicCalendarEvents: [],
    })

    expect(result.issue).toBeNull()
    expect(result.targetWeeks).toEqual(['2026-W09'])
    expect(result.appliedScope?.type).toBe('THIS_WEEK')
  })

  it('FROM_NEXT_WEEK에서 SEMESTER_END가 없으면 차단한다', () => {
    const result = resolveReplacementScopeTargetWeeks({
      selectedWeek: '2026-W09',
      scopeState: {
        type: 'FROM_NEXT_WEEK',
        fromWeek: null,
        toWeek: null,
      },
      academicCalendarEvents: [],
    })

    expect(result.issue?.reason).toBe('MISSING_SEMESTER_END')
    expect(result.targetWeeks).toEqual([])
  })

  it('FROM_NEXT_WEEK에서 학기말까지 주차를 계산한다', () => {
    const result = resolveReplacementScopeTargetWeeks({
      selectedWeek: '2026-W09',
      scopeState: {
        type: 'FROM_NEXT_WEEK',
        fromWeek: null,
        toWeek: null,
      },
      academicCalendarEvents: [makeCalendarEvent({ endDate: '2026-03-27' })],
    })

    expect(result.issue).toBeNull()
    expect(result.targetWeeks).toEqual(['2026-W10', '2026-W11', '2026-W12', '2026-W13'])
    expect(result.appliedScope?.type).toBe('FROM_NEXT_WEEK')
  })

  it('RANGE에서 from > to이면 차단한다', () => {
    const result = resolveReplacementScopeTargetWeeks({
      selectedWeek: '2026-W09',
      scopeState: {
        type: 'RANGE',
        fromWeek: '2026-W12',
        toWeek: '2026-W10',
      },
      academicCalendarEvents: [],
    })

    expect(result.issue?.reason).toBe('INVALID_RANGE')
  })
})

describe('applySingleCandidateToWeekCells', () => {
  it('MOVE 대상 슬롯이 점유되어 있으면 차단한다', () => {
    const result = applySingleCandidateToWeekCells({
      cells: [
        makeCell({ day: 'MON', period: 1 }),
        makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'MON', period: 2 }),
      ],
      selectedCandidate: makeMoveCandidate(),
    })

    expect(result.ok).toBe(false)
    expect(result.issue?.reason).toBe('TARGET_SLOT_OCCUPIED')
  })

  it('MOVE를 성공적으로 적용한다', () => {
    const result = applySingleCandidateToWeekCells({
      cells: [makeCell({ day: 'MON', period: 1 })],
      selectedCandidate: makeMoveCandidate(),
    })

    expect(result.ok).toBe(true)
    expect(result.cells).toHaveLength(1)
    expect(result.cells[0].period).toBe(2)
  })

  it('SWAP 대상 셀이 잠겨 있으면 차단한다', () => {
    const result = applySingleCandidateToWeekCells({
      cells: [
        makeCell({ day: 'MON', period: 1 }),
        makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'MON', period: 2, status: 'LOCKED' }),
      ],
      selectedCandidate: makeMoveCandidate({
        type: 'SWAP',
        targetCell: makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'MON', period: 2 }),
        resultSourceCell: makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'MON', period: 1 }),
      }),
    })

    expect(result.ok).toBe(false)
    expect(result.issue?.reason).toBe('TARGET_CELL_NOT_EDITABLE')
  })
})

describe('applyMultiCandidateToWeekCells', () => {
  it('다중 교체 중 실패를 전달한다', () => {
    const moveCandidate = makeMoveCandidate()
    const multiCandidate: MultiReplacementCandidate = {
      id: 'multi-1',
      sources: [
        { sourceKey: '1-1-MON-1', candidate: moveCandidate },
        {
          sourceKey: '1-1-MON-1',
          candidate: makeMoveCandidate({
            id: 'candidate-2',
            sourceCellKey: '1-1-MON-1',
            targetCellKey: '1-1-MON-3',
          }),
        },
      ],
      combinedRanking: {
        aggregateScore: 10,
        totalViolationCount: 0,
        combinedScoreDelta: 0.2,
        isFullyCompatible: true,
      },
    }

    const result = applyMultiCandidateToWeekCells({
      cells: [makeCell({ day: 'MON', period: 1 })],
      selectedCandidate: multiCandidate,
    })

    expect(result.ok).toBe(false)
    expect(result.issue?.reason).toBe('SOURCE_CELL_NOT_FOUND')
  })
})

describe('filterAcademicCalendarEventsForWeek', () => {
  it('주차 범위와 겹치는 이벤트만 필터링한다', () => {
    const events = [
      makeCalendarEvent({ id: 'in-week', startDate: '2026-03-23', endDate: '2026-03-27' }),
      makeCalendarEvent({ id: 'out-week', startDate: '2026-04-06', endDate: '2026-04-10' }),
    ]

    const filtered = filterAcademicCalendarEventsForWeek({
      events,
      weekTag: '2026-W13',
      activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    })

    expect(filtered.map((event) => event.id)).toEqual(['in-week'])
  })
})
