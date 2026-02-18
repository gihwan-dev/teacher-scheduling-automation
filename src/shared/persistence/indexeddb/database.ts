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
    this.version(6)
      .stores({
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
      .upgrade(async (tx) => {
        await tx
          .table('schoolConfigs')
          .toCollection()
          .modify((config: {
            activeDays?: Array<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'>
            periodsPerDay?: number
            periodsByDay?: Record<
              'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT',
              number
            >
          }) => {
            const legacyPeriods = config.periodsPerDay ?? 7
            if (!config.periodsByDay) {
              config.periodsByDay = {
                MON: legacyPeriods,
                TUE: legacyPeriods,
                WED: legacyPeriods,
                THU: legacyPeriods,
                FRI: legacyPeriods,
                SAT: 1,
              }
            }
            if (!config.periodsPerDay) {
              config.periodsPerDay = Math.max(
                ...Object.values(config.periodsByDay),
              )
            }
          })

        await tx
          .table('teachers')
          .toCollection()
          .modify((teacher: {
            id: string
            subjectIds?: Array<string>
            assignments?: Array<unknown>
            classAssignments?: Array<{
              grade: number
              classNumber: number
              hoursPerWeek: number
            }>
          }) => {
            if (teacher.assignments) return

            if (teacher.classAssignments && teacher.classAssignments.length > 0) {
              const subjectIds = teacher.subjectIds ?? []
              if (subjectIds.length === 1) {
                const subjectId = subjectIds[0]
                teacher.assignments = teacher.classAssignments.map(
                  (assignment, index) => ({
                    id: `migrated-${teacher.id}-${index}`,
                    subjectId,
                    subjectType: 'CLASS',
                    grade: assignment.grade,
                    classNumber: assignment.classNumber,
                    hoursPerWeek: assignment.hoursPerWeek,
                  }),
                )
                return
              }
            }

            // 다과목 레거시 데이터는 자동 분배하지 않고 수동 재입력 유도
            teacher.assignments = []
          })

        await tx
          .table('fixedEvents')
          .toCollection()
          .modify((event: {
            type: string
            grade: number | null
            classNumber: number | null
            subjectType?: 'CLASS' | 'GRADE' | 'SCHOOL' | null
          }) => {
            if (event.subjectType) return
            if (event.type === 'FIXED_CLASS') {
              event.subjectType =
                event.grade !== null && event.classNumber !== null
                  ? 'CLASS'
                  : 'SCHOOL'
              return
            }
            event.subjectType = null
          })

        await tx
          .table('timetableSnapshots')
          .toCollection()
          .modify((snapshot: {
            cells: Array<{ subjectType?: 'CLASS' | 'GRADE' | 'SCHOOL' }>
          }) => {
            for (const cell of snapshot.cells) {
              if (!cell.subjectType) {
                cell.subjectType = 'CLASS'
              }
            }
          })
      })
  }
}

export const db = new SchedulingDatabase()
