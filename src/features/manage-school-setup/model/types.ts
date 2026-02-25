import type { DayOfWeek } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'

export type ImportSource = 'TEACHER_HOURS_XLS' | 'FINAL_TIMETABLE_XLSX'
export type ImportStatus = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED'
export type ImportIssueSeverity = 'error' | 'warning'
export type ImportIssueCode =
  | 'SHEET_NOT_FOUND'
  | 'HEADER_MISMATCH'
  | 'INVALID_STRUCTURE'
  | 'INVALID_ROW'
  | 'DUPLICATE_NORMALIZED_NAME'
  | 'MATCH_NOT_FOUND'
  | 'MATCH_CONFLICT'
  | 'UNKNOWN'

export interface ImportIssue {
  code: ImportIssueCode
  severity: ImportIssueSeverity
  blocking: boolean
  message: string
  location?: {
    sheetName?: string
    row?: number
    column?: string
    field?: string
  }
}

export interface ImportReport {
  source: ImportSource
  status: ImportStatus
  targetWeekTag: WeekTag
  createdAt: string
  issues: Array<ImportIssue>
  summary: {
    errorCount: number
    warningCount: number
    blockingCount: number
  }
}

export interface TeacherHoursImportPayload {
  sheetName: '교사별시수표'
  subjects: Array<{ name: string; abbreviation: string }>
  teachers: Array<{ name: string; baseHoursPerWeek: number }>
  assignments: Array<{
    teacherName: string
    subjectName: string
    grade: number
    classNumber: number
    hoursPerWeek: number
  }>
  issues: Array<ImportIssue>
}

export interface FinalTimetableImportPayload {
  sheetName: '1학기 시간표'
  schoolConfig: {
    gradeCount: number
    classCountByGrade: Record<number, number>
    activeDays: Array<DayOfWeek>
    periodsByDay: Partial<Record<DayOfWeek, number>>
  }
  slots: Array<{
    grade: number
    classNumber: number
    day: DayOfWeek
    period: number
    subjectName: string
    teacherName: string
  }>
  issues: Array<ImportIssue>
}

export type AutoSaveFlushReason = 'debounce' | 'pagehide' | 'manual'
