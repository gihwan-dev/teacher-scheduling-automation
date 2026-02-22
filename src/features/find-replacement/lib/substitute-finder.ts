import { rankSubstituteCandidate } from './substitute-ranker'
import type { CellKey, TimetableCell } from '@/entities/timetable'
import type { WeekTag } from '@/shared/lib/week-tag'
import type {
  ReplacementCandidate,
  ReplacementSearchConfig,
  ReplacementSearchResult,
} from '../model/types'
import type { ReplacementFinderContext } from './replacement-finder'
import { isCellEditable } from '@/features/edit-timetable-cell/lib/edit-validator'
import {
  TimetableGrid,
  buildBlockedSlots,
  expandGradeBlockedSlots,
  isPlacementValid,
} from '@/features/generate-timetable'
import { buildAcademicCalendarBlockedSlots } from '@/features/validate-schedule-change'
import { generateId } from '@/shared/lib/id'
import { shiftWeekTag } from '@/shared/lib/week-tag'

interface SubstituteFinderInput {
  sourceCellKey: CellKey
  sourceCell: TimetableCell
  allCells: Array<TimetableCell>
  config: ReplacementSearchConfig
  ctx: ReplacementFinderContext
  substituteLoadByTeacher: Map<string, number>
}

export function findSubstituteCandidates(
  input: SubstituteFinderInput,
): ReplacementSearchResult {
  const startTime = performance.now()
  const { sourceCell, sourceCellKey, allCells, config, ctx } = input

  if (sourceCell.isFixed || sourceCell.status === 'LOCKED') {
    return emptyResult(startTime)
  }

  const blockedSlots = buildAllBlockedSlots(ctx)
  const grid = new TimetableGrid()
  for (const cell of allCells) {
    // 소스 셀은 대강 배정용으로 잠시 비운다.
    if (
      cell.grade === sourceCell.grade &&
      cell.classNumber === sourceCell.classNumber &&
      cell.day === sourceCell.day &&
      cell.period === sourceCell.period
    ) {
      continue
    }
    grid.placeCell(cell)
  }

  const candidates: Array<ReplacementCandidate> = []

  for (const teacher of ctx.teachers) {
    if (teacher.id === sourceCell.teacherId) {
      continue
    }

    if (!teacher.subjectIds.includes(sourceCell.subjectId)) {
      continue
    }

    if (
      config.excludeHomeroomTeachers &&
      teacher.homeroom?.grade === sourceCell.grade &&
      teacher.homeroom.classNumber === sourceCell.classNumber
    ) {
      continue
    }

    const alreadyAssigned = allCells.some(
      (cell) =>
        cell.teacherId === teacher.id &&
        cell.day === sourceCell.day &&
        cell.period === sourceCell.period,
    )
    if (alreadyAssigned) {
      continue
    }

    const unit = {
      teacherId: teacher.id,
      subjectId: sourceCell.subjectId,
      grade: sourceCell.grade,
      classNumber: sourceCell.classNumber,
      totalHours: 1,
      remainingHours: 1,
    }

    const valid = isPlacementValid(
      grid,
      unit,
      sourceCell.day,
      sourceCell.period,
      ctx.constraintPolicy,
      blockedSlots,
      ctx.teacherPolicies,
    )

    if (!valid && !config.includeViolating) {
      continue
    }

    const resultTargetCell: TimetableCell = {
      ...sourceCell,
      teacherId: teacher.id,
      status: 'TEMP_MODIFIED',
    }

    const afterCells = allCells.map((cell) => {
      if (
        cell.grade === sourceCell.grade &&
        cell.classNumber === sourceCell.classNumber &&
        cell.day === sourceCell.day &&
        cell.period === sourceCell.period
      ) {
        return resultTargetCell
      }
      return cell
    })

    const ranking = rankSubstituteCandidate({
      allCells,
      afterCells,
      constraintPolicy: ctx.constraintPolicy,
      teacherPolicies: ctx.teacherPolicies,
      schoolConfig: ctx.schoolConfig,
      teachers: ctx.teachers,
      subjects: ctx.subjects,
      weekTag: ctx.weekTag,
      academicCalendarEvents: ctx.academicCalendarEvents,
      substituteTeacher: teacher,
      substituteLoadByTeacher: input.substituteLoadByTeacher,
      fairnessWindowWeeks: config.fairnessWindowWeeks,
    })

    if (!config.includeViolating && ranking.violationCount > 0) {
      continue
    }

    candidates.push({
      id: generateId(),
      type: 'SUBSTITUTE',
      sourceCell,
      sourceCellKey,
      targetCellKey: sourceCellKey,
      targetCell: sourceCell,
      resultSourceCell: sourceCell,
      resultTargetCell,
      substituteTeacherId: teacher.id,
      ranking,
    })
  }

  candidates.sort((a, b) => b.ranking.totalRank - a.ranking.totalRank)
  const limitedCandidates = candidates.slice(0, config.maxCandidates)

  return {
    candidates: limitedCandidates,
    stats: {
      totalExamined: candidates.length,
      validCandidates: limitedCandidates.length,
      searchTimeMs: Math.round(performance.now() - startTime),
    },
    relaxationSuggestions: [],
  }
}

function buildAllBlockedSlots(ctx: ReplacementFinderContext): Set<string> {
  let blockedSlots = buildBlockedSlots(ctx.fixedEvents, ctx.teacherPolicies)
  blockedSlots = expandGradeBlockedSlots(
    blockedSlots,
    ctx.schoolConfig.classCountByGrade,
  )

  const calendarBlockedSlots = buildAcademicCalendarBlockedSlots({
    schoolConfig: ctx.schoolConfig,
    weekTag: ctx.weekTag,
    academicCalendarEvents: ctx.academicCalendarEvents,
  })
  for (const slotKey of calendarBlockedSlots) {
    blockedSlots.add(slotKey)
  }

  return blockedSlots
}

function emptyResult(startTime: number): ReplacementSearchResult {
  return {
    candidates: [],
    stats: {
      totalExamined: 0,
      validCandidates: 0,
      searchTimeMs: Math.round(performance.now() - startTime),
    },
    relaxationSuggestions: [],
  }
}

export function buildSubstituteLoadByTeacher(input: {
  weekTag: WeekTag
  fairnessWindowWeeks: number
  rows: Array<{ weekTag: WeekTag; substituteTeacherId: string }>
}): Map<string, number> {
  const startYearWeek = shiftWeekTag(
    input.weekTag,
    -(input.fairnessWindowWeeks - 1),
  )
  const result = new Map<string, number>()

  for (const row of input.rows) {
    if (row.weekTag < startYearWeek || row.weekTag > input.weekTag) {
      continue
    }
    result.set(
      row.substituteTeacherId,
      (result.get(row.substituteTeacherId) ?? 0) + 1,
    )
  }

  return result
}

export function isSubstituteSourceEditable(cell: TimetableCell): boolean {
  return isCellEditable(cell)
}
