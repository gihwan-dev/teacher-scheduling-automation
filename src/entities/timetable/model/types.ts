import type { DayOfWeek, SubjectType } from '@/shared/lib/types'

// 시간표 개별 셀 (배치 결과 단위)
export interface TimetableCell {
  teacherId: string
  subjectId: string
  subjectType?: SubjectType
  grade: number
  classNumber: number
  day: DayOfWeek
  period: number
  isFixed: boolean // FixedEvent에서 유래한 셀
  status: CellStatus
}

// 셀 상태
export type CellStatus =
  | 'BASE'
  | 'TEMP_MODIFIED'
  | 'CONFIRMED_MODIFIED'
  | 'LOCKED'

// 셀 고유 키: "grade-classNumber-day-period"
export type CellKey = `${number}-${number}-${DayOfWeek}-${number}`

// Undo/Redo용 편집 커맨드 객체
export interface EditAction {
  type: 'EDIT' | 'CLEAR' | 'LOCK' | 'UNLOCK' | 'MOVE'
  before: TimetableCell | null
  after: TimetableCell | null
  cellKey: CellKey
  timestamp: number
}

// 편집 검증 결과
export interface EditValidationResult {
  valid: boolean
  violations: Array<{ type: string; message: string }>
}

// 생성 결과 스냅샷
export interface TimetableSnapshot {
  id: string
  schoolConfigId: string
  cells: Array<TimetableCell>
  score: number
  generationTimeMs: number
  createdAt: string
}
