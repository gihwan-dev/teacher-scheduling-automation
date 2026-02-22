import { db } from './database'
import type { SetupSnapshot } from './database'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'
import type {
  AppliedScope,
  TimetableCell,
  TimetableSnapshot,
} from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { ChangeActionType, ChangeEvent } from '@/entities/change-history'
import type { WeekTag } from '@/shared/lib/week-tag'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ImpactAnalysisReport } from '@/entities/impact-analysis'
import type {
  ScheduleTransaction,
  ValidationViolation,
} from '@/entities/schedule-transaction'
import { transitionScheduleTransactionStatus } from '@/entities/schedule-transaction'
import { generateId } from '@/shared/lib/id'

type CommitTransactionActionType = Extract<
  ChangeActionType,
  'TRANSACTION_COMMIT' | 'VERSION_RESTORE'
>

export interface CommitTransactionWeekPlan {
  weekTag: WeekTag
  sourceSnapshot: TimetableSnapshot
  nextCells: Array<TimetableCell>
  appliedScope: AppliedScope
}

interface SnapshotSummary {
  snapshotId: string
  versionNo: number
  cellCount: number
  baseVersionId: string | null
}

// SchoolConfig
export async function saveSchoolConfig(config: SchoolConfig): Promise<void> {
  await db.schoolConfigs.put(config)
}

export async function loadSchoolConfig(): Promise<SchoolConfig | undefined> {
  return db.schoolConfigs.orderBy('updatedAt').last()
}

export async function deleteSchoolConfig(id: string): Promise<void> {
  await db.schoolConfigs.delete(id)
}

// Subjects
export async function saveSubjects(subjects: Array<Subject>): Promise<void> {
  await db.transaction('rw', db.subjects, async () => {
    await db.subjects.clear()
    await db.subjects.bulkPut(subjects)
  })
}

export async function loadSubjects(): Promise<Array<Subject>> {
  return db.subjects.toArray()
}

// Teachers
export async function saveTeachers(teachers: Array<Teacher>): Promise<void> {
  await db.transaction('rw', db.teachers, async () => {
    await db.teachers.clear()
    await db.teachers.bulkPut(teachers)
  })
}

export async function loadTeachers(): Promise<Array<Teacher>> {
  return db.teachers.toArray()
}

// FixedEvents
export async function saveFixedEvents(
  events: Array<FixedEvent>,
): Promise<void> {
  await db.transaction('rw', db.fixedEvents, async () => {
    await db.fixedEvents.clear()
    await db.fixedEvents.bulkPut(events)
  })
}

export async function loadFixedEvents(): Promise<Array<FixedEvent>> {
  return db.fixedEvents.toArray()
}

// Snapshot
export async function saveSnapshot(snapshot: SetupSnapshot): Promise<void> {
  await db.setupSnapshots.put(snapshot)
}

export async function loadLatestSnapshot(): Promise<SetupSnapshot | undefined> {
  return db.setupSnapshots.orderBy('updatedAt').last()
}

// Full save/load (convenience)
export async function saveAllSetupData(data: {
  schoolConfig: SchoolConfig
  subjects: Array<Subject>
  teachers: Array<Teacher>
  fixedEvents: Array<FixedEvent>
}): Promise<void> {
  await db.transaction(
    'rw',
    [db.schoolConfigs, db.subjects, db.teachers, db.fixedEvents],
    async () => {
      await db.schoolConfigs.put(data.schoolConfig)
      await db.subjects.clear()
      await db.subjects.bulkPut(data.subjects)
      await db.teachers.clear()
      await db.teachers.bulkPut(data.teachers)
      await db.fixedEvents.clear()
      await db.fixedEvents.bulkPut(data.fixedEvents)
    },
  )
}

