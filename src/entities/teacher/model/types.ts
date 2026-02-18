import type { SubjectType } from '@/shared/lib/types'

export interface TeachingAssignment {
  id: string
  subjectId: string
  subjectType: SubjectType
  grade: number | null
  classNumber: number | null
  hoursPerWeek: number
}

export interface Teacher {
  id: string
  name: string
  subjectIds?: Array<string> // legacy compatibility
  baseHoursPerWeek: number
  assignments?: Array<TeachingAssignment>
  classAssignments?: Array<{
    grade: number
    classNumber: number
    hoursPerWeek: number
  }> // legacy compatibility
  createdAt: string
  updatedAt: string
}
