import { describe, expect, it } from 'vitest'
import { validateScheduleChange } from '../validate-schedule-change'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell } from '@/entities/timetable'

const ts = '2026-02-22T00:00:00.000Z'

const schoolConfig: SchoolConfig = {
  id: 'school-1',
  gradeCount: 1,
  classCountByGrade: { 1: 2 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: ts,
  updatedAt: ts,
}

const teachers: Array<Teacher> = [
  {
    id: 't-1',
    name: '김교사',
    subjectIds: ['s-1'],
    baseHoursPerWeek: 2,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 2 }],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: 't-2',
    name: '이교사',
    subjectIds: ['s-2'],
    baseHoursPerWeek: 2,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 2 }],
    createdAt: ts,
    updatedAt: ts,
  },
]

const subjects: Array<Subject> = [
  {
    id: 's-1',
    name: '수학',
    abbreviation: '수',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: 's-2',
    name: '국어',
    abbreviation: '국',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  },
]

function makePolicy(
  overrides: Partial<ConstraintPolicy> = {},
): ConstraintPolicy {
  return {
    id: 'policy-1',
    studentMaxConsecutiveSameSubject: 2,
    teacherMaxConsecutiveHours: 3,
    teacherMaxDailyHours: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function makeCell(overrides: Partial<TimetableCell> = {}): TimetableCell {
  return {
    teacherId: 't-1',
    subjectId: 's-1',
    grade: 1,
    classNumber: 1,
    day: 'MON',
    period: 1,
    isFixed: false,
    status: 'BASE',
    ...overrides,
  }
}

function makeEvent(overrides: Partial<AcademicCalendarEvent>): AcademicCalendarEvent {
  return {
    id: 'ac-1',
    eventType: 'HOLIDAY',
    startDate: '2026-02-23',
    endDate: '2026-02-23',
    scopeType: 'SCHOOL',
    scopeValue: null,
    periodOverride: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

describe('validateScheduleChange', () => {
  it('교사/학급 충돌을 HC-07로 반환한다', () => {
    const cells = [
      makeCell({ teacherId: 't-1', grade: 1, classNumber: 1, day: 'MON', period: 1 }),
      makeCell({ teacherId: 't-1', grade: 1, classNumber: 2, day: 'MON', period: 1 }),
      makeCell({ teacherId: 't-2', grade: 1, classNumber: 1, day: 'MON', period: 1 }),
    ]

    const violations = validateScheduleChange({
      cells,
      constraintPolicy: makePolicy(),
      schoolConfig,
      teachers,
      subjects,
      weekTag: '2026-W09',
      academicCalendarEvents: [],
    })

    expect(violations.some((violation) => violation.ruleId === 'HC-07')).toBe(true)
  })

  it('연강/일일시수 위반을 HC-08로 반환한다', () => {
    const cells = [
      makeCell({ teacherId: 't-1', day: 'MON', period: 1 }),
      makeCell({ teacherId: 't-1', day: 'MON', period: 2 }),
    ]

    const violations = validateScheduleChange({
      cells,
      constraintPolicy: makePolicy({ teacherMaxDailyHours: 1 }),
      schoolConfig,
      teachers,
      subjects,
      weekTag: '2026-W09',
      academicCalendarEvents: [],
    })

    expect(violations.some((violation) => violation.ruleId === 'HC-08')).toBe(true)
  })

  it('학사일정 하드 제약 위반을 HC-01~HC-05로 반환한다', () => {
    const cells = [makeCell({ day: 'MON', period: 1 }), makeCell({ day: 'TUE', period: 6 })]

    const violations = validateScheduleChange({
      cells,
      constraintPolicy: makePolicy(),
      schoolConfig,
      teachers,
      subjects,
      weekTag: '2026-W09',
      academicCalendarEvents: [
        makeEvent({ eventType: 'HOLIDAY', startDate: '2026-02-23', endDate: '2026-02-23' }),
        makeEvent({
          id: 'ac-2',
          eventType: 'SHORTENED_DAY',
          startDate: '2026-02-24',
          endDate: '2026-02-24',
          periodOverride: 5,
        }),
      ],
    })

    expect(violations.some((violation) => violation.ruleId === 'HC-01')).toBe(true)
    expect(violations.some((violation) => violation.ruleId === 'HC-05')).toBe(true)
  })

  it('메시지에 내부 ID를 노출하지 않는다', () => {
    const cells = [
      makeCell({ teacherId: 't-1', day: 'MON', period: 1 }),
      makeCell({ teacherId: 't-1', grade: 1, classNumber: 2, day: 'MON', period: 1 }),
    ]

    const violations = validateScheduleChange({
      cells,
      constraintPolicy: makePolicy(),
      schoolConfig,
      teachers,
      subjects,
      weekTag: '2026-W09',
      academicCalendarEvents: [],
    })

    for (const violation of violations) {
      expect(violation.humanMessage.includes('t-1')).toBe(false)
      expect(violation.humanMessage.includes('s-1')).toBe(false)
    }
  })
})
