import { create } from 'zustand'
import { parseFinalTimetableXlsx } from './final-timetable-xlsx-parser'
import { normalizeImportName } from './name-normalizer'
import { parseTeacherHoursXls } from './teacher-hours-xls-parser'
import { runFullValidation } from './validation'
import type {
  FinalTimetableImportPayload,
  ImportIssue,
  ImportReport,
  ImportSource,
  TeacherHoursImportPayload,
} from './types'
import type { ValidationMessage } from './validation'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { FixedEvent } from '@/entities/fixed-event'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type {
  ClassHoursAssignment,
  HomeroomAssignment,
  Teacher,
  Teacher as TeacherEntity,
  TeachingAssignment,
} from '@/entities/teacher'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import type { DayOfWeek } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'
import type { SetupImportBundle } from '@/shared/persistence/indexeddb/repository'
import {
  loadAcademicCalendarEvents,
  loadAllSetupData,
  loadLatestSnapshotByWeek,
  loadLatestTimetableSnapshot,
  loadTeacherPolicies,
  saveAcademicCalendarEvents,
  saveAllSetupData,
  saveSetupImportBundle,
} from '@/shared/persistence/indexeddb/repository'
import { generateId } from '@/shared/lib/id'
import { computeWeekTagFromTimestamp } from '@/shared/lib/week-tag'

export type SetupTab =
  | 'school'
  | 'subjects'
  | 'teachers'
  | 'fixedEvents'
  | 'academicCalendar'

interface SetupState {
  schoolConfig: SchoolConfig | null
  subjects: Array<Subject>
  teachers: Array<Teacher>
  fixedEvents: Array<FixedEvent>
  importReport: ImportReport | null
  targetWeekTagForImport: WeekTag
  academicCalendarEvents: Array<AcademicCalendarEvent>
  baselineAcademicCalendarEvents: Array<AcademicCalendarEvent>
  latestSnapshot: TimetableSnapshot | null
  activeTab: SetupTab
  isDirty: boolean
  validationMessages: Array<ValidationMessage>
  isLoading: boolean

  // Tab
  setActiveTab: (tab: SetupTab) => void

  // SchoolConfig
  setSchoolConfig: (config: SchoolConfig) => void

