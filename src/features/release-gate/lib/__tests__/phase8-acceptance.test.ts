import { describe, expect, it } from 'vitest'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell } from '@/entities/timetable'
import { findSubstituteCandidates } from '@/features/find-replacement'
import { autoAssignInvigilators, canEnableExamModeForWeek } from '@/features/manage-exam-mode'

const schoolConfig: SchoolConfig = {
  id: 'school-1',
  gradeCount: 1,
  classCountByGrade: { 1: 1 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: '2026-02-22T00:00:00.000Z',
  updatedAt: '2026-02-22T00:00:00.000Z',
}

const policy: ConstraintPolicy = {
  id: 'policy-1',
  studentMaxConsecutiveSameSubject: 2,
  teacherMaxConsecutiveHours: 4,
  teacherMaxDailyHours: 6,
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
    name: '담임',
    subjectIds: ['subject-1'],
    baseHoursPerWeek: 10,
    homeroom: { grade: 1, classNumber: 1 },
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
  {
    id: 'teacher-3',
    name: '비담임',
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

function makeExamPeriodEvent(): AcademicCalendarEvent {
  return {
    id: 'exam-1',
    eventType: 'EXAM_PERIOD',
    startDate: '2026-02-23',
    endDate: '2026-02-27',
    scopeType: 'SCHOOL',
    scopeValue: null,
    periodOverride: null,
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  }
}

describe('Phase 8 acceptance', () => {
  it('[ACCEPT-08-01] 시험 모드는 EXAM_PERIOD 주차에서만 활성화된다', () => {
    const blocked = canEnableExamModeForWeek({
      weekTag: '2026-W09',
      schoolConfig,
      academicCalendarEvents: [],
    })
    const allowed = canEnableExamModeForWeek({
      weekTag: '2026-W09',
      schoolConfig,
      academicCalendarEvents: [makeExamPeriodEvent()],
    })

    expect(blocked.ok).toBe(false)
    expect(allowed.ok).toBe(true)
  })

  it('[ACCEPT-08-02] 감독 자동 배정은 동일 시간 교사 중복을 만들지 않는다', () => {
    const result = autoAssignInvigilators({
      weekTag: '2026-W09',
      slots: [
        {
          id: 'slot-1',
          weekTag: '2026-W09',
          date: '2026-02-23',
          day: 'MON',
          period: 1,
          grade: 1,
          classNumber: 1,
          subjectId: 'subject-1',
          subjectName: '수학',
          durationMinutes: 50,
          createdAt: '2026-02-22T00:00:00.000Z',
          updatedAt: '2026-02-22T00:00:00.000Z',
        },
        {
          id: 'slot-2',
          weekTag: '2026-W09',
          date: '2026-02-23',
          day: 'MON',
          period: 1,
          grade: 1,
          classNumber: 2,
          subjectId: 'subject-1',
          subjectName: '수학',
          durationMinutes: 50,
          createdAt: '2026-02-22T00:00:00.000Z',
          updatedAt: '2026-02-22T00:00:00.000Z',
        },
      ],
      teachers: [teachers[1]],
      teacherPolicies: [],
      nowIso: '2026-02-22T00:00:00.000Z',
      historicalTeacherLoad: { 'teacher-2': 0 },
    })

    expect(result.assignments.filter((row) => row.status === 'ASSIGNED')).toHaveLength(1)
    expect(result.assignments.filter((row) => row.status === 'UNRESOLVED')).toHaveLength(1)
  })

  it('[ACCEPT-08-03] 대강 추천은 근거를 포함하고 담임 제외 옵션을 반영한다', () => {
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
        teacherPolicies: [],
        fixedEvents: [],
        teachers,
        subjects,
        weekTag: '2026-W09',
        academicCalendarEvents: [],
      },
      substituteLoadByTeacher: new Map([
        ['teacher-2', 3],
        ['teacher-3', 0],
      ]),
    })

    expect(result.candidates.some((candidate) => candidate.substituteTeacherId === 'teacher-2')).toBe(
      false,
    )
    expect(result.candidates[0]?.substituteTeacherId).toBe('teacher-3')
    expect(result.candidates[0]?.ranking.candidateReasons.length).toBeGreaterThan(0)
  })
})
