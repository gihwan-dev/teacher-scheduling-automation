import { describe, expect, it } from 'vitest'
import {
  deriveClassAssignmentsFromAssignments,
  removeSubjectAndAssignments,
  syncTeacherPatchFromAssignments,
} from '../teacher-table.assignment'
import type { Teacher, TeachingAssignment } from '@/entities/teacher'

function makeTeacherSubjectState(
  subjectIds: Array<string>,
): Pick<Teacher, 'subjectIds'> {
  return { subjectIds }
}

function makeClassAssignment(
  id: string,
  subjectId: string,
  grade: number,
  classNumber: number,
  hoursPerWeek: number,
): TeachingAssignment {
  return {
    id,
    subjectId,
    subjectType: 'CLASS',
    grade,
    classNumber,
    hoursPerWeek,
  }
}

describe('deriveClassAssignmentsFromAssignments', () => {
  it('CLASS 배정만 grade-class 기준으로 합산한다', () => {
    const assignments: Array<TeachingAssignment> = [
      makeClassAssignment('a-1', 'sub-math', 1, 1, 2),
      makeClassAssignment('a-2', 'sub-eng', 1, 1, 1),
      makeClassAssignment('a-3', 'sub-eng', 1, 2, 3),
      {
        id: 'a-4',
        subjectId: 'sub-sci',
        subjectType: 'GRADE',
        grade: 1,
        classNumber: null,
        hoursPerWeek: 5,
      },
      makeClassAssignment('a-5', 'sub-math', 2, 1, 0),
    ]

    expect(deriveClassAssignmentsFromAssignments(assignments)).toEqual([
      { grade: 1, classNumber: 1, hoursPerWeek: 3 },
      { grade: 1, classNumber: 2, hoursPerWeek: 3 },
    ])
  })
})

describe('syncTeacherPatchFromAssignments', () => {
  it('배정 행 과목을 subjectIds에 자동 포함한다', () => {
    const teacher = makeTeacherSubjectState(['sub-math'])
    const assignments = [
      makeClassAssignment('a-1', 'sub-eng', 1, 1, 2),
      makeClassAssignment('a-2', 'sub-math', 1, 2, 2),
    ]

    const patch = syncTeacherPatchFromAssignments(teacher, assignments)

    expect(patch.subjectIds).toEqual(['sub-math', 'sub-eng'])
    expect(patch.classAssignments).toEqual([
      { grade: 1, classNumber: 1, hoursPerWeek: 2 },
      { grade: 1, classNumber: 2, hoursPerWeek: 2 },
    ])
  })
})

describe('removeSubjectAndAssignments', () => {
  it('칩에서 과목 해제 시 subjectIds와 배정행을 함께 제거한다', () => {
    const teacher = makeTeacherSubjectState(['sub-math', 'sub-eng'])
    const assignments = [
      makeClassAssignment('a-1', 'sub-math', 1, 1, 2),
      makeClassAssignment('a-2', 'sub-math', 1, 2, 1),
      makeClassAssignment('a-3', 'sub-eng', 1, 1, 3),
    ]

    const patch = removeSubjectAndAssignments(teacher, assignments, 'sub-math')

    expect(patch.subjectIds).toEqual(['sub-eng'])
    expect(patch.assignments).toEqual([
      {
        id: 'a-3',
        subjectId: 'sub-eng',
        subjectType: 'CLASS',
        grade: 1,
        classNumber: 1,
        hoursPerWeek: 3,
      },
    ])
    expect(patch.classAssignments).toEqual([
      { grade: 1, classNumber: 1, hoursPerWeek: 3 },
    ])
  })
})
