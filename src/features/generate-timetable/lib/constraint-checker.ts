import type { DayOfWeek } from '@/shared/lib/types'
import type { FixedEvent } from '@/entities/fixed-event'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { AssignmentUnit } from '../model/types'
import type { TimetableGrid } from './grid'

interface SlotCandidate {
  day: DayOfWeek
  period: number
  score: number
}

/**
 * 배정 단위에 대해 배치 가능한 슬롯 목록 반환 (Hard 제약 통과만)
 */
export function findCandidateSlots(
  grid: TimetableGrid,
  unit: AssignmentUnit,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
  policy: ConstraintPolicy,
  blockedSlots: Set<string>,
  teacherPolicies?: Array<TeacherPolicy>,
): Array<SlotCandidate> {
  const candidates: Array<SlotCandidate> = []

  for (const day of activeDays) {
    for (let period = 1; period <= periodsPerDay; period++) {
      if (
        isPlacementValid(
          grid,
          unit,
          day,
          period,
          policy,
          blockedSlots,
          teacherPolicies,
        )
      ) {
        candidates.push({ day, period, score: 0 })
      }
    }
  }

  return candidates
}

/**
 * 단일 슬롯에 대한 Hard 제약 검사
 */
export function isPlacementValid(
  grid: TimetableGrid,
  unit: AssignmentUnit,
  day: DayOfWeek,
  period: number,
  policy: ConstraintPolicy,
  blockedSlots: Set<string>,
  teacherPolicies?: Array<TeacherPolicy>,
): boolean {
  // 1. 교사 충돌 금지: 동일 시간 2개 반 불가
  if (grid.isTeacherBusy(unit.teacherId, day, period)) {
    return false
  }

  // 2. 반당 교시 1개 배정
  if (grid.isClassSlotFilled(unit.grade, unit.classNumber, day, period)) {
    return false
  }

  // 3. 차단된 슬롯 (출장, 학교 행사, 교사 회피 등)
  const teacherBlockKey = `teacher-${unit.teacherId}-${day}-${period}`
  const classBlockKey = `class-${unit.grade}-${unit.classNumber}-${day}-${period}`
  if (blockedSlots.has(teacherBlockKey) || blockedSlots.has(classBlockKey)) {
    return false
  }

  // 4. 교사 일일 최대 시수 제한 (per-teacher override 우선)
  const tp = teacherPolicies?.find((p) => p.teacherId === unit.teacherId)
  const maxDaily = tp?.maxDailyHoursOverride ?? policy.teacherMaxDailyHours
  if (grid.getTeacherDayHours(unit.teacherId, day) >= maxDaily) {
    return false
  }

  return true
}

/**
 * 고정 이벤트와 출장/행사에서 차단 슬롯 세트 생성
 */
export function buildBlockedSlots(
  fixedEvents: Array<FixedEvent>,
  teacherPolicies?: Array<TeacherPolicy>,
): Set<string> {
  const blocked = new Set<string>()

  for (const event of fixedEvents) {
    if (event.type === 'BUSINESS_TRIP' && event.teacherId) {
      blocked.add(`teacher-${event.teacherId}-${event.day}-${event.period}`)
    }
    if (
      event.type === 'SCHOOL_EVENT' &&
      event.grade !== null &&
      event.classNumber !== null
    ) {
      blocked.add(
        `class-${event.grade}-${event.classNumber}-${event.day}-${event.period}`,
      )
    }
    if (
      event.type === 'SCHOOL_EVENT' &&
      event.grade !== null &&
      event.classNumber === null
    ) {
      blocked.add(`grade-${event.grade}-${event.day}-${event.period}`)
    }
  }

  // 교사별 회피 슬롯을 차단에 추가
  if (teacherPolicies) {
    for (const policy of teacherPolicies) {
      for (const slot of policy.avoidanceSlots) {
        blocked.add(`teacher-${policy.teacherId}-${slot.day}-${slot.period}`)
      }
    }
  }

  return blocked
}

/**
 * 학년 전체 행사 차단 슬롯을 반별로 확장
 */
export function expandGradeBlockedSlots(
  blockedSlots: Set<string>,
  gradeClassCounts: Record<number, number>,
): Set<string> {
  const expanded = new Set(blockedSlots)

  for (const key of blockedSlots) {
    if (key.startsWith('grade-')) {
      // "grade-{grade}-{day}-{period}"
      const parts = key.split('-')
      const grade = Number(parts[1])
      const day = parts[2]
      const period = parts[3]
      const classCount = gradeClassCounts[grade] ?? 0
      for (let cls = 1; cls <= classCount; cls++) {
        expanded.add(`class-${grade}-${cls}-${day}-${period}`)
      }
    }
  }

  return expanded
}
