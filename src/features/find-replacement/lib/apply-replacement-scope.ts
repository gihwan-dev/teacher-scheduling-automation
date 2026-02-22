import { findMultiReplacementCandidates } from './multi-replacement-finder'
import { findReplacementCandidates } from './replacement-finder'
import { findSubstituteCandidates } from './substitute-finder'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { FixedEvent } from '@/entities/fixed-event'
import type { ImpactRiskLevel } from '@/entities/impact-analysis'
import type { ValidationViolation } from '@/entities/schedule-transaction'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type {
  AppliedScope,
  CellKey,
  TimetableCell,
  TimetableSnapshot,
} from '@/entities/timetable'
import type { WeekTag } from '@/shared/lib/week-tag'
import type {
  MultiReplacementCandidate,
  ReplacementApplyScopeState,
  ReplacementCandidate,
  ReplacementSearchConfig,
  ScopeBlockingReason,
  ScopedAlternativeCandidate,
} from '../model/types'
import { isCellEditable, parseCellKey } from '@/features/edit-timetable-cell'
import {
  analyzeMultiReplacementImpact,
  analyzeReplacementImpact,
} from '@/features/analyze-schedule-impact'
import { validateScheduleChange } from '@/features/validate-schedule-change'
import { DAY_LABELS } from '@/shared/lib/constants'
import {
  compareWeekTag,
  computeWeekTagFromTimestamp,
  getWeekDateRange,
  listWeekTagsBetween,
  shiftWeekTag,
} from '@/shared/lib/week-tag'

export interface ResolvedReplacementScope {
  targetWeeks: Array<WeekTag>
  appliedScope: AppliedScope | null
  issue:
    | {
        reason: ScopeBlockingReason
        message: string
      }
    | null
}

export interface ApplyCandidateResult {
  ok: boolean
  cells: Array<TimetableCell>
  issue?: {
    reason: ScopeBlockingReason
    message: string
  }
}

interface BuildScopedAlternativesContext {
  schoolConfig: SchoolConfig
  constraintPolicy: ConstraintPolicy
  teacherPolicies: Array<TeacherPolicy>
  fixedEvents: Array<FixedEvent>
  teachers: Array<Teacher>
  subjects: Array<Subject>
  searchConfig: ReplacementSearchConfig
  academicCalendarEvents: Array<AcademicCalendarEvent>
}

export function resolveReplacementScopeTargetWeeks(input: {
  selectedWeek: WeekTag
  scopeState: ReplacementApplyScopeState
  academicCalendarEvents: Array<AcademicCalendarEvent>
}): ResolvedReplacementScope {
  const { selectedWeek, scopeState, academicCalendarEvents } = input

  if (scopeState.type === 'THIS_WEEK') {
    return {
      targetWeeks: [selectedWeek],
      appliedScope: {
        type: 'THIS_WEEK',
        fromWeek: selectedWeek,
        toWeek: null,
      },
      issue: null,
    }
  }

  if (scopeState.type === 'FROM_NEXT_WEEK') {
    const fromWeek = shiftWeekTag(selectedWeek, 1)
    const semesterEndWeek = findSemesterEndWeekTag(academicCalendarEvents)

    if (semesterEndWeek === null) {
      return {
        targetWeeks: [],
        appliedScope: null,
        issue: {
          reason: 'MISSING_SEMESTER_END',
          message:
            '학사일정에 SEMESTER_END가 없어 "다음 주부터 학기말" 범위를 계산할 수 없습니다.',
        },
      }
    }

    if (compareWeekTag(fromWeek, semesterEndWeek) > 0) {
      return {
        targetWeeks: [],
        appliedScope: null,
        issue: {
          reason: 'INVALID_RANGE',
          message: '다음 주가 학기말 이후입니다. 적용 범위를 다시 확인해 주세요.',
        },
      }
    }

    return {
      targetWeeks: listWeekTagsBetween(fromWeek, semesterEndWeek),
      appliedScope: {
        type: 'FROM_NEXT_WEEK',
        fromWeek,
        toWeek: null,
      },
      issue: null,
    }
  }

  if (!scopeState.fromWeek || !scopeState.toWeek) {
    return {
      targetWeeks: [],
      appliedScope: null,
      issue: {
        reason: 'INVALID_RANGE',
        message: '특정 주차 범위는 시작 주차와 종료 주차를 모두 선택해야 합니다.',
      },
    }
  }

  if (compareWeekTag(scopeState.fromWeek, scopeState.toWeek) > 0) {
    return {
      targetWeeks: [],
      appliedScope: null,
      issue: {
        reason: 'INVALID_RANGE',
        message: '시작 주차가 종료 주차보다 늦을 수 없습니다.',
      },
    }
  }

  return {
    targetWeeks: listWeekTagsBetween(scopeState.fromWeek, scopeState.toWeek),
    appliedScope: {
      type: 'RANGE',
      fromWeek: scopeState.fromWeek,
      toWeek: scopeState.toWeek,
    },
    issue: null,
  }
}

