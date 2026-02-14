export interface ClassHoursAssignment {
  grade: number
  classNumber: number
  hoursPerWeek: number
}

export interface Teacher {
  id: string
  name: string
  subjectIds: Array<string>
  baseHoursPerWeek: number
  classAssignments: Array<ClassHoursAssignment>
  createdAt: string
  updatedAt: string
}
