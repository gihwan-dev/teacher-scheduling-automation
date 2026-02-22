import { describe, expect, it } from 'vitest'
import { applyV8TeacherDefaults } from '../database'
import type { V8TeacherMigrationRecord } from '../database'

describe('v8 migration defaults', () => {
  it('legacy teacher에 homeroom 기본값을 채운다', () => {
    const legacyTeacher: V8TeacherMigrationRecord = {
      id: 'teacher-1',
      name: '김교사',
      subjectIds: ['subject-1'],
      baseHoursPerWeek: 10,
      classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
      createdAt: '2026-02-22T00:00:00.000Z',
      updatedAt: '2026-02-22T00:00:00.000Z',
    }

    applyV8TeacherDefaults(legacyTeacher)

    expect(legacyTeacher.homeroom).toBeNull()
  })
})
