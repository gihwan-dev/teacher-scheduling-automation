import { describe, expect, it } from 'vitest'
import { substituteAssignmentSchema } from '../schema'

describe('substituteAssignmentSchema', () => {
  it('유효한 대강 배정 레코드를 통과시킨다', () => {
    const result = substituteAssignmentSchema.safeParse({
      id: 'sub-assign-1',
      weekTag: '2026-W09',
      date: '2026-02-23',
      day: 'MON',
      period: 3,
      grade: 1,
      classNumber: 2,
      subjectId: 'subject-1',
      absentTeacherId: 'teacher-1',
      substituteTeacherId: 'teacher-2',
      source: 'REPLACEMENT',
      reason: '교체 확정 자동 기록',
      createdAt: '2026-02-22T11:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })
})
