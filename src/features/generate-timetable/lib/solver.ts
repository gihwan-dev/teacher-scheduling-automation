import {
  buildBlockedSlots,
  expandGradeBlockedSlots,
  findCandidateSlots,
  isPlacementValid,
} from './constraint-checker'
import { diagnoseFailure, suggestRelaxations } from './failure-analyzer'
import { TimetableGrid } from './grid'
import { computeTotalScore, scoreSlot } from './scorer'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { FixedEvent } from '@/entities/fixed-event'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { TimetableCell } from '@/entities/timetable'
import type { DayOfWeek } from '@/shared/lib/types'
import type {
  AssignmentUnit,
  GenerationInput,
  GenerationResult,
  UnplacedAssignment,
} from '../model/types'
import { computeWeekTagFromIso } from '@/shared/lib/week-tag'
import { generateId } from '@/shared/lib/id'
import {
  buildAcademicCalendarBlockedSlots,
  validateScheduleChange,
} from '@/features/validate-schedule-change'

const MAX_HILL_CLIMBING_ITERATIONS = 1000
const BACKTRACK_DEPTH_LIMIT = 3

/**
 * 배치 파이프라인: MRV 정렬 → 탐욕 배치 + 백트래킹 → Hill-climbing
 * partial-solver에서도 재사용 가능하도록 추출
 */
export function runPlacementPipeline(
  grid: TimetableGrid,
  assignments: Array<AssignmentUnit>,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
  constraintPolicy: ConstraintPolicy,
  blockedSlots: Set<string>,
  teacherPolicies?: Array<TeacherPolicy>,
): { unplaced: Array<UnplacedAssignment> } {
  sortByMRV(
    assignments,
    grid,
    activeDays,
    periodsPerDay,
    constraintPolicy,
    blockedSlots,
    teacherPolicies,
  )

  const unplaced: Array<UnplacedAssignment> = []

  for (const unit of assignments) {
    while (unit.remainingHours > 0) {
      const candidates = findCandidateSlots(
        grid,
        unit,
        activeDays,
        periodsPerDay,
        constraintPolicy,
        blockedSlots,
        teacherPolicies,
      )

      if (candidates.length === 0) {
        const backtrackSuccess = tryBacktrack(
          grid,
          unit,
          activeDays,
          periodsPerDay,
          constraintPolicy,
          blockedSlots,
          assignments,
          0,
          teacherPolicies,
        )
        if (!backtrackSuccess) {
          unplaced.push({
            teacherId: unit.teacherId,
            subjectId: unit.subjectId,
            grade: unit.grade,
            classNumber: unit.classNumber,
            remainingHours: unit.remainingHours,
            reason: diagnoseFailure(
              grid,
              unit,
              activeDays,
              periodsPerDay,
              constraintPolicy,
              blockedSlots,
            ),
          })
          break
        }
        continue
      }

      for (const candidate of candidates) {
        candidate.score = scoreSlot(
          grid,
          unit,
          candidate.day,
          candidate.period,
          constraintPolicy,
          activeDays,
          teacherPolicies,
          periodsPerDay,
        )
      }

      candidates.sort((a, b) => b.score - a.score)
      const best = candidates[0]

      const cell: TimetableCell = {
        teacherId: unit.teacherId,
        subjectId: unit.subjectId,
        grade: unit.grade,
        classNumber: unit.classNumber,
        day: best.day,
        period: best.period,
        isFixed: false,
        status: 'BASE',
      }
      grid.placeCell(cell)
      unit.remainingHours--
    }
  }

  hillClimb(
    grid,
    constraintPolicy,
    activeDays,
    periodsPerDay,
    blockedSlots,
    teacherPolicies,
  )

  return { unplaced }
}

/**
 * 잠긴 셀의 시수를 차감한 배정 단위 생성
 */
export function buildAssignmentUnitsFromCells(
  teachers: Array<{
    id: string
    subjectIds: Array<string>
    classAssignments: Array<{
      grade: number
      classNumber: number
      hoursPerWeek: number
    }>
  }>,
  subjectMap: Map<string, { id: string }>,
  prePlacedCells: Array<TimetableCell>,
): Array<AssignmentUnit> {
  return buildAssignmentUnits(teachers, subjectMap, prePlacedCells)
}

/**
 * 시간표 자동 생성 메인 함수
 *
 * 3단계 알고리즘:
 * 1. 전처리: 입력 검증 → 고정 이벤트 배치 → 배정 단위 생성
 * 2. 탐욕적 배치 + 제한적 백트래킹
 * 3. Hill-climbing 최적화
 */
