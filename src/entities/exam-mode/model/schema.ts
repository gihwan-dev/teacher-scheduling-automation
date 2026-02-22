import { z } from 'zod'
import { WEEK_TAG_REGEX } from '@/shared/lib/week-tag'
import { DAYS_OF_WEEK, MAX_PERIODS_PER_DAY } from '@/shared/lib/constants'

export const examModeWeekStateSchema = z.object({
  weekTag: z.string().regex(WEEK_TAG_REGEX),
  isEnabled: z.boolean(),
  enabledAt: z.string().nullable(),
  enabledBy: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const examSlotSchema = z.object({
  id: z.string().min(1),
  weekTag: z.string().regex(WEEK_TAG_REGEX),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.enum(DAYS_OF_WEEK),
  period: z.number().int().min(1).max(MAX_PERIODS_PER_DAY),
  grade: z.number().int().min(1),
  classNumber: z.number().int().min(1),
  subjectId: z.string().nullable(),
  subjectName: z.string().min(1),
  durationMinutes: z.number().int().min(30).max(300),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const invigilationAssignmentStatusSchema = z.enum([
  'ASSIGNED',
  'UNRESOLVED',
])

export const invigilationAssignmentSchema = z.object({
  id: z.string().min(1),
  weekTag: z.string().regex(WEEK_TAG_REGEX),
  slotId: z.string().min(1),
  teacherId: z.string().nullable(),
  status: invigilationAssignmentStatusSchema,
  isManual: z.boolean(),
  reason: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

export const invigilationConflictTypeSchema = z.enum([
  'TEACHER_DOUBLE_BOOKED',
  'TEACHER_UNAVAILABLE',
])

export const invigilationConflictSchema = z.object({
  type: invigilationConflictTypeSchema,
  teacherId: z.string().min(1),
  slotIds: z.array(z.string().min(1)).min(1),
  message: z.string().min(1),
})

export const invigilationStatsSchema = z.object({
  weekTag: z.string().regex(WEEK_TAG_REGEX),
  totalSlots: z.number().int().min(0),
  assignedSlots: z.number().int().min(0),
  unassignedSlots: z.number().int().min(0),
  teacherLoad: z.array(
    z.object({
      teacherId: z.string().min(1),
      count: z.number().int().min(0),
    }),
  ),
  updatedAt: z.string().min(1),
})
