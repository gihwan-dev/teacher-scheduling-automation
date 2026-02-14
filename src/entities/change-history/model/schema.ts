import { z } from 'zod'
import { timetableCellSchema } from '@/entities/timetable'

export const weekTagSchema = z.string().regex(/^\d{4}-W\d{2}$/)

export const changeActionTypeSchema = z.enum([
  'EDIT',
  'CLEAR',
  'LOCK',
  'UNLOCK',
  'MOVE',
  'CONFIRM',
  'RECOMPUTE',
])

export const changeEventSchema = z.object({
  id: z.string().min(1),
  snapshotId: z.string().min(1),
  weekTag: weekTagSchema,
  actionType: changeActionTypeSchema,
  cellKey: z.string().min(1),
  before: timetableCellSchema.nullable(),
  after: timetableCellSchema.nullable(),
  timestamp: z.number().int().min(0),
  isUndone: z.boolean(),
})
