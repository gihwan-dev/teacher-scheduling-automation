import type { ConstraintPolicy, ConstraintViolation } from '../model/types'
import type { TimetableCell } from '@/entities/timetable'

export function validateTimetable(
  cells: Array<TimetableCell>,
  policy: ConstraintPolicy,
): Array<ConstraintViolation> {
  const violations: Array<ConstraintViolation> = []

  checkTeacherConflicts(cells, violations)
  checkStudentConsecutive(cells, policy, violations)
  checkTeacherConsecutive(cells, policy, violations)
  checkTeacherDailyOverload(cells, policy, violations)

  return violations
}

function checkTeacherConflicts(
  cells: Array<TimetableCell>,
  violations: Array<ConstraintViolation>,
): void {
  const slotMap = new Map<string, Array<TimetableCell>>()

  for (const cell of cells) {
    const key = `${cell.teacherId}:${cell.day}:${cell.period}`
    const existing = slotMap.get(key)
    if (existing) {
      existing.push(cell)
    } else {
      slotMap.set(key, [cell])
    }
  }

  for (const [, group] of slotMap) {
    if (group.length >= 2) {
      const first = group[0]
      violations.push({
        type: 'TEACHER_CONFLICT',
        severity: 'error',
        message: `교사 ${first.teacherId}가 ${first.day} ${first.period}교시에 ${group.length}개 수업이 배정되었습니다`,
        location: {
          day: first.day,
          period: first.period,
          teacherId: first.teacherId,
        },
      })
    }
  }
}

function checkStudentConsecutive(
  cells: Array<TimetableCell>,
  policy: ConstraintPolicy,
  violations: Array<ConstraintViolation>,
): void {
  const classMap = new Map<string, Array<TimetableCell>>()

  for (const cell of cells) {
    const key = `${cell.grade}:${cell.classNumber}:${cell.day}`
    const existing = classMap.get(key)
    if (existing) {
      existing.push(cell)
    } else {
      classMap.set(key, [cell])
    }
  }

  for (const [, group] of classMap) {
    group.sort((a, b) => a.period - b.period)

    const subjectMap = new Map<string, Array<number>>()
    for (const cell of group) {
      const periods = subjectMap.get(cell.subjectId)
      if (periods) {
        periods.push(cell.period)
      } else {
        subjectMap.set(cell.subjectId, [cell.period])
      }
    }

    for (const [subjectId, periods] of subjectMap) {
      let consecutive = 1
      for (let i = 1; i < periods.length; i++) {
        if (periods[i] === periods[i - 1] + 1) {
          consecutive++
          if (consecutive > policy.studentMaxConsecutiveSameSubject) {
            const first = group[0]
            violations.push({
              type: 'STUDENT_CONSECUTIVE_EXCEEDED',
              severity: 'warning',
              message: `${first.grade}학년 ${first.classNumber}반 ${first.day}에 과목 ${subjectId}가 ${consecutive}연속 배정되었습니다 (최대 ${policy.studentMaxConsecutiveSameSubject})`,
              location: {
                grade: first.grade,
                classNumber: first.classNumber,
                day: first.day,
                subjectId,
              },
            })
            break
          }
        } else {
          consecutive = 1
        }
      }
    }
  }
}

function checkTeacherConsecutive(
  cells: Array<TimetableCell>,
  policy: ConstraintPolicy,
  violations: Array<ConstraintViolation>,
): void {
  const teacherDayMap = new Map<string, Array<number>>()

  for (const cell of cells) {
    const key = `${cell.teacherId}:${cell.day}`
    const existing = teacherDayMap.get(key)
    if (existing) {
      existing.push(cell.period)
    } else {
      teacherDayMap.set(key, [cell.period])
    }
  }

  for (const [key, periods] of teacherDayMap) {
    periods.sort((a, b) => a - b)
    const [teacherId, day] = key.split(':')

    let consecutive = 1
    for (let i = 1; i < periods.length; i++) {
      if (periods[i] === periods[i - 1] + 1) {
        consecutive++
        if (consecutive > policy.teacherMaxConsecutiveHours) {
          violations.push({
            type: 'TEACHER_CONSECUTIVE_EXCEEDED',
            severity: 'warning',
            message: `교사 ${teacherId}가 ${day}에 ${consecutive}연속 수업이 배정되었습니다 (최대 ${policy.teacherMaxConsecutiveHours})`,
            location: {
              day: day as TimetableCell['day'],
              teacherId,
            },
          })
          break
        }
      } else {
        consecutive = 1
      }
    }
  }
}

function checkTeacherDailyOverload(
  cells: Array<TimetableCell>,
  policy: ConstraintPolicy,
  violations: Array<ConstraintViolation>,
): void {
  const teacherDayMap = new Map<string, number>()

  for (const cell of cells) {
    const key = `${cell.teacherId}:${cell.day}`
    teacherDayMap.set(key, (teacherDayMap.get(key) ?? 0) + 1)
  }

  for (const [key, count] of teacherDayMap) {
    if (count > policy.teacherMaxDailyHours) {
      const [teacherId, day] = key.split(':')
      violations.push({
        type: 'TEACHER_DAILY_OVERLOAD',
        severity: 'warning',
        message: `교사 ${teacherId}가 ${day}에 ${count}시간 배정되었습니다 (최대 ${policy.teacherMaxDailyHours})`,
        location: {
          day: day as TimetableCell['day'],
          teacherId,
        },
      })
    }
  }
}
