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
  homeroom: HomeroomAssignment | null
  classAssignments: Array<ClassHoursAssignment>
  createdAt: string
  updatedAt: string
}
