import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../database'
import {
  loadAcademicCalendarEvents,
  loadAcademicCalendarEventsByRange,
  loadAllSetupData,
  loadChangeEventsByWeek,
  loadFixedEvents,
  loadImpactAnalysisReport,
  loadImpactAnalysisReportsBySnapshot,
  loadLatestSnapshotByWeek,
  loadSchoolConfig,
  loadSnapshotBySelection,
  loadSnapshotVersion,
  loadSnapshotWeeks,
  loadSnapshotsByWeek,
  loadSubjects,
  loadTeachers,
  saveAcademicCalendarEvents,
  saveAllSetupData,
  saveChangeEvent,
  saveFixedEvents,
  saveImpactAnalysisReport,
  saveNextSnapshotVersion,
  saveScheduleTransaction,
  saveSchoolConfig,
  saveSubjects,
  saveTeachers,
  saveTimetableSnapshot,
  updateScheduleTransaction,
} from '../repository'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ImpactAnalysisReport } from '@/entities/impact-analysis'
import type { SchoolConfig } from '@/entities/school'
import type { ScheduleTransaction } from '@/entities/schedule-transaction'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'
import type { TimetableSnapshot } from '@/entities/timetable'

const ts = '2024-01-01T00:00:00.000Z'

const sampleSchoolConfig: SchoolConfig = {
  id: 'config-1',
  gradeCount: 3,
  classCountByGrade: { 1: 10, 2: 10, 3: 9 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: ts,
  updatedAt: ts,
}

const sampleSubjects: Array<Subject> = [
  {
    id: 'sub-1',
    name: '수학',
    abbreviation: '수',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: 'sub-2',
    name: '영어',
    abbreviation: '영',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  },
]

const sampleTeachers: Array<Teacher> = [
  {
    id: 'teacher-1',
    name: '김교사',
    subjectIds: ['sub-1'],
    baseHoursPerWeek: 18,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 3 }],
    createdAt: ts,
    updatedAt: ts,
  },
]

const sampleFixedEvents: Array<FixedEvent> = [
  {
    id: 'event-1',
    type: 'FIXED_CLASS',
    description: '고정 수학',
    teacherId: 'teacher-1',
    subjectId: 'sub-1',
    grade: 1,
    classNumber: 1,
    day: 'MON',
    period: 1,
    createdAt: ts,
    updatedAt: ts,
  },
]

const sampleSnapshotV1: TimetableSnapshot = {
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
  generationTimeMs: 1200,
  createdAt: ts,
}

const sampleSnapshotV2: TimetableSnapshot = {
  ...sampleSnapshotV1,
  id: 'snapshot-2',
  versionNo: 2,
  baseVersionId: 'snapshot-1',
}

const sampleSnapshotOtherWeek: TimetableSnapshot = {
  ...sampleSnapshotV1,
  id: 'snapshot-3',
  weekTag: '2026-W10',
  versionNo: 1,
  appliedScope: {
    type: 'THIS_WEEK',
    fromWeek: '2026-W10',
    toWeek: null,
  },
}

const sampleCalendarEvents: Array<AcademicCalendarEvent> = [
  {
    id: 'ac-1',
    eventType: 'HOLIDAY',
    startDate: '2026-03-01',
    endDate: '2026-03-01',
    scopeType: 'SCHOOL',
    scopeValue: null,
    periodOverride: null,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: 'ac-2',
    eventType: 'GRADE_EVENT',
    startDate: '2026-03-03',
    endDate: '2026-03-05',
    scopeType: 'GRADE',
    scopeValue: '2',
    periodOverride: null,
    createdAt: ts,
    updatedAt: ts,
  },
]

const sampleTransaction: ScheduleTransaction = {
  draftId: 'draft-1',
  targetWeeks: ['2026-W08', '2026-W09'],
  validationResult: {
    passed: true,
    violations: [],
  },
  impactReportId: 'impact-1',
  status: 'DRAFT',
  createdAt: ts,
  updatedAt: ts,
}

const sampleImpactReport: ImpactAnalysisReport = {
  id: 'impact-1',
  snapshotId: 'snapshot-1',
  weekTag: '2026-W08',
  affectedTeachers: [{ teacherName: '김교사', summary: '배치 변경 1건' }],
  affectedClasses: [{ grade: 1, classNumber: 1, summary: '변경 슬롯 2건' }],
  hourDelta: [{ target: '김교사(월)', delta: 1 }],
  riskLevel: 'MEDIUM',
  alternatives: ['화 3교시 이동 +0.1점 / 위반 0건'],
  createdAt: ts,
}

beforeEach(async () => {
  await db.schoolConfigs.clear()
  await db.subjects.clear()
  await db.teachers.clear()
  await db.fixedEvents.clear()
  await db.setupSnapshots.clear()
  await db.timetableSnapshots.clear()
  await db.changeEvents.clear()
  await db.academicCalendarEvents.clear()
  await db.scheduleTransactions.clear()
  await db.impactAnalysisReports.clear()
})

