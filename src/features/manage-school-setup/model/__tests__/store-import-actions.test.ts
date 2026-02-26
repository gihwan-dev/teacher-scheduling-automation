import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  FinalTimetableImportPayload,
  TeacherHoursImportPayload,
} from '../types'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { TimetableSnapshot } from '@/entities/timetable'
import type {
  RecomputeInput,
  RecomputeResult,
} from '@/features/recompute-timetable'
import type { SetupImportBundle } from '@/shared/persistence/indexeddb/repository'

const parserMocks = vi.hoisted(() => ({
  parseTeacherHoursXls: vi.fn<
    (input: ArrayBuffer | Uint8Array) => TeacherHoursImportPayload
  >(),
  parseFinalTimetableXlsx: vi.fn<
    (input: ArrayBuffer | Uint8Array) => FinalTimetableImportPayload
  >(),
}))

const repositoryMocks = vi.hoisted(() => ({
  loadAcademicCalendarEvents: vi.fn<() => Promise<Array<unknown>>>(),
  loadAllSetupData: vi.fn<
    () => Promise<{
      schoolConfig: SchoolConfig | undefined
      subjects: Array<Subject>
      teachers: Array<Teacher>
      fixedEvents: Array<FixedEvent>
    }>
  >(),
  loadConstraintPolicy: vi.fn<() => Promise<ConstraintPolicy | undefined>>(),
  loadLatestSnapshotByWeek: vi.fn<
    (weekTag: string) => Promise<TimetableSnapshot | undefined>
  >(),
  loadLatestTimetableSnapshot: vi.fn<() => Promise<TimetableSnapshot | undefined>>(),
  loadTeacherPolicies: vi.fn<() => Promise<Array<TeacherPolicy>>>(),
  saveAcademicCalendarEvents: vi.fn<
    (events: Array<AcademicCalendarEvent>) => Promise<void>
  >(),
  saveAllSetupData: vi.fn<() => Promise<void>>(),
  saveNextSnapshotVersion: vi.fn<
    (params: {
      sourceSnapshot: TimetableSnapshot
      cells: TimetableSnapshot['cells']
      overrideWeekTag?: TimetableSnapshot['weekTag']
    }) => Promise<TimetableSnapshot>
  >(),
  saveSetupImportBundle: vi.fn<(bundle: SetupImportBundle) => Promise<void>>(),
  saveSetupImportBundleWithAcademicCalendar: vi.fn<
    (input: {
      bundle: SetupImportBundle
      academicCalendarEvents: Array<AcademicCalendarEvent>
    }) => Promise<void>
  >(),
}))

const recomputeMocks = vi.hoisted(() => ({
  recomputeUnlocked: vi.fn<(input: RecomputeInput) => RecomputeResult>(),
}))

vi.mock('../teacher-hours-xls-parser', () => ({
  parseTeacherHoursXls: parserMocks.parseTeacherHoursXls,
}))

vi.mock('../final-timetable-xlsx-parser', () => ({
  parseFinalTimetableXlsx: parserMocks.parseFinalTimetableXlsx,
}))

vi.mock('@/features/recompute-timetable', () => ({
  recomputeUnlocked: recomputeMocks.recomputeUnlocked,
}))

vi.mock('@/shared/persistence/indexeddb/repository', () => repositoryMocks)

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

const subjects: Array<Subject> = [
  {
    id: 'subject-legacy',
    name: '국어 (공통)',
    abbreviation: '국',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  },
]

const teachers: Array<Teacher> = [
  {
    id: 'teacher-legacy',
    name: '김교사(담임)',
    subjectIds: ['subject-legacy'],
    baseHoursPerWeek: 5,
    assignments: [
      {
        id: 'assignment-legacy',
        subjectId: 'subject-legacy',
        subjectType: 'CLASS',
        grade: 1,
        classNumber: 1,
        hoursPerWeek: 5,
      },
    ],
    homeroom: { grade: 1, classNumber: 1 },
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 5 }],
    createdAt: ts,
    updatedAt: ts,
  },
]

