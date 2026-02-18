export type { SchoolConfig } from './model/types'
export { schoolConfigSchema } from './model/schema'
export {
  calculateTotalSlots,
  calculateSlotsPerClass,
  getDayPeriodCount,
  getMaxPeriodsPerDay,
} from './lib/validator'
