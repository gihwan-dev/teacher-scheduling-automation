import { describe, expect, it } from 'vitest'
import {
  buildSubstituteLoadByTeacher,
  findSubstituteCandidates,
} from '../substitute-finder'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell } from '@/entities/timetable'
import type { TeacherPolicy } from '@/entities/teacher-policy'

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
  classCountByGrade: { 1: 2 },
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
    name: '담임교사',
    subjectIds: ['subject-1'],
    baseHoursPerWeek: 10,
    homeroom: { grade: 1, classNumber: 1 },
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
  {
    id: 'teacher-3',
    name: '비담임교사',
    subjectIds: ['subject-1'],
    baseHoursPerWeek: 10,
    homeroom: null,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
]

const sourceCell: TimetableCell = {
  teacherId: 'teacher-1',
  subjectId: 'subject-1',
  grade: 1,
  classNumber: 1,
  day: 'MON',
  period: 2,
  isFixed: false,
  status: 'BASE',
}

const teacherPolicies: Array<TeacherPolicy> = []

describe('buildSubstituteLoadByTeacher', () => {
  it('최근 4주 범위 내 레코드만 집계한다', () => {
    const result = buildSubstituteLoadByTeacher({
      weekTag: '2026-W08',
      fairnessWindowWeeks: 4,
      rows: [
        { weekTag: '2026-W04', substituteTeacherId: 'teacher-2' },
        { weekTag: '2026-W05', substituteTeacherId: 'teacher-2' },
        { weekTag: '2026-W08', substituteTeacherId: 'teacher-2' },
      ],
    })

    expect(result.get('teacher-2')).toBe(2)
  })
})

describe('findSubstituteCandidates', () => {
  it('담임 제외 옵션이 켜지면 같은 반 담임 교사를 후보에서 제외한다', () => {
    const result = findSubstituteCandidates({
      sourceCellKey: '1-1-MON-2',
      sourceCell,
      allCells: [sourceCell],
      config: {
        scope: 'SAME_CLASS',
        includeViolating: false,
        maxCandidates: 10,
        searchMode: 'SUBSTITUTE',
        excludeHomeroomTeachers: true,
        fairnessWindowWeeks: 4,
      },
      ctx: {
        schoolConfig,
        constraintPolicy: policy,
        teacherPolicies,
        fixedEvents: [],
        teachers,
        subjects,
        weekTag: '2026-W08',
        academicCalendarEvents: [],
      },
      substituteLoadByTeacher: new Map(),
    })

    expect(
      result.candidates.some((candidate) => candidate.substituteTeacherId === 'teacher-2'),
    ).toBe(false)
    expect(
      result.candidates.some((candidate) => candidate.substituteTeacherId === 'teacher-3'),
    ).toBe(true)
  })
})
