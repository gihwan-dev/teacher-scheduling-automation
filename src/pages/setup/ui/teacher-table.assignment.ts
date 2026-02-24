import type {
  ClassHoursAssignment,
  Teacher,
  TeachingAssignment,
} from '@/entities/teacher'

function isClassAssignment(
  assignment: TeachingAssignment,
): assignment is TeachingAssignment & {
  subjectType: 'CLASS'
  grade: number
  classNumber: number
} {
  return (
    assignment.subjectType === 'CLASS' &&
    assignment.grade !== null &&
    assignment.classNumber !== null
  )
}

function unique(values: Array<string>): Array<string> {
  return [...new Set(values)]
}

export function deriveClassAssignmentsFromAssignments(
  assignments: Array<TeachingAssignment>,
): Array<ClassHoursAssignment> {
  const grouped = new Map<string, number>()

  for (const assignment of assignments) {
    if (!isClassAssignment(assignment)) {
      continue
    }

    if (assignment.hoursPerWeek <= 0) {
      continue
    }

    const key = `${assignment.grade}-${assignment.classNumber}`
    grouped.set(key, (grouped.get(key) ?? 0) + assignment.hoursPerWeek)
  }

  return [...grouped.entries()]
    .map(([key, hoursPerWeek]) => {
      const [grade, classNumber] = key.split('-').map(Number)
      return {
        grade,
        classNumber,
        hoursPerWeek,
      }
    })
    .sort((a, b) => {
      if (a.grade !== b.grade) {
        return a.grade - b.grade
      }
      return a.classNumber - b.classNumber
    })
}

export function syncTeacherPatchFromAssignments(
  teacher: Pick<Teacher, 'subjectIds'>,
  assignments: Array<TeachingAssignment>,
): Pick<Teacher, 'assignments' | 'classAssignments' | 'subjectIds'> {
  const assignmentSubjectIds = assignments
    .map((assignment) => assignment.subjectId)
    .filter((subjectId) => subjectId.length > 0)

  return {
    assignments,
    classAssignments: deriveClassAssignmentsFromAssignments(assignments),
    subjectIds: unique([...teacher.subjectIds, ...assignmentSubjectIds]),
  }
}

export function removeSubjectAndAssignments(
  teacher: Pick<Teacher, 'subjectIds'>,
  assignments: Array<TeachingAssignment>,
  subjectId: string,
): Pick<Teacher, 'assignments' | 'classAssignments' | 'subjectIds'> {
  const nextAssignments = assignments.filter(
    (assignment) => assignment.subjectId !== subjectId,
  )

  const nextSubjectIds = teacher.subjectIds.filter((id) => id !== subjectId)

  return syncTeacherPatchFromAssignments(
    { subjectIds: nextSubjectIds },
    nextAssignments,
  )
}
