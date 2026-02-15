import { z } from 'zod'
import { DAYS_OF_WEEK, MAX_PERIODS_PER_DAY } from '@/shared/lib/constants'

const dayOfWeekSchema = z.enum(DAYS_OF_WEEK)

export const constraintPolicySchema = z.object({
  id: z.string().min(1),
  studentMaxConsecutiveSameSubject: z
    .number()
    .int()
    .min(1)
    .max(MAX_PERIODS_PER_DAY),
  teacherMaxConsecutiveHours: z.number().int().min(1).max(MAX_PERIODS_PER_DAY),
  teacherMaxDailyHours: z.number().int().min(1).max(MAX_PERIODS_PER_DAY),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const violationTypeSchema = z.enum([
  'TEACHER_CONFLICT',
  'STUDENT_CONSECUTIVE_EXCEEDED',
  'TEACHER_CONSECUTIVE_EXCEEDED',
  'TEACHER_DAILY_OVERLOAD',
  'HOURS_MISMATCH',
])

export const constraintViolationSchema = z.object({
  type: violationTypeSchema,
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  location: z.object({
    grade: z.number().optional(),
    classNumber: z.number().optional(),
    day: dayOfWeekSchema.optional(),
    period: z.number().optional(),
    teacherId: z.string().optional(),
    subjectId: z.string().optional(),
  }),
})
