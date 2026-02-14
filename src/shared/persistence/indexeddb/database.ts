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
  }
}

export const db = new SchedulingDatabase()
