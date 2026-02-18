import { z } from 'zod'
import {
  DAYS_OF_WEEK,
  MAX_CLASS_COUNT,
  MAX_GRADE_COUNT,
  MAX_PERIODS_PER_DAY,
  MIN_CLASS_COUNT,
  MIN_GRADE_COUNT,
  MIN_PERIODS_PER_DAY,
} from '@/shared/lib/constants'

const dayOfWeekSchema = z.enum(DAYS_OF_WEEK)
const periodsByDaySchema = z.object({
  MON: z.number().int().min(MIN_PERIODS_PER_DAY).max(MAX_PERIODS_PER_DAY),
  TUE: z.number().int().min(MIN_PERIODS_PER_DAY).max(MAX_PERIODS_PER_DAY),
  WED: z.number().int().min(MIN_PERIODS_PER_DAY).max(MAX_PERIODS_PER_DAY),
  THU: z.number().int().min(MIN_PERIODS_PER_DAY).max(MAX_PERIODS_PER_DAY),
  FRI: z.number().int().min(MIN_PERIODS_PER_DAY).max(MAX_PERIODS_PER_DAY),
  SAT: z.number().int().min(MIN_PERIODS_PER_DAY).max(MAX_PERIODS_PER_DAY),
})

export const schoolConfigSchema = z.object({
  id: z.string().min(1),
  gradeCount: z.number().int().min(MIN_GRADE_COUNT).max(MAX_GRADE_COUNT),
  classCountByGrade: z.record(
    z.coerce.number(),
    z.number().int().min(MIN_CLASS_COUNT).max(MAX_CLASS_COUNT),
  ),
  activeDays: z.array(dayOfWeekSchema).min(1),
  periodsByDay: periodsByDaySchema,
  periodsPerDay: z
    .number()
    .int()
    .min(MIN_PERIODS_PER_DAY)
    .max(MAX_PERIODS_PER_DAY)
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
