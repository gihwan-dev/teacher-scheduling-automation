import { describe, expect, it } from 'vitest'
import { TimetableGrid } from '../grid'
import {
  buildBlockedSlots,
  expandGradeBlockedSlots,
  findCandidateSlots,
  isPlacementValid,
} from '../constraint-checker'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TimetableCell } from '@/entities/timetable'
import type { FixedEvent } from '@/entities/fixed-event'
import type { AssignmentUnit } from '../../model/types'

function makePolicy(
  overrides: Partial<ConstraintPolicy> = {},
): ConstraintPolicy {
  return {
    id: 'policy-1',
    studentMaxConsecutiveSameSubject: 2,
    teacherMaxConsecutiveHours: 4,
    teacherMaxDailyHours: 6,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeUnit(overrides: Partial<AssignmentUnit> = {}): AssignmentUnit {
  return {
    teacherId: 't-1',
    subjectId: 'sub-1',
    grade: 1,
    classNumber: 1,
    totalHours: 3,
    remainingHours: 3,
    ...overrides,
  }
}

function makeCell(overrides: Partial<TimetableCell> = {}): TimetableCell {
  return {
    teacherId: 't-1',
    subjectId: 'sub-1',
    grade: 1,
    classNumber: 1,
    day: 'MON',
    period: 1,
    isFixed: false,
    status: 'BASE',
    ...overrides,
  }
}

describe('isPlacementValid', () => {
  it('빈 그리드에 배치 가능하다', () => {
    const grid = new TimetableGrid()
    const unit = makeUnit()
    const policy = makePolicy()

    expect(isPlacementValid(grid, unit, 'MON', 1, policy, new Set())).toBe(true)
  })

  it('교사가 이미 해당 시간에 배정되면 불가능하다', () => {
    const grid = new TimetableGrid()
    grid.placeCell(makeCell({ grade: 1, classNumber: 2 })) // 같은 교사, 다른 반

    const unit = makeUnit()
    const policy = makePolicy()

    expect(isPlacementValid(grid, unit, 'MON', 1, policy, new Set())).toBe(
      false,
    )
  })

  it('반 슬롯이 이미 차있으면 불가능하다', () => {
    const grid = new TimetableGrid()
    grid.placeCell(makeCell({ teacherId: 't-other' })) // 다른 교사, 같은 반 같은 시간

    const unit = makeUnit()
    const policy = makePolicy()

    expect(isPlacementValid(grid, unit, 'MON', 1, policy, new Set())).toBe(
      false,
    )
  })

  it('차단된 슬롯이면 불가능하다', () => {
    const grid = new TimetableGrid()
    const unit = makeUnit()
    const policy = makePolicy()
    const blocked = new Set(['teacher-t-1-MON-1'])

    expect(isPlacementValid(grid, unit, 'MON', 1, policy, blocked)).toBe(false)
  })

  it('교사 일일 시수 한도에 도달하면 불가능하다', () => {
    const grid = new TimetableGrid()
    const policy = makePolicy({ teacherMaxDailyHours: 2 })

    // 월요일에 이미 2교시 배정
    grid.placeCell(makeCell({ grade: 1, classNumber: 2, period: 1 }))
    grid.placeCell(makeCell({ grade: 1, classNumber: 2, period: 2 }))

    const unit = makeUnit({ grade: 1, classNumber: 3 })

    expect(isPlacementValid(grid, unit, 'MON', 3, policy, new Set())).toBe(
      false,
    )
  })
})

describe('findCandidateSlots', () => {
  it('빈 그리드에서 모든 슬롯이 후보가 된다', () => {
    const grid = new TimetableGrid()
    const unit = makeUnit()
    const policy = makePolicy()
    const activeDays = ['MON', 'TUE', 'WED', 'THU', 'FRI'] as const

    const candidates = findCandidateSlots(
      grid,
      unit,
      [...activeDays],
      7,
      policy,
      new Set(),
    )

    expect(candidates).toHaveLength(5 * 7) // 5일 × 7교시
  })

  it('차단된 슬롯은 제외된다', () => {
    const grid = new TimetableGrid()
    const unit = makeUnit()
    const policy = makePolicy()
    const blocked = new Set(['teacher-t-1-MON-1', 'teacher-t-1-MON-2'])

    const candidates = findCandidateSlots(
      grid,
      unit,
      ['MON'],
      7,
      policy,
      blocked,
    )

    expect(candidates).toHaveLength(5) // 7교시 - 2 차단 = 5
  })
})

describe('buildBlockedSlots', () => {
  it('출장 이벤트를 교사 차단 슬롯으로 변환한다', () => {
    const events: Array<FixedEvent> = [
      {
        id: 'fe-1',
        type: 'BUSINESS_TRIP',
        description: '출장',
        teacherId: 't-1',
        subjectId: null,
        grade: null,
        classNumber: null,
        day: 'MON',
        period: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const blocked = buildBlockedSlots(events)

    expect(blocked.has('teacher-t-1-MON-1')).toBe(true)
  })

  it('학교 행사를 반 차단 슬롯으로 변환한다', () => {
    const events: Array<FixedEvent> = [
      {
        id: 'fe-2',
        type: 'SCHOOL_EVENT',
        description: '행사',
        teacherId: null,
        subjectId: null,
        grade: 1,
        classNumber: 1,
        day: 'FRI',
        period: 7,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const blocked = buildBlockedSlots(events)

    expect(blocked.has('class-1-1-FRI-7')).toBe(true)
  })
})

describe('expandGradeBlockedSlots', () => {
  it('학년 전체 행사를 반별로 확장한다', () => {
    const blocked = new Set(['grade-1-MON-1'])
    const expanded = expandGradeBlockedSlots(blocked, { 1: 3 })

    expect(expanded.has('class-1-1-MON-1')).toBe(true)
    expect(expanded.has('class-1-2-MON-1')).toBe(true)
    expect(expanded.has('class-1-3-MON-1')).toBe(true)
  })
})
