import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell } from '@/entities/timetable'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { DayOfWeek } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'
import type { CandidateRanking } from '../model/types'
import { validateScheduleChange } from '@/features/validate-schedule-change'

interface SubstituteRankingContext {
  allCells: Array<TimetableCell>
  afterCells: Array<TimetableCell>
  constraintPolicy: ConstraintPolicy
  teacherPolicies: Array<TeacherPolicy>
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
  weekTag: WeekTag
  academicCalendarEvents: Array<AcademicCalendarEvent>
  substituteTeacher: Teacher
  substituteLoadByTeacher: Map<string, number>
  fairnessWindowWeeks: number
}

export function rankSubstituteCandidate(
  ctx: SubstituteRankingContext,
): CandidateRanking {
  const violations = validateScheduleChange({
    cells: ctx.afterCells,
    constraintPolicy: ctx.constraintPolicy,
    schoolConfig: ctx.schoolConfig,
    teachers: ctx.teachers,
    subjects: ctx.subjects,
    weekTag: ctx.weekTag,
    academicCalendarEvents: ctx.academicCalendarEvents,
  })
  const violationCount = violations.filter((v) => v.severity === 'error').length

  const substituteCount = ctx.substituteLoadByTeacher.get(ctx.substituteTeacher.id) ?? 0
  const maxLoad = Math.max(0, ...ctx.substituteLoadByTeacher.values())
  const fairnessScore =
    maxLoad === 0
      ? 100
      : Math.round(
          Math.max(0, 100 - (substituteCount / (maxLoad + 1)) * 100),
        )

  const subjectFitScore = 100
  const idleMinimizationScore = computeIdleScoreForTeacher(
    ctx.afterCells,
    ctx.schoolConfig.activeDays,
    ctx.schoolConfig.periodsPerDay,
    ctx.substituteTeacher.id,
  )

  const totalRank =
    subjectFitScore * 0.55 +
    fairnessScore * 0.3 +
    idleMinimizationScore * 0.15 -
    violationCount * 1000

  const reasons = [
    '과목 적합',
    `최근 ${ctx.fairnessWindowWeeks}주 대강 ${substituteCount}회`,
    '해당 시간 공강',
  ]

  return {
    violationCount,
    violations,
    scoreDelta: 0,
    similarityScore: 100,
    idleMinimizationScore,
    fairnessScore,
    candidateReasons: reasons,
    totalRank: Math.round(totalRank * 100) / 100,
  }
}

function computeIdleScoreForTeacher(
  cells: Array<TimetableCell>,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
  teacherId: string,
): number {
  let totalIdle = 0
  let totalSlots = 0

  for (const day of activeDays) {
    const periods = cells
      .filter((cell) => cell.teacherId === teacherId && cell.day === day)
      .map((cell) => cell.period)
      .sort((a, b) => a - b)

    if (periods.length < 2) {
      continue
    }

    const first = periods[0]
    const last = periods[periods.length - 1]
    const span = last - first + 1
    const idle = span - periods.length

    totalIdle += idle
    totalSlots += periodsPerDay
  }

  if (totalSlots === 0) {
    return 100
  }

  return Math.round(Math.max(0, 100 - (totalIdle / totalSlots) * 400))
}
