import Dexie from 'dexie'
import type { EntityTable } from 'dexie'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'

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

  constructor() {
    super('SchedulingAutomation')
    this.version(1).stores({
      schoolConfigs: 'id, updatedAt',
      subjects: 'id, name',
      teachers: 'id, name',
      fixedEvents: 'id, type, teacherId',
      setupSnapshots: 'id, name, updatedAt',
    })
  }
}

export const db = new SchedulingDatabase()
