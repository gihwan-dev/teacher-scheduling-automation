import { describe, expect, it } from 'vitest'
import { predictHourShortageFromCalendarChange } from '../predict-hour-shortage'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { SchoolConfig } from '@/entities/school'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'

const now = '2026-02-22T00:00:00.000Z'

const schoolConfig: SchoolConfig = {
  id: 'config-1',
  gradeCount: 1,
  classCountByGrade: { 1: 1 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: now,
  updatedAt: now,
}

const teachers: Array<Teacher> = [
  {
    id: 't-1',
    name: '김교사',
    subjectIds: ['s-1'],
    baseHoursPerWeek: 35,
    homeroom: null,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 35 }],
    createdAt: now,
    updatedAt: now,
  },
]

function makeSnapshot(cells: Array<TimetableCell>): TimetableSnapshot {
  return {
    id: 'snapshot-1',
    schoolConfigId: 'config-1',
    weekTag: '2026-W08',
    versionNo: 1,
    baseVersionId: null,
    appliedScope: {
      type: 'THIS_WEEK',
      fromWeek: '2026-W08',
      toWeek: null,
    },
    cells,
    score: 80,
    generationTimeMs: 1000,
    createdAt: now,
  }
}

function makeEvent(
  overrides: Partial<AcademicCalendarEvent>,
): AcademicCalendarEvent {
  return {
    id: 'event-1',
    eventType: 'GRADE_EVENT',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    scopeType: 'GRADE',
    scopeValue: '1',
    periodOverride: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function buildCells(
  options: { skip?: Array<string>; fillBlockedSlot?: boolean } = {},
): Array<TimetableCell> {
  const skip = new Set(options.skip ?? [])
  const cells: Array<TimetableCell> = []

  for (const day of schoolConfig.activeDays) {
    for (let period = 1; period <= schoolConfig.periodsPerDay; period++) {
      const key = `${day}-${period}`
      if (skip.has(key)) {
        continue
      }
      cells.push({
        teacherId: 't-1',
        subjectId: 's-1',
        grade: 1,
        classNumber: 1,
        day,
        period,
        isFixed: false,
        status: 'BASE',
      })
    }
  }

  if (options.fillBlockedSlot) {
    cells.push({
      teacherId: 't-1',
      subjectId: 's-1',
      grade: 1,
      classNumber: 1,
      day: 'MON',
      period: 7,
      isFixed: false,
      status: 'BASE',
    })
  }

  return cells
}

describe('predictHourShortageFromCalendarChange', () => {
  it('GRADE_EVENT 추가로 부족 시수가 증가하면 리포트에 포함한다', () => {
    const report = predictHourShortageFromCalendarChange({
      beforeEvents: [],
      afterEvents: [makeEvent({ eventType: 'GRADE_EVENT' })],
      schoolConfig,
      teachers,
      snapshot: makeSnapshot([]),
    })

    expect(report.shortageByClass).toHaveLength(1)
    expect(report.shortageByClass[0].deltaShortage).toBeGreaterThan(0)
  })

  it('SHORTENED_DAY 추가로 부족 시수가 증가한다', () => {
    const report = predictHourShortageFromCalendarChange({
      beforeEvents: [],
      afterEvents: [
        makeEvent({
          eventType: 'SHORTENED_DAY',
          scopeType: 'SCHOOL',
          scopeValue: null,
          periodOverride: 6,
        }),
      ],
      schoolConfig,
      teachers,
      snapshot: makeSnapshot([]),
    })

    expect(report.shortageByClass).toHaveLength(1)
    expect(report.shortageByClass[0].deltaShortage).toBeGreaterThan(0)
  })

  it('빈 슬롯이 있으면 현재 주 보강 추천을 생성한다', () => {
    const report = predictHourShortageFromCalendarChange({
      beforeEvents: [],
      afterEvents: [
        makeEvent({
          eventType: 'SHORTENED_DAY',
          scopeType: 'SCHOOL',
          scopeValue: null,
          periodOverride: 6,
        }),
      ],
      schoolConfig,
      teachers,
      snapshot: makeSnapshot(buildCells({ skip: ['TUE-1'] })),
    })

    expect(report.recommendations[0].message).toContain('현재 주 보강 추천')
  })

  it('빈 슬롯이 없으면 다음 주 보강 추천을 생성한다', () => {
    const report = predictHourShortageFromCalendarChange({
      beforeEvents: [],
      afterEvents: [
        makeEvent({
          eventType: 'SHORTENED_DAY',
          scopeType: 'SCHOOL',
          scopeValue: null,
          periodOverride: 6,
        }),
      ],
      schoolConfig,
      teachers,
      snapshot: makeSnapshot(buildCells({ fillBlockedSlot: true })),
    })

    expect(report.recommendations[0].message).toContain('다음 주 보강')
  })

  it('classAssignments가 비어도 assignments 기반으로 요구 시수를 계산한다', () => {
    const teachersWithAssignmentsOnly: Array<Teacher> = [
      {
        id: 't-2',
        name: '다과목교사',
        subjectIds: ['s-1', 's-2'],
        baseHoursPerWeek: 35,
        assignments: [
          {
            id: 'a-1',
            subjectId: 's-1',
            subjectType: 'CLASS',
            grade: 1,
            classNumber: 1,
            hoursPerWeek: 20,
          },
          {
            id: 'a-2',
            subjectId: 's-2',
            subjectType: 'CLASS',
            grade: 1,
            classNumber: 1,
            hoursPerWeek: 15,
          },
        ],
        homeroom: null,
        classAssignments: [],
        createdAt: now,
        updatedAt: now,
      },
    ]

    const report = predictHourShortageFromCalendarChange({
      beforeEvents: [],
      afterEvents: [
        makeEvent({
          eventType: 'SHORTENED_DAY',
          scopeType: 'SCHOOL',
          scopeValue: null,
          periodOverride: 6,
        }),
      ],
      schoolConfig,
      teachers: teachersWithAssignmentsOnly,
      snapshot: makeSnapshot([]),
    })

    expect(report.shortageByClass).toHaveLength(1)
    expect(report.shortageByClass[0].requiredHours).toBe(35)
    expect(report.shortageByClass[0].deltaShortage).toBe(5)
  })
})
