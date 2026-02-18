import { describe, expect, it } from 'vitest'
import { fixedEventSchema } from '../schema'

describe('fixedEventSchema', () => {
  const baseEvent = {
    id: 'event-1',
    description: '테스트 이벤트',
    teacherId: null,
    subjectId: null,
    subjectType: null,
    grade: null,
    classNumber: null,
    day: 'MON' as const,
    period: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('FIXED_CLASS에 teacherId와 subjectId가 있으면 통과한다', () => {
    const result = fixedEventSchema.safeParse({
      ...baseEvent,
      type: 'FIXED_CLASS',
      teacherId: 'teacher-1',
      subjectId: 'sub-1',
      subjectType: 'CLASS',
      grade: 1,
      classNumber: 1,
    })
    expect(result.success).toBe(true)
  })

  it('FIXED_CLASS에 teacherId가 없으면 실패한다', () => {
    const result = fixedEventSchema.safeParse({
      ...baseEvent,
      type: 'FIXED_CLASS',
      teacherId: null,
      subjectId: 'sub-1',
      subjectType: 'CLASS',
      grade: 1,
      classNumber: 1,
    })
    expect(result.success).toBe(false)
  })

  it('FIXED_CLASS에 subjectId가 없으면 실패한다', () => {
    const result = fixedEventSchema.safeParse({
      ...baseEvent,
      type: 'FIXED_CLASS',
      teacherId: 'teacher-1',
      subjectId: null,
      subjectType: 'CLASS',
      grade: 1,
      classNumber: 1,
    })
    expect(result.success).toBe(false)
  })

  it('BUSINESS_TRIP에 teacherId가 있으면 통과한다', () => {
    const result = fixedEventSchema.safeParse({
      ...baseEvent,
      type: 'BUSINESS_TRIP',
      teacherId: 'teacher-1',
    })
    expect(result.success).toBe(true)
  })

  it('BUSINESS_TRIP에 teacherId가 없으면 실패한다', () => {
    const result = fixedEventSchema.safeParse({
      ...baseEvent,
      type: 'BUSINESS_TRIP',
      teacherId: null,
    })
    expect(result.success).toBe(false)
  })

  it('SCHOOL_EVENT는 teacherId/subjectId 없이도 통과한다', () => {
    const result = fixedEventSchema.safeParse({
      ...baseEvent,
      type: 'SCHOOL_EVENT',
    })
    expect(result.success).toBe(true)
  })

  it('잘못된 요일이면 실패한다', () => {
    const result = fixedEventSchema.safeParse({
      ...baseEvent,
      type: 'SCHOOL_EVENT',
      day: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('period가 0이면 실패한다', () => {
    const result = fixedEventSchema.safeParse({
      ...baseEvent,
      type: 'SCHOOL_EVENT',
      period: 0,
    })
    expect(result.success).toBe(false)
  })
})
