import type {
  ConstraintPolicy,
  ConstraintViolation,
} from '@/entities/constraint-policy'
import type { FixedEvent } from '@/entities/fixed-event'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { TimetableCell } from '@/entities/timetable'
import type {
  RelaxationSuggestion,
  UnplacedAssignment,
} from '@/features/generate-timetable'
import { validateTimetable } from '@/entities/constraint-policy'
import {
  TimetableGrid,
  buildAssignmentUnitsFromCells,
  buildBlockedSlots,
  expandGradeBlockedSlots,
  runPlacementPipeline,
} from '@/features/generate-timetable'
import { suggestRelaxations } from '@/features/generate-timetable/lib/failure-analyzer'
import { computeTotalScore } from '@/features/generate-timetable/lib/scorer'

export interface RecomputeInput {
  cells: Array<TimetableCell>
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
  fixedEvents: Array<FixedEvent>
  constraintPolicy: ConstraintPolicy
  teacherPolicies: Array<TeacherPolicy>
}

export interface RecomputeResult {
  success: boolean
  cells: Array<TimetableCell>
  score: number
  violations: Array<ConstraintViolation>
  unplacedAssignments: Array<UnplacedAssignment>
  suggestions: Array<RelaxationSuggestion>
  recomputeTimeMs: number
}

/**
 * 잠긴/고정 셀을 보존하고 미잠금 셀만 재배치하는 부분 재계산
 */
export function recomputeUnlocked(input: RecomputeInput): RecomputeResult {
  const startTime = performance.now()
  const {
    cells,
    schoolConfig,
    teachers,
    subjects,
    fixedEvents,
    constraintPolicy,
    teacherPolicies,
  } = input
  const { activeDays, periodsPerDay } = schoolConfig

  // 1. locked / unlocked 분류
  const lockedCells: Array<TimetableCell> = []
  const unlockedCells: Array<TimetableCell> = []

  for (const cell of cells) {
    if (cell.isFixed || cell.status === 'LOCKED') {
      lockedCells.push(cell)
    } else {
      unlockedCells.push(cell)
    }
  }

  // 2. locked 셀만으로 그리드 생성
  const grid = new TimetableGrid()
  for (const cell of lockedCells) {
    grid.placeCell(cell)
  }

  // 3. 차단 슬롯 구축
  let blockedSlots = buildBlockedSlots(fixedEvents, teacherPolicies)
  blockedSlots = expandGradeBlockedSlots(
    blockedSlots,
    schoolConfig.classCountByGrade,
  )

  // 4. 잠긴 시수 차감된 배정 단위 생성
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const assignments = buildAssignmentUnitsFromCells(
    teachers,
    subjectMap,
    lockedCells,
  )

  // 5. 배치 파이프라인 실행
  const { unplaced } = runPlacementPipeline(
    grid,
    assignments,
    activeDays,
    periodsPerDay,
    constraintPolicy,
    blockedSlots,
    teacherPolicies,
  )

  // 6. locked 셀 + 새 셀 병합
  const newCells = grid.getAllCells()
  // locked 셀의 status 보존, 새 셀은 BASE
  const mergedCells = newCells.map((cell) => {
    const locked = lockedCells.find(
      (lc) =>
        lc.grade === cell.grade &&
        lc.classNumber === cell.classNumber &&
        lc.day === cell.day &&
        lc.period === cell.period,
    )
    if (locked) return locked
    return { ...cell, status: 'BASE' as const }
  })

  // 7. 검증
  const score = computeTotalScore(
    grid,
    constraintPolicy,
    activeDays,
    periodsPerDay,
    teacherPolicies,
  )
  const violations = validateTimetable(mergedCells, constraintPolicy)
  const suggestions =
    unplaced.length > 0 ? suggestRelaxations(unplaced, constraintPolicy) : []

  const endTime = performance.now()

  return {
    success:
      unplaced.length === 0 &&
      violations.filter((v) => v.severity === 'error').length === 0,
    cells: mergedCells,
    score,
    violations,
    unplacedAssignments: unplaced,
    suggestions,
    recomputeTimeMs: Math.round(endTime - startTime),
  }
}
