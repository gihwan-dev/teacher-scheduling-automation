import type { SchoolConfig } from '../model/types'

export function calculateTotalSlots(config: SchoolConfig): number {
  const totalClasses = Object.values(config.classCountByGrade).reduce((sum, c) => sum + c, 0)
  return totalClasses * config.activeDays.length * config.periodsPerDay
}

export function calculateSlotsPerClass(config: SchoolConfig): number {
  return config.activeDays.length * config.periodsPerDay
}
