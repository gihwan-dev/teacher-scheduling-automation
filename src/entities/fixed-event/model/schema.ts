import { z } from 'zod'
import { DAYS_OF_WEEK } from '@/shared/lib/constants'

const dayOfWeekSchema = z.enum(DAYS_OF_WEEK)
const subjectTypeSchema = z.enum(['CLASS', 'GRADE', 'SCHOOL'])

const fixedEventTypeSchema = z.enum([
  'FIXED_CLASS',
  'BUSINESS_TRIP',
  'SCHOOL_EVENT',
])

export const fixedEventSchema = z
  .object({
    id: z.string().min(1),
    type: fixedEventTypeSchema,
    description: z.string(),
    teacherId: z.string().nullable(),
    subjectId: z.string().nullable(),
    subjectType: subjectTypeSchema.nullable(),
    grade: z.number().int().min(1).max(3).nullable(),
    classNumber: z.number().int().min(1).nullable(),
    day: dayOfWeekSchema,
    period: z.number().int().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .refine(
    (data) => {
      if (data.type === 'FIXED_CLASS') {
        return (
          data.teacherId !== null &&
          data.subjectId !== null &&
          data.subjectType !== null
        )
      }
      return true
    },
    { message: 'FIXED_CLASS requires teacherId, subjectId and subjectType' },
  )
  .refine(
    (data) => {
      if (data.type !== 'FIXED_CLASS' || data.subjectType === null) return true
      if (data.subjectType === 'CLASS') {
        return data.grade !== null && data.classNumber !== null
      }
      if (data.subjectType === 'GRADE') {
        return data.grade !== null && data.classNumber === null
      }
      return data.grade === null && data.classNumber === null
    },
    {
      message:
        'FIXED_CLASS target mismatch: CLASS(grade+class), GRADE(grade), SCHOOL(none)',
    },
  )
  .refine(
    (data) => {
      if (data.type === 'BUSINESS_TRIP') {
        return data.teacherId !== null
      }
      return true
    },
    { message: 'BUSINESS_TRIP requires teacherId' },
  )

export { fixedEventTypeSchema }
