import { z } from 'zod'
import { WEEK_TAG_REGEX } from '@/shared/lib/week-tag'

export const impactRiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])

export const impactAnalysisReportSchema = z.object({
  id: z.string().min(1),
  snapshotId: z.string().min(1),
  weekTag: z.string().regex(WEEK_TAG_REGEX),
  affectedTeachers: z.array(
    z.object({
      teacherName: z.string().min(1),
      summary: z.string().min(1),
    }),
  ),
  affectedClasses: z.array(
    z.object({
      grade: z.number().int().min(1),
      classNumber: z.number().int().min(1),
      summary: z.string().min(1),
    }),
  ),
  hourDelta: z.array(
    z.object({
      target: z.string().min(1),
      delta: z.number(),
    }),
  ),
  riskLevel: impactRiskLevelSchema,
  alternatives: z.array(z.string().min(1)),
  createdAt: z.string().min(1),
})