export function generateTimetable(input: GenerationInput): GenerationResult {
  const startTime = performance.now()
  const {
    schoolConfig,
    teachers,
    subjects,
    fixedEvents,
    constraintPolicy,
    teacherPolicies,
    targetWeekTag,
    academicCalendarEvents = [],
  } = input
  const createdAt = new Date().toISOString()
  const weekTag = targetWeekTag ?? computeWeekTagFromIso(createdAt)

  // === 전처리 ===
  const grid = new TimetableGrid()
  const { activeDays, periodsPerDay } = schoolConfig

  // 차단 슬롯 구축 (교사 회피 슬롯 포함)
  let blockedSlots = buildBlockedSlots(fixedEvents, teacherPolicies)
  blockedSlots = expandGradeBlockedSlots(
    blockedSlots,
    schoolConfig.classCountByGrade,
  )
  const calendarBlockedSlots = buildAcademicCalendarBlockedSlots({
    schoolConfig,
    weekTag,
    academicCalendarEvents,
  })
  for (const slotKey of calendarBlockedSlots) {
    blockedSlots.add(slotKey)
  }

  // 고정 이벤트 배치
  const fixedCells = placeFixedEvents(fixedEvents, subjects, grid)

  // 배정 단위 생성 (교사-과목-반 매핑)
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const assignments = buildAssignmentUnits(teachers, subjectMap, fixedCells)

  // 총 슬롯 수 계산
  const totalClasses = Object.values(schoolConfig.classCountByGrade).reduce(
    (s, c) => s + c,
    0,
  )
  const totalSlots = totalClasses * activeDays.length * periodsPerDay

  // === 배치 파이프라인 ===
  const { unplaced } = runPlacementPipeline(
    grid,
    assignments,
    activeDays,
    periodsPerDay,
    constraintPolicy,
    blockedSlots,
    teacherPolicies,
  )

  // === 결과 빌드 ===
  const endTime = performance.now()
  const generationTimeMs = Math.round(endTime - startTime)
  const cells = grid.getAllCells()
  const score = computeTotalScore(
    grid,
    constraintPolicy,
    activeDays,
    periodsPerDay,
    teacherPolicies,
  )
  const violations = validateScheduleChange({
    cells,
    constraintPolicy,
    schoolConfig,
    teachers,
    subjects,
    weekTag,
    academicCalendarEvents,
  })
  const suggestions = suggestRelaxations(unplaced, constraintPolicy)

  const hardViolations = violations.filter((v) => v.severity === 'error')
  const success = unplaced.length === 0 && hardViolations.length === 0

  const snapshot = success
    ? (() => {
        return {
          id: generateId(),
          schoolConfigId: schoolConfig.id,
          weekTag,
          versionNo: 1,
          baseVersionId: null,
          appliedScope: {
            type: 'THIS_WEEK' as const,
            fromWeek: weekTag,
            toWeek: null,
          },
          cells,
          score,
          generationTimeMs,
          createdAt,
        }
      })()
    : null

  return {
    success,
    snapshot,
    violations,
    unplacedAssignments: unplaced,
    suggestions,
    stats: {
      totalSlots,
      filledSlots: cells.length,
      fixedSlots: grid.getFixedCellCount(),
      generationTimeMs,
    },
  }
}

/**
 * 고정 이벤트를 그리드에 배치
 */
function placeFixedEvents(
  fixedEvents: Array<FixedEvent>,
  _subjects: Array<{ id: string }>,
  grid: TimetableGrid,
): Array<TimetableCell> {
  const fixedCells: Array<TimetableCell> = []

  for (const event of fixedEvents) {
    if (
      event.type === 'FIXED_CLASS' &&
      event.teacherId &&
      event.subjectId &&
      event.grade !== null &&
      event.classNumber !== null
    ) {
      const cell: TimetableCell = {
        teacherId: event.teacherId,
        subjectId: event.subjectId,
        grade: event.grade,
        classNumber: event.classNumber,
        day: event.day,
        period: event.period,
        isFixed: true,
        status: 'BASE',
      }
      grid.placeCell(cell)
      fixedCells.push(cell)
    }
  }

  return fixedCells
}

/**
 * 교사-과목-반 배정 단위 생성
 * ClassHoursAssignment에 subjectId가 없으므로 교사의 subjectIds로 추론
 */
