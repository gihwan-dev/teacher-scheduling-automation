import { z } from 'zod'
import { DAYS_OF_WEEK, MAX_PERIODS_PER_DAY } from '@/shared/lib/constants'

const dayOfWeekSchema = z.enum(DAYS_OF_WEEK)

export const cellStatusSchema = z.enum([
  'BASE',
  'TEMP_MODIFIED',
  'CONFIRMED_MODIFIED',
  'LOCKED',
])

export const timetableCellSchema = z.object({
  teacherId: z.string().min(1),
  subjectId: z.string().min(1),
  subjectType: z.enum(['CLASS', 'GRADE', 'SCHOOL']).default('CLASS'),
  grade: z.number().int().min(1).max(3),
  classNumber: z.number().int().min(1),
  day: dayOfWeekSchema,
  period: z.number().int().min(1).max(MAX_PERIODS_PER_DAY),
  isFixed: z.boolean(),
  status: cellStatusSchema.default('BASE'),
})

export const timetableSnapshotSchema = z.object({
  id: z.string().min(1),
  schoolConfigId: z.string().min(1),
  cells: z.array(timetableCellSchema),
  score: z.number().min(0),
  generationTimeMs: z.number().int().min(0),
  createdAt: z.string(),
})
