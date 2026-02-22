import { isDateInRange, isEventScopeMatch } from './academic-calendar-blocked-slots'
import type { ConstraintViolation } from '@/entities/constraint-policy'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ValidationViolation } from '@/entities/schedule-transaction'
import type { DayOfWeek } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'
import type { ValidateScheduleChangeInput } from '../model/types'
import { getIsoDateForWeekDay } from '@/shared/lib/week-tag'
import { DAY_LABELS } from '@/shared/lib/constants'
import { validateTimetable } from '@/entities/constraint-policy'

const CALENDAR_EVENT_LABEL: Record<string, string> = {
  HOLIDAY: '공휴일',
  CLOSURE_DAY: '휴업일',
  EXAM_PERIOD: '시험기간',
  GRADE_EVENT: '학년 행사',
  SCHOOL_EVENT: '전교 행사',
  SHORTENED_DAY: '단축수업일',
}

export function validateScheduleChange(
  input: ValidateScheduleChangeInput,
): Array<ValidationViolation> {
  const {
    cells,
    constraintPolicy,
    weekTag,
    teachers,
    subjects,
    academicCalendarEvents = [],
  } = input

  const teacherNameById = new Map(teachers.map((teacher) => [teacher.id, teacher.name]))
  const subjectNameById = new Map(subjects.map((subject) => [subject.id, subject.name]))

  const violations: Array<ValidationViolation> = []

  const baseViolations = validateTimetable(cells, constraintPolicy)
  for (const violation of baseViolations) {
    violations.push(
      mapConstraintViolation(violation, weekTag, teacherNameById, subjectNameById),
    )
  }

  violations.push(...buildClassConflictViolations(cells, weekTag))
  violations.push(
    ...buildAcademicCalendarViolations(
      cells,
      weekTag,
      academicCalendarEvents,
      teacherNameById,
      subjectNameById,
    ),
  )

  return violations
}

function mapConstraintViolation(
  violation: ConstraintViolation,
  weekTag: WeekTag,
  teacherNameById: Map<string, string>,
  subjectNameById: Map<string, string>,
): ValidationViolation {
  const day = violation.location.day
  const period = violation.location.period
  const date = day ? getIsoDateForWeekDay(weekTag, day) : undefined
  const teacherName =
    violation.location.teacherId !== undefined
      ? (teacherNameById.get(violation.location.teacherId) ?? '교사')
      : undefined
  const subjectName =
    violation.location.subjectId !== undefined
      ? (subjectNameById.get(violation.location.subjectId) ?? '해당 과목')
      : undefined

  switch (violation.type) {
    case 'TEACHER_CONFLICT':
      return {
        ruleId: 'HC-07',
        severity: 'error',
        humanMessage: `${teacherName ?? '교사'}가 ${dayLabel(day)} ${period}교시에 중복 배정되었습니다.`,
        location: {
          weekTag,
          date,
          day,
          period,
          teacherName,
        },
        relatedEntities: [
          ...(teacherName ? [{ type: 'TEACHER' as const, label: teacherName }] : []),
        ],
      }
    case 'STUDENT_CONSECUTIVE_EXCEEDED':
      return {
        ruleId: 'HC-08',
        severity: 'error',
        humanMessage: `${violation.location.grade ?? '-'}학년 ${violation.location.classNumber ?? '-'}반에서 ${subjectName ?? '해당 과목'} 연강 제한을 초과했습니다.`,
        location: {
          weekTag,
          date,
          grade: violation.location.grade,
          classNumber: violation.location.classNumber,
          day,
          period,
        },
        relatedEntities: [
          {
            type: 'CLASS',
            label: `${violation.location.grade ?? '-'}학년 ${violation.location.classNumber ?? '-'}반`,
          },
          ...(subjectName ? [{ type: 'LESSON' as const, label: subjectName }] : []),
        ],
      }
    case 'TEACHER_CONSECUTIVE_EXCEEDED':
      return {
        ruleId: 'HC-08',
        severity: 'error',
        humanMessage: `${teacherName ?? '교사'}의 연속 수업 제한을 초과했습니다.`,
        location: {
          weekTag,
          date,
          day,
          period,
          teacherName,
        },
        relatedEntities: [
          ...(teacherName ? [{ type: 'TEACHER' as const, label: teacherName }] : []),
        ],
      }
    case 'TEACHER_DAILY_OVERLOAD':
      return {
        ruleId: 'HC-08',
        severity: 'error',
        humanMessage: `${teacherName ?? '교사'}의 일일 최대 시수 제한을 초과했습니다.`,
        location: {
          weekTag,
          date,
          day,
          period,
          teacherName,
        },
        relatedEntities: [
          ...(teacherName ? [{ type: 'TEACHER' as const, label: teacherName }] : []),
        ],
      }
    default:
      return {
        ruleId: 'HC-08',
        severity: violation.severity,
        humanMessage: '시간표 제약 위반이 감지되었습니다.',
        location: {
          weekTag,
          date,
          grade: violation.location.grade,
          classNumber: violation.location.classNumber,
          day,
          period,
          teacherName,
        },
        relatedEntities: [],
      }
  }
}

