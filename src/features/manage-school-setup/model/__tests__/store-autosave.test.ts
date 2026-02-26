import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { FixedEvent } from '@/entities/fixed-event'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableSnapshot } from '@/entities/timetable'
import type {
  RecomputeInput,
  RecomputeResult,
} from '@/features/recompute-timetable'

const parserMocks = vi.hoisted(() => ({
  parseTeacherHoursXls: vi.fn(),
  parseFinalTimetableXlsx: vi.fn(),
}))

const repositoryMocks = vi.hoisted(() => ({
  loadAcademicCalendarEvents: vi.fn<
    () => Promise<Array<AcademicCalendarEvent>>
  >(),
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
  loadLatestTimetableSnapshot: vi.fn<
    () => Promise<TimetableSnapshot | undefined>
  >(),
  loadTeacherPolicies: vi.fn<() => Promise<Array<unknown>>>(),
  saveAcademicCalendarEvents: vi.fn<
    (events: Array<AcademicCalendarEvent>) => Promise<void>
  >(),
  saveAllSetupData: vi.fn<
    (data: {
      schoolConfig: SchoolConfig
      subjects: Array<Subject>
      teachers: Array<Teacher>
      fixedEvents: Array<FixedEvent>
    }) => Promise<void>
  >(),
  saveNextSnapshotVersion: vi.fn<
    (params: {
      sourceSnapshot: TimetableSnapshot
      cells: TimetableSnapshot['cells']
      overrideWeekTag?: TimetableSnapshot['weekTag']
    }) => Promise<TimetableSnapshot>
  >(),
  saveSetupImportBundle: vi.fn<
    (bundle: {
      schoolConfig: SchoolConfig
      subjects: Array<Subject>
      teachers: Array<Teacher>
      fixedEvents: Array<FixedEvent>
      teacherPolicies: Array<unknown>
      timetableSnapshots?: Array<TimetableSnapshot>
    }) => Promise<void>
  >(),
  saveSetupImportBundleWithAcademicCalendar: vi.fn<
    (input: {
      bundle: {
        schoolConfig: SchoolConfig
        subjects: Array<Subject>
        teachers: Array<Teacher>
        fixedEvents: Array<FixedEvent>
        teacherPolicies: Array<unknown>
        timetableSnapshots?: Array<TimetableSnapshot>
      }
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

const ts = '2026-02-20T00:00:00.000Z'

const baseSchoolConfig: SchoolConfig = {
  id: 'school-1',
  gradeCount: 1,
  classCountByGrade: { 1: 1 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: ts,
  updatedAt: ts,
}

type StoreModule = Awaited<ReturnType<typeof loadStoreModule>>

async function loadStoreModule() {
  return import('../store')
}

let useSetupStore: StoreModule['useSetupStore']
let AUTO_SAVE_DEBOUNCE_MS: StoreModule['AUTO_SAVE_DEBOUNCE_MS']
let SETUP_DRAFT_KEY: StoreModule['SETUP_DRAFT_KEY']

function clone<T>(value: T): T {
  return structuredClone(value)
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createTeacherHoursFile(): File {
  return {
    name: 'teacher-hours.xls',
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as File
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-02-25T09:00:00.000Z'))
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

  repositoryMocks.loadAllSetupData.mockResolvedValue({
    schoolConfig: clone(baseSchoolConfig),
    subjects: [],
    teachers: [],
    fixedEvents: [],
  })
  repositoryMocks.loadAcademicCalendarEvents.mockResolvedValue([])
  repositoryMocks.loadLatestTimetableSnapshot.mockResolvedValue(undefined)
  repositoryMocks.loadConstraintPolicy.mockResolvedValue(undefined)
  repositoryMocks.loadLatestSnapshotByWeek.mockResolvedValue(undefined)
  repositoryMocks.loadTeacherPolicies.mockResolvedValue([])
  repositoryMocks.saveAcademicCalendarEvents.mockResolvedValue(undefined)
  repositoryMocks.saveAllSetupData.mockResolvedValue(undefined)
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
  repositoryMocks.saveSetupImportBundle.mockResolvedValue(undefined)
  repositoryMocks.saveSetupImportBundleWithAcademicCalendar.mockResolvedValue(
    undefined,
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

  const storeModule = await loadStoreModule()
  useSetupStore = storeModule.useSetupStore
  AUTO_SAVE_DEBOUNCE_MS = storeModule.AUTO_SAVE_DEBOUNCE_MS
  SETUP_DRAFT_KEY = storeModule.SETUP_DRAFT_KEY
  useSetupStore.setState(useSetupStore.getInitialState(), true)
  window.localStorage.clear()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('setup store autosave', () => {
  it('single mutation triggers one save after 700ms', async () => {
    useSetupStore.getState().setSchoolConfig(clone(baseSchoolConfig))

    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS - 1)
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(0)

    await vi.advanceTimersByTimeAsync(1)
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(1)
    expect(repositoryMocks.saveAcademicCalendarEvents).toHaveBeenCalledTimes(1)
  })

  it('multiple mutations within 700ms coalesce to one save', async () => {
    useSetupStore.setState({ schoolConfig: clone(baseSchoolConfig) })

    useSetupStore.getState().addSubject({
      name: '국어',
      abbreviation: '국',
      track: 'COMMON',
    })
    await vi.advanceTimersByTimeAsync(300)
    useSetupStore.getState().addTeacher({
      name: '김교사',
      subjectIds: [],
      baseHoursPerWeek: 10,
      assignments: [],
      homeroom: null,
      classAssignments: [],
    })
    await vi.advanceTimersByTimeAsync(300)

    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(0)

    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(1)
  })

  it("flushAutoSave('pagehide') flushes immediately and avoids duplicate timer save", async () => {
    useSetupStore.setState({ schoolConfig: clone(baseSchoolConfig) })
    useSetupStore.getState().addSubject({
      name: '수학',
      abbreviation: '수',
      track: 'COMMON',
    })

    await useSetupStore.getState().flushAutoSave('pagehide')
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS + 50)
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(1)
  })

  it('non-manual flush on clean state skips persistence writes', async () => {
    useSetupStore.setState({
      schoolConfig: clone(baseSchoolConfig),
      isDirty: false,
    })

    await useSetupStore.getState().flushAutoSave('pagehide')

    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(0)
    expect(repositoryMocks.saveAcademicCalendarEvents).toHaveBeenCalledTimes(0)
  })

  it('loadFromDB prefers newer local draft and schedules persistence', async () => {
    const dbConfig: SchoolConfig = {
      ...clone(baseSchoolConfig),
      periodsPerDay: 6,
      updatedAt: '2026-02-20T00:00:00.000Z',
    }
    repositoryMocks.loadAllSetupData.mockResolvedValueOnce({
      schoolConfig: dbConfig,
      subjects: [],
      teachers: [],
      fixedEvents: [],
    })
    repositoryMocks.loadAcademicCalendarEvents.mockResolvedValueOnce([])

    const draftConfig: SchoolConfig = {
      ...clone(baseSchoolConfig),
      periodsPerDay: 8,
      updatedAt: '2026-02-21T00:00:00.000Z',
    }
    window.localStorage.setItem(
      SETUP_DRAFT_KEY,
      JSON.stringify({
        schoolConfig: draftConfig,
        subjects: [],
        teachers: [],
        fixedEvents: [],
        academicCalendarEvents: [],
        updatedAt: '2026-02-21T00:00:00.000Z',
      }),
    )

    await useSetupStore.getState().loadFromDB()

    expect(useSetupStore.getState().schoolConfig?.periodsPerDay).toBe(8)
    expect(useSetupStore.getState().isDirty).toBe(true)
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(0)

    await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(1)
    expect(repositoryMocks.saveAllSetupData.mock.calls[0]?.[0].schoolConfig).toEqual(
      expect.objectContaining({
        periodsPerDay: 8,
      }),
    )
  })

  it('save failure sets autoSaveError and resets isAutoSaving', async () => {
    repositoryMocks.saveAllSetupData.mockRejectedValueOnce(new Error('db write failed'))
    useSetupStore.setState({
      schoolConfig: clone(baseSchoolConfig),
      isDirty: true,
    })

    const flushPromise = useSetupStore.getState().flushAutoSave('manual')
    expect(useSetupStore.getState().isAutoSaving).toBe(true)

    await flushPromise

    expect(useSetupStore.getState().isAutoSaving).toBe(false)
    expect(useSetupStore.getState().autoSaveError).toBe('db write failed')
    expect(useSetupStore.getState().isDirty).toBe(true)
  })

  it('successful autosave clears draft and next loadFromDB does not force draft restore', async () => {
    useSetupStore.setState({ schoolConfig: clone(baseSchoolConfig) })
    useSetupStore.getState().addSubject({
      name: '국어',
      abbreviation: '국',
      track: 'COMMON',
    })

    expect(window.localStorage.getItem(SETUP_DRAFT_KEY)).not.toBeNull()

    await useSetupStore.getState().flushAutoSave('manual')

    expect(window.localStorage.getItem(SETUP_DRAFT_KEY)).toBeNull()
    expect(useSetupStore.getState().isDirty).toBe(false)

    useSetupStore.setState(useSetupStore.getInitialState(), true)
    repositoryMocks.loadAllSetupData.mockResolvedValueOnce({
      schoolConfig: clone(baseSchoolConfig),
      subjects: [
        {
          id: 'subject-db',
          name: '국어',
          abbreviation: '국',
          track: 'COMMON',
          createdAt: '2026-02-25T09:00:00.000Z',
          updatedAt: '2026-02-25T09:00:00.000Z',
        },
      ],
      teachers: [],
      fixedEvents: [],
    })
    repositoryMocks.loadAcademicCalendarEvents.mockResolvedValueOnce([])

    await useSetupStore.getState().loadFromDB()

    expect(useSetupStore.getState().isDirty).toBe(false)
    expect(useSetupStore.getState().subjects).toHaveLength(1)
  })

  it('save in progress + new mutation triggers follow-up flush with latest data', async () => {
    const firstSave = createDeferred<void>()
    repositoryMocks.saveAllSetupData
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValue(undefined)
    useSetupStore.setState({ schoolConfig: clone(baseSchoolConfig) })
    useSetupStore.getState().addSubject({
      name: '국어',
      abbreviation: '국',
      track: 'COMMON',
    })

    const flushPromise = useSetupStore.getState().flushAutoSave('manual')
    await Promise.resolve()
    expect(useSetupStore.getState().isAutoSaving).toBe(true)
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(1)

    useSetupStore.getState().addSubject({
      name: '영어',
      abbreviation: '영',
      track: 'COMMON',
    })

    firstSave.resolve(undefined)
    await flushPromise

    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(2)
    const secondSavedSubjectNames = repositoryMocks.saveAllSetupData.mock.calls[1]?.[0].subjects.map(
      (subject) => subject.name,
    )
    expect(secondSavedSubjectNames).toEqual(expect.arrayContaining(['국어', '영어']))
    expect(useSetupStore.getState().isDirty).toBe(false)
  })

  it('import waits for in-flight autosave to finish before bundle write', async () => {
    const firstSave = createDeferred<void>()
    repositoryMocks.saveAllSetupData
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValue(undefined)
    useSetupStore.setState({ schoolConfig: clone(baseSchoolConfig) })
    useSetupStore.getState().addSubject({
      name: '국어',
      abbreviation: '국',
      track: 'COMMON',
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

    const flushPromise = useSetupStore.getState().flushAutoSave('manual')
    await Promise.resolve()
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(1)

    const importPromise = useSetupStore
      .getState()
      .importTeacherHoursFromFile(createTeacherHoursFile())
    await Promise.resolve()
    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).toHaveBeenCalledTimes(0)

    firstSave.resolve(undefined)
    await flushPromise
    await importPromise

    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).toHaveBeenCalledTimes(1)
  })

  it('import in-flight + mutation keeps dirty until follow-up autosave persists', async () => {
    const importSave = createDeferred<void>()
    const importSaveStarted = createDeferred<void>()
    const followUpSaveStarted = createDeferred<void>()
    const followUpSave = createDeferred<void>()
    repositoryMocks.saveSetupImportBundleWithAcademicCalendar.mockImplementationOnce(
      () => {
        importSaveStarted.resolve(undefined)
        return importSave.promise
      },
    )
    repositoryMocks.saveAllSetupData.mockImplementationOnce(() => {
      followUpSaveStarted.resolve(undefined)
      return followUpSave.promise
    })
    useSetupStore.setState({ schoolConfig: clone(baseSchoolConfig) })
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

    const importPromise = useSetupStore
      .getState()
      .importTeacherHoursFromFile(createTeacherHoursFile())
    await importSaveStarted.promise
    expect(
      repositoryMocks.saveSetupImportBundleWithAcademicCalendar,
    ).toHaveBeenCalledTimes(1)

    useSetupStore.getState().addAcademicCalendarEvent({
      eventType: 'HOLIDAY',
      startDate: '2026-03-01',
      endDate: '2026-03-01',
      scopeType: 'SCHOOL',
      scopeValue: null,
      periodOverride: null,
    })

    importSave.resolve(undefined)
    await followUpSaveStarted.promise

    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(1)
    expect(useSetupStore.getState().isDirty).toBe(true)
    expect(useSetupStore.getState().isAutoSaving).toBe(true)

    followUpSave.resolve(undefined)
    await importPromise

    expect(useSetupStore.getState().isDirty).toBe(false)
    expect(repositoryMocks.saveAcademicCalendarEvents).toHaveBeenCalledTimes(1)
    expect(repositoryMocks.saveAcademicCalendarEvents.mock.calls[0]?.[0]).toHaveLength(
      1,
    )
  })

  it('delete-only change writes newer draft timestamp and loadFromDB prefers draft', async () => {
    useSetupStore.setState({
      schoolConfig: clone(baseSchoolConfig),
      subjects: [
        {
          id: 'subject-1',
          name: '삭제대상',
          abbreviation: '삭',
          track: 'COMMON',
          createdAt: '2026-02-20T00:00:00.000Z',
          updatedAt: '2026-02-20T00:00:00.000Z',
        },
      ],
    })

    useSetupStore.getState().removeSubject('subject-1')

    const draftRaw = window.localStorage.getItem(SETUP_DRAFT_KEY)
    expect(draftRaw).not.toBeNull()
    const draft = JSON.parse(draftRaw ?? '{}') as {
      subjects: Array<Subject>
      updatedAt: string
    }
    expect(draft.subjects).toHaveLength(0)
    expect(draft.updatedAt).toBe('2026-02-25T09:00:00.000Z')

    vi.clearAllTimers()
    useSetupStore.setState(useSetupStore.getInitialState(), true)

    repositoryMocks.loadAllSetupData.mockResolvedValueOnce({
      schoolConfig: clone(baseSchoolConfig),
      subjects: [
        {
          id: 'subject-1',
          name: '삭제대상',
          abbreviation: '삭',
          track: 'COMMON',
          createdAt: '2026-02-20T00:00:00.000Z',
          updatedAt: '2026-02-20T00:00:00.000Z',
        },
      ],
      teachers: [],
      fixedEvents: [],
    })
    repositoryMocks.loadAcademicCalendarEvents.mockResolvedValueOnce([])

    await useSetupStore.getState().loadFromDB()

    expect(useSetupStore.getState().subjects).toHaveLength(0)
    expect(useSetupStore.getState().isDirty).toBe(true)
  })

  it('empty DB with existing draft prefers draft during loadFromDB', async () => {
    repositoryMocks.loadAllSetupData.mockResolvedValueOnce({
      schoolConfig: undefined,
      subjects: [],
      teachers: [],
      fixedEvents: [],
    })
    repositoryMocks.loadAcademicCalendarEvents.mockResolvedValueOnce([])
    window.localStorage.setItem(
      SETUP_DRAFT_KEY,
      JSON.stringify({
        schoolConfig: {
          ...clone(baseSchoolConfig),
          periodsPerDay: 9,
          updatedAt: '2026-02-25T09:10:00.000Z',
        },
        subjects: [],
        teachers: [],
        fixedEvents: [],
        academicCalendarEvents: [],
        updatedAt: '2026-02-25T09:10:00.000Z',
      }),
    )

    await useSetupStore.getState().loadFromDB()

    expect(useSetupStore.getState().schoolConfig?.periodsPerDay).toBe(9)
    expect(useSetupStore.getState().isDirty).toBe(true)
  })

  it('dirty state + import failure queues follow-up autosave and persists changes', async () => {
    useSetupStore.setState({ schoolConfig: clone(baseSchoolConfig) })
    useSetupStore.getState().addSubject({
      name: '국어',
      abbreviation: '국',
      track: 'COMMON',
    })
    vi.clearAllMocks()
    parserMocks.parseTeacherHoursXls.mockImplementation(() => {
      throw new Error('parse failed')
    })

    await useSetupStore.getState().importTeacherHoursFromFile(createTeacherHoursFile())

    expect(useSetupStore.getState().importReport?.status).toBe('FAILED')
    expect(repositoryMocks.saveAllSetupData).toHaveBeenCalledTimes(1)
    expect(useSetupStore.getState().isDirty).toBe(false)
  })
})
