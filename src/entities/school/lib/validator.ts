import type { SchoolConfig } from '../model/types'
import type { DayOfWeek } from '@/shared/lib/types'

export function getDayPeriodCount(config: SchoolConfig, day: DayOfWeek): number {
  if (config.periodsByDay && typeof config.periodsByDay[day] === 'number') {
    return config.periodsByDay[day]
  }
  return config.periodsPerDay
}

export function getMaxPeriodsPerDay(config: SchoolConfig): number {
  return config.activeDays.reduce((max, day) => {
    return Math.max(max, getDayPeriodCount(config, day))
  }, 0)
}

export function calculateSlotsPerClass(config: SchoolConfig): number {
  return config.activeDays.reduce((sum, day) => {
    return sum + getDayPeriodCount(config, day)
  }, 0)
}

export function calculateTotalSlots(config: SchoolConfig): number {
  const totalClasses = Object.values(config.classCountByGrade).reduce(
    (sum, c) => sum + c,
    0,
  )
  return totalClasses * calculateSlotsPerClass(config)
}
