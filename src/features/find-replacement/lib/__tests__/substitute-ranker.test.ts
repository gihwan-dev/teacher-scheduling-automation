import { describe, expect, it } from 'vitest'
import { rankSubstituteCandidate } from '../substitute-ranker'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell } from '@/entities/timetable'

const policy: ConstraintPolicy = {
  id: 'policy-1',
  studentMaxConsecutiveSameSubject: 2,
  teacherMaxConsecutiveHours: 4,
  teacherMaxDailyHours: 6,
  createdAt: '2026-02-22T00:00:00.000Z',
  updatedAt: '2026-02-22T00:00:00.000Z',
}

const schoolConfig: SchoolConfig = {
  id: 'school-1',
  gradeCount: 1,
  classCountByGrade: { 1: 1 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: '2026-02-22T00:00:00.000Z',
  updatedAt: '2026-02-22T00:00:00.000Z',
}

const subjects: Array<Subject> = [
  {
    id: 'subject-1',
    name: '수학',
    abbreviation: '수',
    track: 'COMMON',
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
]

const teachers: Array<Teacher> = [
  {
    id: 'teacher-1',
    name: '원담당',
    subjectIds: ['subject-1'],
    baseHoursPerWeek: 10,
    homeroom: null,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
  {
    id: 'teacher-2',
    name: '대강A',
    subjectIds: ['subject-1'],
    baseHoursPerWeek: 10,
    homeroom: null,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
  {
    id: 'teacher-3',
    name: '대강B',
    subjectIds: ['subject-1'],
    baseHoursPerWeek: 10,
    homeroom: null,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
]

const allCells: Array<TimetableCell> = [
  {
    teacherId: 'teacher-1',
    subjectId: 'subject-1',
    grade: 1,
    classNumber: 1,
    day: 'MON',
    period: 1,
    isFixed: false,
    status: 'BASE',
  },
]

describe('rankSubstituteCandidate', () => {
  it('최근 4주 누적 대강이 적을수록 공정성 점수가 높다', () => {
    const lowLoad = rankSubstituteCandidate({
      allCells,
      afterCells: [
        {
          ...allCells[0],
          teacherId: 'teacher-2',
          status: 'TEMP_MODIFIED',
        },
      ],
      constraintPolicy: policy,
      teacherPolicies: [],
      schoolConfig,
      teachers,
      subjects,
      weekTag: '2026-W08',
      academicCalendarEvents: [],
      substituteTeacher: teachers[1],
      substituteLoadByTeacher: new Map([
        ['teacher-2', 0],
        ['teacher-3', 5],
      ]),
      fairnessWindowWeeks: 4,
    })

    const highLoad = rankSubstituteCandidate({
      allCells,
      afterCells: [
        {
          ...allCells[0],
          teacherId: 'teacher-3',
          status: 'TEMP_MODIFIED',
        },
      ],
      constraintPolicy: policy,
      teacherPolicies: [],
      schoolConfig,
      teachers,
      subjects,
      weekTag: '2026-W08',
      academicCalendarEvents: [],
      substituteTeacher: teachers[2],
      substituteLoadByTeacher: new Map([
        ['teacher-2', 0],
        ['teacher-3', 5],
      ]),
      fairnessWindowWeeks: 4,
    })

    expect(lowLoad.fairnessScore).toBeGreaterThan(highLoad.fairnessScore)
    expect(lowLoad.totalRank).toBeGreaterThan(highLoad.totalRank)
    expect(lowLoad.candidateReasons).toContain('과목 적합')
    expect(lowLoad.candidateReasons.some((reason) => reason.includes('최근 4주'))).toBe(
      true,
    )
  })
})
