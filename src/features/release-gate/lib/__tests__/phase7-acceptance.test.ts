import { beforeEach, describe, expect, it } from 'vitest'
import {
  ACCEPTANCE_WEEK,
  makeCalendarEvent,
  makeCell,
  makeConstraintPolicy,
  makeErrorViolation,
  makeMoveCandidate,
  makeSchoolConfig,
  makeSnapshot,
  makeSubject,
  makeTeacher,
  resetAcceptanceDatabase,
} from './phase7-acceptance-fixtures'
import { predictHourShortageFromCalendarChange } from '@/features/analyze-schedule-impact'
import { applyScheduleTransaction } from '@/features/apply-schedule-transaction'
import { useReplacementStore } from '@/features/find-replacement'
import { validateScheduleChange } from '@/features/validate-schedule-change'
import {
  loadChangeEventsByWeek,
  loadLatestSnapshotByWeek,
  loadSnapshotWeeks,
  loadSnapshotsByWeek,
  saveTimetableSnapshot,
} from '@/shared/persistence/indexeddb/repository'
import {
  buildForwardWeekWindow,
  computeWeekTagFromTimestamp,
  shiftWeekTag,
} from '@/shared/lib/week-tag'

const MONDAY_DATE = '2026-02-23'

describe('Phase 7 acceptance gate', () => {
  beforeEach(async () => {
    await resetAcceptanceDatabase()
    useReplacementStore.setState(useReplacementStore.getInitialState(), true)
  })

  it('[ACCEPT-01] 공휴일/휴업일에 수업 배정 시 HC-01로 즉시 차단된다', () => {
    const schoolConfig = makeSchoolConfig()
    const subjects = [makeSubject('subject-1', '수학')]
    const teachers = [
      makeTeacher({
        id: 'teacher-1',
        name: '김교사',
        subjectIds: ['subject-1'],
      }),
    ]

    const violations = validateScheduleChange({
      cells: [makeCell({ teacherId: 'teacher-1', subjectId: 'subject-1' })],
      constraintPolicy: makeConstraintPolicy(),
      schoolConfig,
      teachers,
      subjects,
      weekTag: ACCEPTANCE_WEEK,
      academicCalendarEvents: [
        makeCalendarEvent({
          eventType: 'CLOSURE_DAY',
          startDate: MONDAY_DATE,
          endDate: MONDAY_DATE,
        }),
      ],
    })

    expect(violations.some((violation) => violation.ruleId === 'HC-01')).toBe(true)
  })

  it('[ACCEPT-02] 학년 행사 차단과 시수 부족 증가를 함께 검증한다', () => {
    const schoolConfig = makeSchoolConfig()
    const subjects = [makeSubject('subject-1', '국어')]
    const teachers = [
      makeTeacher({
        id: 'teacher-1',
        name: '이교사',
        subjectIds: ['subject-1'],
        classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 35 }],
      }),
    ]
    const snapshot = makeSnapshot({ weekTag: ACCEPTANCE_WEEK, cells: [] })
    const gradeEvent = makeCalendarEvent({
      id: 'grade-event-1',
      eventType: 'GRADE_EVENT',
      startDate: MONDAY_DATE,
      endDate: MONDAY_DATE,
      scopeType: 'GRADE',
      scopeValue: '1',
    })

    const violations = validateScheduleChange({
      cells: [makeCell({ teacherId: 'teacher-1', subjectId: 'subject-1' })],
      constraintPolicy: makeConstraintPolicy(),
      schoolConfig,
      teachers,
      subjects,
      weekTag: ACCEPTANCE_WEEK,
      academicCalendarEvents: [gradeEvent],
    })

    const shortage = predictHourShortageFromCalendarChange({
      beforeEvents: [],
      afterEvents: [gradeEvent],
      schoolConfig,
      teachers,
      snapshot,
    })

    expect(violations.some((violation) => violation.ruleId === 'HC-02')).toBe(true)
    expect(shortage.shortageByClass).toHaveLength(1)
    expect(shortage.shortageByClass[0].deltaShortage).toBeGreaterThan(0)
  })

  it('[ACCEPT-03] 시험기간에는 일반 수업 배정이 HC-04로 차단된다', () => {
    const schoolConfig = makeSchoolConfig()
    const subjects = [makeSubject('subject-1', '영어')]
    const teachers = [
      makeTeacher({
        id: 'teacher-1',
        name: '박교사',
        subjectIds: ['subject-1'],
      }),
    ]

    const violations = validateScheduleChange({
      cells: [makeCell({ teacherId: 'teacher-1', subjectId: 'subject-1' })],
      constraintPolicy: makeConstraintPolicy(),
      schoolConfig,
      teachers,
      subjects,
      weekTag: ACCEPTANCE_WEEK,
      academicCalendarEvents: [
        makeCalendarEvent({
          eventType: 'EXAM_PERIOD',
          startDate: MONDAY_DATE,
          endDate: MONDAY_DATE,
        }),
      ],
    })

    expect(violations.some((violation) => violation.ruleId === 'HC-04')).toBe(true)
  })

  it('[ACCEPT-04] 단축수업 초과 교시는 HC-05 차단되고 보강 추천이 생성된다', () => {
    const schoolConfig = makeSchoolConfig()
    const subjects = [makeSubject('subject-1', '과학')]
    const teachers = [
      makeTeacher({
        id: 'teacher-1',
        name: '최교사',
        subjectIds: ['subject-1'],
        classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 35 }],
      }),
    ]
    const snapshot = makeSnapshot({ weekTag: ACCEPTANCE_WEEK, cells: [] })
    const shortenedDay = makeCalendarEvent({
      id: 'short-1',
      eventType: 'SHORTENED_DAY',
      startDate: MONDAY_DATE,
      endDate: MONDAY_DATE,
      periodOverride: 6,
    })

    const violations = validateScheduleChange({
      cells: [
        makeCell({
          teacherId: 'teacher-1',
          subjectId: 'subject-1',
          day: 'MON',
          period: 7,
        }),
      ],
      constraintPolicy: makeConstraintPolicy(),
      schoolConfig,
      teachers,
      subjects,
      weekTag: ACCEPTANCE_WEEK,
      academicCalendarEvents: [shortenedDay],
    })

    const shortage = predictHourShortageFromCalendarChange({
      beforeEvents: [],
      afterEvents: [shortenedDay],
      schoolConfig,
      teachers,
      snapshot,
    })

    expect(violations.some((violation) => violation.ruleId === 'HC-05')).toBe(true)
    expect(shortage.shortageByClass[0].deltaShortage).toBeGreaterThan(0)
    expect(shortage.recommendations.length).toBeGreaterThan(0)
    expect(shortage.recommendations[0].message).toContain('보강')
  })

  it('[ACCEPT-05] 영향 리포트가 없으면 범위 교체 확정이 차단된다', async () => {
    const snapshot = makeSnapshot({
      id: 'snapshot-replacement-1',
      weekTag: ACCEPTANCE_WEEK,
      cells: [makeCell()],
    })

    useReplacementStore.setState({
      snapshot,
      cells: snapshot.cells,
      schoolConfig: makeSchoolConfig(),
      constraintPolicy: makeConstraintPolicy(),
      selectedCandidate: makeMoveCandidate({ sourceCell: snapshot.cells[0] }),
      impactReport: null,
    })

    const result = await useReplacementStore.getState().confirmReplacement()
    expect(result).toBe(false)
    expect(useReplacementStore.getState().isApplyingScope).toBe(false)
    expect(useReplacementStore.getState().scopeValidationSummary.status).toBe('IDLE')
  })

  it('[ACCEPT-06] 충돌 메시지에 UUID/내부 ID 노출 없이 사람 중심 문구를 유지한다', () => {
    const schoolConfig = makeSchoolConfig({
      classCountByGrade: { 1: 2 },
    })
    const subjectId = '550e8400-e29b-41d4-a716-446655440000'
    const teacherId = '123e4567-e89b-12d3-a456-426614174000'
    const subjects = [makeSubject(subjectId, '사회')]
    const teachers = [
      makeTeacher({
        id: teacherId,
        name: '정교사',
        subjectIds: [subjectId],
        classAssignments: [
          { grade: 1, classNumber: 1, hoursPerWeek: 5 },
          { grade: 1, classNumber: 2, hoursPerWeek: 5 },
        ],
      }),
    ]

    const violations = validateScheduleChange({
      cells: [
        makeCell({
          teacherId,
          subjectId,
          classNumber: 1,
          day: 'MON',
          period: 1,
        }),
        makeCell({
          teacherId,
          subjectId,
          classNumber: 2,
          day: 'MON',
          period: 1,
        }),
      ],
      constraintPolicy: makeConstraintPolicy(),
      schoolConfig,
      teachers,
      subjects,
      weekTag: ACCEPTANCE_WEEK,
      academicCalendarEvents: [],
    })

    expect(violations.some((violation) => violation.ruleId === 'HC-07')).toBe(true)
    for (const violation of violations) {
      expect(violation.humanMessage.includes(teacherId)).toBe(false)
      expect(violation.humanMessage.includes(subjectId)).toBe(false)
      expect(
        violation.humanMessage.includes('123e4567-e89b-12d3-a456-426614174000'),
      ).toBe(false)
    }
    expect(
      violations.some(
        (violation) =>
          violation.humanMessage.includes('정교사') ||
          violation.humanMessage.includes('1학년'),
      ),
    ).toBe(true)
  })

  it('[ACCEPT-07] 트랜잭션 실패 시 롤백되어 주차 스냅샷이 보존된다', async () => {
    const sourceSnapshot = makeSnapshot({
      id: 'snapshot-rollback-1',
      weekTag: ACCEPTANCE_WEEK,
      versionNo: 1,
      cells: [makeCell({ period: 1 })],
    })
    await saveTimetableSnapshot(sourceSnapshot)

    const before = await loadSnapshotsByWeek(ACCEPTANCE_WEEK)
    const result = await applyScheduleTransaction({
      kind: 'EDIT_SAVE',
      plans: [
        {
          weekTag: sourceSnapshot.weekTag,
          sourceSnapshot,
          nextCells: sourceSnapshot.cells,
          appliedScope: sourceSnapshot.appliedScope,
        },
      ],
      prevalidatedViolations: [makeErrorViolation('HC-07', '중복 배정')],
    })
    const after = await loadSnapshotsByWeek(ACCEPTANCE_WEEK)

    expect(result.ok).toBe(false)
    expect(result.status).toBe('ROLLED_BACK')
    expect(after).toHaveLength(before.length)
    expect(after.at(-1)?.id).toBe(before.at(-1)?.id)
  })

  it('[ACCEPT-08] VERSION_RESTORE 커밋 시 before/after payload 추적이 가능하다', async () => {
    const sourceSnapshot = makeSnapshot({
      id: 'snapshot-restore-1',
      weekTag: ACCEPTANCE_WEEK,
      versionNo: 1,
      cells: [makeCell({ period: 1 })],
    })
    await saveTimetableSnapshot(sourceSnapshot)

    const restoredCells = [makeCell({ period: 2, status: 'CONFIRMED_MODIFIED' })]
    const result = await applyScheduleTransaction({
      kind: 'VERSION_RESTORE',
      preferredCommitActionType: 'VERSION_RESTORE',
      plans: [
        {
          weekTag: sourceSnapshot.weekTag,
          sourceSnapshot,
          nextCells: restoredCells,
          appliedScope: sourceSnapshot.appliedScope,
        },
      ],
    })

    const events = await loadChangeEventsByWeek(ACCEPTANCE_WEEK)
    const restoreEvent = events.find((event) => event.actionType === 'VERSION_RESTORE')

    expect(result.ok).toBe(true)
    expect(restoreEvent).toBeDefined()
    expect(restoreEvent?.beforePayload).not.toBeNull()
    expect(restoreEvent?.afterPayload).not.toBeNull()
    expect(restoreEvent?.impactSummary).toContain('restore v1 -> v2')
  })

  it('[ACCEPT-09] 현재+다음 3주 윈도우와 과거 주차 조회가 모두 가능하다', async () => {
    const currentWeek = computeWeekTagFromTimestamp(Date.now())
    const futureWeek = shiftWeekTag(currentWeek, 2)
    const pastWeek = shiftWeekTag(currentWeek, -1)

    await saveTimetableSnapshot(
      makeSnapshot({
        id: 'snapshot-current',
        weekTag: currentWeek,
        versionNo: 1,
      }),
    )
    await saveTimetableSnapshot(
      makeSnapshot({
        id: 'snapshot-future',
        weekTag: futureWeek,
        versionNo: 1,
      }),
    )
    await saveTimetableSnapshot(
      makeSnapshot({
        id: 'snapshot-past',
        weekTag: pastWeek,
        versionNo: 1,
      }),
    )

    const window = buildForwardWeekWindow(currentWeek, 3)
    const snapshotWeeks = await loadSnapshotWeeks()

    expect(window).toHaveLength(4)
    expect(window[0]).toBe(currentWeek)
    expect(window[3]).toBe(shiftWeekTag(currentWeek, 3))
    expect(snapshotWeeks).toContain(currentWeek)
    expect(snapshotWeeks).toContain(futureWeek)
    expect(snapshotWeeks).toContain(pastWeek)
  })

  it('[ACCEPT-10] 특정 주차 수정 시 비대상 주차 버전/스냅샷은 유지된다', async () => {
    const weekA = '2026-W09'
    const weekB = '2026-W10'
    const snapshotA = makeSnapshot({
      id: 'snapshot-a-1',
      weekTag: weekA,
      versionNo: 1,
      cells: [makeCell({ period: 1 })],
    })
    const snapshotB = makeSnapshot({
      id: 'snapshot-b-1',
      weekTag: weekB,
      versionNo: 1,
      cells: [makeCell({ day: 'TUE', period: 3 })],
    })
    await saveTimetableSnapshot(snapshotA)
    await saveTimetableSnapshot(snapshotB)

    const beforeWeekB = await loadLatestSnapshotByWeek(weekB)
    const result = await applyScheduleTransaction({
      kind: 'EDIT_SAVE',
      plans: [
        {
          weekTag: snapshotA.weekTag,
          sourceSnapshot: snapshotA,
          nextCells: [makeCell({ period: 2, status: 'CONFIRMED_MODIFIED' })],
          appliedScope: snapshotA.appliedScope,
        },
      ],
    })

    const weekASnapshots = await loadSnapshotsByWeek(weekA)
    const weekBSnapshots = await loadSnapshotsByWeek(weekB)
    const afterWeekB = await loadLatestSnapshotByWeek(weekB)

    expect(result.ok).toBe(true)
    expect(weekASnapshots).toHaveLength(2)
    expect(weekBSnapshots).toHaveLength(1)
    expect(afterWeekB?.id).toBe(beforeWeekB?.id)
    expect(afterWeekB?.versionNo).toBe(beforeWeekB?.versionNo)
  })
})
