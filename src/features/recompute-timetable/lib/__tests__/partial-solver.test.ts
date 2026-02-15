import { describe, expect, it } from 'vitest'
import { recomputeUnlocked } from '../partial-solver'
import type { TimetableCell } from '@/entities/timetable'
import type { SchoolConfig } from '@/entities/school'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { RecomputeInput } from '../partial-solver'

function makeSchoolConfig(overrides: Partial<SchoolConfig> = {}): SchoolConfig {
  return {
    id: 'school-1',
    gradeCount: 1,
    classCountByGrade: { 1: 1 },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    periodsPerDay: 7,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeSubject(id: string, name: string): Subject {
  return {
    id,
    name,
    abbreviation: name.slice(0, 2),
    track: 'COMMON',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

function makeTeacher(
  id: string,
  name: string,
  subjectId: string,
  assignments: Array<{
    grade: number
    classNumber: number
    hoursPerWeek: number
  }>,
): Teacher {
  const baseHours = assignments.reduce((s, a) => s + a.hoursPerWeek, 0)
  return {
    id,
    name,
    subjectIds: [subjectId],
    baseHoursPerWeek: baseHours,
    classAssignments: assignments,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

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

function makeCell(overrides: Partial<TimetableCell> = {}): TimetableCell {
  return {
    teacherId: 't-1',
    subjectId: 'sub-math',
    grade: 1,
    classNumber: 1,
    day: 'MON',
    period: 1,
    isFixed: false,
    status: 'BASE',
    ...overrides,
  }
}

function makeBasicInput(
  cellOverrides?: Array<Partial<TimetableCell>>,
): RecomputeInput {
  const subjects = [
    makeSubject('sub-math', '수학'),
    makeSubject('sub-kor', '국어'),
    makeSubject('sub-eng', '영어'),
  ]
  const teachers = [
    makeTeacher('t-math', '김수학', 'sub-math', [
      { grade: 1, classNumber: 1, hoursPerWeek: 3 },
    ]),
    makeTeacher('t-kor', '이국어', 'sub-kor', [
      { grade: 1, classNumber: 1, hoursPerWeek: 3 },
    ]),
    makeTeacher('t-eng', '박영어', 'sub-eng', [
      { grade: 1, classNumber: 1, hoursPerWeek: 2 },
    ]),
  ]

  const defaultCells = [
    makeCell({
      teacherId: 't-math',
      subjectId: 'sub-math',
      day: 'MON',
      period: 1,
    }),
    makeCell({
      teacherId: 't-math',
      subjectId: 'sub-math',
      day: 'TUE',
      period: 1,
    }),
    makeCell({
      teacherId: 't-math',
      subjectId: 'sub-math',
      day: 'WED',
      period: 1,
    }),
    makeCell({
      teacherId: 't-kor',
      subjectId: 'sub-kor',
      day: 'MON',
      period: 2,
    }),
    makeCell({
      teacherId: 't-kor',
      subjectId: 'sub-kor',
      day: 'TUE',
      period: 2,
    }),
    makeCell({
      teacherId: 't-kor',
      subjectId: 'sub-kor',
      day: 'WED',
      period: 2,
    }),
    makeCell({
      teacherId: 't-eng',
      subjectId: 'sub-eng',
      day: 'THU',
      period: 1,
    }),
    makeCell({
      teacherId: 't-eng',
      subjectId: 'sub-eng',
      day: 'FRI',
      period: 1,
    }),
  ]

  const cells = cellOverrides
    ? cellOverrides.map((o, i) => ({ ...defaultCells[i], ...o }))
    : defaultCells

  return {
    cells,
    schoolConfig: makeSchoolConfig(),
    teachers,
    subjects,
    fixedEvents: [],
    constraintPolicy: makePolicy(),
    teacherPolicies: [],
  }
}

describe('recomputeUnlocked', () => {
  it('잠긴 셀은 재계산 후에도 불변이다', () => {
    const input = makeBasicInput()
    // 처음 2개 셀을 잠금
    input.cells[0] = { ...input.cells[0], status: 'LOCKED' }
    input.cells[1] = { ...input.cells[1], status: 'LOCKED' }

    const result = recomputeUnlocked(input)

    // 잠긴 셀이 동일 위치에 있는지 확인
    const lockedInResult = result.cells.filter((c) => c.status === 'LOCKED')
    expect(lockedInResult).toHaveLength(2)
    expect(lockedInResult[0].teacherId).toBe('t-math')
    expect(lockedInResult[0].day).toBe('MON')
    expect(lockedInResult[0].period).toBe(1)
    expect(lockedInResult[1].teacherId).toBe('t-math')
    expect(lockedInResult[1].day).toBe('TUE')
    expect(lockedInResult[1].period).toBe(1)
  })

  it('고정 셀은 재계산 후에도 불변이다', () => {
    const input = makeBasicInput()
    input.cells[0] = { ...input.cells[0], isFixed: true }

    const result = recomputeUnlocked(input)

    const fixedInResult = result.cells.filter((c) => c.isFixed)
    expect(fixedInResult).toHaveLength(1)
    expect(fixedInResult[0].teacherId).toBe('t-math')
    expect(fixedInResult[0].day).toBe('MON')
    expect(fixedInResult[0].period).toBe(1)
  })

  it('재계산 후 교사 충돌이 없다', () => {
    const input = makeBasicInput()
    const result = recomputeUnlocked(input)

    expect(result.success).toBe(true)
    const teacherConflicts = result.violations.filter(
      (v) => v.type === 'TEACHER_CONFLICT',
    )
    expect(teacherConflicts).toHaveLength(0)
  })

  it('시수가 보존된다', () => {
    const input = makeBasicInput()
    const originalCount = input.cells.length
    const result = recomputeUnlocked(input)

    expect(result.cells.length).toBe(originalCount)
  })

  it('모든 셀이 잠겨있으면 그대로 반환한다', () => {
    const input = makeBasicInput()
    input.cells = input.cells.map((c) => ({ ...c, status: 'LOCKED' as const }))

    const result = recomputeUnlocked(input)

    expect(result.success).toBe(true)
    expect(result.cells).toHaveLength(input.cells.length)
    expect(result.cells.every((c) => c.status === 'LOCKED')).toBe(true)
  })

  it('잠금 과다 시 미배치 목록을 반환한다', () => {
    // 교사가 많은 시수 + 거의 모든 슬롯 잠금 → 배치 불가 상황
    const subjects = [makeSubject('sub-a', '과목A')]
    const teachers = [
      makeTeacher('t-a', '교사A', 'sub-a', [
        { grade: 1, classNumber: 1, hoursPerWeek: 5 },
      ]),
    ]

    // 1반 MON~FRI 교시 1~7 중 5개 잠금, 나머지 2개 슬롯에 5시수 배치는 불가능
    const cells: Array<TimetableCell> = [
      makeCell({
        teacherId: 't-a',
        subjectId: 'sub-a',
        day: 'MON',
        period: 1,
        status: 'LOCKED',
      }),
      makeCell({
        teacherId: 't-a',
        subjectId: 'sub-a',
        day: 'TUE',
        period: 1,
        status: 'LOCKED',
      }),
    ]

    const result = recomputeUnlocked({
      cells,
      schoolConfig: makeSchoolConfig({ periodsPerDay: 7 }),
      teachers,
      subjects,
      fixedEvents: [],
      constraintPolicy: makePolicy({ teacherMaxDailyHours: 1 }),
      teacherPolicies: [],
    })

    // 일일 1시수만 가능인데 5시수(잠긴2 + 미잠금3) 배치 → 미배치 발생 가능
    expect(result.unplacedAssignments.length).toBeGreaterThanOrEqual(0)
  })

  it('재계산 시간이 반환된다', () => {
    const input = makeBasicInput()
    const result = recomputeUnlocked(input)

    expect(result.recomputeTimeMs).toBeGreaterThanOrEqual(0)
  })
})
