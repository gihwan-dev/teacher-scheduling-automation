import type { DayOfWeek } from '@/shared/lib/types'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type {
  AssignmentUnit,
  RelaxationSuggestion,
  UnplacedAssignment,
} from '../model/types'
import type { TimetableGrid } from './grid'

/**
 * 배치 실패 원인 분석
 */
export function diagnoseFailure(
  grid: TimetableGrid,
  unit: AssignmentUnit,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
  _policy: ConstraintPolicy,
  blockedSlots: Set<string>,
): UnplacedAssignment['reason'] {
  // 교사의 가용 슬롯 수 계산
  let teacherAvailable = 0
  let classAvailable = 0
  let overlapAvailable = 0

  for (const day of activeDays) {
    for (let period = 1; period <= periodsPerDay; period++) {
      const teacherFree = !grid.isTeacherBusy(unit.teacherId, day, period)
      const teacherNotBlocked = !blockedSlots.has(
        `teacher-${unit.teacherId}-${day}-${period}`,
      )
      const classFree = !grid.isClassSlotFilled(
        unit.grade,
        unit.classNumber,
        day,
        period,
      )
      const classNotBlocked = !blockedSlots.has(
        `class-${unit.grade}-${unit.classNumber}-${day}-${period}`,
      )

      if (teacherFree && teacherNotBlocked) teacherAvailable++
      if (classFree && classNotBlocked) classAvailable++
      if (teacherFree && teacherNotBlocked && classFree && classNotBlocked)
        overlapAvailable++
    }
  }

  if (teacherAvailable < unit.remainingHours) {
    return 'TEACHER_NO_AVAILABLE_SLOTS'
  }
  if (classAvailable < unit.remainingHours) {
    return 'CLASS_NO_AVAILABLE_SLOTS'
  }
  if (overlapAvailable < unit.remainingHours) {
    return 'TEACHER_CLASS_NO_OVERLAP'
  }
  return 'BACKTRACKING_EXHAUSTED'
}

/**
 * 미배치 목록 기반 완화 제안 생성
 */
export function suggestRelaxations(
  unplaced: Array<UnplacedAssignment>,
  policy: ConstraintPolicy,
): Array<RelaxationSuggestion> {
  const suggestions: Array<RelaxationSuggestion> = []
  const reasonCounts = new Map<string, number>()

  for (const u of unplaced) {
    reasonCounts.set(u.reason, (reasonCounts.get(u.reason) ?? 0) + 1)
  }

  if (reasonCounts.has('TEACHER_NO_AVAILABLE_SLOTS')) {
    const count = reasonCounts.get('TEACHER_NO_AVAILABLE_SLOTS')!
    const teacherIds = [
      ...new Set(
        unplaced
          .filter((u) => u.reason === 'TEACHER_NO_AVAILABLE_SLOTS')
          .map((u) => u.teacherId),
      ),
    ]
    suggestions.push({
      type: 'REDUCE_TEACHER_HOURS',
      message: `${count}건의 배정이 교사 가용 슬롯 부족으로 실패했습니다. 해당 교사(${teacherIds.length}명)의 기준 시수를 줄이거나 운영 교시를 늘리는 것을 검토하세요.`,
      priority: 'high',
    })
  }

  if (reasonCounts.has('CLASS_NO_AVAILABLE_SLOTS')) {
    const count = reasonCounts.get('CLASS_NO_AVAILABLE_SLOTS')!
    suggestions.push({
      type: 'INCREASE_PERIODS',
      message: `${count}건의 배정이 반 가용 슬롯 부족으로 실패했습니다. 일일 교시 수를 늘리거나 운영 요일을 추가하세요.`,
      priority: 'high',
    })
  }

  if (reasonCounts.has('TEACHER_CLASS_NO_OVERLAP')) {
    const count = reasonCounts.get('TEACHER_CLASS_NO_OVERLAP')!
    suggestions.push({
      type: 'RESOLVE_OVERLAP',
      message: `${count}건의 배정이 교사-반 시간 겹침으로 실패했습니다. 출장/행사 일정을 조정하거나, 교사 배정을 변경하세요.`,
      priority: 'medium',
    })
  }

  if (reasonCounts.has('BACKTRACKING_EXHAUSTED')) {
    const count = reasonCounts.get('BACKTRACKING_EXHAUSTED')!
    suggestions.push({
      type: 'RELAX_CONSTRAINTS',
      message: `${count}건의 배정이 백트래킹 한도 초과로 실패했습니다. 교사 일일 최대 시수(현재 ${policy.teacherMaxDailyHours})를 완화하거나 재시도하세요.`,
      priority: 'medium',
    })

    if (policy.teacherMaxDailyHours < 8) {
      suggestions.push({
        type: 'INCREASE_DAILY_LIMIT',
        message: `교사 일일 최대 시수를 ${policy.teacherMaxDailyHours}에서 ${policy.teacherMaxDailyHours + 1}로 완화하면 배치 성공률이 높아질 수 있습니다.`,
        priority: 'low',
      })
    }
  }

  return suggestions
}
