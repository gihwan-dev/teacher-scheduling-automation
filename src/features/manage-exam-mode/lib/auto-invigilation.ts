import { buildInvigilationStats } from './validator'
import type {
  ExamSlot,
  InvigilationAssignment,
  InvigilationConflict,
  InvigilationStats,
} from '@/entities/exam-mode'
import type { Teacher } from '@/entities/teacher'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { WeekTag } from '@/shared/lib/week-tag'
import { generateId } from '@/shared/lib/id'

interface AutoAssignmentInput {
  weekTag: WeekTag
  slots: Array<ExamSlot>
  teachers: Array<Teacher>
  teacherPolicies: Array<TeacherPolicy>
  nowIso: string
  historicalTeacherLoad?: Record<string, number>
}

export interface AutoInvigilationResult {
  assignments: Array<InvigilationAssignment>
  conflicts: Array<InvigilationConflict>
  unresolvedSlotIds: Array<string>
  stats: InvigilationStats
}

export function autoAssignInvigilators(
  input: AutoAssignmentInput,
): AutoInvigilationResult {
  const policyByTeacher = new Map(
    input.teacherPolicies.map((policy) => [policy.teacherId, policy]),
  )

  const teacherLoad = new Map<string, number>()
  for (const teacher of input.teachers) {
    teacherLoad.set(teacher.id, input.historicalTeacherLoad?.[teacher.id] ?? 0)
  }

  // 같은 시간 중복 배정을 막기 위한 teacher-day-period 키
  const occupiedTeacherSlots = new Set<string>()
  const conflicts: Array<InvigilationConflict> = []
  const unresolvedSlotIds: Array<string> = []

  const sortedSlots = [...input.slots].sort((a, b) => {
    const diff = candidateCount(a) - candidateCount(b)
    if (diff !== 0) {
      return diff
    }
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date)
    }
    return a.period - b.period
  })

  const assignments: Array<InvigilationAssignment> = []

  for (const slot of sortedSlots) {
    const candidates = input.teachers
      .filter((teacher) => {
        const teacherSlotKey = `${teacher.id}-${slot.date}-${slot.period}`
        if (occupiedTeacherSlots.has(teacherSlotKey)) {
          return false
        }

        const policy = policyByTeacher.get(teacher.id)
        if (!policy) {
          return true
        }

        const isAvoided = policy.avoidanceSlots.some(
          (avoidance) =>
            avoidance.day === slot.day && avoidance.period === slot.period,
        )

        return !isAvoided
      })
      .map((teacher) => ({
        teacherId: teacher.id,
        currentLoad: teacherLoad.get(teacher.id) ?? 0,
      }))
      .sort((a, b) => {
        if (a.currentLoad !== b.currentLoad) {
          return a.currentLoad - b.currentLoad
        }
        return a.teacherId.localeCompare(b.teacherId)
      })

    if (candidates.length === 0) {
      unresolvedSlotIds.push(slot.id)
      assignments.push({
        id: generateId(),
        weekTag: input.weekTag,
        slotId: slot.id,
        teacherId: null,
        status: 'UNRESOLVED',
        isManual: false,
        reason: '배정 가능한 감독 교사가 없습니다.',
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      })
      conflicts.push({
        type: 'TEACHER_UNAVAILABLE',
        teacherId: 'N/A',
        slotIds: [slot.id],
        message: `${slot.date} ${slot.period}교시에 배정 가능한 감독 교사가 없습니다.`,
      })
      continue
    }

    const selected = candidates[0]
    teacherLoad.set(selected.teacherId, selected.currentLoad + 1)
    occupiedTeacherSlots.add(`${selected.teacherId}-${slot.date}-${slot.period}`)

    assignments.push({
      id: generateId(),
      weekTag: input.weekTag,
      slotId: slot.id,
      teacherId: selected.teacherId,
      status: 'ASSIGNED',
      isManual: false,
      reason: null,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    })
  }

  const stats = buildInvigilationStats({
    weekTag: input.weekTag,
    assignments,
    nowIso: input.nowIso,
  })

  return {
    assignments,
    conflicts,
    unresolvedSlotIds,
    stats,
  }

  function candidateCount(slot: ExamSlot): number {
    return input.teachers.filter((teacher) => {
      const policy = policyByTeacher.get(teacher.id)
      if (!policy) {
        return true
      }

      const isAvoided = policy.avoidanceSlots.some(
        (avoidance) =>
          avoidance.day === slot.day && avoidance.period === slot.period,
      )

      return !isAvoided
    }).length
  }
}
