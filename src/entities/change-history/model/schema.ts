import { z } from 'zod'
import { timetableCellSchema } from '@/entities/timetable'
import { WEEK_TAG_REGEX } from '@/shared/lib/week-tag'

export const weekTagSchema = z.string().regex(WEEK_TAG_REGEX)

export const changeActionTypeSchema = z.enum([
  'EDIT',
  'CLEAR',
  'LOCK',
  'UNLOCK',
  'MOVE',
  'CONFIRM',
  'RECOMPUTE',
  'VERSION_CLONE',
  'VERSION_RESTORE',
])

export const changeEventSchema = z.object({
  id: z.string().min(1),
  snapshotId: z.string().min(1),
  weekTag: weekTagSchema,
  actionType: changeActionTypeSchema,
  actor: z.string().min(1),
  cellKey: z.string().min(1),
  before: timetableCellSchema.nullable(),
  after: timetableCellSchema.nullable(),
  beforePayload: z.unknown().nullable(),
  afterPayload: z.unknown().nullable(),
  impactSummary: z.string().nullable(),
  conflictDetected: z.boolean(),
  rollbackRef: z.string().nullable(),
  timestamp: z.number().int().min(0),
  isUndone: z.boolean(),
})
