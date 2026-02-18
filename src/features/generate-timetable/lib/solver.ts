import {
  buildBlockedSlots,
  expandGradeBlockedSlots,
  findCandidateSlots,
  isPlacementValid,
} from './constraint-checker'
import { diagnoseFailure, suggestRelaxations } from './failure-analyzer'
import { TimetableGrid } from './grid'
import { computeTotalScore, scoreSlot } from './scorer'
import type {
  AssignmentUnit,
  GenerationInput,
  GenerationResult,
  UnplacedAssignment,
} from '../model/types'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { FixedEvent } from '@/entities/fixed-event'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { TimetableCell } from '@/entities/timetable'
import type { DayOfWeek } from '@/shared/lib/types'
import { validateTimetable } from '@/entities/constraint-policy'
import {
  calculateSlotsPerClass,
  getDayPeriodCount,
  getMaxPeriodsPerDay,
} from '@/entities/school'
import { getTeacherAssignments } from '@/entities/teacher'
import { generateId } from '@/shared/lib/id'

const MAX_HILL_CLIMBING_ITERATIONS = 1000
const BACKTRACK_DEPTH_LIMIT = 3

interface SynchronizedAssignment {
  teacherId: string
  subjectId: string
  subjectType: 'GRADE' | 'SCHOOL'
  grade: number | null
  totalHours: number
  remainingHours: number
  targetClasses: Array<{ grade: number; classNumber: number }>
}

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
        subjectType: unit.subjectType,
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
  teachers: GenerationInput['teachers'],
  subjectMap: Map<string, { id: string }>,
  prePlacedCells: Array<TimetableCell>,
  schoolConfig: GenerationInput['schoolConfig'],
): Array<AssignmentUnit> {
  return buildAssignmentUnits(
    teachers,
    subjectMap,
    prePlacedCells,
    schoolConfig,
  ).classUnits
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
  } = input

  // === 전처리 ===
  const grid = new TimetableGrid()
  const { activeDays } = schoolConfig
  const periodsPerDay = getMaxPeriodsPerDay(schoolConfig)

  // 차단 슬롯 구축 (교사 회피 슬롯 포함)
  let blockedSlots = buildBlockedSlots(fixedEvents, teacherPolicies)
  blockedSlots = expandGradeBlockedSlots(
    blockedSlots,
    schoolConfig.classCountByGrade,
  )
  blockedSlots = expandOutOfRangeSlots(blockedSlots, schoolConfig, periodsPerDay)

  // 고정 이벤트 배치
  const fixedCells = placeFixedEvents(fixedEvents, subjects, grid, schoolConfig)

  // 배정 단위 생성 (교사-과목-반 매핑)
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const { classUnits, synchronizedUnits } = buildAssignmentUnits(
    teachers,
    subjectMap,
    fixedCells,
    schoolConfig,
  )

  // 총 슬롯 수 계산
  const totalClasses = Object.values(schoolConfig.classCountByGrade).reduce(
    (s, c) => s + c,
    0,
  )
  const totalSlots = totalClasses * calculateSlotsPerClass(schoolConfig)

  // 학년/전교 단위 배정 먼저 처리 (동일 시간 동기 배치)
  const synchronizedUnplaced = placeSynchronizedAssignments(
    grid,
    synchronizedUnits,
    schoolConfig,
    constraintPolicy,
    blockedSlots,
    teacherPolicies,
  )

  // === 배치 파이프라인 ===
  const { unplaced: classUnplaced } = runPlacementPipeline(
    grid,
    classUnits,
    activeDays,
    periodsPerDay,
    constraintPolicy,
    blockedSlots,
    teacherPolicies,
  )
  const unplaced = [...synchronizedUnplaced, ...classUnplaced]

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
  const violations = validateTimetable(cells, constraintPolicy)
  const suggestions = suggestRelaxations(unplaced, constraintPolicy)

  const hardViolations = violations.filter((v) => v.severity === 'error')
  const success = unplaced.length === 0 && hardViolations.length === 0

  const snapshot = success
    ? {
        id: generateId(),
        schoolConfigId: schoolConfig.id,
        cells,
        score,
        generationTimeMs,
        createdAt: new Date().toISOString(),
      }
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
  schoolConfig: GenerationInput['schoolConfig'],
): Array<TimetableCell> {
  const fixedCells: Array<TimetableCell> = []

  for (const event of fixedEvents) {
    if (
      event.type === 'FIXED_CLASS' &&
      event.teacherId &&
      event.subjectId &&
      event.subjectType
    ) {
      const targets = resolveTargetsForSubjectType(
        event.subjectType,
        event.grade ?? null,
        event.classNumber ?? null,
        schoolConfig,
      )
      for (const target of targets) {
        const status = event.subjectType === 'CLASS' ? 'BASE' : 'LOCKED'
        const cell: TimetableCell = {
          teacherId: event.teacherId,
          subjectId: event.subjectId,
          subjectType: event.subjectType,
          grade: target.grade,
          classNumber: target.classNumber,
          day: event.day,
          period: event.period,
          isFixed: true,
          status,
        }
        grid.placeCell(cell)
        fixedCells.push(cell)
      }
    } else if (
      event.type === 'FIXED_CLASS' &&
      event.teacherId &&
      event.subjectId &&
      event.grade !== null &&
      event.classNumber !== null
    ) {
      // legacy compatibility
      const cell: TimetableCell = {
        teacherId: event.teacherId,
        subjectId: event.subjectId,
        subjectType: 'CLASS',
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
  teachers: GenerationInput['teachers'],
  subjectMap: Map<string, { id: string }>,
  fixedCells: Array<TimetableCell>,
  schoolConfig: GenerationInput['schoolConfig'],
): { classUnits: Array<AssignmentUnit>; synchronizedUnits: Array<SynchronizedAssignment> } {
  const classUnits: Array<AssignmentUnit> = []
  const synchronizedUnits: Array<SynchronizedAssignment> = []

  // 고정 셀에서 이미 배치된 시수 계산
  const fixedHoursMap = new Map<string, number>()
  for (const cell of fixedCells) {
    const key = `${cell.teacherId}-${cell.subjectId}-${cell.subjectType ?? 'CLASS'}-${cell.grade}-${cell.classNumber}`
    fixedHoursMap.set(key, (fixedHoursMap.get(key) ?? 0) + 1)
  }

  for (const teacher of teachers) {
    for (const assignment of getTeacherAssignments(teacher)) {
      if (!subjectMap.has(assignment.subjectId)) continue

      const subjectType = assignment.subjectType
      const targets = resolveTargetsForSubjectType(
        subjectType,
        assignment.grade ?? null,
        assignment.classNumber ?? null,
        schoolConfig,
      )
      if (targets.length === 0) continue

      const fixedKey = `${teacher.id}-${assignment.subjectId}-${subjectType}-${targets[0].grade}-${targets[0].classNumber}`
      const fixedHours = fixedHoursMap.get(fixedKey) ?? 0
      const remaining = assignment.hoursPerWeek - fixedHours

      if (remaining <= 0) continue

      if (subjectType === 'CLASS') {
        const target = targets[0]
        classUnits.push({
          teacherId: teacher.id,
          subjectId: assignment.subjectId,
          subjectType,
          grade: target.grade,
          classNumber: target.classNumber,
          totalHours: assignment.hoursPerWeek,
          remainingHours: remaining,
        })
        continue
      }

      synchronizedUnits.push({
        teacherId: teacher.id,
        subjectId: assignment.subjectId,
        subjectType,
        grade: assignment.grade ?? null,
        totalHours: assignment.hoursPerWeek,
        remainingHours: remaining,
        targetClasses: targets,
      })
    }
  }

  return { classUnits, synchronizedUnits }
}

function resolveTargetsForSubjectType(
  subjectType: 'CLASS' | 'GRADE' | 'SCHOOL',
  grade: number | null,
  classNumber: number | null,
  schoolConfig: GenerationInput['schoolConfig'],
): Array<{ grade: number; classNumber: number }> {
  if (subjectType === 'CLASS') {
    if (grade === null || classNumber === null) return []
    return [{ grade, classNumber }]
  }

  if (subjectType === 'GRADE') {
    if (grade === null) return []
    const classCount = schoolConfig.classCountByGrade[grade] ?? 0
    return Array.from({ length: classCount }, (_, i) => ({
      grade,
      classNumber: i + 1,
    }))
  }

  const targets: Array<{ grade: number; classNumber: number }> = []
  for (let g = 1; g <= schoolConfig.gradeCount; g++) {
    const classCount = schoolConfig.classCountByGrade[g] ?? 0
    for (let cls = 1; cls <= classCount; cls++) {
      targets.push({ grade: g, classNumber: cls })
    }
  }
  return targets
}

function expandOutOfRangeSlots(
  blockedSlots: Set<string>,
  schoolConfig: GenerationInput['schoolConfig'],
  maxPeriodsPerDay: number,
): Set<string> {
  const expanded = new Set(blockedSlots)
  for (let grade = 1; grade <= schoolConfig.gradeCount; grade++) {
    const classCount = schoolConfig.classCountByGrade[grade] ?? 0
    for (let cls = 1; cls <= classCount; cls++) {
      for (const day of schoolConfig.activeDays) {
        const dayMax = getDayPeriodCount(schoolConfig, day)
        for (let period = dayMax + 1; period <= maxPeriodsPerDay; period++) {
          expanded.add(`class-${grade}-${cls}-${day}-${period}`)
        }
      }
    }
  }
  return expanded
}

function placeSynchronizedAssignments(
  grid: TimetableGrid,
  units: Array<SynchronizedAssignment>,
  schoolConfig: GenerationInput['schoolConfig'],
  constraintPolicy: ConstraintPolicy,
  blockedSlots: Set<string>,
  teacherPolicies?: Array<TeacherPolicy>,
): Array<UnplacedAssignment> {
  const unplaced: Array<UnplacedAssignment> = []
  const periodsPerDay = getMaxPeriodsPerDay(schoolConfig)
  const { activeDays } = schoolConfig

  for (const unit of units) {
    const primaryClass = unit.targetClasses.at(0)
    if (!primaryClass) continue

    while (unit.remainingHours > 0) {
      const candidates: Array<{ day: DayOfWeek; period: number; score: number }> = []

      for (const day of activeDays) {
        const maxPeriodOnDay = getDayPeriodCount(schoolConfig, day)
        for (let period = 1; period <= maxPeriodOnDay; period++) {
          const teacherBlockKey = `teacher-${unit.teacherId}-${day}-${period}`
          if (blockedSlots.has(teacherBlockKey)) continue

          const tp = teacherPolicies?.find((policy) => policy.teacherId === unit.teacherId)
          const maxDaily = tp?.maxDailyHoursOverride ?? constraintPolicy.teacherMaxDailyHours
          if (grid.getTeacherDayHours(unit.teacherId, day) >= maxDaily) continue

          const allTargetsAvailable = unit.targetClasses.every((target) => {
            const classBlocked = blockedSlots.has(
              `class-${target.grade}-${target.classNumber}-${day}-${period}`,
            )
            if (classBlocked) return false
            return !grid.isClassSlotFilled(target.grade, target.classNumber, day, period)
          })

          if (!allTargetsAvailable) continue

          const unitForScoring: AssignmentUnit = {
            teacherId: unit.teacherId,
            subjectId: unit.subjectId,
            subjectType: unit.subjectType,
            grade: primaryClass.grade,
            classNumber: primaryClass.classNumber,
            totalHours: 1,
            remainingHours: 1,
          }
          const score = scoreSlot(
            grid,
            unitForScoring,
            day,
            period,
            constraintPolicy,
            activeDays,
            teacherPolicies,
            periodsPerDay,
          )

          candidates.push({ day, period, score })
        }
      }

      if (candidates.length === 0) {
        const reasonUnit: AssignmentUnit = {
          teacherId: unit.teacherId,
          subjectId: unit.subjectId,
          subjectType: unit.subjectType,
          grade: primaryClass.grade,
          classNumber: primaryClass.classNumber,
          totalHours: unit.totalHours,
          remainingHours: unit.remainingHours,
        }

        unplaced.push({
          teacherId: unit.teacherId,
          subjectId: unit.subjectId,
          grade: primaryClass.grade,
          classNumber: primaryClass.classNumber,
          remainingHours: unit.remainingHours,
          reason: diagnoseFailure(
            grid,
            reasonUnit,
            activeDays,
            periodsPerDay,
            constraintPolicy,
            blockedSlots,
          ),
        })
        break
      }

      candidates.sort((a, b) => b.score - a.score)
      const best = candidates[0]
      for (const target of unit.targetClasses) {
        const cell: TimetableCell = {
          teacherId: unit.teacherId,
          subjectId: unit.subjectId,
          subjectType: unit.subjectType,
          grade: target.grade,
          classNumber: target.classNumber,
          day: best.day,
          period: best.period,
          isFixed: false,
          status: 'LOCKED',
        }
        grid.placeCell(cell)
      }
      unit.remainingHours--
    }
  }

  return unplaced
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
            subjectType: unit.subjectType,
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
            subjectType: occupyingCell.subjectType ?? 'CLASS',
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
              subjectType: displacedUnit.subjectType,
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

    const nonFixedCells = grid
      .getAllCells()
      .filter(
        (c) =>
          !c.isFixed &&
          c.status !== 'LOCKED' &&
          (c.subjectType ?? 'CLASS') === 'CLASS',
      )
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
          subjectType: cellA.subjectType ?? 'CLASS',
          grade: cellA.grade,
          classNumber: cellA.classNumber,
          totalHours: 1,
          remainingHours: 1,
        }
        const unitB: AssignmentUnit = {
          teacherId: cellB.teacherId,
          subjectId: cellB.subjectId,
          subjectType: cellB.subjectType ?? 'CLASS',
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
