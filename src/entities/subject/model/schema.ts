import { z } from 'zod'

export const subjectTrackSchema = z.enum([
  'COMMON',
  'NATURAL_SCIENCE',
  'SOCIAL_SCIENCE',
  'ARTS',
  'PHYSICAL',
  'OTHER',
])

export const subjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  track: subjectTrackSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