export async function loadAllSetupData(): Promise<{
  schoolConfig: SchoolConfig | undefined
  subjects: Array<Subject>
  teachers: Array<Teacher>
  fixedEvents: Array<FixedEvent>
}> {
  const [schoolConfig, subjects, teachers, fixedEvents] = await Promise.all([
    loadSchoolConfig(),
    loadSubjects(),
    loadTeachers(),
    loadFixedEvents(),
  ])
  return { schoolConfig, subjects, teachers, fixedEvents }
}

// TimetableSnapshot
export async function saveTimetableSnapshot(
  snapshot: TimetableSnapshot,
): Promise<void> {
  await db.timetableSnapshots.put(snapshot)
}

export async function loadLatestTimetableSnapshot(): Promise<
  TimetableSnapshot | undefined
> {
  return db.timetableSnapshots.orderBy('createdAt').last()
}

export async function loadTimetableSnapshotById(
  id: string,
): Promise<TimetableSnapshot | undefined> {
  return db.timetableSnapshots.get(id)
}

export async function loadSnapshotsByWeek(
  weekTag: WeekTag,
): Promise<Array<TimetableSnapshot>> {
  return db.timetableSnapshots.where('weekTag').equals(weekTag).sortBy('versionNo')
}

export async function loadLatestSnapshotByWeek(
  weekTag: WeekTag,
): Promise<TimetableSnapshot | undefined> {
  const snapshots = await loadSnapshotsByWeek(weekTag)
  return snapshots.at(-1)
}

export async function loadSnapshotVersion(
  weekTag: WeekTag,
  versionNo: number,
): Promise<TimetableSnapshot | undefined> {
  return db.timetableSnapshots
    .where('[weekTag+versionNo]')
    .equals([weekTag, versionNo])
    .first()
}

export async function loadSnapshotWeeks(): Promise<Array<WeekTag>> {
  const snapshots = await db.timetableSnapshots.toArray()
  const weekTags = new Set<WeekTag>()
  for (const snapshot of snapshots) {
    weekTags.add(snapshot.weekTag)
  }
  return [...weekTags].sort((a, b) => b.localeCompare(a))
}

export async function loadSnapshotBySelection(selection: {
  weekTag?: WeekTag
  versionNo?: number
}): Promise<TimetableSnapshot | undefined> {
  const { weekTag, versionNo } = selection
  if (!weekTag) {
    return loadLatestTimetableSnapshot()
  }
  if (versionNo && versionNo > 0) {
    const exact = await loadSnapshotVersion(weekTag, versionNo)
    if (exact) {
      return exact
    }
  }
  return loadLatestSnapshotByWeek(weekTag)
}

function normalizeAppliedScope(
  sourceSnapshot: TimetableSnapshot,
  weekTag: WeekTag,
  appliedScopeOverride?: AppliedScope,
): AppliedScope {
  if (appliedScopeOverride) {
    return appliedScopeOverride
  }
  if (sourceSnapshot.appliedScope.type === 'RANGE') {
    return {
      ...sourceSnapshot.appliedScope,
      fromWeek: weekTag,
      toWeek: sourceSnapshot.appliedScope.toWeek ?? weekTag,
    }
  }
  return {
    ...sourceSnapshot.appliedScope,
    fromWeek: weekTag,
    toWeek: null,
  }
}

function createSnapshotSummary(snapshot: TimetableSnapshot): SnapshotSummary {
  return {
    snapshotId: snapshot.id,
    versionNo: snapshot.versionNo,
    cellCount: snapshot.cells.length,
    baseVersionId: snapshot.baseVersionId,
  }
}

function countChangedSlots(
  beforeCells: Array<TimetableCell>,
  afterCells: Array<TimetableCell>,
): number {
  const beforeMap = new Map(beforeCells.map((cell) => [slotKey(cell), slotValue(cell)]))
  const afterMap = new Map(afterCells.map((cell) => [slotKey(cell), slotValue(cell)]))
  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()])

  let changed = 0
  for (const key of allKeys) {
    if (beforeMap.get(key) !== afterMap.get(key)) {
      changed += 1
    }
  }
  return changed
}