  // Subjects
  addSubject: (subject: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateSubject: (id: string, updates: Partial<Subject>) => void
  removeSubject: (id: string) => void

  // Teachers
  addTeacher: (teacher: Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTeacher: (id: string, updates: Partial<Teacher>) => void
  removeTeacher: (id: string) => void

  // FixedEvents
  addFixedEvent: (
    event: Omit<FixedEvent, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void
  updateFixedEvent: (id: string, updates: Partial<FixedEvent>) => void
  removeFixedEvent: (id: string) => void

  // AcademicCalendarEvents
  addAcademicCalendarEvent: (
    event: Omit<AcademicCalendarEvent, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void
  updateAcademicCalendarEvent: (
    id: string,
    updates: Partial<AcademicCalendarEvent>,
  ) => void
  removeAcademicCalendarEvent: (id: string) => void
  setTargetWeekTagForImport: (weekTag: WeekTag) => void
  importTeacherHoursFromFile: (file: File) => Promise<void>
  importFinalTimetableFromFile: (file: File) => Promise<void>

  // Persistence
  loadFromDB: () => Promise<void>
  saveToDB: () => Promise<void>

  // Validation
  runValidation: () => void
}

function now(): string {
  return new Date().toISOString()
}

const DAY_ORDER: Array<DayOfWeek> = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function createImportIssue(input: {
  message: string
  severity: 'error' | 'warning'
  blocking: boolean
}): ImportIssue {
  return {
    code: 'UNKNOWN',
    severity: input.severity,
    blocking: input.blocking,
    message: input.message,
  }
}

function hasBlockingIssue(issues: Array<ImportIssue>): boolean {
  return issues.some((issue) => issue.blocking)
}

function resolveImportStatus(
  issues: Array<ImportIssue>,
): ImportReport['status'] {
  if (hasBlockingIssue(issues)) {
    return 'FAILED'
  }
  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'PARTIAL_SUCCESS'
  }
  return 'SUCCESS'
}

function createImportReport(input: {
  source: ImportSource
  targetWeekTag: WeekTag
  createdAt: string
  issues: Array<ImportIssue>
}): ImportReport {
  return {
    source: input.source,
    status: resolveImportStatus(input.issues),
    targetWeekTag: input.targetWeekTag,
    createdAt: input.createdAt,
    issues: input.issues,
    summary: {
      errorCount: input.issues.filter((issue) => issue.severity === 'error').length,
      warningCount: input.issues.filter((issue) => issue.severity === 'warning')
        .length,
      blockingCount: input.issues.filter((issue) => issue.blocking).length,
    },
  }
}

function normalizeDays(days: Array<DayOfWeek>): Array<DayOfWeek> {
  const daySet = new Set<DayOfWeek>(days)
  return DAY_ORDER.filter((day) => daySet.has(day))
}

function mapByNormalizedName<T extends { name: string }>(
  items: Array<T>,
): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) {
    const normalizedName = normalizeImportName(item.name)
    if (!normalizedName || map.has(normalizedName)) continue
    map.set(normalizedName, item)
  }
  return map
}

function isValidHomeroom(
  homeroom: HomeroomAssignment | null,
  schoolConfig: SchoolConfig,
): homeroom is HomeroomAssignment {
  if (!homeroom) return false
  if (homeroom.grade < 1 || homeroom.grade > schoolConfig.gradeCount) return false
  const classCount = schoolConfig.classCountByGrade[homeroom.grade] ?? 0
  if (classCount < 1) return false
  return homeroom.classNumber >= 1 && homeroom.classNumber <= classCount
}

function sanitizeHomeroom(
  homeroom: HomeroomAssignment | null,
  schoolConfig: SchoolConfig,
): HomeroomAssignment | null {
  return isValidHomeroom(homeroom, schoolConfig) ? homeroom : null
}

function buildSubjectAbbreviation(name: string): string {
  const condensed = name.replace(/\s+/g, '')
  if (condensed.length >= 2) {
    return condensed.slice(0, 2)
  }
  if (condensed.length === 1) {
    return condensed
  }
  const fallback = name.trim()
  if (fallback.length > 0) {
    return fallback.slice(0, 1)
  }
  return 'X'
}

function buildTeacherClassAssignments(
  assignments: Array<TeachingAssignment>,
): Array<ClassHoursAssignment> {
  const byClassKey = new Map<string, ClassHoursAssignment>()
  for (const assignment of assignments) {
    if (
      assignment.subjectType !== 'CLASS' ||
      assignment.grade === null ||
      assignment.classNumber === null
    ) {
      continue
    }
    const key = `${assignment.grade}-${assignment.classNumber}`
    const previous = byClassKey.get(key)
    if (previous) {
      previous.hoursPerWeek += assignment.hoursPerWeek
      continue
    }
    byClassKey.set(key, {
      grade: assignment.grade,
      classNumber: assignment.classNumber,
      hoursPerWeek: assignment.hoursPerWeek,
    })
  }
  return [...byClassKey.values()].sort((a, b) => {
    if (a.grade === b.grade) {
      return a.classNumber - b.classNumber
    }
    return a.grade - b.grade
  })
}

function buildTeacherSubjectIds(assignments: Array<TeachingAssignment>): Array<string> {
  return [...new Set(assignments.map((assignment) => assignment.subjectId))]
}

function buildPeriodsByDay(
  periodsByDay: Partial<Record<DayOfWeek, number>>,
): Record<DayOfWeek, number> {
  return {
    MON: periodsByDay.MON ?? 0,
    TUE: periodsByDay.TUE ?? 0,
    WED: periodsByDay.WED ?? 0,
    THU: periodsByDay.THU ?? 0,
    FRI: periodsByDay.FRI ?? 0,
    SAT: periodsByDay.SAT ?? 0,
  }
}

function maxPeriodsPerDay(periodsByDay: Partial<Record<DayOfWeek, number>>): number {
  return DAY_ORDER.reduce((max, day) => Math.max(max, periodsByDay[day] ?? 0), 0)
}

function pruneOrphans(input: {
  fixedEvents: Array<FixedEvent>
  teacherPolicies: Array<TeacherPolicy>
  teachers: Array<TeacherEntity>
  subjects: Array<Subject>
  issues: Array<ImportIssue>
}): {
  fixedEvents: Array<FixedEvent>
  teacherPolicies: Array<TeacherPolicy>
} {
  const teacherIds = new Set(input.teachers.map((teacher) => teacher.id))
  const subjectIds = new Set(input.subjects.map((subject) => subject.id))
  const fixedEvents = input.fixedEvents.filter((event) => {
    if (event.teacherId && !teacherIds.has(event.teacherId)) {
      return false
    }
    if (event.subjectId && !subjectIds.has(event.subjectId)) {
      return false
    }
    return true
  })
  const removedFixedEventCount = input.fixedEvents.length - fixedEvents.length
  if (removedFixedEventCount > 0) {
    input.issues.push(
      createImportIssue({
        message: `참조 무효 고정 이벤트 ${removedFixedEventCount}건을 삭제했습니다.`,
        severity: 'warning',
        blocking: false,
      }),
    )
  }

  const teacherPolicies = input.teacherPolicies.filter((policy) =>
    teacherIds.has(policy.teacherId),
  )
  const removedPolicyCount = input.teacherPolicies.length - teacherPolicies.length
  if (removedPolicyCount > 0) {
    input.issues.push(
      createImportIssue({
        message: `교사 참조 무효 정책 ${removedPolicyCount}건을 삭제했습니다.`,
        severity: 'warning',
        blocking: false,
      }),
    )
  }

  return { fixedEvents, teacherPolicies }
}

interface ImportPipelineTransformResult {
  schoolConfig: SchoolConfig
  subjects: Array<Subject>
  teachers: Array<Teacher>
  fixedEvents: Array<FixedEvent>
  timetableSnapshots?: Array<TimetableSnapshot>
  latestSnapshot: TimetableSnapshot | null
}

interface ImportPipelineInput<TPayload> {
  source: ImportSource
  file: File
  parser: (input: ArrayBuffer | Uint8Array) => TPayload
  extractIssues: (payload: TPayload) => Array<ImportIssue>
  transform: (input: {
    payload: TPayload
    state: SetupState
    createdAt: string
    targetWeekTag: WeekTag
    issues: Array<ImportIssue>
  }) => ImportPipelineTransformResult | null | Promise<ImportPipelineTransformResult | null>
}

export const useSetupStore = create<SetupState>((set, get) => {
  const runImportPipeline = async <TPayload>(
    input: ImportPipelineInput<TPayload>,
  ): Promise<void> => {
    const targetWeekTag = get().targetWeekTagForImport
    const createdAt = now()
    const issues: Array<ImportIssue> = []

    let payload: TPayload | null = null
    try {
      const fileBuffer = await input.file.arrayBuffer()
      payload = input.parser(fileBuffer)
      issues.push(...input.extractIssues(payload))
    } catch {
      issues.push(
        createImportIssue({
          message: '파일 읽기 또는 파싱에 실패했습니다.',
          severity: 'error',
          blocking: true,
        }),
      )
    }

    if (!payload || hasBlockingIssue(issues)) {
      set({
        importReport: createImportReport({
          source: input.source,
          targetWeekTag,
          createdAt,
          issues,
        }),
      })
      return
    }

    let transformed: ImportPipelineTransformResult | null = null
    try {
      transformed = await input.transform({
        payload,
        state: get(),
        createdAt,
        targetWeekTag,
        issues,
      })
    } catch {
      issues.push(
        createImportIssue({
          message: '파싱 결과를 엔티티로 변환하는 중 오류가 발생했습니다.',
          severity: 'error',
          blocking: true,
        }),
      )
    }

    if (!transformed || hasBlockingIssue(issues)) {
      set({
        importReport: createImportReport({
          source: input.source,
          targetWeekTag,
          createdAt,
          issues,
        }),
      })
      return
    }

    try {
      const teacherPolicies = await loadTeacherPolicies()
      const pruned = pruneOrphans({
        fixedEvents: transformed.fixedEvents,
        teacherPolicies,
        teachers: transformed.teachers,
        subjects: transformed.subjects,
        issues,
      })
      const bundle: SetupImportBundle = {
        schoolConfig: transformed.schoolConfig,
        subjects: transformed.subjects,
        teachers: transformed.teachers,
        fixedEvents: pruned.fixedEvents,
        teacherPolicies: pruned.teacherPolicies,
        timetableSnapshots: transformed.timetableSnapshots,
      }
      await saveSetupImportBundle(bundle)
      const importReport = createImportReport({
        source: input.source,
        targetWeekTag,
        createdAt,
        issues,
      })
      set({
        schoolConfig: bundle.schoolConfig,
        subjects: bundle.subjects,
        teachers: bundle.teachers,
        fixedEvents: bundle.fixedEvents,
        latestSnapshot: transformed.latestSnapshot,
        validationMessages: runFullValidation(
          bundle.schoolConfig,
          bundle.subjects,
          bundle.teachers,
          bundle.fixedEvents,
        ),
        importReport,
      })
    } catch {
      issues.push(
        createImportIssue({
          message: '반영 데이터 저장 중 오류가 발생했습니다.',
          severity: 'error',
          blocking: true,
        }),
      )
      set({
        importReport: createImportReport({
          source: input.source,
          targetWeekTag,
          createdAt,
          issues,
        }),
      })
    }
  }

  return {
    schoolConfig: null,
    subjects: [],
    teachers: [],
    fixedEvents: [],
    importReport: null,
    targetWeekTagForImport: computeWeekTagFromTimestamp(Date.now()),
    academicCalendarEvents: [],
    baselineAcademicCalendarEvents: [],
    latestSnapshot: null,
    activeTab: 'school',
    isDirty: false,
    validationMessages: [],
    isLoading: false,

    setActiveTab: (tab) => set({ activeTab: tab }),

    // SchoolConfig
    setSchoolConfig: (config) =>
      set({ schoolConfig: { ...config, updatedAt: now() }, isDirty: true }),

    // Subjects
    addSubject: (data) => {
      const timestamp = now()
      const subject: Subject = {
        ...data,
        id: generateId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      set((s) => ({ subjects: [...s.subjects, subject], isDirty: true }))
    },

    updateSubject: (id, updates) =>
      set((s) => ({
        subjects: s.subjects.map((sub) =>
          sub.id === id ? { ...sub, ...updates, updatedAt: now() } : sub,
        ),
        isDirty: true,
      })),

    removeSubject: (id) =>
      set((s) => ({
        subjects: s.subjects.filter((sub) => sub.id !== id),
        isDirty: true,
      })),

    // Teachers
    addTeacher: (data) => {
      const timestamp = now()
      const teacher: Teacher = {
        ...data,
        id: generateId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      set((s) => ({ teachers: [...s.teachers, teacher], isDirty: true }))
    },

    updateTeacher: (id, updates) =>
      set((s) => ({
        teachers: s.teachers.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: now() } : t,
        ),
        isDirty: true,
      })),

    removeTeacher: (id) =>
      set((s) => ({
        teachers: s.teachers.filter((t) => t.id !== id),
        isDirty: true,
      })),

    // FixedEvents
    addFixedEvent: (data) => {
      const timestamp = now()
      const event: FixedEvent = {
        ...data,
        id: generateId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      set((s) => ({ fixedEvents: [...s.fixedEvents, event], isDirty: true }))
    },

    updateFixedEvent: (id, updates) =>
      set((s) => ({
        fixedEvents: s.fixedEvents.map((e) =>
          e.id === id ? { ...e, ...updates, updatedAt: now() } : e,
        ),
        isDirty: true,
      })),

    removeFixedEvent: (id) =>
      set((s) => ({
        fixedEvents: s.fixedEvents.filter((e) => e.id !== id),
        isDirty: true,
      })),

    // AcademicCalendarEvents
    addAcademicCalendarEvent: (data) => {
      const timestamp = now()
      const event: AcademicCalendarEvent = {
        ...data,
        id: generateId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      set((s) => ({
        academicCalendarEvents: [...s.academicCalendarEvents, event],
        isDirty: true,
      }))
    },

    updateAcademicCalendarEvent: (id, updates) =>
      set((s) => ({
        academicCalendarEvents: s.academicCalendarEvents.map((event) =>
          event.id === id ? { ...event, ...updates, updatedAt: now() } : event,
        ),
        isDirty: true,
      })),

    removeAcademicCalendarEvent: (id) =>
      set((s) => ({
        academicCalendarEvents: s.academicCalendarEvents.filter(
          (event) => event.id !== id,
        ),
        isDirty: true,
      })),

    setTargetWeekTagForImport: (weekTag) =>
      set({ targetWeekTagForImport: weekTag }),

    importTeacherHoursFromFile: async (file) => {
      await runImportPipeline<TeacherHoursImportPayload>({
        source: 'TEACHER_HOURS_XLS',
        file,
        parser: parseTeacherHoursXls,
        extractIssues: (payload) => payload.issues,
        transform: ({ payload, state, createdAt, issues }) => {
          if (!state.schoolConfig) {
            issues.push(
              createImportIssue({
                message: '학교 구조가 없어 교사 시수표를 반영할 수 없습니다.',
                severity: 'error',
                blocking: true,
              }),
            )
            return null
          }
          const currentSchoolConfig = state.schoolConfig

          const subjectNames: Array<string> = []
          for (const subject of payload.subjects) {
            const normalizedName = normalizeImportName(subject.name)
            if (!normalizedName || subjectNames.includes(normalizedName)) continue
            subjectNames.push(normalizedName)
          }
          for (const assignment of payload.assignments) {
            const normalizedName = normalizeImportName(assignment.subjectName)
            if (!normalizedName || subjectNames.includes(normalizedName)) continue
            subjectNames.push(normalizedName)
          }

          const existingSubjectByName = mapByNormalizedName(state.subjects)
          const subjects: Array<Subject> = subjectNames.map((name) => {
            const existing = existingSubjectByName.get(name)
            return {
              id: existing?.id ?? generateId(),
              name,
              abbreviation: existing?.abbreviation ?? buildSubjectAbbreviation(name),
              track: existing?.track ?? 'COMMON',
              createdAt: existing?.createdAt ?? createdAt,
              updatedAt: createdAt,
            }
          })
          const subjectIdByName = new Map<string, string>(
            subjects.map((subject) => [normalizeImportName(subject.name), subject.id]),
          )

          const teacherNameOrder: Array<string> = []
          const teacherBaseHoursByName = new Map<string, number>()
          for (const teacher of payload.teachers) {
            const normalizedName = normalizeImportName(teacher.name)
            if (!normalizedName) continue
            if (!teacherBaseHoursByName.has(normalizedName)) {
              teacherNameOrder.push(normalizedName)
              teacherBaseHoursByName.set(normalizedName, teacher.baseHoursPerWeek)
              continue
            }
            teacherBaseHoursByName.set(
              normalizedName,
              (teacherBaseHoursByName.get(normalizedName) ?? 0) +
                teacher.baseHoursPerWeek,
            )
          }

          const assignmentByCompositeKey = new Map<
            string,
            {
              teacherName: string
              subjectId: string
              grade: number
              classNumber: number
              hoursPerWeek: number
            }
          >()
          for (const assignment of payload.assignments) {
            const teacherName = normalizeImportName(assignment.teacherName)
            const subjectName = normalizeImportName(assignment.subjectName)
            const subjectId = subjectIdByName.get(subjectName)
            if (!teacherName || !subjectId) continue

            if (!teacherBaseHoursByName.has(teacherName)) {
              teacherNameOrder.push(teacherName)
              teacherBaseHoursByName.set(teacherName, 0)
            }

            const key = `${teacherName}|${subjectId}|${assignment.grade}|${assignment.classNumber}`
            const previous = assignmentByCompositeKey.get(key)
            if (previous) {
              previous.hoursPerWeek += assignment.hoursPerWeek
              continue
            }
            assignmentByCompositeKey.set(key, {
              teacherName,
              subjectId,
              grade: assignment.grade,
              classNumber: assignment.classNumber,
              hoursPerWeek: assignment.hoursPerWeek,
            })
          }

          const assignmentsByTeacherName = new Map<string, Array<TeachingAssignment>>()
          for (const assignment of assignmentByCompositeKey.values()) {
            const assignments =
              assignmentsByTeacherName.get(assignment.teacherName) ?? []
            assignments.push({
              id: generateId(),
              subjectId: assignment.subjectId,
              subjectType: 'CLASS',
              grade: assignment.grade,
              classNumber: assignment.classNumber,
              hoursPerWeek: assignment.hoursPerWeek,
            })
            assignmentsByTeacherName.set(assignment.teacherName, assignments)
          }

          const existingTeacherByName = mapByNormalizedName(state.teachers)
          const teachers: Array<Teacher> = teacherNameOrder.map((name) => {
            const existing = existingTeacherByName.get(name)
            const assignments = assignmentsByTeacherName.get(name) ?? []
            const assignedHours = assignments.reduce(
              (sum, assignment) => sum + assignment.hoursPerWeek,
              0,
            )
            return {
              id: existing?.id ?? generateId(),
              name,
              subjectIds: buildTeacherSubjectIds(assignments),
              baseHoursPerWeek: teacherBaseHoursByName.get(name) ?? assignedHours,
              assignments,
              homeroom: sanitizeHomeroom(
                existing?.homeroom ?? null,
                currentSchoolConfig,
              ),
              classAssignments: buildTeacherClassAssignments(assignments),
              createdAt: existing?.createdAt ?? createdAt,
              updatedAt: createdAt,
            }
          })

          if (
            subjects.length === 0 ||
            teachers.length === 0 ||
            assignmentByCompositeKey.size === 0
          ) {
            issues.push(
              createImportIssue({
                message:
                  '교사 시수표에서 반영 가능한 과목/교사/배정 데이터가 없어 저장을 중단했습니다.',
                severity: 'error',
                blocking: true,
              }),
            )
            return null
          }

          return {
            schoolConfig: currentSchoolConfig,
            subjects,
            teachers,
            fixedEvents: state.fixedEvents,
            latestSnapshot: state.latestSnapshot,
          }
        },
      })
    },

    importFinalTimetableFromFile: async (file) => {
      await runImportPipeline<FinalTimetableImportPayload>({
        source: 'FINAL_TIMETABLE_XLSX',
        file,
        parser: parseFinalTimetableXlsx,
        extractIssues: (payload) => payload.issues,
        transform: async ({
          payload,
          state,
          createdAt,
          targetWeekTag,
          issues,
        }) => {
          const schoolConfigId = state.schoolConfig?.id ?? generateId()
          const classCountByGrade: Record<number, number> = {}
          for (const [grade, classCount] of Object.entries(
            payload.schoolConfig.classCountByGrade,
          )) {
            classCountByGrade[Number(grade)] = classCount
          }
          const schoolConfig: SchoolConfig = {
            id: schoolConfigId,
            gradeCount: payload.schoolConfig.gradeCount,
            classCountByGrade,
            activeDays: normalizeDays(payload.schoolConfig.activeDays),
            periodsByDay: buildPeriodsByDay(payload.schoolConfig.periodsByDay),
            periodsPerDay: maxPeriodsPerDay(payload.schoolConfig.periodsByDay),
            createdAt: state.schoolConfig?.createdAt ?? createdAt,
            updatedAt: createdAt,
          }

          const subjectNameOrder: Array<string> = []
          const teacherNameOrder: Array<string> = []
          for (const slot of payload.slots) {
            const subjectName = normalizeImportName(slot.subjectName)
            if (subjectName && !subjectNameOrder.includes(subjectName)) {
              subjectNameOrder.push(subjectName)
            }
            const teacherName = normalizeImportName(slot.teacherName)
            if (teacherName && !teacherNameOrder.includes(teacherName)) {
              teacherNameOrder.push(teacherName)
            }
          }

          const existingSubjectByName = mapByNormalizedName(state.subjects)
          const subjects: Array<Subject> = subjectNameOrder.map((name) => {
            const existing = existingSubjectByName.get(name)
            return {
              id: existing?.id ?? generateId(),
              name,
              abbreviation: existing?.abbreviation ?? buildSubjectAbbreviation(name),
              track: existing?.track ?? 'COMMON',
              createdAt: existing?.createdAt ?? createdAt,
              updatedAt: createdAt,
            }
          })
          const subjectIdByName = new Map<string, string>(
            subjects.map((subject) => [normalizeImportName(subject.name), subject.id]),
          )

          const existingTeacherByName = mapByNormalizedName(state.teachers)
          const teachers: Array<Teacher> = teacherNameOrder.map((name) => {
            const existing = existingTeacherByName.get(name)
            return {
              id: existing?.id ?? generateId(),
              name,
              subjectIds: [],
              baseHoursPerWeek: 0,
              assignments: [],
              homeroom: sanitizeHomeroom(existing?.homeroom ?? null, schoolConfig),
              classAssignments: [],
              createdAt: existing?.createdAt ?? createdAt,
              updatedAt: createdAt,
            }
          })
          const teacherByName = new Map(teachers.map((teacher) => [teacher.name, teacher]))

          const assignmentByCompositeKey = new Map<
            string,
            {
              teacherName: string
              subjectId: string
              grade: number
              classNumber: number
              hoursPerWeek: number
            }
          >()
          const cells: Array<TimetableCell> = []
          for (const slot of payload.slots) {
            const subjectName = normalizeImportName(slot.subjectName)
            const teacherName = normalizeImportName(slot.teacherName)
            const subjectId = subjectIdByName.get(subjectName)
            const teacher = teacherByName.get(teacherName)
            if (!subjectId || !teacher) {
              issues.push(
                createImportIssue({
                  message: '슬롯의 교사/과목 매핑에 실패했습니다.',
                  severity: 'error',
                  blocking: true,
                }),
              )
              return null
            }

            const key = `${teacherName}|${subjectId}|${slot.grade}|${slot.classNumber}`
            const previous = assignmentByCompositeKey.get(key)
            if (previous) {
              previous.hoursPerWeek += 1
            } else {
              assignmentByCompositeKey.set(key, {
                teacherName,
                subjectId,
                grade: slot.grade,
                classNumber: slot.classNumber,
                hoursPerWeek: 1,
              })
            }

            cells.push({
              teacherId: teacher.id,
              subjectId,
              subjectType: 'CLASS',
              grade: slot.grade,
              classNumber: slot.classNumber,
              day: slot.day,
              period: slot.period,
              isFixed: false,
              status: 'BASE',
            })
          }

          const assignmentsByTeacherName = new Map<string, Array<TeachingAssignment>>()
          for (const assignment of assignmentByCompositeKey.values()) {
            const assignments =
              assignmentsByTeacherName.get(assignment.teacherName) ?? []
            assignments.push({
              id: generateId(),
              subjectId: assignment.subjectId,
              subjectType: 'CLASS',
              grade: assignment.grade,
              classNumber: assignment.classNumber,
              hoursPerWeek: assignment.hoursPerWeek,
            })
            assignmentsByTeacherName.set(assignment.teacherName, assignments)
          }

          for (const teacher of teachers) {
            const assignments = assignmentsByTeacherName.get(teacher.name) ?? []
            teacher.assignments = assignments
            teacher.subjectIds = buildTeacherSubjectIds(assignments)
            teacher.classAssignments = buildTeacherClassAssignments(assignments)
            teacher.baseHoursPerWeek = assignments.reduce(
              (sum, assignment) => sum + assignment.hoursPerWeek,
              0,
            )
            teacher.updatedAt = createdAt
          }

          const latestByTargetWeek = await loadLatestSnapshotByWeek(targetWeekTag)
          const nextSnapshot: TimetableSnapshot = {
            id: generateId(),
            schoolConfigId: schoolConfig.id,
            weekTag: targetWeekTag,
            versionNo: (latestByTargetWeek?.versionNo ?? 0) + 1,
            baseVersionId: latestByTargetWeek?.id ?? null,
            appliedScope: {
              type: 'THIS_WEEK',
              fromWeek: targetWeekTag,
              toWeek: null,
            },
            cells,
            score: latestByTargetWeek?.score ?? 0,
            generationTimeMs: latestByTargetWeek?.generationTimeMs ?? 0,
            createdAt,
          }

          return {
            schoolConfig,
            subjects,
            teachers,
            fixedEvents: state.fixedEvents,
            timetableSnapshots: [nextSnapshot],
            latestSnapshot: nextSnapshot,
          }
        },
      })
    },

    // Persistence
    loadFromDB: async () => {
      set({ isLoading: true })
      const [data, academicCalendarEvents, latestSnapshot] = await Promise.all([
        loadAllSetupData(),
        loadAcademicCalendarEvents(),
        loadLatestTimetableSnapshot(),
      ])
      set({
        schoolConfig: data.schoolConfig ?? null,
        subjects: data.subjects,
        teachers: data.teachers,
        fixedEvents: data.fixedEvents,
        academicCalendarEvents,
        baselineAcademicCalendarEvents: academicCalendarEvents,
        latestSnapshot: latestSnapshot ?? null,
        isDirty: false,
        isLoading: false,
      })
    },

    saveToDB: async () => {
      const {
        schoolConfig,
        subjects,
        teachers,
        fixedEvents,
        academicCalendarEvents,
      } = get()
      if (!schoolConfig) return
      await Promise.all([
        saveAllSetupData({ schoolConfig, subjects, teachers, fixedEvents }),
        saveAcademicCalendarEvents(academicCalendarEvents),
      ])
      set({
        baselineAcademicCalendarEvents: academicCalendarEvents,
        isDirty: false,
      })
    },

    // Validation
    runValidation: () => {
      const { schoolConfig, subjects, teachers, fixedEvents } = get()
      const messages = runFullValidation(
        schoolConfig,
        subjects,
        teachers,
        fixedEvents,
      )
      set({ validationMessages: messages })
    },
  }
})
