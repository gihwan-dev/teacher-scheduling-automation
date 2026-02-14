import { describe, expect, it } from 'vitest'
import { validateTimetable } from '../validator'
import type { ConstraintPolicy } from '../../model/types'
import type { TimetableCell } from '@/entities/timetable'

const ts = '2024-01-01T00:00:00.000Z'

function makePolicy(overrides: Partial<ConstraintPolicy> = {}): ConstraintPolicy {
  return {
    id: 'policy-1',
    studentMaxConsecutiveSameSubject: 2,
    teacherMaxConsecutiveHours: 4,
    teacherMaxDailyHours: 6,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function makeCell(overrides: Partial<TimetableCell> = {}): TimetableCell {
  return {
    teacherId: 'teacher-1',
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

describe('validateTimetable', () => {
  it('위반 없는 정상 시간표는 빈 배열을 반환한다', () => {
    const cells: Array<TimetableCell> = [
      makeCell({ period: 1 }),
      makeCell({ period: 2, subjectId: 'sub-2' }),
      makeCell({ period: 3 }),
    ]
    const result = validateTimetable(cells, makePolicy())
    expect(result).toEqual([])
  })

  it('교사 충돌: 같은 시간에 2개 반 배정 시 TEACHER_CONFLICT 검출', () => {
    const cells: Array<TimetableCell> = [
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 1, classNumber: 1 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 1, classNumber: 2 }),
    ]
    const result = validateTimetable(cells, makePolicy())
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('TEACHER_CONFLICT')
    expect(result[0].severity).toBe('error')
    expect(result[0].location.teacherId).toBe('teacher-1')
    expect(result[0].location.day).toBe('MON')
    expect(result[0].location.period).toBe(1)
  })

  it('학생 동일과목 연강 초과 시 STUDENT_CONSECUTIVE_EXCEEDED 검출', () => {
    const cells: Array<TimetableCell> = [
      makeCell({ subjectId: 'sub-1', period: 1 }),
      makeCell({ subjectId: 'sub-1', period: 2 }),
      makeCell({ subjectId: 'sub-1', period: 3, teacherId: 'teacher-2' }),
    ]
    const policy = makePolicy({ studentMaxConsecutiveSameSubject: 2 })
    const result = validateTimetable(cells, policy)
    const consecutive = result.filter((v) => v.type === 'STUDENT_CONSECUTIVE_EXCEEDED')
    expect(consecutive).toHaveLength(1)
    expect(consecutive[0].location.subjectId).toBe('sub-1')
    expect(consecutive[0].location.grade).toBe(1)
    expect(consecutive[0].location.classNumber).toBe(1)
  })

  it('교사 연속 수업 초과 시 TEACHER_CONSECUTIVE_EXCEEDED 검출', () => {
    const cells: Array<TimetableCell> = [
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 1, classNumber: 1 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 2, classNumber: 2 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 3, classNumber: 3 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 4, classNumber: 4 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 5, classNumber: 5 }),
    ]
    const policy = makePolicy({ teacherMaxConsecutiveHours: 4 })
    const result = validateTimetable(cells, policy)
    const exceeded = result.filter((v) => v.type === 'TEACHER_CONSECUTIVE_EXCEEDED')
    expect(exceeded).toHaveLength(1)
    expect(exceeded[0].location.teacherId).toBe('teacher-1')
    expect(exceeded[0].location.day).toBe('MON')
  })

  it('교사 일일 시수 초과 시 TEACHER_DAILY_OVERLOAD 검출', () => {
    const cells: Array<TimetableCell> = [
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 1, classNumber: 1 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 2, classNumber: 2 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 3, classNumber: 3 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 5, classNumber: 4 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 6, classNumber: 5 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 7, classNumber: 6 }),
      makeCell({ teacherId: 'teacher-1', day: 'MON', period: 8, classNumber: 7 }),
    ]
    const policy = makePolicy({ teacherMaxDailyHours: 6 })
    const result = validateTimetable(cells, policy)
    const overload = result.filter((v) => v.type === 'TEACHER_DAILY_OVERLOAD')
    expect(overload).toHaveLength(1)
    expect(overload[0].location.teacherId).toBe('teacher-1')
    expect(overload[0].location.day).toBe('MON')
  })
})
