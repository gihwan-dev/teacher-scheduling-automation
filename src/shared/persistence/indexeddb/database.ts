import Dexie from 'dexie'
import type { EntityTable } from 'dexie'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'
import type { TimetableSnapshot } from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { ChangeEvent } from '@/entities/change-history'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ImpactAnalysisReport } from '@/entities/impact-analysis'
import type { ScheduleTransaction } from '@/entities/schedule-transaction'
import { computeWeekTagFromIso } from '@/shared/lib/week-tag'

export interface SetupSnapshot {
  id: string
  name: string
  schoolConfig: SchoolConfig
  subjects: Array<Subject>
  teachers: Array<Teacher>
  fixedEvents: Array<FixedEvent>
  createdAt: string
  updatedAt: string
}

class SchedulingDatabase extends Dexie {
  schoolConfigs!: EntityTable<SchoolConfig, 'id'>
  subjects!: EntityTable<Subject, 'id'>
  teachers!: EntityTable<Teacher, 'id'>
  fixedEvents!: EntityTable<FixedEvent, 'id'>
  setupSnapshots!: EntityTable<SetupSnapshot, 'id'>
  timetableSnapshots!: EntityTable<TimetableSnapshot, 'id'>
  constraintPolicies!: EntityTable<ConstraintPolicy, 'id'>
  teacherPolicies!: EntityTable<TeacherPolicy, 'id'>
  changeEvents!: EntityTable<ChangeEvent, 'id'>
  academicCalendarEvents!: EntityTable<AcademicCalendarEvent, 'id'>
  impactAnalysisReports!: EntityTable<ImpactAnalysisReport, 'id'>
  scheduleTransactions!: EntityTable<ScheduleTransaction, 'draftId'>

  constructor() {
    super('SchedulingAutomation')
    this.version(1).stores({
      schoolConfigs: 'id, updatedAt',
      subjects: 'id, name',
      teachers: 'id, name',
      fixedEvents: 'id, type, teacherId',
      setupSnapshots: 'id, name, updatedAt',
    })
    this.version(2).stores({
      schoolConfigs: 'id, updatedAt',
      subjects: 'id, name',
      teachers: 'id, name',
      fixedEvents: 'id, type, teacherId',
      setupSnapshots: 'id, name, updatedAt',
      timetableSnapshots: 'id, schoolConfigId, createdAt',
      constraintPolicies: 'id, updatedAt',
    })
    this.version(3).stores({
      schoolConfigs: 'id, updatedAt',
      subjects: 'id, name',
      teachers: 'id, name',
      fixedEvents: 'id, type, teacherId',
      setupSnapshots: 'id, name, updatedAt',
      timetableSnapshots: 'id, schoolConfigId, createdAt',
      constraintPolicies: 'id, updatedAt',
      teacherPolicies: 'id, teacherId, updatedAt',
    })
    this.version(4).upgrade(async (tx) => {
      await tx
        .table('timetableSnapshots')
        .toCollection()
        .modify((snapshot: { cells: Array<{ status?: string }> }) => {
          for (const cell of snapshot.cells) {
            if (!cell.status) {
              cell.status = 'BASE'
            }
          }
        })
    })
    this.version(5).stores({
      schoolConfigs: 'id, updatedAt',
      subjects: 'id, name',
      teachers: 'id, name',
      fixedEvents: 'id, type, teacherId',
      setupSnapshots: 'id, name, updatedAt',
      timetableSnapshots: 'id, schoolConfigId, createdAt',
      constraintPolicies: 'id, updatedAt',
      teacherPolicies: 'id, teacherId, updatedAt',
      changeEvents: 'id, snapshotId, weekTag, actionType, timestamp',
    })
    this.version(6)
      .stores({
        schoolConfigs: 'id, updatedAt',
        subjects: 'id, name',
        teachers: 'id, name',
        fixedEvents: 'id, type, teacherId',
        setupSnapshots: 'id, name, updatedAt',
        timetableSnapshots:
          'id, schoolConfigId, weekTag, versionNo, [weekTag+versionNo], createdAt',
        constraintPolicies: 'id, updatedAt',
        teacherPolicies: 'id, teacherId, updatedAt',
        changeEvents: 'id, snapshotId, weekTag, actionType, timestamp',
        academicCalendarEvents:
          'id, eventType, startDate, endDate, scopeType, scopeValue',
        scheduleTransactions: 'draftId, status, updatedAt, *targetWeeks',
      })
      .upgrade(async (tx) => {
        await tx
          .table('timetableSnapshots')
          .toCollection()
          .modify((snapshot: LegacyTimetableSnapshot) => {
            applyV6SnapshotDefaults(snapshot)
          })

        await tx
          .table('changeEvents')
          .toCollection()
          .modify((event: LegacyChangeEvent) => {
            applyV6ChangeEventDefaults(event)
          })
      })
    this.version(7).stores({
      schoolConfigs: 'id, updatedAt',
      subjects: 'id, name',
      teachers: 'id, name',
      fixedEvents: 'id, type, teacherId',
      setupSnapshots: 'id, name, updatedAt',
      timetableSnapshots:
        'id, schoolConfigId, weekTag, versionNo, [weekTag+versionNo], createdAt',
      constraintPolicies: 'id, updatedAt',
      teacherPolicies: 'id, teacherId, updatedAt',
      changeEvents: 'id, snapshotId, weekTag, actionType, timestamp',
      academicCalendarEvents:
        'id, eventType, startDate, endDate, scopeType, scopeValue',
      scheduleTransactions: 'draftId, status, updatedAt, *targetWeeks',
      impactAnalysisReports: 'id, snapshotId, weekTag, riskLevel, createdAt',
    })
  }
}