function buildAssignmentUnits(
  teachers: Array<{
    id: string
    subjectIds: Array<string>
    classAssignments: Array<{
      grade: number
      classNumber: number
      hoursPerWeek: number
    }>
  }>,
  subjectMap: Map<string, { id: string }>,
  fixedCells: Array<TimetableCell>,
): Array<AssignmentUnit> {
  const units: Array<AssignmentUnit> = []

  // 고정 셀에서 이미 배치된 시수 계산
  const fixedHoursMap = new Map<string, number>()
  for (const cell of fixedCells) {
    const key = `${cell.teacherId}-${cell.grade}-${cell.classNumber}`
    fixedHoursMap.set(key, (fixedHoursMap.get(key) ?? 0) + 1)
  }

  for (const teacher of teachers) {
    // subjectId 결정: 단일 과목이면 자동 매핑, 다중이면 첫 번째 사용
    const subjectId = teacher.subjectIds[0]
    if (!subjectId || !subjectMap.has(subjectId)) continue

    for (const assignment of teacher.classAssignments) {
      const fixedKey = `${teacher.id}-${assignment.grade}-${assignment.classNumber}`
      const fixedHours = fixedHoursMap.get(fixedKey) ?? 0
      const remaining = assignment.hoursPerWeek - fixedHours

      if (remaining > 0) {
        units.push({
          teacherId: teacher.id,
          subjectId,
          subjectType: 'CLASS',
          grade: assignment.grade,
          classNumber: assignment.classNumber,
          totalHours: assignment.hoursPerWeek,
          remainingHours: remaining,
        })
      }
    }
  }

  return units
}

/**
 * MRV(최소 잔여값) 휴리스틱으로 배정 정렬
 * 가용 슬롯이 적은 배정을 먼저 처리
 */
function sortByMRV(
  assignments: Array<AssignmentUnit>,
  grid: TimetableGrid,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
  policy: ConstraintPolicy,
  blockedSlots: Set<string>,
  teacherPolicies?: Array<TeacherPolicy>,
): void {
  const candidateCounts = new Map<AssignmentUnit, number>()

  for (const unit of assignments) {
    const candidates = findCandidateSlots(
      grid,
      unit,
      activeDays,
      periodsPerDay,
      policy,
      blockedSlots,
      teacherPolicies,
    )
    candidateCounts.set(unit, candidates.length)
  }

  assignments.sort((a, b) => {
    const countA = candidateCounts.get(a) ?? 0
    const countB = candidateCounts.get(b) ?? 0
    // 가용 슬롯이 적은 것 우선 (MRV)
    if (countA !== countB) return countA - countB
    // 잔여 시수가 많은 것 우선
    return b.remainingHours - a.remainingHours
  })
}

/**
 * 제한적 백트래킹: 이미 배치된 비고정 셀을 교체하여 공간 확보
 */
function tryBacktrack(
  grid: TimetableGrid,
  unit: AssignmentUnit,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
  policy: ConstraintPolicy,
  blockedSlots: Set<string>,
  _allUnits: Array<AssignmentUnit>,
  depth: number,
  teacherPolicies?: Array<TeacherPolicy>,
): boolean {
  if (depth >= BACKTRACK_DEPTH_LIMIT) return false

  // 이 unit이 배치될 수 있는 슬롯을 찾되, 현재 점유한 비고정 셀을 제거하고 시도
  for (const day of activeDays) {
    for (let period = 1; period <= periodsPerDay; period++) {
      // 교사가 바쁘지만, 반 슬롯이 비어있는 경우 → 교사의 다른 배정을 이동
      // 반 슬롯이 차있지만 교사가 비어있는 경우 → 반의 기존 배정을 이동
      if (
        grid.isClassSlotFilled(unit.grade, unit.classNumber, day, period) &&
        !grid.isTeacherBusy(unit.teacherId, day, period)
      ) {
        // 반 슬롯을 점유하는 비고정 셀 찾기
        const occupyingCell = grid
          .getAllCells()
          .find(
            (c) =>
              c.grade === unit.grade &&
              c.classNumber === unit.classNumber &&
              c.day === day &&
              c.period === period &&
              !c.isFixed,
          )

        if (!occupyingCell) continue

        // 점유 셀을 제거하고 이 unit을 배치할 수 있는지 확인
        grid.removeCell(occupyingCell)

        if (
          isPlacementValid(
            grid,
            unit,
            day,
            period,
            policy,
            blockedSlots,
            teacherPolicies,
          )
        ) {
          // 이 unit 배치
          const newCell: TimetableCell = {
            teacherId: unit.teacherId,
            subjectId: unit.subjectId,
            grade: unit.grade,
            classNumber: unit.classNumber,
            day,
            period,
            isFixed: false,
            status: 'BASE',
          }
          grid.placeCell(newCell)
          unit.remainingHours--

          // 제거된 셀을 다른 곳에 배치 시도
          const displacedUnit: AssignmentUnit = {
            teacherId: occupyingCell.teacherId,
            subjectId: occupyingCell.subjectId,
            grade: occupyingCell.grade,
            classNumber: occupyingCell.classNumber,
            totalHours: 1,
            remainingHours: 1,
          }

          const displacedCandidates = findCandidateSlots(
            grid,
            displacedUnit,
            activeDays,
            periodsPerDay,
            policy,
            blockedSlots,
            teacherPolicies,
          )

          if (displacedCandidates.length > 0) {
            // 점수 기반 선택
            let bestCandidate = displacedCandidates[0]
            let bestScore = -1
            for (const c of displacedCandidates) {
              const s = scoreSlot(
                grid,
                displacedUnit,
                c.day,
                c.period,
                policy,
                activeDays,
                teacherPolicies,
                periodsPerDay,
              )
              if (s > bestScore) {
                bestScore = s
                bestCandidate = c
              }
            }
            const displacedCell: TimetableCell = {
              teacherId: displacedUnit.teacherId,
              subjectId: displacedUnit.subjectId,
              grade: displacedUnit.grade,
              classNumber: displacedUnit.classNumber,
              day: bestCandidate.day,
              period: bestCandidate.period,
              isFixed: false,
              status: 'BASE',
            }
            grid.placeCell(displacedCell)
            return true
          }

          // 재귀 백트래킹
          const success = tryBacktrack(
            grid,
            displacedUnit,
            activeDays,
            periodsPerDay,
            policy,
            blockedSlots,
            _allUnits,
            depth + 1,
            teacherPolicies,
          )
          if (success) return true

          // 실패: 원복
          grid.removeCell(newCell)
          unit.remainingHours++
          grid.placeCell(occupyingCell)
        } else {
          // 원복
          grid.placeCell(occupyingCell)
        }
      }
    }
  }

  return false
}

