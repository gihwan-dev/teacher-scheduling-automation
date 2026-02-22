import type { SubjectType } from '@/shared/lib/types'

export interface TeachingAssignment {
  id: string
  subjectId: string
  subjectType: SubjectType
  grade: number | null
  classNumber: number | null
  hoursPerWeek: number
}

export interface ClassHoursAssignment {
  grade: number
  classNumber: number
  hoursPerWeek: number
}

export interface HomeroomAssignment {
  grade: number
  classNumber: number
}

export interface Teacher {
  id: string
  name: string
  subjectIds: Array<string>
  baseHoursPerWeek: number
  assignments?: Array<TeachingAssignment>
  homeroom: HomeroomAssignment | null
  classAssignments: Array<ClassHoursAssignment>
  createdAt: string
  updatedAt: string
}
