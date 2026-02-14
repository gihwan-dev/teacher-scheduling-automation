import { z } from 'zod'

export const classHoursAssignmentSchema = z.object({
  grade: z.number().int().min(1).max(3),
  classNumber: z.number().int().min(1),
  hoursPerWeek: z.number().int().min(0),
})

export const teacherSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subjectIds: z.array(z.string().min(1)).min(1),
  baseHoursPerWeek: z.number().int().min(0),
  classAssignments: z.array(classHoursAssignmentSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})
