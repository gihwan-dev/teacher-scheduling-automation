import { describe, expect, it } from 'vitest'
import { isCellEditable, validateCellEdit, validateCellMove } from '../edit-validator'
import type { TimetableCell } from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'

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

function makePolicy(overrides: Partial<ConstraintPolicy> = {}): ConstraintPolicy {
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

describe('isCellEditable', () => {
  it('일반 셀은 편집 가능하다', () => {
    expect(isCellEditable(makeCell())).toBe(true)
  })

  it('TEMP_MODIFIED 셀은 편집 가능하다', () => {
    expect(isCellEditable(makeCell({ status: 'TEMP_MODIFIED' }))).toBe(true)
  })

  it('CONFIRMED_MODIFIED 셀은 편집 가능하다', () => {
    expect(isCellEditable(makeCell({ status: 'CONFIRMED_MODIFIED' }))).toBe(true)
  })

  it('isFixed 셀은 편집 불가하다', () => {
    expect(isCellEditable(makeCell({ isFixed: true }))).toBe(false)
  })

  it('LOCKED 셀은 편집 불가하다', () => {
    expect(isCellEditable(makeCell({ status: 'LOCKED' }))).toBe(false)
  })
})

describe('validateCellEdit', () => {
  const policy = makePolicy()
  const teacherPolicies: Array<TeacherPolicy> = []
  const blockedSlots = new Set<string>()

  it('유효한 편집을 허용한다', () => {
    const cells = [
      makeCell({ teacherId: 't-1', day: 'MON', period: 1 }),
    ]
    const result = validateCellEdit(cells, '1-1-MON-1', 't-2', 'sub-2', policy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('교사 충돌 편집을 거부한다', () => {
    const cells = [
      makeCell({ teacherId: 't-1', day: 'MON', period: 1, classNumber: 1 }),
      makeCell({ teacherId: 't-2', day: 'MON', period: 1, classNumber: 2 }),
    ]
    // 1반 1교시를 t-2로 변경 → t-2는 2반 1교시에 이미 배정됨
    const result = validateCellEdit(cells, '1-1-MON-1', 't-2', 'sub-1', policy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'TEACHER_CONFLICT')).toBe(true)
  })

  it('잠긴 셀 편집을 거부한다', () => {
    const cells = [
      makeCell({ status: 'LOCKED', day: 'MON', period: 1 }),
    ]
    const result = validateCellEdit(cells, '1-1-MON-1', 't-2', 'sub-2', policy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'NOT_EDITABLE')).toBe(true)
  })

  it('고정 셀 편집을 거부한다', () => {
    const cells = [
      makeCell({ isFixed: true, day: 'MON', period: 1 }),
    ]
    const result = validateCellEdit(cells, '1-1-MON-1', 't-2', 'sub-2', policy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'NOT_EDITABLE')).toBe(true)
  })

  it('일일 시수 초과를 거부한다', () => {
    // t-2가 MON에 이미 2교시 배정, 일일 최대 2 제한
    const restrictivePolicy = makePolicy({ teacherMaxDailyHours: 2 })
    const cells = [
      makeCell({ teacherId: 't-1', day: 'MON', period: 1, classNumber: 1 }),
      makeCell({ teacherId: 't-2', day: 'MON', period: 2, classNumber: 2 }),
      makeCell({ teacherId: 't-2', day: 'MON', period: 3, classNumber: 3 }),
    ]
    // 1반 1교시를 t-2로 변경 → t-2 일일 3시수(2+1)
    const result = validateCellEdit(cells, '1-1-MON-1', 't-2', 'sub-1', restrictivePolicy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'DAILY_LIMIT')).toBe(true)
  })

  it('차단된 슬롯으로의 편집을 거부한다', () => {
    const cells = [
      makeCell({ teacherId: 't-1', day: 'MON', period: 1 }),
    ]
    const blocked = new Set(['teacher-t-2-MON-1'])
    const result = validateCellEdit(cells, '1-1-MON-1', 't-2', 'sub-1', policy, teacherPolicies, blocked)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'BLOCKED_SLOT')).toBe(true)
  })
})

describe('validateCellMove', () => {
  const policy = makePolicy()
  const teacherPolicies: Array<TeacherPolicy> = []
  const blockedSlots = new Set<string>()

  it('빈 슬롯으로의 이동을 허용한다', () => {
    const cells = [
      makeCell({ teacherId: 't-1', day: 'MON', period: 1 }),
    ]
    const result = validateCellMove(cells, '1-1-MON-1', 'TUE', 2, policy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(true)
  })

  it('이미 점유된 슬롯으로의 이동을 거부한다', () => {
    const cells = [
      makeCell({ teacherId: 't-1', day: 'MON', period: 1 }),
      makeCell({ teacherId: 't-2', subjectId: 'sub-2', day: 'TUE', period: 2 }),
    ]
    const result = validateCellMove(cells, '1-1-MON-1', 'TUE', 2, policy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'SLOT_OCCUPIED')).toBe(true)
  })

  it('고정 셀의 이동을 거부한다', () => {
    const cells = [
      makeCell({ isFixed: true, day: 'MON', period: 1 }),
    ]
    const result = validateCellMove(cells, '1-1-MON-1', 'TUE', 2, policy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'NOT_EDITABLE')).toBe(true)
  })

  it('잠긴 셀의 이동을 거부한다', () => {
    const cells = [
      makeCell({ status: 'LOCKED', day: 'MON', period: 1 }),
    ]
    const result = validateCellMove(cells, '1-1-MON-1', 'TUE', 2, policy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'NOT_EDITABLE')).toBe(true)
  })

  it('존재하지 않는 셀의 이동을 거부한다', () => {
    const result = validateCellMove([], '1-1-MON-1', 'TUE', 2, policy, teacherPolicies, blockedSlots)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'NOT_FOUND')).toBe(true)
  })
})
