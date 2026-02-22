import { z } from 'zod'
import { MAX_PERIODS_PER_DAY } from '@/shared/lib/constants'

export const academicCalendarEventTypeSchema = z.enum([
  'SEMESTER_START',
  'SEMESTER_END',
  'HOLIDAY',
  'CLOSURE_DAY',
  'EXAM_PERIOD',
  'GRADE_EVENT',
  'SCHOOL_EVENT',
  'SHORTENED_DAY',
])

export const academicCalendarScopeTypeSchema = z.enum([
  'SCHOOL',
  'GRADE',
  'CLASS',
])

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const academicCalendarEventSchema = z
  .object({
    id: z.string().min(1),
    eventType: academicCalendarEventTypeSchema,
    startDate: dateSchema,
    endDate: dateSchema,
    scopeType: academicCalendarScopeTypeSchema,
    scopeValue: z.string().min(1).nullable(),
    periodOverride: z.number().int().min(1).max(MAX_PERIODS_PER_DAY).nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((event, ctx) => {
    if (event.endDate < event.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: '종료일은 시작일보다 빠를 수 없습니다.',
      })
    }

    if (event.scopeType === 'SCHOOL' && event.scopeValue !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scopeValue'],
        message: 'SCHOOL 범위에서는 scopeValue가 null이어야 합니다.',
      })
    }

    if (event.scopeType !== 'SCHOOL' && event.scopeValue === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scopeValue'],
        message: 'SCHOOL 외 범위에서는 scopeValue가 필요합니다.',
      })
    }

    if (event.eventType !== 'SHORTENED_DAY' && event.periodOverride !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodOverride'],
        message: 'periodOverride는 SHORTENED_DAY에서만 설정할 수 있습니다.',
      })
    }

    if (event.eventType === 'SHORTENED_DAY' && event.periodOverride === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodOverride'],
        message: 'SHORTENED_DAY에는 periodOverride가 필요합니다.',
      })
    }
  })
