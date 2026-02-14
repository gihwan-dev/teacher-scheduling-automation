import { describe, expect, it } from 'vitest'
import { generateTimetable } from '../solver'
import type { GenerationInput } from '../../model/types'
import type { SchoolConfig } from '@/entities/school'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { FixedEvent } from '@/entities/fixed-event'
import type { ConstraintPolicy } from '@/entities/constraint-policy'

function makeSchoolConfig(overrides: Partial<SchoolConfig> = {}): SchoolConfig {
  return {
    id: 'school-1',
    gradeCount: 1,
    classCountByGrade: { 1: 2 },
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
  assignments: Array<{ grade: number; classNumber: number; hoursPerWeek: number }>,
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

function makeInput(overrides: Partial<GenerationInput> = {}): GenerationInput {
  const subjects = [
    makeSubject('sub-math', '수학'),
    makeSubject('sub-kor', '국어'),
    makeSubject('sub-eng', '영어'),
    makeSubject('sub-sci', '과학'),
    makeSubject('sub-soc', '사회'),
  ]

  const teachers = [
    makeTeacher('t-math', '김수학', 'sub-math', [
      { grade: 1, classNumber: 1, hoursPerWeek: 4 },
      { grade: 1, classNumber: 2, hoursPerWeek: 4 },
    ]),
    makeTeacher('t-kor', '이국어', 'sub-kor', [
      { grade: 1, classNumber: 1, hoursPerWeek: 4 },
      { grade: 1, classNumber: 2, hoursPerWeek: 4 },
    ]),
    makeTeacher('t-eng', '박영어', 'sub-eng', [
      { grade: 1, classNumber: 1, hoursPerWeek: 3 },
      { grade: 1, classNumber: 2, hoursPerWeek: 3 },
    ]),
    makeTeacher('t-sci', '최과학', 'sub-sci', [
      { grade: 1, classNumber: 1, hoursPerWeek: 3 },
      { grade: 1, classNumber: 2, hoursPerWeek: 3 },
    ]),
    makeTeacher('t-soc', '정사회', 'sub-soc', [
      { grade: 1, classNumber: 1, hoursPerWeek: 3 },
      { grade: 1, classNumber: 2, hoursPerWeek: 3 },
    ]),
  ]

  return {
    schoolConfig: makeSchoolConfig(),
    teachers,
    subjects,
    fixedEvents: [],
    constraintPolicy: makePolicy(),
    ...overrides,
  }
}

describe('generateTimetable', () => {
  it('기본 데이터로 생성 성공하고 필수 제약 위반이 없다', () => {
    const input = makeInput()
    const result = generateTimetable(input)

    expect(result.success).toBe(true)
    expect(result.snapshot).not.toBeNull()
    expect(result.unplacedAssignments).toHaveLength(0)

    // 필수 제약(error) 위반 없음
    const errors = result.violations.filter((v) => v.severity === 'error')
    expect(errors).toHaveLength(0)
  })

  it('교사 충돌 없이 배치된다 (동일 교시에 교사 중복 없음)', () => {
    const input = makeInput()
    const result = generateTimetable(input)

    expect(result.snapshot).not.toBeNull()
    const cells = result.snapshot!.cells

    // 교사-요일-교시 조합이 유일한지 확인
    const teacherSlots = new Set<string>()
    for (const cell of cells) {
      const key = `${cell.teacherId}-${cell.day}-${cell.period}`
      expect(teacherSlots.has(key)).toBe(false)
      teacherSlots.add(key)
    }
  })

  it('반별 교시 중복 없이 배치된다', () => {
    const input = makeInput()
    const result = generateTimetable(input)

    expect(result.snapshot).not.toBeNull()
    const cells = result.snapshot!.cells

    // 반-요일-교시 조합이 유일한지 확인
    const classSlots = new Set<string>()
    for (const cell of cells) {
      const key = `${cell.grade}-${cell.classNumber}-${cell.day}-${cell.period}`
      expect(classSlots.has(key)).toBe(false)
      classSlots.add(key)
    }
  })

  it('교사별 배정 시수가 정확히 충족된다', () => {
    const input = makeInput()
    const result = generateTimetable(input)

    expect(result.snapshot).not.toBeNull()
    const cells = result.snapshot!.cells

    // 교사별 반별 배정 시수 확인
    for (const teacher of input.teachers) {
      for (const assignment of teacher.classAssignments) {
        const count = cells.filter(
          (c) =>
            c.teacherId === teacher.id &&
            c.grade === assignment.grade &&
            c.classNumber === assignment.classNumber,
        ).length
        expect(count).toBe(assignment.hoursPerWeek)
      }
    }
  })

  it('고정 이벤트가 결과에 그대로 포함된다', () => {
    const fixedEvents: Array<FixedEvent> = [
      {
        id: 'fe-1',
        type: 'FIXED_CLASS',
        description: '수학 고정',
        teacherId: 't-math',
        subjectId: 'sub-math',
        grade: 1,
        classNumber: 1,
        day: 'MON',
        period: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const input = makeInput({ fixedEvents })
    const result = generateTimetable(input)

    expect(result.success).toBe(true)
    expect(result.snapshot).not.toBeNull()

    const fixedCell = result.snapshot!.cells.find(
      (c) =>
        c.teacherId === 't-math' &&
        c.grade === 1 &&
        c.classNumber === 1 &&
        c.day === 'MON' &&
        c.period === 1,
    )
    expect(fixedCell).toBeDefined()
    expect(fixedCell!.isFixed).toBe(true)
  })

  it('출장 교사가 해당 시간에 배정되지 않는다', () => {
    const fixedEvents: Array<FixedEvent> = [
      {
        id: 'fe-trip',
        type: 'BUSINESS_TRIP',
        description: '김수학 월요일 1교시 출장',
        teacherId: 't-math',
        subjectId: null,
        grade: null,
        classNumber: null,
        day: 'MON',
        period: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const input = makeInput({ fixedEvents })
    const result = generateTimetable(input)

    expect(result.success).toBe(true)
    const blockedCell = result.snapshot!.cells.find(
      (c) => c.teacherId === 't-math' && c.day === 'MON' && c.period === 1,
    )
    expect(blockedCell).toBeUndefined()
  })

  it('실패 시 원인 사유와 완화 제안을 반환한다', () => {
    // 교사 시수 > 가용 교시 설정 (일일 최대 2시수로 제한, 총 8시수 → 5일×2=10 가능하지만 2반이면 부족)
    const subjects = [makeSubject('sub-all', '전과목')]
    const teachers = [
      makeTeacher('t-one', '김교사', 'sub-all', [
        { grade: 1, classNumber: 1, hoursPerWeek: 15 },
        { grade: 1, classNumber: 2, hoursPerWeek: 15 },
      ]),
    ]

    const input = makeInput({
      schoolConfig: makeSchoolConfig({
        classCountByGrade: { 1: 2 },
        periodsPerDay: 7,
      }),
      teachers,
      subjects,
      constraintPolicy: makePolicy({ teacherMaxDailyHours: 3 }),
    })

    const result = generateTimetable(input)

    // 30시수를 5일 × 3시수/일 = 15슬롯에 넣으려면 실패
    expect(result.success).toBe(false)
    expect(result.unplacedAssignments.length).toBeGreaterThan(0)
    expect(result.suggestions.length).toBeGreaterThan(0)
  })

  it('통계 정보가 올바르게 반환된다', () => {
    const input = makeInput()
    const result = generateTimetable(input)

    expect(result.stats.totalSlots).toBe(2 * 5 * 7) // 2반 × 5일 × 7교시
    expect(result.stats.filledSlots).toBeGreaterThan(0)
    expect(result.stats.generationTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('3학년 5반 규모에서도 생성 성공한다', () => {
    const subjects = [
      makeSubject('sub-math', '수학'),
      makeSubject('sub-kor', '국어'),
      makeSubject('sub-eng', '영어'),
      makeSubject('sub-sci', '과학'),
      makeSubject('sub-soc', '사회'),
    ]

    const teachers: Array<Teacher> = []
    const grades = [1, 2, 3]
    const classesPerGrade = 5

    // 각 과목별 교사 3명 (학년별 1명), 각 교사가 5반 × 3시수
    let teacherIdx = 0
    for (const subjectId of subjects.map((s) => s.id)) {
      for (const grade of grades) {
        teacherIdx++
        const assignments = []
        for (let cls = 1; cls <= classesPerGrade; cls++) {
          assignments.push({ grade, classNumber: cls, hoursPerWeek: 3 })
        }
        teachers.push(
          makeTeacher(`t-${teacherIdx}`, `교사${teacherIdx}`, subjectId, assignments),
        )
      }
    }

    const input = makeInput({
      schoolConfig: makeSchoolConfig({
        gradeCount: 3,
        classCountByGrade: { 1: 5, 2: 5, 3: 5 },
      }),
      teachers,
      subjects,
    })

    const result = generateTimetable(input)

    expect(result.success).toBe(true)
    expect(result.unplacedAssignments).toHaveLength(0)

    // 교사 충돌 없음 확인
    const errors = result.violations.filter((v) => v.severity === 'error')
    expect(errors).toHaveLength(0)
  })
})
