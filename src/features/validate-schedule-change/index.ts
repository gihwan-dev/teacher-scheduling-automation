export { validateScheduleChange } from './lib/validate-schedule-change'
export {
  buildAcademicCalendarBlockedSlots,
  createClassSlotKey,
  isDateInRange,
  isEventScopeMatch,
  isFullDayBlockedEvent,
} from './lib/academic-calendar-blocked-slots'
export type {
  BuildAcademicCalendarBlockedSlotsInput,
  ValidateScheduleChangeInput,
  ValidateScheduleChangeOutput,
} from './model/types'