describe('SchoolConfig persistence', () => {
  it('저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveSchoolConfig(sampleSchoolConfig)
    const loaded = await loadSchoolConfig()
    expect(loaded).toEqual(sampleSchoolConfig)
  })
})

describe('Subjects persistence', () => {
  it('저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveSubjects(sampleSubjects)
    const loaded = await loadSubjects()
    expect(loaded).toEqual(expect.arrayContaining(sampleSubjects))
    expect(loaded).toHaveLength(sampleSubjects.length)
  })
})

describe('Teachers persistence', () => {
  it('저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveTeachers(sampleTeachers)
    const loaded = await loadTeachers()
    expect(loaded).toEqual(sampleTeachers)
  })
})

describe('FixedEvents persistence', () => {
  it('저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveFixedEvents(sampleFixedEvents)
    const loaded = await loadFixedEvents()
    expect(loaded).toEqual(sampleFixedEvents)
  })
})

describe('Full setup round-trip', () => {
  it('전체 데이터 저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveAllSetupData({
      schoolConfig: sampleSchoolConfig,
      subjects: sampleSubjects,
      teachers: sampleTeachers,
      fixedEvents: sampleFixedEvents,
    })

    const loaded = await loadAllSetupData()
    expect(loaded.schoolConfig).toEqual(sampleSchoolConfig)
    expect(loaded.subjects).toEqual(expect.arrayContaining(sampleSubjects))
    expect(loaded.teachers).toEqual(sampleTeachers)
    expect(loaded.fixedEvents).toEqual(sampleFixedEvents)
  })

  it('빈 상태에서 로드하면 기본값 반환', async () => {
    const loaded = await loadAllSetupData()
    expect(loaded.schoolConfig).toBeUndefined()
    expect(loaded.subjects).toEqual([])
    expect(loaded.teachers).toEqual([])
    expect(loaded.fixedEvents).toEqual([])
  })

  it('데이터 덮어쓰기가 정상 동작한다', async () => {
    await saveAllSetupData({
      schoolConfig: sampleSchoolConfig,
      subjects: sampleSubjects,
      teachers: sampleTeachers,
      fixedEvents: sampleFixedEvents,
    })

    const updatedConfig = {
      ...sampleSchoolConfig,
      periodsPerDay: 8,
      updatedAt: '2024-02-01T00:00:00.000Z',
    }
    await saveAllSetupData({
      schoolConfig: updatedConfig,
      subjects: [sampleSubjects[0]],
      teachers: [],
      fixedEvents: [],
    })

    const loaded = await loadAllSetupData()
    expect(loaded.schoolConfig?.periodsPerDay).toBe(8)
    expect(loaded.subjects).toHaveLength(1)
    expect(loaded.teachers).toHaveLength(0)
    expect(loaded.fixedEvents).toHaveLength(0)
  })
})

describe('TimetableSnapshot persistence', () => {
  it('주차별 버전을 조회할 수 있다', async () => {
    await saveTimetableSnapshot(sampleSnapshotV1)
    await saveTimetableSnapshot(sampleSnapshotV2)

    const byWeek = await loadSnapshotsByWeek('2026-W08')
    expect(byWeek).toHaveLength(2)
    expect(byWeek[0].versionNo).toBe(1)
    expect(byWeek[1].versionNo).toBe(2)

    const latest = await loadLatestSnapshotByWeek('2026-W08')
    expect(latest?.id).toBe('snapshot-2')

    const version = await loadSnapshotVersion('2026-W08', 1)
    expect(version?.id).toBe('snapshot-1')
  })

  it('주차 목록을 역순으로 조회할 수 있다', async () => {
    await saveTimetableSnapshot(sampleSnapshotV1)
    await saveTimetableSnapshot(sampleSnapshotOtherWeek)

    const weeks = await loadSnapshotWeeks()
    expect(weeks).toEqual(['2026-W10', '2026-W08'])
  })

  it('주차/버전 선택으로 스냅샷을 조회한다', async () => {
    await saveTimetableSnapshot(sampleSnapshotV1)
    await saveTimetableSnapshot(sampleSnapshotV2)

    const latestByWeek = await loadSnapshotBySelection({
      weekTag: '2026-W08',
    })
    expect(latestByWeek?.id).toBe('snapshot-2')

    const exact = await loadSnapshotBySelection({
      weekTag: '2026-W08',
      versionNo: 1,
    })
    expect(exact?.id).toBe('snapshot-1')

    const fallback = await loadSnapshotBySelection({
      weekTag: '2026-W08',
      versionNo: 999,
    })
    expect(fallback?.id).toBe('snapshot-2')
  })

  it('다음 버전을 append-only로 저장한다', async () => {
    await saveTimetableSnapshot(sampleSnapshotV1)
    await saveTimetableSnapshot(sampleSnapshotV2)

    const next = await saveNextSnapshotVersion({
      sourceSnapshot: sampleSnapshotV1,
      cells: [
        {
          teacherId: 'teacher-1',
          subjectId: 'sub-1',
          grade: 1,
          classNumber: 1,
          day: 'MON',
          period: 1,
          isFixed: false,
          status: 'CONFIRMED_MODIFIED',
        },
      ],
    })

    expect(next.id).not.toBe(sampleSnapshotV1.id)
    expect(next.weekTag).toBe('2026-W08')
    expect(next.versionNo).toBe(3)
    expect(next.baseVersionId).toBe(sampleSnapshotV1.id)
    expect(next.cells).toHaveLength(1)
  })

  it('주차 첫 버전은 versionNo=1로 시작한다', async () => {
    const next = await saveNextSnapshotVersion({
      sourceSnapshot: sampleSnapshotV1,
      cells: [],
      overrideWeekTag: '2026-W11',
    })

    expect(next.weekTag).toBe('2026-W11')
    expect(next.versionNo).toBe(1)
    expect(next.baseVersionId).toBeNull()
  })
})

