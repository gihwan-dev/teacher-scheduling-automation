import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { DayOfWeek } from '@/shared/lib/types'
import type { BuildAcademicCalendarBlockedSlotsInput } from '../model/types'
import { getIsoDateForWeekDay } from '@/shared/lib/week-tag'

interface ParsedClassScope {
  grade: number
  classNumber: number
}

export function buildAcademicCalendarBlockedSlots(
  input: BuildAcademicCalendarBlockedSlotsInput,
): Set<string> {
  const { schoolConfig, weekTag, academicCalendarEvents } = input
  const blocked = new Set<string>()

  for (const day of schoolConfig.activeDays) {
    const date = getIsoDateForWeekDay(weekTag, day)

    for (let grade = 1; grade <= schoolConfig.gradeCount; grade++) {
      const classCount = schoolConfig.classCountByGrade[grade] ?? 0
      for (let classNumber = 1; classNumber <= classCount; classNumber++) {
        const matchedEvents = academicCalendarEvents.filter(
          (event) =>
            isDateInRange(date, event.startDate, event.endDate) &&
            isEventScopeMatch(event, grade, classNumber),
        )

        for (const event of matchedEvents) {
          if (isFullDayBlockedEvent(event)) {
            for (let period = 1; period <= schoolConfig.periodsPerDay; period++) {
              blocked.add(`class-${grade}-${classNumber}-${day}-${period}`)
            }
            continue
          }

          if (
            event.eventType === 'SHORTENED_DAY' &&
            event.periodOverride !== null &&
            event.periodOverride < schoolConfig.periodsPerDay
          ) {
            for (
              let period = event.periodOverride + 1;
              period <= schoolConfig.periodsPerDay;
              period++
            ) {
              blocked.add(`class-${grade}-${classNumber}-${day}-${period}`)
            }
          }
        }
      }
    }
  }

  return blocked
}

export function isDateInRange(
  date: string,
  startDate: string,
  endDate: string,
): boolean {
  return date >= startDate && date <= endDate
}

export function isEventScopeMatch(
  event: AcademicCalendarEvent,
  grade: number,
  classNumber: number,
): boolean {
  if (event.scopeType === 'SCHOOL') {
    return true
  }

  if (event.scopeType === 'GRADE') {
    const gradeValue = Number(event.scopeValue)
    return Number.isInteger(gradeValue) && gradeValue === grade
  }

  const parsed = parseClassScope(event.scopeValue)
  if (!parsed) {
    return false
  }
  return parsed.grade === grade && parsed.classNumber === classNumber
}

export function isFullDayBlockedEvent(event: AcademicCalendarEvent): boolean {
  return (
    event.eventType === 'HOLIDAY' ||
    event.eventType === 'CLOSURE_DAY' ||
    event.eventType === 'GRADE_EVENT' ||
    event.eventType === 'SCHOOL_EVENT' ||
    event.eventType === 'EXAM_PERIOD'
  )
}

export function createClassSlotKey(
  grade: number,
  classNumber: number,
  day: DayOfWeek,
  period: number,
): string {
  return `class-${grade}-${classNumber}-${day}-${period}`
}

function parseClassScope(scopeValue: string | null): ParsedClassScope | null {
  if (!scopeValue) {
    return null
  }
  const parts = scopeValue.split('-')
  if (parts.length !== 2) {
    return null
  }

  const grade = Number(parts[0])
  const classNumber = Number(parts[1])
  if (!Number.isInteger(grade) || !Number.isInteger(classNumber)) {
    return null
  }
  if (grade < 1 || classNumber < 1) {
    return null
  }

  return { grade, classNumber }
}
