import { describe, expect, it } from 'vitest'
import { teacherSchema } from '../schema'

describe('teacherSchema', () => {
  const validTeacher = {
    id: 'teacher-1',
    name: '김교사',
    baseHoursPerWeek: 18,
    assignments: [
      {
        id: 'assign-1',
        subjectId: 'sub-1',
        subjectType: 'CLASS' as const,
        grade: 1,
        classNumber: 1,
        hoursPerWeek: 3,
      },
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

  it('subjectIds가 비어있어도 통과한다', () => {
    expect(
      teacherSchema.safeParse({ ...validTeacher, subjectIds: [] }).success,
    ).toBe(true)
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

  it('CLASS assignment의 grade가 없으면 실패한다', () => {
    expect(
      teacherSchema.safeParse({
        ...validTeacher,
        assignments: [
          {
            id: 'assign-1',
            subjectId: 'sub-1',
            subjectType: 'CLASS',
            grade: null,
            classNumber: 1,
            hoursPerWeek: 3,
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('GRADE assignment에 classNumber가 있으면 실패한다', () => {
    expect(
      teacherSchema.safeParse({
        ...validTeacher,
        assignments: [
          {
            id: 'assign-1',
            subjectId: 'sub-1',
            subjectType: 'GRADE',
            grade: 1,
            classNumber: 1,
            hoursPerWeek: 3,
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('SCHOOL assignment에 grade/classNumber가 있으면 실패한다', () => {
    expect(
      teacherSchema.safeParse({
        ...validTeacher,
        assignments: [
          {
            id: 'assign-1',
            subjectId: 'sub-1',
            subjectType: 'SCHOOL',
            grade: 1,
            classNumber: null,
            hoursPerWeek: 3,
          },
        ],
      }).success,
    ).toBe(false)
  })
})