export function applySingleCandidateToWeekCells(input: {
  cells: Array<TimetableCell>
  selectedCandidate: ReplacementCandidate
}): ApplyCandidateResult {
  const { cells, selectedCandidate } = input
  const sourceCell = getCellByKey(cells, selectedCandidate.sourceCellKey)

  if (!sourceCell) {
    return {
      ok: false,
      cells,
      issue: {
        reason: 'SOURCE_CELL_NOT_FOUND',
        message: '해당 주차에서 교체 원본 셀을 찾을 수 없습니다.',
      },
    }
  }

  if (!isCellEditable(sourceCell)) {
    return {
      ok: false,
      cells,
      issue: {
        reason: 'SOURCE_CELL_NOT_EDITABLE',
        message: '해당 주차의 원본 셀이 고정/잠금 상태라 교체할 수 없습니다.',
      },
    }
  }

  if (selectedCandidate.type === 'SUBSTITUTE') {
    const sourcePos = parseCellKey(selectedCandidate.sourceCellKey)
    return {
      ok: true,
      cells: cells.map((cell) => {
        if (!isSameCellPosition(cell, sourcePos)) {
          return cell
        }
        return {
          ...cell,
          teacherId: selectedCandidate.resultTargetCell.teacherId,
          status: 'TEMP_MODIFIED',
        }
      }),
    }
  }

  if (selectedCandidate.type === 'SWAP') {
    const targetCell = getCellByKey(cells, selectedCandidate.targetCellKey)
    if (!targetCell) {
      return {
        ok: false,
        cells,
        issue: {
          reason: 'TARGET_CELL_NOT_FOUND',
          message: '해당 주차에서 교체 대상 셀을 찾을 수 없습니다.',
        },
      }
    }

    if (!isCellEditable(targetCell)) {
      return {
        ok: false,
        cells,
        issue: {
          reason: 'TARGET_CELL_NOT_EDITABLE',
          message: '해당 주차의 교체 대상 셀이 고정/잠금 상태입니다.',
        },
      }
    }

    const sourcePos = parseCellKey(selectedCandidate.sourceCellKey)
    const targetPos = parseCellKey(selectedCandidate.targetCellKey)

    const swappedSourceCell: TimetableCell = {
      ...targetCell,
      grade: sourcePos.grade,
      classNumber: sourcePos.classNumber,
      day: sourcePos.day,
      period: sourcePos.period,
      status: 'TEMP_MODIFIED',
    }

    const swappedTargetCell: TimetableCell = {
      ...sourceCell,
      grade: targetPos.grade,
      classNumber: targetPos.classNumber,
      day: targetPos.day,
      period: targetPos.period,
      status: 'TEMP_MODIFIED',
    }

    return {
      ok: true,
      cells: cells.map((cell) => {
        if (isSameCellPosition(cell, sourcePos)) {
          return swappedSourceCell
        }
        if (isSameCellPosition(cell, targetPos)) {
          return swappedTargetCell
        }
        return cell
      }),
    }
  }

  const targetCell = getCellByKey(cells, selectedCandidate.targetCellKey)
  if (targetCell) {
    return {
      ok: false,
      cells,
      issue: {
        reason: 'TARGET_SLOT_OCCUPIED',
        message: '해당 주차에서 이동 대상 슬롯이 이미 점유되어 있습니다.',
      },
    }
  }

  const sourcePos = parseCellKey(selectedCandidate.sourceCellKey)
  const targetPos = parseCellKey(selectedCandidate.targetCellKey)

  const movedTargetCell: TimetableCell = {
    ...sourceCell,
    grade: targetPos.grade,
    classNumber: targetPos.classNumber,
    day: targetPos.day,
    period: targetPos.period,
    status: 'TEMP_MODIFIED',
  }

  return {
    ok: true,
    cells: cells
      .filter((cell) => !isSameCellPosition(cell, sourcePos))
      .concat(movedTargetCell),
  }
}

