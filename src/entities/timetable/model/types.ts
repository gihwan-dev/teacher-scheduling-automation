import type { DayOfWeek } from '@/shared/lib/types'

// 시간표 개별 셀 (배치 결과 단위)
export interface TimetableCell {
  teacherId: string
  subjectId: string
  grade: number
  classNumber: number
  day: DayOfWeek
  period: number
  isFixed: boolean // FixedEvent에서 유래한 셀
}

// 셀 상태 (Phase 4+ 에서 편집/잠금 시 사용, 지금은 BASE만)
export type CellStatus = 'BASE' | 'TEMP_MODIFIED' | 'CONFIRMED_MODIFIED' | 'LOCKED'

// 생성 결과 스냅샷
export interface TimetableSnapshot {
  id: string
  schoolConfigId: string
  cells: Array<TimetableCell>
  score: number
  generationTimeMs: number
  createdAt: string
}
