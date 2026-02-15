import { describe, expect, it } from 'vitest'
import { teacherSchema } from '../schema'

describe('teacherSchema', () => {
  const validTeacher = {
    id: 'teacher-1',
    name: '김교사',
    subjectIds: ['sub-1'],
    baseHoursPerWeek: 18,
    classAssignments: [
      { grade: 1, classNumber: 1, hoursPerWeek: 3 },
      { grade: 1, classNumber: 2, hoursPerWeek: 3 },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('유효한 교사를 통과시킨다', () => {
    expect(teacherSchema.safeParse(validTeacher).success).toBe(true)
  })

  it('name이 비어있으면 실패한다', () => {
    expect(teacherSchema.safeParse({ ...validTeacher, name: '' }).success).toBe(
      false,
    )
  })

  it('subjectIds가 비어있으면 실패한다', () => {
    expect(
      teacherSchema.safeParse({ ...validTeacher, subjectIds: [] }).success,
    ).toBe(false)
  })

  it('classAssignments가 비어있어도 통과한다', () => {
    expect(
      teacherSchema.safeParse({ ...validTeacher, classAssignments: [] })
        .success,
    ).toBe(true)
  })

  it('baseHoursPerWeek가 음수이면 실패한다', () => {
    expect(
      teacherSchema.safeParse({ ...validTeacher, baseHoursPerWeek: -1 })
        .success,
    ).toBe(false)
  })

  it('classAssignment의 grade가 0이면 실패한다', () => {
    expect(
      teacherSchema.safeParse({
        ...validTeacher,
        classAssignments: [{ grade: 0, classNumber: 1, hoursPerWeek: 3 }],
      }).success,
    ).toBe(false)
  })

  it('classAssignment의 grade가 4이면 실패한다', () => {
    expect(
      teacherSchema.safeParse({
        ...validTeacher,
        classAssignments: [{ grade: 4, classNumber: 1, hoursPerWeek: 3 }],
      }).success,
    ).toBe(false)
  })
})