export const db = new SchedulingDatabase()

type LegacyAppliedScope = {
  type: 'THIS_WEEK' | 'FROM_NEXT_WEEK' | 'RANGE'
  fromWeek?: string
  toWeek?: string | null
}

type LegacyTimetableSnapshot = Omit<
  TimetableSnapshot,
  'weekTag' | 'versionNo' | 'baseVersionId' | 'appliedScope'
> & {
  weekTag?: string
  versionNo?: number
  baseVersionId?: string | null
  appliedScope?: LegacyAppliedScope
}

type LegacyChangeEvent = Omit<
  ChangeEvent,
  | 'actor'
  | 'beforePayload'
  | 'afterPayload'
  | 'impactSummary'
  | 'conflictDetected'
  | 'rollbackRef'
> & {
  actor?: string
  beforePayload?: unknown | null
  afterPayload?: unknown | null
  impactSummary?: string | null
  conflictDetected?: boolean
  rollbackRef?: string | null
}

export type V6SnapshotMigrationRecord = LegacyTimetableSnapshot
export type V6ChangeEventMigrationRecord = LegacyChangeEvent

export function applyV6SnapshotDefaults(snapshot: LegacyTimetableSnapshot): void {
  const weekTag = snapshot.weekTag ?? computeWeekTagFromIso(snapshot.createdAt)
  snapshot.weekTag = weekTag
  snapshot.versionNo = snapshot.versionNo ?? 1
  snapshot.baseVersionId = snapshot.baseVersionId ?? null

  if (!snapshot.appliedScope) {
    snapshot.appliedScope = {
      type: 'THIS_WEEK',
      fromWeek: weekTag,
      toWeek: null,
    }
    return
  }

  snapshot.appliedScope.fromWeek = snapshot.appliedScope.fromWeek ?? weekTag
  if (snapshot.appliedScope.type === 'RANGE') {
    snapshot.appliedScope.toWeek = snapshot.appliedScope.toWeek ?? weekTag
  } else {
    snapshot.appliedScope.toWeek = null
  }
}

export function applyV6ChangeEventDefaults(event: LegacyChangeEvent): void {
  event.actor = event.actor ?? 'LOCAL_OPERATOR'
  event.beforePayload = event.beforePayload ?? event.before ?? null
  event.afterPayload = event.afterPayload ?? event.after ?? null
  event.impactSummary = event.impactSummary ?? null
  event.conflictDetected = event.conflictDetected ?? false
  event.rollbackRef = event.rollbackRef ?? null
}