function slotKey(cell: TimetableCell): string {
  return `${cell.grade}-${cell.classNumber}-${cell.day}-${cell.period}`
}

function slotValue(cell: TimetableCell): string {
  return `${cell.teacherId}-${cell.subjectId}-${cell.status}-${cell.isFixed ? '1' : '0'}`
}

export async function saveNextSnapshotVersion(params: {
  sourceSnapshot: TimetableSnapshot
  cells: Array<TimetableCell>
  overrideWeekTag?: WeekTag
  appliedScopeOverride?: AppliedScope
}): Promise<TimetableSnapshot> {
  const { sourceSnapshot, cells, overrideWeekTag, appliedScopeOverride } = params
  const weekTag = overrideWeekTag ?? sourceSnapshot.weekTag
  const latest = await loadLatestSnapshotByWeek(weekTag)
  const nextVersionNo = (latest?.versionNo ?? 0) + 1

  const appliedScope = normalizeAppliedScope(
    sourceSnapshot,
    weekTag,
    appliedScopeOverride,
  )

  const nextSnapshot: TimetableSnapshot = {
    ...sourceSnapshot,
    id: generateId(),
    weekTag,
    versionNo: nextVersionNo,
    baseVersionId: latest ? sourceSnapshot.id : null,
    appliedScope,
    cells,
    createdAt: new Date().toISOString(),
  }

  await saveTimetableSnapshot(nextSnapshot)
  return nextSnapshot
}

export async function updateTimetableSnapshot(
  snapshot: TimetableSnapshot,
): Promise<void> {
  await db.timetableSnapshots.put(snapshot)
}

// ConstraintPolicy
export async function saveConstraintPolicy(
  policy: ConstraintPolicy,
): Promise<void> {
  await db.constraintPolicies.put(policy)
}

export async function loadConstraintPolicy(): Promise<
  ConstraintPolicy | undefined
> {
  return db.constraintPolicies.orderBy('updatedAt').last()
}

// TeacherPolicies
export async function saveTeacherPolicies(
  policies: Array<TeacherPolicy>,
): Promise<void> {
  await db.transaction('rw', db.teacherPolicies, async () => {
    await db.teacherPolicies.clear()
    await db.teacherPolicies.bulkPut(policies)
  })
}

export async function loadTeacherPolicies(): Promise<Array<TeacherPolicy>> {
  return db.teacherPolicies.toArray()
}

// ChangeEvents
export async function saveChangeEvent(event: ChangeEvent): Promise<void> {
  await db.changeEvents.put(event)
}

export async function saveChangeEvents(
  events: Array<ChangeEvent>,
): Promise<void> {
  await db.changeEvents.bulkPut(events)
}

export async function loadChangeEvents(
  snapshotId: string,
): Promise<Array<ChangeEvent>> {
  return db.changeEvents
    .where('snapshotId')
    .equals(snapshotId)
    .sortBy('timestamp')
}

export async function loadChangeEventsByWeek(
  weekTag: WeekTag,
): Promise<Array<ChangeEvent>> {
  return db.changeEvents.where('weekTag').equals(weekTag).sortBy('timestamp')
}

export async function updateChangeEvent(event: ChangeEvent): Promise<void> {
  await db.changeEvents.put(event)
}

export async function deleteChangeEventsBySnapshot(
  snapshotId: string,
): Promise<void> {
  await db.changeEvents.where('snapshotId').equals(snapshotId).delete()
}

// AcademicCalendarEvents
export async function saveAcademicCalendarEvents(
  events: Array<AcademicCalendarEvent>,
): Promise<void> {
  await db.transaction('rw', db.academicCalendarEvents, async () => {
    await db.academicCalendarEvents.clear()
    await db.academicCalendarEvents.bulkPut(events)
  })
}

