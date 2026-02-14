import {  db } from './database'
import type {SetupSnapshot} from './database';
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'

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
export async function saveFixedEvents(events: Array<FixedEvent>): Promise<void> {
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
