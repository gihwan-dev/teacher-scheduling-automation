import { z } from 'zod'
import { DAYS_OF_WEEK, MAX_PERIODS_PER_DAY } from '@/shared/lib/constants'
import { WEEK_TAG_REGEX } from '@/shared/lib/week-tag'

export const substituteAssignmentSourceSchema = z.enum([
  'REPLACEMENT',
  'MANUAL',
])

export const substituteAssignmentSchema = z.object({
  id: z.string().min(1),
  weekTag: z.string().regex(WEEK_TAG_REGEX),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.enum(DAYS_OF_WEEK),
  period: z.number().int().min(1).max(MAX_PERIODS_PER_DAY),
  grade: z.number().int().min(1),
  classNumber: z.number().int().min(1),
  subjectId: z.string().min(1),
  absentTeacherId: z.string().min(1),
  substituteTeacherId: z.string().min(1),
  source: substituteAssignmentSourceSchema,
  reason: z.string().min(1),
  createdAt: z.string().min(1),
})