describe('AcademicCalendarEvents persistence', () => {
  it('기간 범위로 이벤트를 조회할 수 있다', async () => {
    await saveAcademicCalendarEvents(sampleCalendarEvents)

    const events = await loadAcademicCalendarEventsByRange(
      '2026-03-02',
      '2026-03-05',
    )
    expect(events.map((event) => event.id)).toEqual(['ac-2'])
  })

  it('전체 이벤트를 시작일 순서로 조회할 수 있다', async () => {
    await saveAcademicCalendarEvents([sampleCalendarEvents[1], sampleCalendarEvents[0]])

    const events = await loadAcademicCalendarEvents()
    expect(events.map((event) => event.id)).toEqual(['ac-1', 'ac-2'])
  })
})

describe('ScheduleTransaction persistence', () => {
  it('저장 후 업데이트를 반영한다', async () => {
    await saveScheduleTransaction(sampleTransaction)

    await updateScheduleTransaction({
      ...sampleTransaction,
      status: 'COMMITTED',
      updatedAt: '2026-02-22T10:00:00.000Z',
    })

    const stored = await db.scheduleTransactions.get('draft-1')
    expect(stored?.status).toBe('COMMITTED')
  })
})

describe('ImpactAnalysisReport persistence', () => {
  it('리포트를 저장하고 id로 조회할 수 있다', async () => {
    await saveImpactAnalysisReport(sampleImpactReport)

    const loaded = await loadImpactAnalysisReport('impact-1')
    expect(loaded).toEqual(sampleImpactReport)
  })

  it('snapshot 기준으로 리포트 목록을 조회할 수 있다', async () => {
    await saveImpactAnalysisReport(sampleImpactReport)
    await saveImpactAnalysisReport({
      ...sampleImpactReport,
      id: 'impact-2',
      createdAt: '2024-01-01T00:01:00.000Z',
    })

    const reports = await loadImpactAnalysisReportsBySnapshot('snapshot-1')
    expect(reports.map((report) => report.id)).toEqual(['impact-1', 'impact-2'])
  })
})

describe('ChangeEvents persistence', () => {
  it('주차 기준으로 이력을 조회할 수 있다', async () => {
    await saveChangeEvent({
      id: 'event-1',
      snapshotId: 'snapshot-1',
      weekTag: '2026-W08',
      actionType: 'EDIT',
      actor: 'LOCAL_OPERATOR',
      cellKey: '1-1-MON-1',
      before: null,
      after: null,
      beforePayload: null,
      afterPayload: null,
      impactSummary: null,
      conflictDetected: false,
      rollbackRef: null,
      timestamp: 10,
      isUndone: false,
    })
    await saveChangeEvent({
      id: 'event-2',
      snapshotId: 'snapshot-2',
      weekTag: '2026-W08',
      actionType: 'RECOMPUTE',
      actor: 'LOCAL_OPERATOR',
      cellKey: '1-1-MON-1',
      before: null,
      after: null,
      beforePayload: null,
      afterPayload: null,
      impactSummary: null,
      conflictDetected: false,
      rollbackRef: null,
      timestamp: 20,
      isUndone: false,
    })
    await saveChangeEvent({
      id: 'event-3',
      snapshotId: 'snapshot-3',
      weekTag: '2026-W10',
      actionType: 'LOCK',
      actor: 'LOCAL_OPERATOR',
      cellKey: '1-1-MON-1',
      before: null,
      after: null,
      beforePayload: null,
      afterPayload: null,
      impactSummary: null,
      conflictDetected: false,
      rollbackRef: null,
      timestamp: 30,
      isUndone: false,
    })

    const weekEvents = await loadChangeEventsByWeek('2026-W08')
    expect(weekEvents.map((event) => event.id)).toEqual(['event-1', 'event-2'])
  })
})
