import type { DayOfWeek } from '@/shared/lib/types'
import type { CellStatus } from '@/entities/timetable'
import type { SubjectTrack } from '@/entities/subject'
import type { TimePreference } from '@/entities/teacher-policy'

export const SHARE_SCHEMA_VERSION = 1

export const URL_LENGTH_WARNING = 6000
export const URL_LENGTH_MAX = 8000

export const DAY_TO_INDEX: Record<DayOfWeek, number> = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4,
  SAT: 5,
}

export const INDEX_TO_DAY: Record<number, DayOfWeek> = {
  0: 'MON',
  1: 'TUE',
  2: 'WED',
  3: 'THU',
  4: 'FRI',
  5: 'SAT',
}

export const CELL_STATUS_TO_INDEX: Record<CellStatus, number> = {
  BASE: 0,
  TEMP_MODIFIED: 1,
  CONFIRMED_MODIFIED: 2,
  LOCKED: 3,
}

export const INDEX_TO_CELL_STATUS: Record<number, CellStatus> = {
  0: 'BASE',
  1: 'TEMP_MODIFIED',
  2: 'CONFIRMED_MODIFIED',
  3: 'LOCKED',
}

export const TRACK_TO_INDEX: Record<SubjectTrack, number> = {
  COMMON: 0,
  NATURAL_SCIENCE: 1,
  SOCIAL_SCIENCE: 2,
  ARTS: 3,
  PHYSICAL: 4,
  OTHER: 5,
}

export const INDEX_TO_TRACK: Record<number, SubjectTrack> = {
  0: 'COMMON',
  1: 'NATURAL_SCIENCE',
  2: 'SOCIAL_SCIENCE',
  3: 'ARTS',
  4: 'PHYSICAL',
  5: 'OTHER',
}

export const TIME_PREF_TO_INDEX: Record<TimePreference, number> = {
  MORNING: 0,
  AFTERNOON: 1,
  NONE: 2,
}

export const INDEX_TO_TIME_PREF: Record<number, TimePreference> = {
  0: 'MORNING',
  1: 'AFTERNOON',
  2: 'NONE',
}
