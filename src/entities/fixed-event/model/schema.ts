import { z } from 'zod'
import { DAYS_OF_WEEK } from '@/shared/lib/constants'

const dayOfWeekSchema = z.enum(DAYS_OF_WEEK)

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
        return data.teacherId !== null && data.subjectId !== null
      }
      return true
    },
    { message: 'FIXED_CLASS requires teacherId and subjectId' },
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