export async function loadAcademicCalendarEventsByRange(
  startDate: string,
  endDate: string,
): Promise<Array<AcademicCalendarEvent>> {
  const candidates = await db.academicCalendarEvents
    .where('startDate')
    .belowOrEqual(endDate)
    .toArray()

  return candidates
    .filter((event) => event.endDate >= startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export async function loadAcademicCalendarEvents(): Promise<
  Array<AcademicCalendarEvent>
> {
  const events = await db.academicCalendarEvents.toArray()
  return events.sort((a, b) => {
    if (a.startDate === b.startDate) {
      return a.endDate.localeCompare(b.endDate)
    }
    return a.startDate.localeCompare(b.startDate)
  })
}

// ScheduleTransactions
export async function saveScheduleTransaction(
  transaction: ScheduleTransaction,
): Promise<void> {
  await db.scheduleTransactions.put(transaction)
}

export async function updateScheduleTransaction(
  transaction: ScheduleTransaction,
): Promise<void> {
  await db.scheduleTransactions.put(transaction)
}

export async function createScheduleTransactionDraft(input: {
  targetWeeks: Array<WeekTag>
  validationResult: {
    passed: boolean
    violations: Array<ValidationViolation>
  }
  impactReportId: string
}): Promise<ScheduleTransaction> {
  const timestamp = new Date().toISOString()
  const transaction: ScheduleTransaction = {
    draftId: generateId(),
    targetWeeks: [...new Set(input.targetWeeks)].sort((a, b) =>
      a.localeCompare(b),
    ),
    validationResult: input.validationResult,
    impactReportId: input.impactReportId,
    status: 'DRAFT',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await saveScheduleTransaction(transaction)
  return transaction
}

export async function loadScheduleTransaction(
  draftId: string,
): Promise<ScheduleTransaction | undefined> {
  return db.scheduleTransactions.get(draftId)
}

export async function commitScheduleTransactionAtomically(input: {
  transaction: ScheduleTransaction
  plans: Array<CommitTransactionWeekPlan>
  impactReports: Array<ImpactAnalysisReport>
  actor: string
  actionType: CommitTransactionActionType
  impactSummary: string | null
}): Promise<{
  transaction: ScheduleTransaction
  savedSnapshots: Array<TimetableSnapshot>
}> {
  const nextStatus = transitionScheduleTransactionStatus(
    input.transaction.status,
    'COMMITTED',
  )
  const eventTimestamp = Date.now()
  const committedAt = new Date().toISOString()
  const orderedPlans = [...input.plans].sort((a, b) =>
    a.weekTag.localeCompare(b.weekTag),
  )

  return db.transaction(
    'rw',
    [
      db.timetableSnapshots,
      db.scheduleTransactions,
      db.impactAnalysisReports,
      db.changeEvents,
    ],
    async () => {
      const savedSnapshots: Array<TimetableSnapshot> = []
      const commitEvents: Array<ChangeEvent> = []

      for (let index = 0; index < orderedPlans.length; index += 1) {
        const plan = orderedPlans[index]
        const weekSnapshots = await db.timetableSnapshots
          .where('weekTag')
          .equals(plan.weekTag)
          .sortBy('versionNo')
        const latest = weekSnapshots.at(-1)
        const nextVersionNo = (latest?.versionNo ?? 0) + 1

        const nextSnapshot: TimetableSnapshot = {
          ...plan.sourceSnapshot,
          id: generateId(),
          weekTag: plan.weekTag,
          versionNo: nextVersionNo,
          baseVersionId: latest ? plan.sourceSnapshot.id : null,
          appliedScope: normalizeAppliedScope(
            plan.sourceSnapshot,
            plan.weekTag,
            plan.appliedScope,
          ),
          cells: plan.nextCells,
          createdAt: committedAt,
        }
        savedSnapshots.push(nextSnapshot)

        const changedSlots = countChangedSlots(plan.sourceSnapshot.cells, plan.nextCells)
        const versionImpactSummary =
          input.actionType === 'VERSION_RESTORE'
            ? `restore v${plan.sourceSnapshot.versionNo} -> v${nextSnapshot.versionNo} (changed ${changedSlots} slots)`
            : `${input.impactSummary ?? '트랜잭션 확정'} (${plan.weekTag}, changed ${changedSlots} slots)`

        commitEvents.push({
          id: generateId(),
          snapshotId: nextSnapshot.id,
          weekTag: plan.weekTag,
          actionType: input.actionType,
          actor: input.actor,
          cellKey: 'VERSION' as ChangeEvent['cellKey'],
          before: null,
          after: null,
          beforePayload: createSnapshotSummary(plan.sourceSnapshot),
          afterPayload: createSnapshotSummary(nextSnapshot),
          impactSummary: versionImpactSummary,
          conflictDetected: false,
          rollbackRef: null,
          timestamp: eventTimestamp + index,
          isUndone: false,
        })
      }

      await db.timetableSnapshots.bulkPut(savedSnapshots)
      if (input.impactReports.length > 0) {
        await db.impactAnalysisReports.bulkPut(input.impactReports)
      }

      const committedTransaction: ScheduleTransaction = {
        ...input.transaction,
        status: nextStatus,
        updatedAt: committedAt,
      }
      await db.scheduleTransactions.put(committedTransaction)
      await db.changeEvents.bulkPut(commitEvents)

      return {
        transaction: committedTransaction,
        savedSnapshots,
      }
    },
  )
}

export async function rollbackScheduleTransaction(input: {
  transaction: ScheduleTransaction
  actor: string
  reason: string
  weekTag: WeekTag
  snapshotId: string
  violations?: Array<ValidationViolation>
  conflictDetected?: boolean
}): Promise<ScheduleTransaction> {
  const rollbackAt = new Date().toISOString()
  const rollbackStatus =
    input.transaction.status === 'ROLLED_BACK'
      ? 'ROLLED_BACK'
      : transitionScheduleTransactionStatus(input.transaction.status, 'ROLLED_BACK')

  return db.transaction(
    'rw',
    [db.scheduleTransactions, db.changeEvents],
    async () => {
      const rolledBackTransaction: ScheduleTransaction = {
        ...input.transaction,
        status: rollbackStatus,
        updatedAt: rollbackAt,
      }

      await db.scheduleTransactions.put(rolledBackTransaction)
      await db.changeEvents.put({
        id: generateId(),
        snapshotId: input.snapshotId,
        weekTag: input.weekTag,
        actionType: 'TRANSACTION_ROLLBACK',
        actor: input.actor,
        cellKey: 'VERSION' as ChangeEvent['cellKey'],
        before: null,
        after: null,
        beforePayload: {
          draftId: input.transaction.draftId,
          statusBefore: input.transaction.status,
          violationCount:
            input.violations?.length ??
            input.transaction.validationResult.violations.length,
        },
        afterPayload: {
          statusAfter: rollbackStatus,
        },
        impactSummary: input.reason,
        conflictDetected: input.conflictDetected ?? true,
        rollbackRef: input.transaction.draftId,
        timestamp: Date.now(),
        isUndone: false,
      })

      return rolledBackTransaction
    },
  )
}

// ImpactAnalysisReports
export async function saveImpactAnalysisReport(
  report: ImpactAnalysisReport,
): Promise<void> {
  await db.impactAnalysisReports.put(report)
}

export async function loadImpactAnalysisReport(
  id: string,
): Promise<ImpactAnalysisReport | undefined> {
  return db.impactAnalysisReports.get(id)
}

export async function loadImpactAnalysisReportsBySnapshot(
  snapshotId: string,
): Promise<Array<ImpactAnalysisReport>> {
  return db.impactAnalysisReports
    .where('snapshotId')
    .equals(snapshotId)
    .sortBy('createdAt')
}
