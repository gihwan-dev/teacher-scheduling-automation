import { z } from 'zod'

export const teachingAssignmentSchema = z
  .object({
    id: z.string().min(1),
    subjectId: z.string().min(1),
    subjectType: z.enum(['CLASS', 'GRADE', 'SCHOOL']),
    grade: z.number().int().min(1).max(3).nullable(),
    classNumber: z.number().int().min(1).nullable(),
    hoursPerWeek: z.number().int().min(0),
  })
  .superRefine((assignment, ctx) => {
    if (assignment.subjectType === 'CLASS') {
      if (assignment.grade === null || assignment.classNumber === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CLASS assignment requires grade and classNumber',
        })
      }
      return
    }

    if (assignment.subjectType === 'GRADE') {
      if (assignment.grade === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'GRADE assignment requires grade',
        })
      }
      if (assignment.classNumber !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'GRADE assignment cannot set classNumber',
        })
      }
      return
    }

    if (assignment.grade !== null || assignment.classNumber !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SCHOOL assignment cannot set grade/classNumber',
      })
    }
  })

export const classHoursAssignmentSchema = z.object({
  grade: z.number().int().min(1).max(3),
  classNumber: z.number().int().min(1),
  hoursPerWeek: z.number().int().min(0),
})

export const homeroomAssignmentSchema = z.object({
  grade: z.number().int().min(1).max(3),
  classNumber: z.number().int().min(1),
})

export const legacyClassHoursAssignmentSchema = classHoursAssignmentSchema

export const teacherSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subjectIds: z.array(z.string().min(1)).min(1),
  baseHoursPerWeek: z.number().int().min(0),
  assignments: z.array(teachingAssignmentSchema).optional(),
  homeroom: homeroomAssignmentSchema.nullable().optional(),
  classAssignments: z.array(classHoursAssignmentSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
