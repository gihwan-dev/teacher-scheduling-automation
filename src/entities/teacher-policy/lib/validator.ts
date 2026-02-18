import type { TeacherPolicy } from '../model/types'
import type { Teacher } from '@/entities/teacher'
import type { SchoolConfig } from '@/entities/school'
import { getDayPeriodCount, getMaxPeriodsPerDay } from '@/entities/school'
import { getTeacherAssignments } from '@/entities/teacher/lib/validator'

export interface PolicyValidationMessage {
  severity: 'error' | 'warning'
  teacherId: string
  message: string
  guide?: string
}

/**
 * 단일 교사 정책 검증
 */
export function validateTeacherPolicy(
  policy: TeacherPolicy,
  teacher: Teacher,
  schoolConfig: SchoolConfig,
): Array<PolicyValidationMessage> {
  const messages: Array<PolicyValidationMessage> = []
  const { activeDays } = schoolConfig

  // 총 가용 슬롯 수
  const totalSlots = activeDays.reduce(
    (sum, day) => sum + getDayPeriodCount(schoolConfig, day),
    0,
  )
  const maxPeriodsPerDay = getMaxPeriodsPerDay(schoolConfig)

  // 유효한 회피 슬롯만 카운트 (운영 요일/교시 범위 내)
  const validAvoidanceCount = policy.avoidanceSlots.filter(
    (slot) =>
      activeDays.includes(slot.day) &&
      slot.period >= 1 &&
      slot.period <= getDayPeriodCount(schoolConfig, slot.day),
  ).length

  // 비운영 요일/범위 밖 교시 회피 설정 경고 (규칙 4)
  const invalidSlots = policy.avoidanceSlots.filter(
    (slot) =>
      !activeDays.includes(slot.day) ||
      slot.period < 1 ||
      slot.period > getDayPeriodCount(schoolConfig, slot.day),
  )
  if (invalidSlots.length > 0) {
    messages.push({
      severity: 'warning',
      teacherId: policy.teacherId,
      message: `${teacher.name}: 비운영 시간대에 회피 설정이 ${invalidSlots.length}건 있습니다. (무시됨)`,
    })
  }

  const availableSlots = totalSlots - validAvoidanceCount

  // 규칙 1: 모든 가용 슬롯 회피 시 → error
  if (availableSlots === 0) {
    messages.push({
      severity: 'error',
      teacherId: policy.teacherId,
      message: `${teacher.name}: 모든 가용 시간이 회피로 설정되어 배치가 불가능합니다.`,
      guide: '최소 1개 이상의 회피 슬롯을 해제하세요.',
    })
    return messages
  }

  // 교사의 총 기준 시수 계산
  const totalRequiredHours = getTeacherAssignments(teacher).reduce(
    (sum, a) => sum + a.hoursPerWeek,
    0,
  )

  // 규칙 2: 가용 슬롯 < 교사 기준 시수 → error
  if (availableSlots < totalRequiredHours) {
    const slotsToRelease = totalRequiredHours - availableSlots
    messages.push({
      severity: 'error',
      teacherId: policy.teacherId,
      message: `${teacher.name}: 가용 슬롯(${availableSlots})이 주당 시수(${totalRequiredHours})보다 부족합니다.`,
      guide: `${slotsToRelease}개 이상의 회피 슬롯을 해제하세요.`,
    })
  }

  // 규칙 3: 회피 비율 80% 이상 → warning
  if (totalSlots > 0) {
    const avoidanceRatio = validAvoidanceCount / totalSlots
    if (avoidanceRatio >= 0.8 && availableSlots >= totalRequiredHours) {
      messages.push({
        severity: 'warning',
        teacherId: policy.teacherId,
        message: `${teacher.name}: 회피 비율이 ${Math.round(avoidanceRatio * 100)}%로 배치 난이도가 매우 높습니다.`,
      })
    }
  }

  // 규칙 5: override 값 < 1 → error
  if (
    policy.maxConsecutiveHoursOverride !== null &&
    (policy.maxConsecutiveHoursOverride < 1 ||
      policy.maxConsecutiveHoursOverride > maxPeriodsPerDay)
  ) {
    messages.push({
      severity: 'error',
      teacherId: policy.teacherId,
      message: `${teacher.name}: 연강 허용 한도는 1~${maxPeriodsPerDay} 범위여야 합니다.`,
    })
  }

  if (
    policy.maxDailyHoursOverride !== null &&
    (policy.maxDailyHoursOverride < 1 ||
      policy.maxDailyHoursOverride > maxPeriodsPerDay)
  ) {
    messages.push({
      severity: 'error',
      teacherId: policy.teacherId,
      message: `${teacher.name}: 일일 최대 시수는 1~${maxPeriodsPerDay} 범위여야 합니다.`,
    })
  }

  return messages
}

/**
 * 전체 교사 정책 검증
 */
export function validateAllPolicies(
  policies: Array<TeacherPolicy>,
  teachers: Array<Teacher>,
  schoolConfig: SchoolConfig,
): { valid: boolean; messages: Array<PolicyValidationMessage> } {
  const teacherMap = new Map(teachers.map((t) => [t.id, t]))
  const allMessages: Array<PolicyValidationMessage> = []

  for (const policy of policies) {
    const teacher = teacherMap.get(policy.teacherId)
    if (!teacher) continue
    const msgs = validateTeacherPolicy(policy, teacher, schoolConfig)
    allMessages.push(...msgs)
  }

  const hasError = allMessages.some((m) => m.severity === 'error')
  return { valid: !hasError, messages: allMessages }
}
