import { create } from 'zustand'
import { autoAssignInvigilators } from '../lib/auto-invigilation'
import {
  buildInvigilationStats,
  canEnableExamModeForWeek,
  validateInvigilationAssignments,
} from '../lib/validator'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type {
  ExamModeWeekState,
  ExamSlot,
  InvigilationAssignment,
  InvigilationConflict,
  InvigilationStats,
} from '@/entities/exam-mode'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { DayOfWeek } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'
import {
  loadAcademicCalendarEventsByRange,
  loadAllSetupData,
  loadExamModeWeekState,
  loadExamSlotsByWeek,
  loadInvigilationAssignmentsByWeek,
  loadSnapshotBySelection,
  loadSnapshotWeeks,
  loadTeacherPolicies,
  saveChangeEvent,
  saveExamModeWeekState,
  saveExamSlots,
  saveInvigilationAssignments,
} from '@/shared/persistence/indexeddb/repository'
import { generateId } from '@/shared/lib/id'
import { getWeekDateRange } from '@/shared/lib/week-tag'

interface ExamModeState {
  weekTag: WeekTag | null
  availableWeekTags: Array<WeekTag>
  schoolConfig: SchoolConfig | null
  teachers: Array<Teacher>
  subjects: Array<Subject>
  teacherPolicies: Array<TeacherPolicy>
  academicCalendarEvents: Array<AcademicCalendarEvent>

  examModeState: ExamModeWeekState | null
  slots: Array<ExamSlot>
  assignments: Array<InvigilationAssignment>
  conflicts: Array<InvigilationConflict>
  stats: InvigilationStats | null

  gateMessage: string | null
  isLoading: boolean
  isSaving: boolean
  isAutoAssigning: boolean

  loadWeek: (weekTag?: WeekTag) => Promise<void>
  enableExamMode: () => Promise<boolean>
  disableExamMode: () => Promise<void>
  addExamSlot: (input: {
    day: DayOfWeek
    period: number
    grade: number
    classNumber: number
    subjectId: string | null
    subjectName: string
    durationMinutes: number
  }) => void
  updateExamSlot: (slotId: string, updates: Partial<ExamSlot>) => void
  removeExamSlot: (slotId: string) => void
  autoAssign: () => Promise<void>
  setAssignmentTeacher: (slotId: string, teacherId: string | null) => void
  saveAll: () => Promise<boolean>
}

function nowIso(): string {
  return new Date().toISOString()
}

function toEmptyStats(weekTag: WeekTag): InvigilationStats {
  return {
    weekTag,
    totalSlots: 0,
    assignedSlots: 0,
    unassignedSlots: 0,
    teacherLoad: [],
    updatedAt: nowIso(),
  }
}

