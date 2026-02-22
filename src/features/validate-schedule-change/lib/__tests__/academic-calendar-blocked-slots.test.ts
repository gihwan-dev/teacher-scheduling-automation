import { describe, expect, it } from 'vitest'
import { buildAcademicCalendarBlockedSlots } from '../academic-calendar-blocked-slots'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { SchoolConfig } from '@/entities/school'

const ts = '2026-02-22T00:00:00.000Z'

function makeSchoolConfig(): SchoolConfig {
  return {
    id: 'school-1',
    gradeCount: 1,
    classCountByGrade: { 1: 2 },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    periodsPerDay: 7,
    createdAt: ts,
    updatedAt: ts,
  }
}

function makeEvent(
  overrides: Partial<AcademicCalendarEvent>,
): AcademicCalendarEvent {
  return {
    id: 'event-1',
    eventType: 'HOLIDAY',
    startDate: '2026-02-23',
    endDate: '2026-02-23',
    scopeType: 'SCHOOL',
    scopeValue: null,
    periodOverride: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

describe('buildAcademicCalendarBlockedSlots', () => {
  it('공휴일은 전 학급 전 교시를 차단한다', () => {
    const blocked = buildAcademicCalendarBlockedSlots({
      schoolConfig: makeSchoolConfig(),
      weekTag: '2026-W09',
      academicCalendarEvents: [makeEvent({ eventType: 'HOLIDAY' })],
    })

    expect(blocked.has('class-1-1-MON-1')).toBe(true)
    expect(blocked.has('class-1-2-MON-7')).toBe(true)
  })

  it('단축수업은 periodOverride 초과 교시만 차단한다', () => {
    const blocked = buildAcademicCalendarBlockedSlots({
      schoolConfig: makeSchoolConfig(),
      weekTag: '2026-W09',
      academicCalendarEvents: [
        makeEvent({
          id: 'event-short',
          eventType: 'SHORTENED_DAY',
          startDate: '2026-02-24',
          endDate: '2026-02-24',
          periodOverride: 4,
        }),
      ],
    })

    expect(blocked.has('class-1-1-TUE-4')).toBe(false)
    expect(blocked.has('class-1-1-TUE-5')).toBe(true)
    expect(blocked.has('class-1-2-TUE-7')).toBe(true)
  })

  it('CLASS 범위 이벤트는 해당 반만 차단한다', () => {
    const blocked = buildAcademicCalendarBlockedSlots({
      schoolConfig: makeSchoolConfig(),
      weekTag: '2026-W09',
      academicCalendarEvents: [
        makeEvent({
          id: 'event-class',
          eventType: 'SCHOOL_EVENT',
          startDate: '2026-02-25',
          endDate: '2026-02-25',
          scopeType: 'CLASS',
          scopeValue: '1-2',
        }),
      ],
    })

    expect(blocked.has('class-1-1-WED-1')).toBe(false)
    expect(blocked.has('class-1-2-WED-1')).toBe(true)
  })
})
