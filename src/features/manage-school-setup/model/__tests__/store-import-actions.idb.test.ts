import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinalTimetableImportPayload } from '../types'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableSnapshot } from '@/entities/timetable'

const parserMocks = vi.hoisted(() => ({
  parseFinalTimetableXlsx: vi.fn<
    (input: ArrayBuffer | Uint8Array) => FinalTimetableImportPayload
  >(),
}))

vi.mock('../final-timetable-xlsx-parser', () => ({
  parseFinalTimetableXlsx: parserMocks.parseFinalTimetableXlsx,
}))

const ts = '2026-02-22T00:00:00.000Z'

const initialSchoolConfig: SchoolConfig = {
  id: 'school-1',
  gradeCount: 1,
  classCountByGrade: { 1: 1 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: ts,
  updatedAt: ts,
}

const initialSubjects: Array<Subject> = [
  {
    id: 'subject-legacy',
    name: '수학 (공통)',
    abbreviation: '수',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  },
]

const initialTeachers: Array<Teacher> = [
  {
    id: 'teacher-legacy',
    name: '김교사(담임)',
    subjectIds: ['subject-legacy'],
    baseHoursPerWeek: 1,
    assignments: [
      {
        id: 'assignment-legacy',
        subjectId: 'subject-legacy',
        subjectType: 'CLASS',
        grade: 1,
        classNumber: 1,
        hoursPerWeek: 1,
      },
    ],
    homeroom: { grade: 1, classNumber: 1 },
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 1 }],
    createdAt: ts,
    updatedAt: ts,
  },
]

const initialSnapshot: TimetableSnapshot = {
  id: 'snapshot-1',
  schoolConfigId: 'school-1',
  weekTag: '2026-W15',
  versionNo: 1,
  baseVersionId: null,
  appliedScope: {
    type: 'THIS_WEEK',
    fromWeek: '2026-W15',
    toWeek: null,
  },
  cells: [],
  score: 70,
  generationTimeMs: 900,
  createdAt: ts,
}

async function loadStoreModule() {
  return import('../store')
}

async function loadGenerateStoreModule() {
  return import('@/features/generate-timetable/model/store')
}

async function loadEditStoreModule() {
  return import('@/features/edit-timetable-cell/model/store')
}

async function loadTeacherPolicyStoreModule() {
  return import('@/features/manage-teacher-policy/model/store')
}

async function loadChangeHistoryStoreModule() {
  return import('@/features/track-change-history/model/store')
}

async function loadDatabaseModule() {
  return import('@/shared/persistence/indexeddb/database')
}

async function loadRepositoryModule() {
  return import('@/shared/persistence/indexeddb/repository')
}

type StoreModule = Awaited<ReturnType<typeof loadStoreModule>>
type GenerateStoreModule = Awaited<ReturnType<typeof loadGenerateStoreModule>>
type EditStoreModule = Awaited<ReturnType<typeof loadEditStoreModule>>
type TeacherPolicyStoreModule = Awaited<
  ReturnType<typeof loadTeacherPolicyStoreModule>
>
type ChangeHistoryStoreModule = Awaited<
  ReturnType<typeof loadChangeHistoryStoreModule>
>
type DatabaseModule = Awaited<ReturnType<typeof loadDatabaseModule>>
type RepositoryModule = Awaited<ReturnType<typeof loadRepositoryModule>>

let useSetupStore: StoreModule['useSetupStore']
let SETUP_DRAFT_KEY: StoreModule['SETUP_DRAFT_KEY']
let useGenerateStore: GenerateStoreModule['useGenerateStore']
let useEditStore: EditStoreModule['useEditStore']
let useTeacherPolicyStore: TeacherPolicyStoreModule['useTeacherPolicyStore']
let useChangeHistoryStore: ChangeHistoryStoreModule['useChangeHistoryStore']
let db: DatabaseModule['db']
let repository: RepositoryModule

