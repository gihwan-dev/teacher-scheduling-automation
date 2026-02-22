import { beforeEach, describe, expect, it } from 'vitest'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { SchoolConfig } from '@/entities/school'
import type { Teacher } from '@/entities/teacher'
import type { TimetableSnapshot } from '@/entities/timetable'
import { predictHourShortageFromCalendarChange } from '@/features/analyze-schedule-impact'
import { useSetupStore } from '@/features/manage-school-setup'

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

const snapshot: TimetableSnapshot = {
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
  cells: [],
  score: 80,
  generationTimeMs: 1000,
  createdAt: now,
}

function makeShortenedDayEvent(): AcademicCalendarEvent {
  return {
    id: 'event-1',
    eventType: 'SHORTENED_DAY',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    scopeType: 'SCHOOL',
    scopeValue: null,
    periodOverride: 6,
    createdAt: now,
    updatedAt: now,
  }
}

function computeReportFromStore() {
  const state = useSetupStore.getState()
  return predictHourShortageFromCalendarChange({
    beforeEvents: state.baselineAcademicCalendarEvents,
    afterEvents: state.academicCalendarEvents,
    schoolConfig: state.schoolConfig!,
    teachers: state.teachers,
    snapshot: state.latestSnapshot!,
  })
}

beforeEach(() => {
  useSetupStore.setState(useSetupStore.getInitialState(), true)
})

describe('hour shortage report recalculation', () => {
  it('학사일정 변경으로 부족 시수가 증가하면 결과에 포함된다', () => {
    useSetupStore.setState({
      schoolConfig,
      teachers,
      latestSnapshot: snapshot,
      baselineAcademicCalendarEvents: [],
      academicCalendarEvents: [makeShortenedDayEvent()],
    })

    const report = computeReportFromStore()
    expect(report.shortageByClass).toHaveLength(1)
    expect(report.shortageByClass[0].deltaShortage).toBe(5)
  })

  it('학사일정을 되돌리면 부족 시수 리포트가 재계산된다', () => {
    useSetupStore.setState({
      schoolConfig,
      teachers,
      latestSnapshot: snapshot,
      baselineAcademicCalendarEvents: [],
      academicCalendarEvents: [makeShortenedDayEvent()],
    })
    const changedReport = computeReportFromStore()
    expect(changedReport.shortageByClass.length).toBeGreaterThan(0)

    useSetupStore.setState({
      academicCalendarEvents: [],
    })
    const restoredReport = computeReportFromStore()
    expect(restoredReport.shortageByClass).toHaveLength(0)
  })
})