const fixedEvents: Array<FixedEvent> = [
  {
    id: 'fixed-valid',
    type: 'FIXED_CLASS',
    description: '유효 고정',
    teacherId: 'teacher-legacy',
    subjectId: 'subject-legacy',
    grade: 1,
    classNumber: 1,
    day: 'MON',
    period: 1,
    createdAt: ts,
    updatedAt: ts,
  },
]

const latestSnapshot: TimetableSnapshot = {
  id: 'snapshot-1',
  schoolConfigId: 'school-1',
  weekTag: '2026-W10',
  versionNo: 1,
  baseVersionId: null,
  appliedScope: {
    type: 'THIS_WEEK',
    fromWeek: '2026-W10',
    toWeek: null,
  },
  cells: [],
  score: 80,
  generationTimeMs: 1000,
  createdAt: ts,
}

async function loadStoreModule() {
  return import('../store')
}

type StoreModule = Awaited<ReturnType<typeof loadStoreModule>>

let useSetupStore: StoreModule['useSetupStore']

function clone<T>(value: T): T {
  return structuredClone(value)
}

function seedBaseState(): void {
  useSetupStore.setState({
    schoolConfig: clone(schoolConfig),
    subjects: clone(subjects),
    teachers: clone(teachers),
    fixedEvents: clone(fixedEvents),
    latestSnapshot: clone(latestSnapshot),
  })
}

