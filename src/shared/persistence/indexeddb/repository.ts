import { db } from './database'
import type { SetupSnapshot } from './database'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'
import type { TimetableSnapshot } from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { ChangeEvent } from '@/entities/change-history'
import type { WeekTag } from '@/shared/lib/week-tag'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ImpactAnalysisReport } from '@/entities/impact-analysis'
import type { ScheduleTransaction } from '@/entities/schedule-transaction'

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
