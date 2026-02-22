import { describe, expect, it } from 'vitest'
import {
  examModeWeekStateSchema,
  examSlotSchema,
  invigilationAssignmentSchema,
  invigilationConflictSchema,
  invigilationStatsSchema,
} from '../schema'

describe('exam-mode schema', () => {
  it('시험 모드 주차 상태를 검증한다', () => {
    const result = examModeWeekStateSchema.safeParse({
      weekTag: '2026-W09',
      isEnabled: true,
      enabledAt: '2026-02-22T10:00:00.000Z',
      enabledBy: 'LOCAL_OPERATOR',
      createdAt: '2026-02-22T10:00:00.000Z',
      updatedAt: '2026-02-22T10:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })

  it('시험 슬롯을 검증한다', () => {
    const result = examSlotSchema.safeParse({
      id: 'slot-1',
      weekTag: '2026-W09',
      date: '2026-02-23',
      day: 'MON',
      period: 2,
      grade: 1,
      classNumber: 1,
      subjectId: 'subject-1',
      subjectName: '국어',
      durationMinutes: 50,
      createdAt: '2026-02-22T10:00:00.000Z',
      updatedAt: '2026-02-22T10:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })

  it('감독 배정을 검증한다', () => {
    const result = invigilationAssignmentSchema.safeParse({
      id: 'assign-1',
      weekTag: '2026-W09',
      slotId: 'slot-1',
      teacherId: 'teacher-1',
      status: 'ASSIGNED',
      isManual: false,
      reason: null,
      createdAt: '2026-02-22T10:00:00.000Z',
      updatedAt: '2026-02-22T10:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })

  it('감독 충돌을 검증한다', () => {
    const result = invigilationConflictSchema.safeParse({
      type: 'TEACHER_DOUBLE_BOOKED',
      teacherId: 'teacher-1',
      slotIds: ['slot-1', 'slot-2'],
      message: '동일 시간 중복 감독입니다.',
    })

    expect(result.success).toBe(true)
  })

  it('감독 통계를 검증한다', () => {
    const result = invigilationStatsSchema.safeParse({
      weekTag: '2026-W09',
      totalSlots: 10,
      assignedSlots: 8,
      unassignedSlots: 2,
      teacherLoad: [{ teacherId: 'teacher-1', count: 3 }],
      updatedAt: '2026-02-22T10:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })
})