/**
 * Hill-climbing: 비고정 셀 쌍을 스왑하여 점수 개선
 */
function hillClimb(
  grid: TimetableGrid,
  policy: ConstraintPolicy,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
  blockedSlots: Set<string>,
  teacherPolicies?: Array<TeacherPolicy>,
): void {
  let currentScore = computeTotalScore(
    grid,
    policy,
    activeDays,
    periodsPerDay,
    teacherPolicies,
  )
  let iterations = 0

  while (iterations < MAX_HILL_CLIMBING_ITERATIONS) {
    iterations++
    let improved = false

    const nonFixedCells = grid.getAllCells().filter((c) => !c.isFixed)
    if (nonFixedCells.length < 2) break

    // 랜덤 셀 쌍 스왑 시도
    for (let i = 0; i < nonFixedCells.length && !improved; i++) {
      for (let j = i + 1; j < nonFixedCells.length && !improved; j++) {
        const cellA = nonFixedCells[i]
        const cellB = nonFixedCells[j]

        // 같은 반이 아니면 스왑 불가 (반-교시 매핑이 바뀜)
        if (
          cellA.grade !== cellB.grade ||
          cellA.classNumber !== cellB.classNumber
        )
          continue
        // 이미 같은 슬롯이면 스킵
        if (cellA.day === cellB.day && cellA.period === cellB.period) continue

        // 스왑 시도: A를 B 위치에, B를 A 위치에
        grid.removeCell(cellA)
        grid.removeCell(cellB)

        const unitA: AssignmentUnit = {
          teacherId: cellA.teacherId,
          subjectId: cellA.subjectId,
          grade: cellA.grade,
          classNumber: cellA.classNumber,
          totalHours: 1,
          remainingHours: 1,
        }
        const unitB: AssignmentUnit = {
          teacherId: cellB.teacherId,
          subjectId: cellB.subjectId,
          grade: cellB.grade,
          classNumber: cellB.classNumber,
          totalHours: 1,
          remainingHours: 1,
        }

        const aAtB = isPlacementValid(
          grid,
          unitA,
          cellB.day,
          cellB.period,
          policy,
          blockedSlots,
          teacherPolicies,
        )
        const bAtA = isPlacementValid(
          grid,
          unitB,
          cellA.day,
          cellA.period,
          policy,
          blockedSlots,
          teacherPolicies,
        )

        if (aAtB && bAtA) {
          const swappedA: TimetableCell = {
            ...cellA,
            day: cellB.day,
            period: cellB.period,
          }
          const swappedB: TimetableCell = {
            ...cellB,
            day: cellA.day,
            period: cellA.period,
          }

          grid.placeCell(swappedA)
          grid.placeCell(swappedB)

          const newScore = computeTotalScore(
            grid,
            policy,
            activeDays,
            periodsPerDay,
            teacherPolicies,
          )
          if (newScore > currentScore) {
            currentScore = newScore
            improved = true
          } else {
            // 원복
            grid.removeCell(swappedA)
            grid.removeCell(swappedB)
            grid.placeCell(cellA)
            grid.placeCell(cellB)
          }
        } else {
          // 원복
          grid.placeCell(cellA)
          grid.placeCell(cellB)
        }
      }
    }

    if (!improved) break
  }
}