export function applyMultiCandidateToWeekCells(input: {
  cells: Array<TimetableCell>
  selectedCandidate: MultiReplacementCandidate
}): ApplyCandidateResult {
  let workingCells = [...input.cells]

  for (const source of input.selectedCandidate.sources) {
    const result = applySingleCandidateToWeekCells({
      cells: workingCells,
      selectedCandidate: source.candidate,
    })

    if (!result.ok) {
      return result
    }

    workingCells = result.cells
  }

  return {
    ok: true,
    cells: workingCells,
  }
}

export function filterAcademicCalendarEventsForWeek(input: {
  events: Array<AcademicCalendarEvent>
  weekTag: WeekTag
  activeDays: Array<SchoolConfig['activeDays'][number]>
}): Array<AcademicCalendarEvent> {
  const { startDate, endDate } = getWeekDateRange(input.weekTag, input.activeDays)

  return input.events.filter((event) => {
    if (event.startDate > endDate) {
      return false
    }
    if (event.endDate < startDate) {
      return false
    }
    return true
  })
}

export function buildScopedSingleAlternatives(input: {
  snapshot: TimetableSnapshot
  cells: Array<TimetableCell>
  selectedCandidate: ReplacementCandidate
  context: BuildScopedAlternativesContext
}): Array<ScopedAlternativeCandidate> {
  const sourceCell = getCellByKey(input.cells, input.selectedCandidate.sourceCellKey)
  if (!sourceCell || !isCellEditable(sourceCell)) {
    return []
  }

  const finderContext = makeFinderContext({
    weekTag: input.snapshot.weekTag,
    context: input.context,
  })

  const result =
    input.context.searchConfig.searchMode === 'SUBSTITUTE'
      ? findSubstituteCandidates({
          sourceCellKey: input.selectedCandidate.sourceCellKey,
          sourceCell,
          allCells: input.cells,
          config: {
            ...input.context.searchConfig,
            maxCandidates: 3,
          },
          ctx: finderContext,
          substituteLoadByTeacher: new Map(),
        })
      : findReplacementCandidates(
          input.selectedCandidate.sourceCellKey,
          sourceCell,
          input.cells,
          {
            ...input.context.searchConfig,
            maxCandidates: 3,
          },
          finderContext,
        )

  const alternatives = result.candidates.slice(0, 3)

  return alternatives.map((candidate) => {
    const report = analyzeReplacementImpact({
      snapshot: input.snapshot,
      beforeCells: input.cells,
      selectedCandidate: candidate,
      allCandidates: alternatives,
      teachers: input.context.teachers,
    })

    return {
      id: candidate.id,
      weekTag: input.snapshot.weekTag,
      label: toSingleAlternativeLabel(candidate),
      riskLevel: report.riskLevel,
      scoreDelta: candidate.ranking.scoreDelta,
      violationCount: candidate.ranking.violationCount,
    }
  })
}

export function buildScopedMultiAlternatives(input: {
  snapshot: TimetableSnapshot
  cells: Array<TimetableCell>
  selectedCandidate: MultiReplacementCandidate
  context: BuildScopedAlternativesContext
}): Array<ScopedAlternativeCandidate> {
  const sourceKeys = input.selectedCandidate.sources.map((source) => source.sourceKey)
  for (const sourceKey of sourceKeys) {
    const sourceCell = getCellByKey(input.cells, sourceKey)
    if (!sourceCell || !isCellEditable(sourceCell)) {
      return []
    }
  }

  const finderContext = makeFinderContext({
    weekTag: input.snapshot.weekTag,
    context: input.context,
  })

  const result = findMultiReplacementCandidates(
    sourceKeys,
    input.cells,
    {
      ...input.context.searchConfig,
      maxCandidates: 3,
    },
    finderContext,
  )

  const alternatives = result.candidates.slice(0, 3)

  return alternatives.map((candidate) => {
    const report = analyzeMultiReplacementImpact({
      snapshot: input.snapshot,
      beforeCells: input.cells,
      selectedCandidate: candidate,
      allCandidates: alternatives,
      teachers: input.context.teachers,
    })

    return {
      id: candidate.id,
      weekTag: input.snapshot.weekTag,
      label: toMultiAlternativeLabel(candidate),
      riskLevel: report.riskLevel,
      scoreDelta: candidate.combinedRanking.combinedScoreDelta,
      violationCount: candidate.combinedRanking.totalViolationCount,
    }
  })
}

