import type { Teacher } from '../model/types'
import type { Subject } from '@/entities/subject'
import type { SchoolConfig } from '@/entities/school'
import { calculateSlotsPerClass } from '@/entities/school'

export function getTeacherAssignments(teacher: Teacher): Array<{
  id: string
  subjectId: string
  subjectType: 'CLASS' | 'GRADE' | 'SCHOOL'
  grade: number | null
  classNumber: number | null
  hoursPerWeek: number
}> {
  // assignments가 정의되어 있으면(빈 배열 포함) 신규 구조를 우선 사용한다.
  // 빈 배열은 "수동 재입력 필요" 상태를 의미하므로 레거시로 되돌리지 않는다.
  if (teacher.assignments) {
    return teacher.assignments
  }

  const legacySubjectId = teacher.subjectIds?.[0]
  if (!legacySubjectId || !teacher.classAssignments) return []

  return teacher.classAssignments.map((assignment, index) => ({
    id: `legacy-${teacher.id}-${index}`,
    subjectId: legacySubjectId,
    subjectType: 'CLASS',
    grade: assignment.grade,
    classNumber: assignment.classNumber,
    hoursPerWeek: assignment.hoursPerWeek,
  }))
}

export function validateHoursConsistency(teacher: Teacher): {
  valid: boolean
  assigned: number
  base: number
} {
  const assigned = getTeacherAssignments(teacher).reduce(
    (sum, a) => sum + a.hoursPerWeek,
    0,
  )
  return {
    valid: assigned === teacher.baseHoursPerWeek,
    assigned,
    base: teacher.baseHoursPerWeek,
  }
}

export function validateClassCapacity(
  teachers: Array<Teacher>,
  schoolConfig: SchoolConfig,
): Array<{
  grade: number
  classNumber: number
  total: number
  capacity: number
}> {
  const capacity = calculateSlotsPerClass(schoolConfig)
  const classHoursMap = new Map<string, number>()
  const allClassKeys: Array<string> = []
  for (let grade = 1; grade <= schoolConfig.gradeCount; grade++) {
    const classCount = schoolConfig.classCountByGrade[grade] ?? 0
    for (let cls = 1; cls <= classCount; cls++) {
      allClassKeys.push(`${grade}-${cls}`)
    }
  }

  for (const teacher of teachers) {
    for (const assignment of getTeacherAssignments(teacher)) {
      if (assignment.subjectType === 'CLASS') {
        if (assignment.grade === null || assignment.classNumber === null) {
          continue
        }
        const key = `${assignment.grade}-${assignment.classNumber}`
        classHoursMap.set(
          key,
          (classHoursMap.get(key) ?? 0) + assignment.hoursPerWeek,
        )
        continue
      }

      if (assignment.subjectType === 'GRADE') {
        if (assignment.grade === null) continue
        const classCount = schoolConfig.classCountByGrade[assignment.grade] ?? 0
        for (let cls = 1; cls <= classCount; cls++) {
          const key = `${assignment.grade}-${cls}`
          classHoursMap.set(
            key,
            (classHoursMap.get(key) ?? 0) + assignment.hoursPerWeek,
          )
        }
        continue
      }

      for (const key of allClassKeys) {
        classHoursMap.set(key, (classHoursMap.get(key) ?? 0) + assignment.hoursPerWeek)
      }
    }
  }

  const overflows: Array<{
    grade: number
    classNumber: number
    total: number
    capacity: number
  }> = []
  for (const [key, total] of classHoursMap) {
    if (total > capacity) {
      const [grade, classNumber] = key.split('-').map(Number)
      overflows.push({ grade, classNumber, total, capacity })
    }
  }

  return overflows
}

export function findUnassignedSubjects(
  subjects: Array<Subject>,
  teachers: Array<Teacher>,
): Array<Subject> {
  const assignedSubjectIds = new Set<string>()
  for (const teacher of teachers) {
    const assignments = getTeacherAssignments(teacher)
    for (const assignment of assignments) {
      assignedSubjectIds.add(assignment.subjectId)
    }

    if (assignments.length === 0 && teacher.subjectIds) {
      for (const subjectId of teacher.subjectIds) {
        assignedSubjectIds.add(subjectId)
      }
    }
  }
  return subjects.filter((s) => !assignedSubjectIds.has(s.id))
}
