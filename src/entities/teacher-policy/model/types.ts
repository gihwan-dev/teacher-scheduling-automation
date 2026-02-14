import type { DayOfWeek } from '@/shared/lib/types'

export interface AvoidanceSlot {
  day: DayOfWeek
  period: number
}

export type TimePreference = 'MORNING' | 'AFTERNOON' | 'NONE'

export interface TeacherPolicy {
  id: string
  teacherId: string
  avoidanceSlots: Array<AvoidanceSlot>
  timePreference: TimePreference
  maxConsecutiveHoursOverride: number | null
  maxDailyHoursOverride: number | null
  createdAt: string
  updatedAt: string
}
