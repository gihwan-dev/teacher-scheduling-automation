import { describe, expect, it } from 'vitest'
import {
  academicCalendarEventSchema,
  academicCalendarEventTypeSchema,
  academicCalendarScopeTypeSchema,
} from '../schema'

const validEvent = {
  id: 'event-1',
  eventType: 'HOLIDAY' as const,
  startDate: '2026-03-01',
  endDate: '2026-03-01',
  scopeType: 'SCHOOL' as const,
  scopeValue: null,
  periodOverride: null,
  createdAt: '2026-02-22T00:00:00.000Z',
  updatedAt: '2026-02-22T00:00:00.000Z',
}

describe('academicCalendarEventTypeSchema', () => {
  it('유효한 이벤트 타입을 허용한다', () => {
    expect(academicCalendarEventTypeSchema.safeParse('HOLIDAY').success).toBe(
      true,
    )
    expect(
      academicCalendarEventTypeSchema.safeParse('SHORTENED_DAY').success,
    ).toBe(true)
  })

  it('잘못된 이벤트 타입을 거부한다', () => {
    expect(academicCalendarEventTypeSchema.safeParse('INVALID').success).toBe(
      false,
    )
  })
})

describe('academicCalendarScopeTypeSchema', () => {
  it('유효한 범위 타입을 허용한다', () => {
    expect(academicCalendarScopeTypeSchema.safeParse('SCHOOL').success).toBe(
      true,
    )
    expect(academicCalendarScopeTypeSchema.safeParse('GRADE').success).toBe(
      true,
    )
    expect(academicCalendarScopeTypeSchema.safeParse('CLASS').success).toBe(
      true,
    )
  })

  it('잘못된 범위 타입을 거부한다', () => {
    expect(academicCalendarScopeTypeSchema.safeParse('ALL').success).toBe(
      false,
    )
  })
})

describe('academicCalendarEventSchema', () => {
  it('유효한 이벤트를 통과시킨다', () => {
    expect(academicCalendarEventSchema.safeParse(validEvent).success).toBe(true)
  })

  it('종료일이 시작일보다 빠르면 실패한다', () => {
    expect(
      academicCalendarEventSchema.safeParse({
        ...validEvent,
        startDate: '2026-03-02',
        endDate: '2026-03-01',
      }).success,
    ).toBe(false)
  })

  it('SCHOOL 범위에서 scopeValue가 있으면 실패한다', () => {
    expect(
      academicCalendarEventSchema.safeParse({
        ...validEvent,
        scopeValue: '1학년',
      }).success,
    ).toBe(false)
  })

  it('SCHOOL 외 범위에서 scopeValue가 없으면 실패한다', () => {
    expect(
      academicCalendarEventSchema.safeParse({
        ...validEvent,
        scopeType: 'GRADE',
        scopeValue: null,
      }).success,
    ).toBe(false)
  })

  it('SHORTENED_DAY에서 periodOverride가 없으면 실패한다', () => {
    expect(
      academicCalendarEventSchema.safeParse({
        ...validEvent,
        eventType: 'SHORTENED_DAY',
        periodOverride: null,
      }).success,
    ).toBe(false)
  })

  it('SHORTENED_DAY가 아닌데 periodOverride가 있으면 실패한다', () => {
    expect(
      academicCalendarEventSchema.safeParse({
        ...validEvent,
        periodOverride: 5,
      }).success,
    ).toBe(false)
  })
})
