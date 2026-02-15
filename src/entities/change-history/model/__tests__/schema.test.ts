import { describe, expect, it } from 'vitest'
import {
  changeActionTypeSchema,
  changeEventSchema,
  weekTagSchema,
} from '../schema'

describe('weekTagSchema', () => {
  it('유효한 주차 태그를 통과시킨다', () => {
    expect(weekTagSchema.safeParse('2026-W07').success).toBe(true)
    expect(weekTagSchema.safeParse('2026-W01').success).toBe(true)
    expect(weekTagSchema.safeParse('2025-W52').success).toBe(true)
  })

  it('잘못된 형식을 거부한다', () => {
    expect(weekTagSchema.safeParse('2026-07').success).toBe(false)
    expect(weekTagSchema.safeParse('W07').success).toBe(false)
    expect(weekTagSchema.safeParse('2026-W7').success).toBe(false) // 한 자리
    expect(weekTagSchema.safeParse('').success).toBe(false)
  })
})

describe('changeActionTypeSchema', () => {
  it('유효한 액션 타입을 통과시킨다', () => {
    for (const type of [
      'EDIT',
      'CLEAR',
      'LOCK',
      'UNLOCK',
      'MOVE',
      'CONFIRM',
      'RECOMPUTE',
    ]) {
      expect(changeActionTypeSchema.safeParse(type).success).toBe(true)
    }
  })

  it('잘못된 액션 타입을 거부한다', () => {
    expect(changeActionTypeSchema.safeParse('INVALID').success).toBe(false)
    expect(changeActionTypeSchema.safeParse('').success).toBe(false)
  })
})

describe('changeEventSchema', () => {
  const validEvent = {
    id: 'event-1',
    snapshotId: 'snapshot-1',
    weekTag: '2026-W07',
    actionType: 'EDIT' as const,
    cellKey: '1-1-MON-1',
    before: null,
    after: {
      teacherId: 'teacher-1',
      subjectId: 'subject-1',
      grade: 1,
      classNumber: 1,
      day: 'MON' as const,
      period: 1,
      isFixed: false,
      status: 'TEMP_MODIFIED' as const,
    },
    timestamp: 1707300000000,
    isUndone: false,
  }

  it('유효한 이벤트를 통과시킨다', () => {
    expect(changeEventSchema.safeParse(validEvent).success).toBe(true)
  })

  it('before와 after 모두 null이어도 통과한다 (RECOMPUTE)', () => {
    const event = {
      ...validEvent,
      actionType: 'RECOMPUTE',
      before: null,
      after: null,
    }
    expect(changeEventSchema.safeParse(event).success).toBe(true)
  })

  it('id가 빈 문자열이면 실패한다', () => {
    expect(changeEventSchema.safeParse({ ...validEvent, id: '' }).success).toBe(
      false,
    )
  })

  it('snapshotId가 빈 문자열이면 실패한다', () => {
    expect(
      changeEventSchema.safeParse({ ...validEvent, snapshotId: '' }).success,
    ).toBe(false)
  })

  it('timestamp가 음수이면 실패한다', () => {
    expect(
      changeEventSchema.safeParse({ ...validEvent, timestamp: -1 }).success,
    ).toBe(false)
  })

  it('잘못된 weekTag 형식이면 실패한다', () => {
    expect(
      changeEventSchema.safeParse({ ...validEvent, weekTag: '2026-7' }).success,
    ).toBe(false)
  })
})