export const useExamModeStore = create<ExamModeState>((set, get) => ({
  weekTag: null,
  availableWeekTags: [],
  schoolConfig: null,
  teachers: [],
  subjects: [],
  teacherPolicies: [],
  academicCalendarEvents: [],

  examModeState: null,
  slots: [],
  assignments: [],
  conflicts: [],
  stats: null,

  gateMessage: null,
  isLoading: false,
  isSaving: false,
  isAutoAssigning: false,

  loadWeek: async (requestedWeekTag) => {
    set({ isLoading: true })

    const [setupData, teacherPolicies, weekTags, selectedSnapshot] =
      await Promise.all([
        loadAllSetupData(),
        loadTeacherPolicies(),
        loadSnapshotWeeks(),
        loadSnapshotBySelection({ weekTag: requestedWeekTag }),
      ])

    const resolvedWeekTag =
      requestedWeekTag ?? selectedSnapshot?.weekTag ?? weekTags.at(0)

    if (!resolvedWeekTag || !setupData.schoolConfig) {
      set({
        weekTag: resolvedWeekTag ?? null,
        availableWeekTags: weekTags,
        schoolConfig: setupData.schoolConfig ?? null,
        teachers: setupData.teachers,
        subjects: setupData.subjects,
        teacherPolicies,
        academicCalendarEvents: [],
        examModeState: null,
        slots: [],
        assignments: [],
        conflicts: [],
        stats: null,
        gateMessage: null,
        isLoading: false,
      })
      return
    }

    const { startDate, endDate } = getWeekDateRange(
      resolvedWeekTag,
      setupData.schoolConfig.activeDays,
    )

    const [events, examModeState, slots, assignments] = await Promise.all([
      loadAcademicCalendarEventsByRange(startDate, endDate),
      loadExamModeWeekState(resolvedWeekTag),
      loadExamSlotsByWeek(resolvedWeekTag),
      loadInvigilationAssignmentsByWeek(resolvedWeekTag),
    ])

    const gate = canEnableExamModeForWeek({
      weekTag: resolvedWeekTag,
      schoolConfig: setupData.schoolConfig,
      academicCalendarEvents: events,
    })

    const conflicts = validateInvigilationAssignments({
      slots,
      assignments,
      teacherPolicies,
    })

    const stats =
      assignments.length > 0
        ? buildInvigilationStats({
            weekTag: resolvedWeekTag,
            assignments,
            nowIso: nowIso(),
          })
        : toEmptyStats(resolvedWeekTag)

    set({
      weekTag: resolvedWeekTag,
      availableWeekTags: weekTags,
      schoolConfig: setupData.schoolConfig,
      teachers: setupData.teachers,
      subjects: setupData.subjects,
      teacherPolicies,
      academicCalendarEvents: events,
      examModeState,
      slots,
      assignments,
      conflicts,
      stats,
      gateMessage: gate.message,
      isLoading: false,
    })
  },

  enableExamMode: async () => {
    const {
      weekTag,
      schoolConfig,
      academicCalendarEvents,
      examModeState,
      availableWeekTags,
    } = get()

    if (!weekTag || !schoolConfig) {
      return false
    }

    const gate = canEnableExamModeForWeek({
      weekTag,
      schoolConfig,
      academicCalendarEvents,
    })
    if (!gate.ok) {
      set({ gateMessage: gate.message })
      return false
    }

    const timestamp = nowIso()
    const nextState: ExamModeWeekState = {
      weekTag,
      isEnabled: true,
      enabledAt: timestamp,
      enabledBy: 'LOCAL_OPERATOR',
      createdAt: examModeState?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }

    await saveExamModeWeekState(nextState)

    await saveChangeEvent({
      id: generateId(),
      snapshotId: 'EXAM_MODE',
      weekTag,
      actionType: 'EXAM_MODE_ENABLED',
      actor: 'LOCAL_OPERATOR',
      cellKey: 'VERSION',
      before: null,
      after: null,
      beforePayload: examModeState,
      afterPayload: nextState,
      impactSummary: '시험 모드 활성화',
      conflictDetected: false,
      rollbackRef: null,
      timestamp: Date.now(),
      isUndone: false,
    })

    set({
      examModeState: nextState,
      gateMessage: null,
      availableWeekTags,
    })

    return true
  },

  disableExamMode: async () => {
    const { weekTag, examModeState } = get()
    if (!weekTag) {
      return
    }

    const timestamp = nowIso()
    const nextState: ExamModeWeekState = {
      weekTag,
      isEnabled: false,
      enabledAt: examModeState?.enabledAt ?? null,
      enabledBy: examModeState?.enabledBy ?? null,
      createdAt: examModeState?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }

    await saveExamModeWeekState(nextState)
    set({ examModeState: nextState })
  },

  addExamSlot: (input) => {
    const { weekTag } = get()
    if (!weekTag) {
      return
    }

    const timestamp = nowIso()
    const newSlot: ExamSlot = {
      id: generateId(),
      weekTag,
      date: getWeekDateRange(weekTag, [input.day]).startDate,
      day: input.day,
      period: input.period,
      grade: input.grade,
      classNumber: input.classNumber,
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      durationMinutes: input.durationMinutes,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const slots = [...get().slots, newSlot].sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date)
      }
      return a.period - b.period
    })

    set({ slots })
  },

  updateExamSlot: (slotId, updates) => {
    const timestamp = nowIso()
    set((state) => ({
      slots: state.slots.map((slot) =>
        slot.id === slotId ? { ...slot, ...updates, updatedAt: timestamp } : slot,
      ),
    }))
  },

  removeExamSlot: (slotId) => {
    set((state) => ({
      slots: state.slots.filter((slot) => slot.id !== slotId),
      assignments: state.assignments.filter((assignment) => assignment.slotId !== slotId),
    }))
  },

  autoAssign: async () => {
    const { weekTag, slots, teachers, teacherPolicies, assignments } = get()
    if (!weekTag || slots.length === 0) {
      return
    }

    set({ isAutoAssigning: true })

    const historicalTeacherLoad: Record<string, number> = {}
    for (const assignment of assignments) {
      if (assignment.status !== 'ASSIGNED' || assignment.teacherId === null) {
        continue
      }
      historicalTeacherLoad[assignment.teacherId] =
        (historicalTeacherLoad[assignment.teacherId] ?? 0) + 1
    }

    const result = autoAssignInvigilators({
      weekTag,
      slots,
      teachers,
      teacherPolicies,
      nowIso: nowIso(),
      historicalTeacherLoad,
    })

    await saveChangeEvent({
      id: generateId(),
      snapshotId: 'EXAM_MODE',
      weekTag,
      actionType: 'INVIGILATION_AUTO_ASSIGN',
      actor: 'LOCAL_OPERATOR',
      cellKey: 'VERSION',
      before: null,
      after: null,
      beforePayload: { previousAssignments: assignments.length },
      afterPayload: {
        assignedSlots: result.stats.assignedSlots,
        unassignedSlots: result.stats.unassignedSlots,
      },
      impactSummary: '감독 자동 배정 실행',
      conflictDetected: result.conflicts.length > 0,
      rollbackRef: null,
      timestamp: Date.now(),
      isUndone: false,
    })

    set({
      assignments: result.assignments,
      conflicts: result.conflicts,
      stats: result.stats,
      isAutoAssigning: false,
    })
  },

  setAssignmentTeacher: (slotId, teacherId) => {
    const { weekTag, assignments, slots, teacherPolicies } = get()
    if (!weekTag) {
      return
    }

    const timestamp = nowIso()
    const existing = assignments.find((assignment) => assignment.slotId === slotId)

    const nextAssignments = existing
      ? assignments.map((assignment) =>
          assignment.slotId === slotId
            ? {
                ...assignment,
                teacherId,
                status:
                  teacherId === null
                    ? ('UNRESOLVED' as const)
                    : ('ASSIGNED' as const),
                isManual: true,
                reason:
                  teacherId === null ? '수동으로 미배정 처리됨' : assignment.reason,
                updatedAt: timestamp,
              }
            : assignment,
        )
      : [
          ...assignments,
          {
            id: generateId(),
            weekTag,
            slotId,
            teacherId,
            status:
              teacherId === null ? ('UNRESOLVED' as const) : ('ASSIGNED' as const),
            isManual: true,
            reason: teacherId === null ? '수동으로 미배정 처리됨' : null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ]

    const conflicts = validateInvigilationAssignments({
      slots,
      assignments: nextAssignments,
      teacherPolicies,
    })

    const stats = buildInvigilationStats({
      weekTag,
      assignments: nextAssignments,
      nowIso: timestamp,
    })

    set({ assignments: nextAssignments, conflicts, stats })
  },

  saveAll: async () => {
    const { weekTag, examModeState, slots, assignments, teacherPolicies } = get()
    if (!weekTag) {
      return false
    }

    const conflicts = validateInvigilationAssignments({
      slots,
      assignments,
      teacherPolicies,
    })

    if (conflicts.length > 0) {
      set({ conflicts })
      return false
    }

    set({ isSaving: true })

    if (examModeState) {
      await saveExamModeWeekState(examModeState)
    }
    await saveExamSlots(weekTag, slots)
    await saveInvigilationAssignments(weekTag, assignments)

    set({ isSaving: false })
    return true
  },
}))
