import { z } from 'zod'
import { DAYS_OF_WEEK, MAX_PERIODS_PER_DAY } from '@/shared/lib/constants'
import { WEEK_TAG_REGEX } from '@/shared/lib/week-tag'

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
  grade: z.number().int().min(1).max(3),
  classNumber: z.number().int().min(1),
  day: dayOfWeekSchema,
  period: z.number().int().min(1).max(MAX_PERIODS_PER_DAY),
  isFixed: z.boolean(),
  status: cellStatusSchema.default('BASE'),
})

export const appliedScopeTypeSchema = z.enum([
  'THIS_WEEK',
  'FROM_NEXT_WEEK',
  'RANGE',
])

export const appliedScopeSchema = z
  .object({
    type: appliedScopeTypeSchema,
    fromWeek: z.string().regex(WEEK_TAG_REGEX),
    toWeek: z.string().regex(WEEK_TAG_REGEX).nullable(),
  })
  .superRefine((scope, ctx) => {
    if (scope.type === 'RANGE' && scope.toWeek === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toWeek'],
        message: 'RANGE 범위에서는 toWeek가 필요합니다.',
      })
    }

    if (scope.type !== 'RANGE' && scope.toWeek !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toWeek'],
        message: 'RANGE 외 범위에서는 toWeek가 null이어야 합니다.',
      })
    }
  })

export const timetableSnapshotSchema = z.object({
  id: z.string().min(1),
  schoolConfigId: z.string().min(1),
  weekTag: z.string().regex(WEEK_TAG_REGEX),
  versionNo: z.number().int().min(1),
  baseVersionId: z.string().min(1).nullable(),
  appliedScope: appliedScopeSchema,
  cells: z.array(timetableCellSchema),
  score: z.number().min(0),
  generationTimeMs: z.number().int().min(0),
  createdAt: z.string(),
})
