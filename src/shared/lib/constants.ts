import type { DayOfWeek } from './types'

export const DAYS_OF_WEEK: Array<DayOfWeek> = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
]

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
}

export const MIN_GRADE_COUNT = 1
export const MAX_GRADE_COUNT = 3
export const MIN_PERIODS_PER_DAY = 1
export const MAX_PERIODS_PER_DAY = 10
export const MIN_CLASS_COUNT = 1
export const MAX_CLASS_COUNT = 20
