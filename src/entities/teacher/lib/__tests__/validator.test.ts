import { describe, expect, it } from 'vitest'
import {
  findUnassignedSubjects,
  validateClassCapacity,
  validateHoursConsistency,
} from '../validator'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { SchoolConfig } from '@/entities/school'

const ts = '2024-01-01T00:00:00.000Z'

function makeTeacher(overrides: Partial<Teacher> = {}): Teacher {
  return {
    id: 'teacher-1',
    name: '김교사',
    subjectIds: ['sub-1'],
    baseHoursPerWeek: 18,
    classAssignments: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function makeSchoolConfig(overrides: Partial<SchoolConfig> = {}): SchoolConfig {
  return {
    id: 'config-1',
    gradeCount: 3,
    classCountByGrade: { 1: 2, 2: 2, 3: 2 },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    periodsPerDay: 7,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

describe('validateHoursConsistency', () => {
  it('배정 합계와 기준 시수가 같으면 valid', () => {
    const teacher = makeTeacher({
      baseHoursPerWeek: 6,
      classAssignments: [
        { grade: 1, classNumber: 1, hoursPerWeek: 3 },
        { grade: 1, classNumber: 2, hoursPerWeek: 3 },
      ],
    })
    const result = validateHoursConsistency(teacher)
    expect(result.valid).toBe(true)
    expect(result.assigned).toBe(6)
    expect(result.base).toBe(6)
  })

  it('배정 합계와 기준 시수가 다르면 invalid', () => {
    const teacher = makeTeacher({
      baseHoursPerWeek: 18,
      classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 3 }],
    })
    const result = validateHoursConsistency(teacher)
    expect(result.valid).toBe(false)
    expect(result.assigned).toBe(3)
  })

  it('배정이 없으면 assigned는 0', () => {
    const teacher = makeTeacher({ baseHoursPerWeek: 0 })
    expect(validateHoursConsistency(teacher).valid).toBe(true)
  })
})

describe('validateClassCapacity', () => {
  it('배정 시수가 가용 교시 이하이면 오버플로 없음', () => {
    const teachers = [
      makeTeacher({
        classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 30 }],
      }),
    ]
    const config = makeSchoolConfig({ periodsPerDay: 7 }) // 5*7=35
    expect(validateClassCapacity(teachers, config)).toEqual([])
  })

  it('배정 시수가 가용 교시를 초과하면 오버플로 반환', () => {
    const teachers = [
      makeTeacher({
        id: 't1',
        classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 20 }],
      }),
      makeTeacher({
        id: 't2',
        classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 20 }],
      }),
    ]
    const config = makeSchoolConfig({ periodsPerDay: 7 }) // capacity = 35
    const overflows = validateClassCapacity(teachers, config)
    expect(overflows).toHaveLength(1)
    expect(overflows[0]).toEqual({
      grade: 1,
      classNumber: 1,
      total: 40,
      capacity: 35,
    })
  })
})

describe('findUnassignedSubjects', () => {
  const subject1: Subject = {
    id: 'sub-1',
    name: '수학',
    abbreviation: '수',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  }
  const subject2: Subject = {
    id: 'sub-2',
    name: '영어',
    abbreviation: '영',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  }

  it('모든 과목에 교사가 배정되면 빈 배열 반환', () => {
    const teachers = [makeTeacher({ subjectIds: ['sub-1', 'sub-2'] })]
    expect(findUnassignedSubjects([subject1, subject2], teachers)).toEqual([])
  })

  it('배정되지 않은 과목을 반환한다', () => {
    const teachers = [makeTeacher({ subjectIds: ['sub-1'] })]
    expect(findUnassignedSubjects([subject1, subject2], teachers)).toEqual([
      subject2,
    ])
  })

  it('교사가 없으면 모든 과목을 반환한다', () => {
    expect(findUnassignedSubjects([subject1, subject2], [])).toEqual([
      subject1,
      subject2,
    ])
  })
})
