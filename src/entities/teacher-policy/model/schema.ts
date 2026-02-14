import { z } from 'zod'
import { DAYS_OF_WEEK, MAX_PERIODS_PER_DAY } from '@/shared/lib/constants'

const dayOfWeekSchema = z.enum(DAYS_OF_WEEK)

export const avoidanceSlotSchema = z.object({
  day: dayOfWeekSchema,
  period: z.number().int().min(1).max(MAX_PERIODS_PER_DAY),
})

export const timePreferenceSchema = z.enum(['MORNING', 'AFTERNOON', 'NONE'])

export const teacherPolicySchema = z.object({
  id: z.string().min(1),
  teacherId: z.string().min(1),
  avoidanceSlots: z.array(avoidanceSlotSchema),
  timePreference: timePreferenceSchema,
  maxConsecutiveHoursOverride: z.number().int().min(1).max(MAX_PERIODS_PER_DAY).nullable(),
  maxDailyHoursOverride: z.number().int().min(1).max(MAX_PERIODS_PER_DAY).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