function createFinalTimetableFile(): File {
  return {
    name: 'final-timetable.xlsx',
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as File
}

async function importFinalTimetableForWeek15(): Promise<void> {
  await repository.saveAllSetupData({
    schoolConfig: initialSchoolConfig,
    subjects: initialSubjects,
    teachers: initialTeachers,
    fixedEvents: [],
  })
  await repository.saveTeacherPolicies([
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
  ])
  await repository.saveTimetableSnapshot(initialSnapshot)
  await useSetupStore.getState().loadFromDB()
  useSetupStore.getState().setTargetWeekTagForImport('2026-W15')

  parserMocks.parseFinalTimetableXlsx.mockReturnValue({
    sheetName: '1학기 시간표',
    schoolConfig: {
      gradeCount: 1,
      classCountByGrade: { 1: 1 },
      activeDays: ['MON'],
      periodsByDay: { MON: 1 },
    },
    slots: [
      {
        grade: 1,
        classNumber: 1,
        day: 'MON',
        period: 1,
        subjectName: '수학',
        teacherName: '김교사',
      },
    ],
    issues: [],
  })

  await useSetupStore
    .getState()
    .importFinalTimetableFromFile(createFinalTimetableFile())
}

beforeEach(async () => {
  vi.resetModules()
  parserMocks.parseFinalTimetableXlsx.mockReset()
  const storeModule = await loadStoreModule()
  useSetupStore = storeModule.useSetupStore
  SETUP_DRAFT_KEY = storeModule.SETUP_DRAFT_KEY
  const generateStoreModule = await loadGenerateStoreModule()
  useGenerateStore = generateStoreModule.useGenerateStore
  const editStoreModule = await loadEditStoreModule()
  useEditStore = editStoreModule.useEditStore
  const teacherPolicyStoreModule = await loadTeacherPolicyStoreModule()
  useTeacherPolicyStore = teacherPolicyStoreModule.useTeacherPolicyStore
  const changeHistoryStoreModule = await loadChangeHistoryStoreModule()
  useChangeHistoryStore = changeHistoryStoreModule.useChangeHistoryStore
  const databaseModule = await loadDatabaseModule()
  db = databaseModule.db
  repository = await loadRepositoryModule()
  useSetupStore.setState(useSetupStore.getInitialState(), true)
  useGenerateStore.setState(useGenerateStore.getInitialState(), true)
  useEditStore.setState(useEditStore.getInitialState(), true)
  useTeacherPolicyStore.setState(useTeacherPolicyStore.getInitialState(), true)
  useChangeHistoryStore.setState(useChangeHistoryStore.getInitialState(), true)
  window.localStorage.removeItem(SETUP_DRAFT_KEY)
  await db.schoolConfigs.clear()
  await db.subjects.clear()
  await db.teachers.clear()
  await db.fixedEvents.clear()
  await db.teacherPolicies.clear()
  await db.timetableSnapshots.clear()
  await db.changeEvents.clear()
  await db.academicCalendarEvents.clear()
})

describe('setup import actions idb round-trip', () => {
  it('final-timetable import 후 setup/policy/snapshot이 실제 repository에 반영된다', async () => {
    await importFinalTimetableForWeek15()

    const setup = await repository.loadAllSetupData()
    const policies = await repository.loadTeacherPolicies()
    const latestSnapshot = await repository.loadLatestSnapshotByWeek('2026-W15')

    expect(setup.schoolConfig?.id).toBe('school-1')
    expect(setup.subjects[0]?.id).toBe('subject-legacy')
    expect(setup.teachers[0]?.id).toBe('teacher-legacy')
    expect(policies).toHaveLength(1)
    expect(policies[0]?.id).toBe('policy-valid')
    expect(latestSnapshot?.versionNo).toBe(2)
    expect(latestSnapshot?.baseVersionId).toBe('snapshot-1')
    expect(latestSnapshot?.cells[0]).toEqual(
      expect.objectContaining({
        teacherId: 'teacher-legacy',
        subjectId: 'subject-legacy',
        status: 'BASE',
        isFixed: false,
        subjectType: 'CLASS',
      }),
    )
    expect(useSetupStore.getState().importReport?.status).toBe('PARTIAL_SUCCESS')
  })

  it('final-timetable import 후 /generate,/edit,/policy,/history store load smoke', async () => {
    await importFinalTimetableForWeek15()

    await useGenerateStore.getState().loadSetupData()
    expect(useGenerateStore.getState().setupLoaded).toBe(true)

    await useEditStore.getState().loadSnapshot({ weekTag: '2026-W15' })
    const editState = useEditStore.getState()
    expect(editState.snapshot).not.toBeNull()
    expect(editState.availableVersionNos.length).toBeGreaterThan(0)

    await useTeacherPolicyStore.getState().loadFromDB()
    expect(useTeacherPolicyStore.getState().selectedTeacherId).not.toBeNull()

    await useChangeHistoryStore.getState().loadEventsByWeek('2026-W15')
    expect(Array.isArray(useChangeHistoryStore.getState().events)).toBe(true)
  })

  it('snapshot 없는 주차에서 /edit,/history 빈 상태 안전 동작', async () => {
    await importFinalTimetableForWeek15()

    await useEditStore.getState().loadSnapshot({ weekTag: '2026-W16' })
    expect(useEditStore.getState().snapshot).toBeNull()
    expect(useEditStore.getState().availableVersionNos).toHaveLength(0)

    await useChangeHistoryStore.getState().loadEventsByWeek('2026-W16')
    expect(useChangeHistoryStore.getState().events).toHaveLength(0)
  })
})
