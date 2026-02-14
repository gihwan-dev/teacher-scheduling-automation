import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'
import {
  findUnassignedSubjects,
  validateClassCapacity,
  validateHoursConsistency,
} from '@/entities/teacher'
import { calculateSlotsPerClass } from '@/entities/school'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationMessage {
  severity: ValidationSeverity
  message: string
}

export function runFullValidation(
  schoolConfig: SchoolConfig | null,
  subjects: Array<Subject>,
  teachers: Array<Teacher>,
  fixedEvents: Array<FixedEvent>,
): Array<ValidationMessage> {
  const messages: Array<ValidationMessage> = []

  if (!schoolConfig) {
    messages.push({ severity: 'error', message: '학교 구조가 설정되지 않았습니다.' })
    return messages
  }

  // 필수 필드 누락 체크
  if (schoolConfig.activeDays.length === 0) {
    messages.push({ severity: 'error', message: '운영 요일이 선택되지 않았습니다.' })
  }

  if (subjects.length === 0) {
    messages.push({ severity: 'warning', message: '등록된 과목이 없습니다.' })
  }

  if (teachers.length === 0) {
    messages.push({ severity: 'warning', message: '등록된 교사가 없습니다.' })
  }

  // 교사별 시수 정합성
  for (const teacher of teachers) {
    const result = validateHoursConsistency(teacher)
    if (!result.valid) {
      messages.push({
        severity: 'error',
        message: `${teacher.name}: 배정 시수(${result.assigned})가 기준 시수(${result.base})와 다릅니다.`,
      })
    }
  }

  // 반별 배정 시수 합 vs 가용 교시
  const overflows = validateClassCapacity(teachers, schoolConfig)
  for (const overflow of overflows) {
    messages.push({
      severity: 'error',
      message: `${overflow.grade}학년 ${overflow.classNumber}반: 배정 시수(${overflow.total})가 가용 교시(${overflow.capacity})를 초과합니다.`,
    })
  }

  // 반별 배정 시수 합 < 가용 교시 (경고)
  const slotsPerClass = calculateSlotsPerClass(schoolConfig)
  const classHoursMap = new Map<string, number>()
  for (const teacher of teachers) {
    for (const assignment of teacher.classAssignments) {
      const key = `${assignment.grade}-${assignment.classNumber}`
      classHoursMap.set(key, (classHoursMap.get(key) ?? 0) + assignment.hoursPerWeek)
    }
  }
  for (let grade = 1; grade <= schoolConfig.gradeCount; grade++) {
    const classCount = schoolConfig.classCountByGrade[grade] ?? 0
    for (let cls = 1; cls <= classCount; cls++) {
      const key = `${grade}-${cls}`
      const assigned = classHoursMap.get(key) ?? 0
      if (assigned > 0 && assigned < slotsPerClass) {
        messages.push({
          severity: 'warning',
          message: `${grade}학년 ${cls}반: 배정 시수(${assigned})가 가용 교시(${slotsPerClass})보다 적습니다.`,
        })
      }
    }
  }

  // 교사 미배정 과목 탐지
  const unassigned = findUnassignedSubjects(subjects, teachers)
  for (const subject of unassigned) {
    messages.push({
      severity: 'warning',
      message: `과목 "${subject.name}"에 배정된 교사가 없습니다.`,
    })
  }

  // 고정 이벤트 참조 정합성
  const teacherIds = new Set(teachers.map((t) => t.id))
  const subjectIds = new Set(subjects.map((s) => s.id))
  for (const event of fixedEvents) {
    if (event.teacherId && !teacherIds.has(event.teacherId)) {
      messages.push({
        severity: 'error',
        message: `고정 이벤트 "${event.description}": 존재하지 않는 교사를 참조합니다.`,
      })
    }
    if (event.subjectId && !subjectIds.has(event.subjectId)) {
      messages.push({
        severity: 'error',
        message: `고정 이벤트 "${event.description}": 존재하지 않는 과목을 참조합니다.`,
      })
    }
  }

  return messages
}
