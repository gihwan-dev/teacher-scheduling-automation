import type {
  HourShortagePredictionReport,
  HourShortageRecommendation,
} from '@/entities/impact-analysis'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { SchoolConfig } from '@/entities/school'
import type { Teacher } from '@/entities/teacher'
import type { TimetableSnapshot } from '@/entities/timetable'
import type { DayOfWeek } from '@/shared/lib/types'
import { getTeacherAssignments } from '@/entities/teacher'
import { DAY_LABELS } from '@/shared/lib/constants'
import { buildAcademicCalendarBlockedSlots } from '@/features/validate-schedule-change'

interface PredictHourShortageInput {
  beforeEvents: Array<AcademicCalendarEvent>
  afterEvents: Array<AcademicCalendarEvent>
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  snapshot: TimetableSnapshot
}

export function predictHourShortageFromCalendarChange(
  input: PredictHourShortageInput,
): HourShortagePredictionReport {
  const { beforeEvents, afterEvents, schoolConfig, teachers, snapshot } = input
  const totalSlotsPerClass =
    schoolConfig.activeDays.length * schoolConfig.periodsPerDay
  const requiredHoursByClass = buildRequiredHoursByClass(teachers)

  const beforeBlocked = buildAcademicCalendarBlockedSlots({
    schoolConfig,
    weekTag: snapshot.weekTag,
    academicCalendarEvents: beforeEvents,
  })
  const afterBlocked = buildAcademicCalendarBlockedSlots({
    schoolConfig,
    weekTag: snapshot.weekTag,
    academicCalendarEvents: afterEvents,
  })

  const shortageByClass = []
  const recommendations: Array<HourShortageRecommendation> = []

  for (let grade = 1; grade <= schoolConfig.gradeCount; grade++) {
    const classCount = schoolConfig.classCountByGrade[grade] ?? 0
    for (let classNumber = 1; classNumber <= classCount; classNumber++) {
      const key = `${grade}-${classNumber}`
      const requiredHours = requiredHoursByClass.get(key) ?? 0
      const beforeBlockedCount = countBlockedSlotsForClass(beforeBlocked, grade, classNumber)
      const afterBlockedCount = countBlockedSlotsForClass(afterBlocked, grade, classNumber)

      const availableBefore = Math.max(0, totalSlotsPerClass - beforeBlockedCount)
      const availableAfter = Math.max(0, totalSlotsPerClass - afterBlockedCount)
      const shortageBefore = Math.max(0, requiredHours - availableBefore)
      const shortageAfter = Math.max(0, requiredHours - availableAfter)
      const deltaShortage = shortageAfter - shortageBefore

      if (deltaShortage <= 0) {
        continue
      }

      shortageByClass.push({
        grade,
        classNumber,
        requiredHours,
        availableBefore,
        availableAfter,
        shortageBefore,
        shortageAfter,
        deltaShortage,
      })

      const fallbackMessage = `${grade}학년 ${classNumber}반: 다음 주 보강 ${deltaShortage}시간 권장`
      const availableRecommendations = findMakeupSlotRecommendations(
        snapshot,
        schoolConfig,
        afterBlocked,
        grade,
        classNumber,
      )

      if (availableRecommendations.length === 0) {
        recommendations.push({
          grade,
          classNumber,
          message: fallbackMessage,
        })
      } else {
        recommendations.push({
          grade,
          classNumber,
          message: `${grade}학년 ${classNumber}반: 현재 주 보강 추천 (${availableRecommendations.join(', ')})`,
        })
      }
    }
  }

  return {
    weekTag: snapshot.weekTag,
    generatedAt: new Date().toISOString(),
    shortageByClass,
    recommendations,
  }
}

function buildRequiredHoursByClass(teachers: Array<Teacher>): Map<string, number> {
  const map = new Map<string, number>()
  for (const teacher of teachers) {
    for (const assignment of getTeacherAssignments(teacher)) {
      if (
        assignment.subjectType !== 'CLASS' ||
        assignment.grade === null ||
        assignment.classNumber === null
      ) {
        continue
      }
      const key = `${assignment.grade}-${assignment.classNumber}`
      map.set(key, (map.get(key) ?? 0) + assignment.hoursPerWeek)
    }
  }
  return map
}

function countBlockedSlotsForClass(
  blocked: Set<string>,
  grade: number,
  classNumber: number,
): number {
  const prefix = `class-${grade}-${classNumber}-`
  let count = 0
  for (const key of blocked) {
    if (key.startsWith(prefix)) {
      count += 1
    }
  }
  return count
}

function findMakeupSlotRecommendations(
  snapshot: TimetableSnapshot,
  schoolConfig: SchoolConfig,
  blockedAfter: Set<string>,
  grade: number,
  classNumber: number,
): Array<string> {
  const occupied = new Set<string>()
  for (const cell of snapshot.cells) {
    if (cell.grade !== grade || cell.classNumber !== classNumber) {
      continue
    }
    occupied.add(`${cell.day}-${cell.period}`)
  }

  const recommendations: Array<string> = []
  for (const day of schoolConfig.activeDays) {
    for (let period = 1; period <= schoolConfig.periodsPerDay; period++) {
      const blockedKey = `class-${grade}-${classNumber}-${day}-${period}`
      const occupiedKey = `${day}-${period}`
      if (blockedAfter.has(blockedKey) || occupied.has(occupiedKey)) {
        continue
      }
      recommendations.push(`${DAY_LABELS[day]} ${period}교시`)
      if (recommendations.length >= 3) {
        return recommendations
      }
    }
  }

  return recommendations
}

export function buildShortenedDayEvent(
  id: string,
  startDate: string,
  endDate: string,
  periodOverride: number,
): AcademicCalendarEvent {
  const now = new Date().toISOString()
  return {
    id,
    eventType: 'SHORTENED_DAY',
    startDate,
    endDate,
    scopeType: 'SCHOOL',
    scopeValue: null,
    periodOverride,
    createdAt: now,
    updatedAt: now,
  }
}

export function buildCellSlotKey(day: DayOfWeek, period: number): string {
  return `${day}-${period}`
}
