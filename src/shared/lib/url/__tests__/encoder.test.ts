import { describe, expect, it } from 'vitest'
import { buildSharePayload, computeFlatIndex } from '../encoder'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableSnapshot } from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'

const schoolConfig: SchoolConfig = {
  id: 'sc-1',
  gradeCount: 2,
  classCountByGrade: { 1: 2, 2: 2 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const subjects: Array<Subject> = [
  { id: 'sub-1', name: '국어', abbreviation: '국', track: 'COMMON', createdAt: '', updatedAt: '' },
  { id: 'sub-2', name: '수학', abbreviation: '수', track: 'COMMON', createdAt: '', updatedAt: '' },
]

const teachers: Array<Teacher> = [
  {
    id: 'tea-1',
    name: '김교사',
    subjectIds: ['sub-1'],
    baseHoursPerWeek: 20,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 5 }],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tea-2',
    name: '이교사',
    subjectIds: ['sub-2'],
    baseHoursPerWeek: 18,
    classAssignments: [{ grade: 1, classNumber: 2, hoursPerWeek: 4 }],
    createdAt: '',
    updatedAt: '',
  },
]

const snapshot: TimetableSnapshot = {
  id: 'snap-1',
  schoolConfigId: 'sc-1',
  cells: [
    {
      teacherId: 'tea-1',
      subjectId: 'sub-1',
      grade: 1,
      classNumber: 1,
      day: 'MON',
      period: 1,
      isFixed: false,
      status: 'BASE',
    },
    {
      teacherId: 'tea-2',
      subjectId: 'sub-2',
      grade: 1,
      classNumber: 2,
      day: 'TUE',
      period: 3,
      isFixed: true,
      status: 'LOCKED',
    },
  ],
  score: 85.5,
  generationTimeMs: 1200,
  createdAt: '2024-01-01T00:00:00.000Z',
}

const constraintPolicy: ConstraintPolicy = {
  id: 'cp-1',
  studentMaxConsecutiveSameSubject: 2,
  teacherMaxConsecutiveHours: 4,
  teacherMaxDailyHours: 6,
  createdAt: '',
  updatedAt: '',
}

const teacherPolicies: Array<TeacherPolicy> = [
  {
    id: 'tp-1',
    teacherId: 'tea-1',
    avoidanceSlots: [{ day: 'FRI', period: 7 }],
    timePreference: 'MORNING',
    maxConsecutiveHoursOverride: 3,
    maxDailyHoursOverride: null,
    createdAt: '',
    updatedAt: '',
  },
]

describe('buildSharePayload', () => {
  it('올바른 스키마 버전을 설정한다', () => {
    const payload = buildSharePayload(
      schoolConfig, subjects, teachers, snapshot, constraintPolicy, teacherPolicies,
    )
    expect(payload.v).toBe(1)
  })

  it('메타 정보를 올바르게 인코딩한다', () => {
    const payload = buildSharePayload(
      schoolConfig, subjects, teachers, snapshot, constraintPolicy, teacherPolicies,
    )
    expect(payload.meta).toEqual({
      score: 85.5,
      genMs: 1200,
      ts: '2024-01-01T00:00:00.000Z',
    })
  })

  it('학교 설정을 컴팩트 형태로 인코딩한다', () => {
    const payload = buildSharePayload(
      schoolConfig, subjects, teachers, snapshot, constraintPolicy, teacherPolicies,
    )
    expect(payload.school).toEqual({
      g: 2,
      c: { 1: 2, 2: 2 },
      d: [0, 1, 2, 3, 4], // MON~FRI
      p: 7,
    })
  })

  it('과목을 인덱스 기반으로 인코딩한다', () => {
    const payload = buildSharePayload(
      schoolConfig, subjects, teachers, snapshot, constraintPolicy, teacherPolicies,
    )
    expect(payload.subjects).toEqual([
      { n: '국어', a: '국', t: 0 },
      { n: '수학', a: '수', t: 0 },
    ])
  })

  it('교사의 subject 참조를 인덱스로 변환한다', () => {
    const payload = buildSharePayload(
      schoolConfig, subjects, teachers, snapshot, constraintPolicy, teacherPolicies,
    )
    expect(payload.teachers[0].s).toEqual([0]) // sub-1 → index 0
    expect(payload.teachers[1].s).toEqual([1]) // sub-2 → index 1
  })

  it('셀의 flags bitfield를 올바르게 설정한다', () => {
    const payload = buildSharePayload(
      schoolConfig, subjects, teachers, snapshot, constraintPolicy, teacherPolicies,
    )
    // cell 0: BASE(0), isFixed=false → (0 << 1) | 0 = 0
    expect(payload.grid[0].f).toBe(0)
    // cell 1: LOCKED(3), isFixed=true → (3 << 1) | 1 = 7
    expect(payload.grid[1].f).toBe(7)
  })

  it('교사 정책의 회피 슬롯을 인덱스 기반으로 인코딩한다', () => {
    const payload = buildSharePayload(
      schoolConfig, subjects, teachers, snapshot, constraintPolicy, teacherPolicies,
    )
    expect(payload.teacherPolicies[0].av).toEqual([[4, 7]]) // FRI=4, period=7
    expect(payload.teacherPolicies[0].tp).toBe(0) // MORNING
    expect(payload.teacherPolicies[0].mco).toBe(3)
    expect(payload.teacherPolicies[0].mdo).toBeNull()
  })
})

describe('computeFlatIndex', () => {
  const activeDayIndices = [0, 1, 2, 3, 4] // MON~FRI

  it('grade 1, class 1, MON, period 1 → 0', () => {
    expect(
      computeFlatIndex(1, 1, 'MON', 1, schoolConfig, activeDayIndices),
    ).toBe(0)
  })

  it('grade 1, class 1, MON, period 7 → 6', () => {
    expect(
      computeFlatIndex(1, 1, 'MON', 7, schoolConfig, activeDayIndices),
    ).toBe(6)
  })

  it('grade 1, class 1, TUE, period 1 → 7', () => {
    expect(
      computeFlatIndex(1, 1, 'TUE', 1, schoolConfig, activeDayIndices),
    ).toBe(7)
  })

  it('grade 1, class 2, MON, period 1 → 35', () => {
    // maxClass=2, slotsPerClass=5*7=35 → (0*2+1)*35 + 0 + 0 = 35
    expect(
      computeFlatIndex(1, 2, 'MON', 1, schoolConfig, activeDayIndices),
    ).toBe(35)
  })

  it('grade 2, class 1, MON, period 1 → 70', () => {
    // (1*2+0)*35 = 70
    expect(
      computeFlatIndex(2, 1, 'MON', 1, schoolConfig, activeDayIndices),
    ).toBe(70)
  })
})