function buildClassConflictViolations(
  cells: Array<{
    grade: number
    classNumber: number
    day: DayOfWeek
    period: number
  }>,
  weekTag: WeekTag,
): Array<ValidationViolation> {
  const conflicts = new Map<string, number>()

  for (const cell of cells) {
    const key = `${cell.grade}-${cell.classNumber}-${cell.day}-${cell.period}`
    conflicts.set(key, (conflicts.get(key) ?? 0) + 1)
  }

  const violations: Array<ValidationViolation> = []
  for (const [key, count] of conflicts) {
    if (count < 2) {
      continue
    }
    const [gradeStr, classStr, day, periodStr] = key.split('-')
    const grade = Number(gradeStr)
    const classNumber = Number(classStr)
    const period = Number(periodStr)
    const date = getIsoDateForWeekDay(weekTag, day as DayOfWeek)

    violations.push({
      ruleId: 'HC-07',
      severity: 'error',
      humanMessage: `${grade}학년 ${classNumber}반 ${dayLabel(day as DayOfWeek)} ${period}교시에 수업이 중복 배정되었습니다.`,
      location: {
        weekTag,
        date,
        grade,
        classNumber,
        day: day as DayOfWeek,
        period,
      },
      relatedEntities: [
        {
          type: 'CLASS',
          label: `${grade}학년 ${classNumber}반`,
        },
      ],
    })
  }

  return violations
}

function buildAcademicCalendarViolations(
  cells: Array<{
    teacherId: string
    subjectId: string
    grade: number
    classNumber: number
    day: DayOfWeek
    period: number
  }>,
  weekTag: WeekTag,
  events: Array<AcademicCalendarEvent>,
  teacherNameById: Map<string, string>,
  subjectNameById: Map<string, string>,
): Array<ValidationViolation> {
  const violations: Array<ValidationViolation> = []
  const visited = new Set<string>()

  for (const cell of cells) {
    const date = getIsoDateForWeekDay(weekTag, cell.day)
    for (const event of events) {
      if (!isDateInRange(date, event.startDate, event.endDate)) {
        continue
      }
      if (!isEventScopeMatch(event, cell.grade, cell.classNumber)) {
        continue
      }

      const blocked =
        event.eventType === 'HOLIDAY' ||
        event.eventType === 'CLOSURE_DAY' ||
        event.eventType === 'GRADE_EVENT' ||
        event.eventType === 'SCHOOL_EVENT' ||
        event.eventType === 'EXAM_PERIOD' ||
        (event.eventType === 'SHORTENED_DAY' &&
          event.periodOverride !== null &&
          cell.period > event.periodOverride)

      if (!blocked) {
        continue
      }

      const key = `${event.id}:${cell.grade}:${cell.classNumber}:${cell.day}:${cell.period}`
      if (visited.has(key)) {
        continue
      }
      visited.add(key)

      const ruleId = toCalendarRuleId(event.eventType)
      const teacherName = teacherNameById.get(cell.teacherId) ?? '담당 교사'
      const subjectName = subjectNameById.get(cell.subjectId) ?? '해당 과목'
      const eventLabel = CALENDAR_EVENT_LABEL[event.eventType] ?? '학사일정'

      const humanMessage =
        event.eventType === 'SHORTENED_DAY' && event.periodOverride !== null
          ? `${date}(${dayLabel(cell.day)})은 단축수업일로 ${event.periodOverride}교시까지만 운영됩니다. ${cell.grade}학년 ${cell.classNumber}반 ${cell.period}교시 ${subjectName} 배정은 불가합니다.`
          : `${date}(${dayLabel(cell.day)}) ${eventLabel} 일정으로 ${cell.grade}학년 ${cell.classNumber}반 ${cell.period}교시 ${subjectName} 배정이 불가합니다.`

      violations.push({
        ruleId,
        severity: 'error',
        humanMessage,
        location: {
          weekTag,
          date,
          grade: cell.grade,
          classNumber: cell.classNumber,
          day: cell.day,
          period: cell.period,
          teacherName,
        },
        relatedEntities: [
          { type: 'CLASS', label: `${cell.grade}학년 ${cell.classNumber}반` },
          { type: 'TEACHER', label: teacherName },
          { type: 'LESSON', label: subjectName },
          { type: 'CALENDAR_EVENT', label: eventLabel },
        ],
      })
    }
  }

  return violations
}

function toCalendarRuleId(eventType: string): string {
  switch (eventType) {
    case 'HOLIDAY':
    case 'CLOSURE_DAY':
      return 'HC-01'
    case 'GRADE_EVENT':
      return 'HC-02'
    case 'SCHOOL_EVENT':
      return 'HC-03'
    case 'EXAM_PERIOD':
      return 'HC-04'
    case 'SHORTENED_DAY':
      return 'HC-05'
    default:
      return 'HC-05'
  }
}

function dayLabel(day?: DayOfWeek): string {
  if (!day) {
    return '-'
  }
  return DAY_LABELS[day]
}