function createTeacherHoursFile(): File {
  return {
    name: 'teacher-hours.xls',
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as File
}

function createFinalTimetableFile(): File {
  return {
    name: 'final-timetable.xlsx',
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as File
}

beforeEach(async () => {
  vi.resetModules()
  parserMocks.parseTeacherHoursXls.mockReset()
  parserMocks.parseFinalTimetableXlsx.mockReset()
  repositoryMocks.loadAcademicCalendarEvents.mockReset()
  repositoryMocks.loadAllSetupData.mockReset()
  repositoryMocks.loadConstraintPolicy.mockReset()
  repositoryMocks.loadLatestSnapshotByWeek.mockReset()
  repositoryMocks.loadLatestTimetableSnapshot.mockReset()
  repositoryMocks.loadTeacherPolicies.mockReset()
  repositoryMocks.saveAcademicCalendarEvents.mockReset()
  repositoryMocks.saveAllSetupData.mockReset()
  repositoryMocks.saveNextSnapshotVersion.mockReset()
  repositoryMocks.saveSetupImportBundle.mockReset()
  repositoryMocks.saveSetupImportBundleWithAcademicCalendar.mockReset()
  recomputeMocks.recomputeUnlocked.mockReset()

  repositoryMocks.saveSetupImportBundle.mockResolvedValue(undefined)
  repositoryMocks.saveSetupImportBundleWithAcademicCalendar.mockResolvedValue(
    undefined,
  )
  repositoryMocks.loadConstraintPolicy.mockResolvedValue(undefined)
  repositoryMocks.loadTeacherPolicies.mockResolvedValue([])
  repositoryMocks.loadLatestSnapshotByWeek.mockResolvedValue(clone(latestSnapshot))
  repositoryMocks.saveNextSnapshotVersion.mockImplementation((params) =>
    Promise.resolve({
      ...params.sourceSnapshot,
      id: 'snapshot-next',
      weekTag: params.overrideWeekTag ?? params.sourceSnapshot.weekTag,
      versionNo: params.sourceSnapshot.versionNo + 1,
      baseVersionId: params.sourceSnapshot.id,
      cells: params.cells,
    }),
  )
  recomputeMocks.recomputeUnlocked.mockImplementation((input) => ({
    success: true,
    cells: input.cells,
    score: 0,
    violations: [],
    unplacedAssignments: [],
    suggestions: [],
    recomputeTimeMs: 1,
  }))

  const storeModule = await import('../store')
  useSetupStore = storeModule.useSetupStore
  useSetupStore.setState(useSetupStore.getInitialState(), true)
})

describe('setup store import actions', () => {
  it('teacher-hours snapshot 존재 + recompute 성공 + 기본 정책 fallback + SUCCESS', async () => {
    seedBaseState()
    useSetupStore.getState().setTargetWeekTagForImport('2026-W10')
    repositoryMocks.loadLatestSnapshotByWeek.mockResolvedValueOnce({
      ...latestSnapshot,
      weekTag: '2026-W10',
    })
    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [{ name: '국어', abbreviation: '국' }],
      teachers: [{ name: '김교사', baseHoursPerWeek: 5 }],
      assignments: [
        {
          teacherName: '김교사',
          subjectName: '국어',
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 5,
        },
      ],
      issues: [],
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).toHaveBeenCalledTimes(1)
    const bundle =
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar.mock.calls[0]?.[0]
        ?.bundle
    expect(bundle.subjects[0]?.id).toBe('subject-legacy')
    expect(bundle.teachers[0]?.id).toBe('teacher-legacy')
    expect(bundle.teachers[0]?.assignments?.[0]?.subjectType).toBe('CLASS')
    expect(bundle.teachers[0]?.subjectIds).toEqual(['subject-legacy'])
    expect(bundle.teachers[0]?.classAssignments).toEqual([
      { grade: 1, classNumber: 1, hoursPerWeek: 5 },
    ])
    expect(repositoryMocks.loadConstraintPolicy).toHaveBeenCalledTimes(1)
    expect(recomputeMocks.recomputeUnlocked).toHaveBeenCalledTimes(1)
    const recomputeInput = recomputeMocks.recomputeUnlocked.mock.calls[0]?.[0]
    expect(recomputeInput.constraintPolicy).toMatchObject({
      studentMaxConsecutiveSameSubject: 2,
      teacherMaxConsecutiveHours: 4,
      teacherMaxDailyHours: 6,
    })
    expect(repositoryMocks.saveNextSnapshotVersion).toHaveBeenCalledTimes(1)
    expect(useSetupStore.getState().latestSnapshot?.id).toBe('snapshot-next')
    expect(useSetupStore.getState().importReport?.status).toBe('SUCCESS')
  })

  it('teacher-hours 대상 snapshot 없음: PARTIAL_SUCCESS + warning', async () => {
    seedBaseState()
    repositoryMocks.loadLatestSnapshotByWeek.mockResolvedValueOnce(undefined)
    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [{ name: '국어', abbreviation: '국' }],
      teachers: [{ name: '김교사', baseHoursPerWeek: 5 }],
      assignments: [
        {
          teacherName: '김교사',
          subjectName: '국어',
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 5,
        },
      ],
      issues: [],
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(recomputeMocks.recomputeUnlocked).not.toHaveBeenCalled()
    expect(repositoryMocks.saveNextSnapshotVersion).not.toHaveBeenCalled()
    const importReport = useSetupStore.getState().importReport
    expect(importReport?.status).toBe('PARTIAL_SUCCESS')
    expect(
      importReport?.issues.some(
        (issue) => issue.code === 'UNKNOWN' && issue.severity === 'warning',
      ),
    ).toBe(true)
  })

  it('teacher-hours recompute success=false: PARTIAL_SUCCESS + warning', async () => {
    seedBaseState()
    recomputeMocks.recomputeUnlocked.mockReturnValueOnce({
      success: false,
      cells: [],
      score: 0,
      violations: [],
      unplacedAssignments: [],
      suggestions: [],
      recomputeTimeMs: 1,
    })
    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [{ name: '국어', abbreviation: '국' }],
      teachers: [{ name: '김교사', baseHoursPerWeek: 5 }],
      assignments: [
        {
          teacherName: '김교사',
          subjectName: '국어',
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 5,
        },
      ],
      issues: [],
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(recomputeMocks.recomputeUnlocked).toHaveBeenCalledTimes(1)
    expect(repositoryMocks.saveNextSnapshotVersion).not.toHaveBeenCalled()
    const importReport = useSetupStore.getState().importReport
    expect(importReport?.status).toBe('PARTIAL_SUCCESS')
    expect(
      importReport?.issues.some(
        (issue) => issue.code === 'UNKNOWN' && issue.severity === 'warning',
      ),
    ).toBe(true)
  })

  it('teacher-hours recompute throw: PARTIAL_SUCCESS + warning', async () => {
    seedBaseState()
    recomputeMocks.recomputeUnlocked.mockImplementationOnce(() => {
      throw new Error('recompute exploded')
    })
    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [{ name: '국어', abbreviation: '국' }],
      teachers: [{ name: '김교사', baseHoursPerWeek: 5 }],
      assignments: [
        {
          teacherName: '김교사',
          subjectName: '국어',
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 5,
        },
      ],
      issues: [],
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(recomputeMocks.recomputeUnlocked).toHaveBeenCalledTimes(1)
    expect(repositoryMocks.saveNextSnapshotVersion).not.toHaveBeenCalled()
    const importReport = useSetupStore.getState().importReport
    expect(importReport?.status).toBe('PARTIAL_SUCCESS')
    expect(
      importReport?.issues.some(
        (issue) => issue.code === 'UNKNOWN' && issue.severity === 'warning',
      ),
    ).toBe(true)
  })

  it('teacher-hours warning-only: PARTIAL_SUCCESS', async () => {
    seedBaseState()
    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [{ name: '국어', abbreviation: '국' }],
      teachers: [{ name: '김교사', baseHoursPerWeek: 5 }],
      assignments: [
        {
          teacherName: '김교사',
          subjectName: '국어',
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 5,
        },
      ],
      issues: [
        {
          code: 'INVALID_ROW',
          severity: 'warning',
          blocking: false,
          message: '경고 테스트',
        },
      ],
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).toHaveBeenCalledTimes(1)
    expect(useSetupStore.getState().importReport?.status).toBe('PARTIAL_SUCCESS')
  })

  it('teacher-hours atomic save 실패: FAILED + 상태 불변', async () => {
    seedBaseState()
    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [{ name: '국어', abbreviation: '국' }],
      teachers: [{ name: '김교사', baseHoursPerWeek: 5 }],
      assignments: [
        {
          teacherName: '김교사',
          subjectName: '국어',
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 5,
        },
      ],
      issues: [],
    })
    repositoryMocks.saveSetupImportBundleWithAcademicCalendar.mockRejectedValueOnce(
      new Error('atomic import save failed'),
    )

    const before = clone({
      schoolConfig: useSetupStore.getState().schoolConfig,
      subjects: useSetupStore.getState().subjects,
      teachers: useSetupStore.getState().teachers,
      fixedEvents: useSetupStore.getState().fixedEvents,
      latestSnapshot: useSetupStore.getState().latestSnapshot,
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).toHaveBeenCalledTimes(1)
    expect(useSetupStore.getState().importReport?.status).toBe('FAILED')
    expect({
      schoolConfig: useSetupStore.getState().schoolConfig,
      subjects: useSetupStore.getState().subjects,
      teachers: useSetupStore.getState().teachers,
      fixedEvents: useSetupStore.getState().fixedEvents,
      latestSnapshot: useSetupStore.getState().latestSnapshot,
    }).toEqual(before)
  })

  it('teacher-hours blocking: 저장 미수행 + FAILED + 상태 불변', async () => {
    seedBaseState()
    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [],
      teachers: [],
      assignments: [],
      issues: [
        {
          code: 'SHEET_NOT_FOUND',
          severity: 'error',
          blocking: true,
          message: '필수 시트 없음',
        },
      ],
    })

    const before = clone({
      schoolConfig: useSetupStore.getState().schoolConfig,
      subjects: useSetupStore.getState().subjects,
      teachers: useSetupStore.getState().teachers,
      fixedEvents: useSetupStore.getState().fixedEvents,
      latestSnapshot: useSetupStore.getState().latestSnapshot,
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).not.toHaveBeenCalled()
    expect(useSetupStore.getState().importReport?.status).toBe('FAILED')
    expect({
      schoolConfig: useSetupStore.getState().schoolConfig,
      subjects: useSetupStore.getState().subjects,
      teachers: useSetupStore.getState().teachers,
      fixedEvents: useSetupStore.getState().fixedEvents,
      latestSnapshot: useSetupStore.getState().latestSnapshot,
    }).toEqual(before)
  })

  it('teacher-hours 빈 payload: 저장 미수행 + FAILED', async () => {
    seedBaseState()
    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [],
      teachers: [],
      assignments: [],
      issues: [],
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).not.toHaveBeenCalled()
    const importReport = useSetupStore.getState().importReport
    expect(importReport?.status).toBe('FAILED')
    expect(importReport?.issues.some((issue) => issue.blocking)).toBe(true)
  })

  it('orphan 정리: invalid fixedEvents/teacherPolicies 제거 + warning 누적', async () => {
    seedBaseState()
    useSetupStore.setState({
      fixedEvents: [
        ...clone(fixedEvents),
        {
          id: 'fixed-invalid',
          type: 'FIXED_CLASS',
          description: '무효 고정',
          teacherId: 'ghost-teacher',
          subjectId: 'ghost-subject',
          grade: 1,
          classNumber: 1,
          day: 'TUE',
          period: 1,
          createdAt: ts,
          updatedAt: ts,
        },
      ],
    })
    const policies: Array<TeacherPolicy> = [
      {
        id: 'policy-valid',
        teacherId: 'teacher-legacy',
        avoidanceSlots: [],
        timePreference: 'NONE',
        maxConsecutiveHoursOverride: null,
        maxDailyHoursOverride: null,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: 'policy-invalid',
        teacherId: 'ghost-teacher',
        avoidanceSlots: [],
        timePreference: 'NONE',
        maxConsecutiveHoursOverride: null,
        maxDailyHoursOverride: null,
        createdAt: ts,
        updatedAt: ts,
      },
    ]
    repositoryMocks.loadTeacherPolicies.mockResolvedValue(policies)
    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [{ name: '국어', abbreviation: '국' }],
      teachers: [{ name: '김교사', baseHoursPerWeek: 5 }],
      assignments: [
        {
          teacherName: '김교사',
          subjectName: '국어',
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 5,
        },
      ],
      issues: [],
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    const bundle =
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar.mock.calls[0]?.[0]
        ?.bundle
    expect(bundle.fixedEvents.map((event) => event.id)).toEqual(['fixed-valid'])
    expect(bundle.teacherPolicies.map((policy) => policy.id)).toEqual([
      'policy-valid',
    ])
    const unknownWarnings = useSetupStore
      .getState()
      .importReport?.issues.filter((issue) => issue.code === 'UNKNOWN')
    expect(unknownWarnings).toHaveLength(2)
    expect(useSetupStore.getState().importReport?.status).toBe('PARTIAL_SUCCESS')
  })

  it('academicCalendar dirty=true 상태에서도 import 성공 후 save-state를 초기화한다', async () => {
    seedBaseState()
    useSetupStore.getState().addAcademicCalendarEvent({
      eventType: 'HOLIDAY',
      startDate: '2026-02-23',
      endDate: '2026-02-23',
      scopeType: 'SCHOOL',
      scopeValue: null,
      periodOverride: null,
    })
    expect(useSetupStore.getState().isDirty).toBe(true)

    parserMocks.parseTeacherHoursXls.mockReturnValue({
      sheetName: '교사별시수표',
      subjects: [{ name: '국어', abbreviation: '국' }],
      teachers: [{ name: '김교사', baseHoursPerWeek: 5 }],
      assignments: [
        {
          teacherName: '김교사',
          subjectName: '국어',
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 5,
        },
      ],
      issues: [],
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).toHaveBeenCalledTimes(1)
    expect(useSetupStore.getState().importReport?.status).toBe('SUCCESS')
    expect(useSetupStore.getState().isDirty).toBe(false)
    expect(useSetupStore.getState().autoSaveError).toBeNull()
    expect(useSetupStore.getState().isAutoSaving).toBe(false)
    expect(useSetupStore.getState().lastAutoSavedAt).not.toBeNull()
  })

  it('final-timetable SUCCESS: snapshot version 증가', async () => {
    seedBaseState()
    useSetupStore.getState().setTargetWeekTagForImport('2026-W12')
    repositoryMocks.loadLatestSnapshotByWeek.mockResolvedValue({
      ...latestSnapshot,
      id: 'snapshot-3',
      weekTag: '2026-W12',
      versionNo: 3,
    })
    parserMocks.parseFinalTimetableXlsx.mockReturnValue({
      sheetName: '1학기 시간표',
      schoolConfig: {
        gradeCount: 1,
        classCountByGrade: { 1: 1 },
        activeDays: ['MON', 'TUE'],
        periodsByDay: { MON: 2, TUE: 1 },
      },
      slots: [
        {
          grade: 1,
          classNumber: 1,
          day: 'MON',
          period: 1,
          subjectName: '국어',
          teacherName: '김교사',
        },
        {
          grade: 1,
          classNumber: 1,
          day: 'MON',
          period: 2,
          subjectName: '국어',
          teacherName: '김교사',
        },
      ],
      issues: [],
    })

    await useSetupStore.getState().importFinalTimetableFromFile(createFinalTimetableFile())

    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).toHaveBeenCalledTimes(1)
    const bundle =
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar.mock.calls[0]?.[0]
        ?.bundle
    const snapshot = bundle.timetableSnapshots?.[0]
    expect(snapshot?.weekTag).toBe('2026-W12')
    expect(snapshot?.versionNo).toBe(4)
    expect(snapshot?.baseVersionId).toBe('snapshot-3')
    expect(snapshot?.cells.every((cell) => cell.status === 'BASE')).toBe(true)
    expect(snapshot?.cells.every((cell) => cell.isFixed === false)).toBe(true)
    expect(snapshot?.cells.every((cell) => cell.subjectType === 'CLASS')).toBe(true)
    expect(useSetupStore.getState().latestSnapshot?.versionNo).toBe(4)
    expect(useSetupStore.getState().importReport?.status).toBe('SUCCESS')
  })

  it('final-timetable blocking: setup/snapshot 반영 중단 + FAILED', async () => {
    seedBaseState()
    parserMocks.parseFinalTimetableXlsx.mockReturnValue({
      sheetName: '1학기 시간표',
      schoolConfig: {
        gradeCount: 0,
        classCountByGrade: {},
        activeDays: [],
        periodsByDay: {},
      },
      slots: [],
      issues: [
        {
          code: 'MATCH_CONFLICT',
          severity: 'error',
          blocking: true,
          message: '충돌',
        },
      ],
    })

    const before = clone({
      schoolConfig: useSetupStore.getState().schoolConfig,
      subjects: useSetupStore.getState().subjects,
      teachers: useSetupStore.getState().teachers,
      fixedEvents: useSetupStore.getState().fixedEvents,
      latestSnapshot: useSetupStore.getState().latestSnapshot,
    })

    await useSetupStore.getState().importFinalTimetableFromFile(createFinalTimetableFile())

    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).not.toHaveBeenCalled()
    expect(useSetupStore.getState().importReport?.status).toBe('FAILED')
    expect({
      schoolConfig: useSetupStore.getState().schoolConfig,
      subjects: useSetupStore.getState().subjects,
      teachers: useSetupStore.getState().teachers,
      fixedEvents: useSetupStore.getState().fixedEvents,
      latestSnapshot: useSetupStore.getState().latestSnapshot,
    }).toEqual(before)
  })
})
