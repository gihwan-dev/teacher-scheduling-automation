import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type {
  ExamSlot,
  InvigilationAssignment,
  InvigilationConflict,
  InvigilationStats,
} from '@/entities/exam-mode'
import type { SchoolConfig } from '@/entities/school'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { WeekTag } from '@/shared/lib/week-tag'
import { getWeekDateRange } from '@/shared/lib/week-tag'

export function canEnableExamModeForWeek(input: {
  weekTag: WeekTag
  schoolConfig: SchoolConfig
  academicCalendarEvents: Array<AcademicCalendarEvent>
}): {
  ok: boolean
  message: string | null
} {
  const { startDate, endDate } = getWeekDateRange(
    input.weekTag,
    input.schoolConfig.activeDays,
  )

  const hasExamPeriod = input.academicCalendarEvents.some(
    (event) =>
      event.eventType === 'EXAM_PERIOD' &&
      event.startDate <= endDate &&
      event.endDate >= startDate,
  )

  if (!hasExamPeriod) {
    return {
      ok: false,
      message:
        '해당 주차는 EXAM_PERIOD 학사일정이 없어 시험 모드를 시작할 수 없습니다.',
    }
  }

  return { ok: true, message: null }
}

export function validateInvigilationAssignments(input: {
  slots: Array<ExamSlot>
  assignments: Array<InvigilationAssignment>
  teacherPolicies: Array<TeacherPolicy>
}): Array<InvigilationConflict> {
  const slotById = new Map(input.slots.map((slot) => [slot.id, slot]))
  const conflicts: Array<InvigilationConflict> = []

  const slotKeysByTeacher = new Map<string, Array<string>>()
  for (const assignment of input.assignments) {
    if (assignment.status !== 'ASSIGNED' || assignment.teacherId === null) {
      continue
    }

    const slot = slotById.get(assignment.slotId)
    if (!slot) {
      conflicts.push({
        type: 'TEACHER_UNAVAILABLE',
        teacherId: assignment.teacherId,
        slotIds: [assignment.slotId],
        message: '존재하지 않는 시험 슬롯을 참조한 감독 배정입니다.',
      })
      continue
    }

    const key = `${assignment.teacherId}-${slot.date}-${slot.period}`
    const prev = slotKeysByTeacher.get(key)
    if (prev) {
      prev.push(assignment.slotId)
    } else {
      slotKeysByTeacher.set(key, [assignment.slotId])
    }
  }

  for (const [key, slotIds] of slotKeysByTeacher) {
    if (slotIds.length <= 1) {
      continue
    }
    const teacherId = key.split('-')[0]
    conflicts.push({
      type: 'TEACHER_DOUBLE_BOOKED',
      teacherId,
      slotIds,
      message: '동일 교사가 같은 시간에 복수 시험 감독으로 배정되었습니다.',
    })
  }

  const policyByTeacher = new Map(
    input.teacherPolicies.map((policy) => [policy.teacherId, policy]),
  )

  for (const assignment of input.assignments) {
    if (assignment.status !== 'ASSIGNED' || assignment.teacherId === null) {
      continue
    }

    const slot = slotById.get(assignment.slotId)
    if (!slot) {
      continue
    }

    const policy = policyByTeacher.get(assignment.teacherId)
    if (!policy) {
      continue
    }

    const isAvoided = policy.avoidanceSlots.some(
      (avoidance) =>
        avoidance.day === slot.day && avoidance.period === slot.period,
    )

    if (isAvoided) {
      conflicts.push({
        type: 'TEACHER_UNAVAILABLE',
        teacherId: assignment.teacherId,
        slotIds: [assignment.slotId],
        message: '교사 회피 시간대에 감독 배정이 포함되어 있습니다.',
      })
    }
  }

  return conflicts
}

export function buildInvigilationStats(input: {
  weekTag: WeekTag
  assignments: Array<InvigilationAssignment>
  nowIso: string
}): InvigilationStats {
  const assigned = input.assignments.filter(
    (assignment) =>
      assignment.status === 'ASSIGNED' && assignment.teacherId !== null,
  )

  const teacherLoadMap = new Map<string, number>()
  for (const assignment of assigned) {
    const teacherId = assignment.teacherId as string
    teacherLoadMap.set(teacherId, (teacherLoadMap.get(teacherId) ?? 0) + 1)
  }

  return {
    weekTag: input.weekTag,
    totalSlots: input.assignments.length,
    assignedSlots: assigned.length,
    unassignedSlots: input.assignments.length - assigned.length,
    teacherLoad: [...teacherLoadMap.entries()]
      .map(([teacherId, count]) => ({ teacherId, count }))
      .sort((a, b) => b.count - a.count || a.teacherId.localeCompare(b.teacherId)),
    updatedAt: input.nowIso,
  }
}
