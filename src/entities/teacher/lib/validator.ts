import type { Teacher } from '../model/types'
import type { Subject } from '@/entities/subject'
import type { SchoolConfig } from '@/entities/school'

export function validateHoursConsistency(teacher: Teacher): {
  valid: boolean
  assigned: number
  base: number
} {
  const assigned = teacher.classAssignments.reduce(
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
  const capacity = schoolConfig.activeDays.length * schoolConfig.periodsPerDay
  const classHoursMap = new Map<string, number>()

  for (const teacher of teachers) {
    for (const assignment of teacher.classAssignments) {
      const key = `${assignment.grade}-${assignment.classNumber}`
      classHoursMap.set(
        key,
        (classHoursMap.get(key) ?? 0) + assignment.hoursPerWeek,
      )
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
  const assignedSubjectIds = new Set(teachers.flatMap((t) => t.subjectIds))
  return subjects.filter((s) => !assignedSubjectIds.has(s.id))
}
