export type SubjectTrack =
  | 'COMMON'
  | 'NATURAL_SCIENCE'
  | 'SOCIAL_SCIENCE'
  | 'ARTS'
  | 'PHYSICAL'
  | 'OTHER'

export interface Subject {
  id: string
  name: string
  abbreviation: string
  track: SubjectTrack
  createdAt: string
  updatedAt: string
}
