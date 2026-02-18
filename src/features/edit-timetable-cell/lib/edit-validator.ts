import { makeCellKey, parseCellKey } from './cell-key'
import type {
  CellKey,
  EditValidationResult,
  TimetableCell,
} from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { DayOfWeek } from '@/shared/lib/types'
import { TimetableGrid, isPlacementValid } from '@/features/generate-timetable'

/**
 * 셀이 편집 가능한지 확인 (fixed/locked 셀 거부)
 */
export function isCellEditable(cell: TimetableCell): boolean {
  if (cell.isFixed) return false
  if (cell.status === 'LOCKED') return false
  if ((cell.subjectType ?? 'CLASS') !== 'CLASS') return false
  return true
}

/**
 * 셀 내용 변경(교사/과목) 검증
 */
export function validateCellEdit(
  allCells: Array<TimetableCell>,
  targetKey: CellKey,
  newTeacherId: string,
  newSubjectId: string,
  constraintPolicy: ConstraintPolicy,
  teacherPolicies: Array<TeacherPolicy>,
  blockedSlots: Set<string>,
): EditValidationResult {
  const { grade, classNumber, day, period } = parseCellKey(targetKey)
  const violations: Array<{ type: string; message: string }> = []

  // 대상 셀 찾기
  const targetCell = allCells.find(
    (c) =>
      c.grade === grade &&
      c.classNumber === classNumber &&
      c.day === day &&
      c.period === period,
  )

  if (targetCell && !isCellEditable(targetCell)) {
    violations.push({
      type: 'NOT_EDITABLE',
      message: '고정 또는 잠긴 셀은 편집할 수 없습니다',
    })
    return { valid: false, violations }
  }

  // 대상 셀을 제거한 상태의 그리드 구성
  const grid = new TimetableGrid()
  for (const cell of allCells) {
    const cellKey = makeCellKey(
      cell.grade,
      cell.classNumber,
      cell.day,
      cell.period,
    )
    if (cellKey !== targetKey) {
      grid.placeCell(cell)
    }
  }

  // 새 값으로 배치 가능 여부 확인
  const unit = {
    teacherId: newTeacherId,
    subjectId: newSubjectId,
    subjectType: 'CLASS' as const,
    grade,
    classNumber,
    totalHours: 1,
    remainingHours: 1,
  }

  if (
    !isPlacementValid(
      grid,
      unit,
      day,
      period,
      constraintPolicy,
      blockedSlots,
      teacherPolicies,
    )
  ) {
    // 구체적 사유 분석
    if (grid.isTeacherBusy(newTeacherId, day, period)) {
      violations.push({
        type: 'TEACHER_CONFLICT',
        message: `교사가 ${day} ${period}교시에 이미 배정되어 있습니다`,
      })
    }
    const teacherBlockKey = `teacher-${newTeacherId}-${day}-${period}`
    if (blockedSlots.has(teacherBlockKey)) {
      violations.push({
        type: 'BLOCKED_SLOT',
        message: `${day} ${period}교시는 차단된 슬롯입니다`,
      })
    }
    const tp = teacherPolicies.find((p) => p.teacherId === newTeacherId)
    const maxDaily =
      tp?.maxDailyHoursOverride ?? constraintPolicy.teacherMaxDailyHours
    if (grid.getTeacherDayHours(newTeacherId, day) >= maxDaily) {
      violations.push({
        type: 'DAILY_LIMIT',
        message: `교사의 일일 최대 시수(${maxDaily})를 초과합니다`,
      })
    }
    if (violations.length === 0) {
      violations.push({
        type: 'CONSTRAINT_VIOLATION',
        message: '제약 조건 위반',
      })
    }
    return { valid: false, violations }
  }

  return { valid: true, violations: [] }
}

/**
 * 셀 이동(같은 반 내 day/period 변경) 검증
 */
export function validateCellMove(
  allCells: Array<TimetableCell>,
  sourceKey: CellKey,
  targetDay: DayOfWeek,
  targetPeriod: number,
  constraintPolicy: ConstraintPolicy,
  teacherPolicies: Array<TeacherPolicy>,
  blockedSlots: Set<string>,
): EditValidationResult {
  const source = parseCellKey(sourceKey)
  const violations: Array<{ type: string; message: string }> = []

  const sourceCell = allCells.find(
    (c) =>
      c.grade === source.grade &&
      c.classNumber === source.classNumber &&
      c.day === source.day &&
      c.period === source.period,
  )

  if (!sourceCell) {
    violations.push({
      type: 'NOT_FOUND',
      message: '원본 셀을 찾을 수 없습니다',
    })
    return { valid: false, violations }
  }

  if (!isCellEditable(sourceCell)) {
    violations.push({
      type: 'NOT_EDITABLE',
      message: '고정 또는 잠긴 셀은 이동할 수 없습니다',
    })
    return { valid: false, violations }
  }

  // 대상 위치에 이미 셀이 있는지 확인
  const targetKey = makeCellKey(
    source.grade,
    source.classNumber,
    targetDay,
    targetPeriod,
  )
  const targetCell = allCells.find(
    (c) =>
      c.grade === source.grade &&
      c.classNumber === source.classNumber &&
      c.day === targetDay &&
      c.period === targetPeriod,
  )

  if (targetCell) {
    violations.push({
      type: 'SLOT_OCCUPIED',
      message: `${targetDay} ${targetPeriod}교시에 이미 수업이 배정되어 있습니다`,
    })
    return { valid: false, violations }
  }

  // 소스 셀 제거 후 대상 위치에 배치 시도
  return validateCellEdit(
    allCells,
    targetKey,
    sourceCell.teacherId,
    sourceCell.subjectId,
    constraintPolicy,
    teacherPolicies,
    blockedSlots,
  )
}
