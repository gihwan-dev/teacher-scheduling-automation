import { z } from 'zod'
import { DAYS_OF_WEEK } from '@/shared/lib/constants'
import { WEEK_TAG_REGEX } from '@/shared/lib/week-tag'

const weekTagSchema = z.string().regex(WEEK_TAG_REGEX)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const scheduleTransactionStatusSchema = z.enum([
  'DRAFT',
  'COMMITTED',
  'ROLLED_BACK',
])

export const validationViolationSchema = z.object({
  ruleId: z.string().min(1),
  severity: z.enum(['error', 'warning']),
  humanMessage: z.string().min(1),
  location: z.object({
    weekTag: weekTagSchema.optional(),
    date: dateSchema.optional(),
    grade: z.number().int().min(1).optional(),
    classNumber: z.number().int().min(1).optional(),
    teacherName: z.string().min(1).optional(),
    day: z.enum(DAYS_OF_WEEK).optional(),
    period: z.number().int().min(1).optional(),
  }),
  relatedEntities: z.array(
    z.object({
      type: z.enum(['TEACHER', 'CLASS', 'ROOM', 'CALENDAR_EVENT', 'LESSON']),
      label: z.string().min(1),
    }),
  ),
})

export const scheduleTransactionSchema = z.object({
  draftId: z.string().min(1),
  targetWeeks: z.array(weekTagSchema).min(1),
  validationResult: z.object({
    passed: z.boolean(),
    violations: z.array(validationViolationSchema),
  }),
  impactReportId: z.string().min(1),
  status: scheduleTransactionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