export function validateWeekCandidateResult(input: {
  cells: Array<TimetableCell>
  snapshot: TimetableSnapshot
  schoolConfig: SchoolConfig
  constraintPolicy: ConstraintPolicy
  teachers: Array<Teacher>
  subjects: Array<Subject>
  academicCalendarEvents: Array<AcademicCalendarEvent>
}): Array<ValidationViolation> {
  return validateScheduleChange({
    cells: input.cells,
    constraintPolicy: input.constraintPolicy,
    schoolConfig: input.schoolConfig,
    teachers: input.teachers,
    subjects: input.subjects,
    weekTag: input.snapshot.weekTag,
    academicCalendarEvents: input.academicCalendarEvents,
  })
}

function makeFinderContext(input: {
  weekTag: WeekTag
  context: BuildScopedAlternativesContext
}) {
  return {
    schoolConfig: input.context.schoolConfig,
    constraintPolicy: input.context.constraintPolicy,
    teacherPolicies: input.context.teacherPolicies,
    fixedEvents: input.context.fixedEvents,
    teachers: input.context.teachers,
    subjects: input.context.subjects,
    weekTag: input.weekTag,
    academicCalendarEvents: filterAcademicCalendarEventsForWeek({
      events: input.context.academicCalendarEvents,
      weekTag: input.weekTag,
      activeDays: input.context.schoolConfig.activeDays,
    }),
  }
}

function getCellByKey(cells: Array<TimetableCell>, key: CellKey): TimetableCell | undefined {
  const target = parseCellKey(key)
  return cells.find((cell) => isSameCellPosition(cell, target))
}

function isSameCellPosition(
  cell: TimetableCell,
  target: { grade: number; classNumber: number; day: TimetableCell['day']; period: number },
): boolean {
  return (
    cell.grade === target.grade &&
    cell.classNumber === target.classNumber &&
    cell.day === target.day &&
    cell.period === target.period
  )
}

function toSingleAlternativeLabel(candidate: ReplacementCandidate): string {
  const target = parseCellKey(candidate.targetCellKey)
  const typeLabel =
    candidate.type === 'SWAP'
      ? '교환'
      : candidate.type === 'SUBSTITUTE'
        ? '대강'
        : '이동'
  return `${DAY_LABELS[target.day]} ${target.period}교시 ${typeLabel}`
}

function toMultiAlternativeLabel(candidate: MultiReplacementCandidate): string {
  const slots = candidate.sources
    .map((source) => {
      const target = parseCellKey(source.candidate.targetCellKey)
      return `${DAY_LABELS[target.day]} ${target.period}교시`
    })
    .join(', ')

  return `다중 교체 (${slots})`
}

function findSemesterEndWeekTag(
  academicCalendarEvents: Array<AcademicCalendarEvent>,
): WeekTag | null {
  const semesterEnd = [...academicCalendarEvents]
    .filter((event) => event.eventType === 'SEMESTER_END')
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .at(0)

  if (semesterEnd === undefined) {
    return null
  }

  const timestamp = Date.parse(`${semesterEnd.endDate}T00:00:00.000Z`)
  if (Number.isNaN(timestamp)) {
    return null
  }

  return computeWeekTagFromTimestamp(timestamp)
}

export function riskPriority(riskLevel: ImpactRiskLevel): number {
  if (riskLevel === 'HIGH') {
    return 3
  }
  if (riskLevel === 'MEDIUM') {
    return 2
  }
  return 1
}
