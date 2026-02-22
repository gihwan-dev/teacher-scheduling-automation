export type AcademicCalendarEventType =
  | 'SEMESTER_START'
  | 'SEMESTER_END'
  | 'HOLIDAY'
  | 'CLOSURE_DAY'
  | 'EXAM_PERIOD'
  | 'GRADE_EVENT'
  | 'SCHOOL_EVENT'
  | 'SHORTENED_DAY'

export type AcademicCalendarScopeType = 'SCHOOL' | 'GRADE' | 'CLASS'

export interface AcademicCalendarEvent {
  id: string
  eventType: AcademicCalendarEventType
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  scopeType: AcademicCalendarScopeType
  scopeValue: string | null
  periodOverride: number | null
  createdAt: string
  updatedAt: string
}
