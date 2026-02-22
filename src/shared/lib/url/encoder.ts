import {
  CELL_STATUS_TO_INDEX,
  DAY_TO_INDEX,
  SHARE_SCHEMA_VERSION,
  TIME_PREF_TO_INDEX,
  TRACK_TO_INDEX,
} from './constants'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { CompactCell, SharePayload } from './types'

export function buildSharePayload(
  schoolConfig: SchoolConfig,
  subjects: Array<Subject>,
  teachers: Array<Teacher>,
  snapshot: TimetableSnapshot,
  constraintPolicy: ConstraintPolicy,
  teacherPolicies: Array<TeacherPolicy>,
): SharePayload {
  const subjectIdToIndex = new Map(subjects.map((s, i) => [s.id, i]))
  const teacherIdToIndex = new Map(teachers.map((t, i) => [t.id, i]))

  const activeDayIndices = schoolConfig.activeDays.map((d) => DAY_TO_INDEX[d])

  return {
    v: SHARE_SCHEMA_VERSION,
    meta: {
      score: snapshot.score,
      genMs: snapshot.generationTimeMs,
      ts: snapshot.createdAt,
    },
    school: {
      g: schoolConfig.gradeCount,
      c: schoolConfig.classCountByGrade,
      d: activeDayIndices,
      p: schoolConfig.periodsPerDay,
    },
    subjects: subjects.map((s) => ({
      n: s.name,
      a: s.abbreviation,
      t: TRACK_TO_INDEX[s.track],
    })),
    teachers: teachers.map((t) => ({
      n: t.name,
      s: t.subjectIds.map((id) => subjectIdToIndex.get(id) ?? -1),
      h: t.baseHoursPerWeek,
      ...(t.homeroom
        ? {
            hr: [t.homeroom.grade, t.homeroom.classNumber] as [number, number],
          }
        : {}),
      ca: t.classAssignments.map(
        (ca) =>
          [ca.grade, ca.classNumber, ca.hoursPerWeek] as [
            number,
            number,
            number,
          ],
      ),
    })),
    grid: snapshot.cells.map((cell) =>
      encodeCell(
        cell,
        schoolConfig,
        activeDayIndices,
        teacherIdToIndex,
        subjectIdToIndex,
      ),
    ),
    policy: {
      sc: constraintPolicy.studentMaxConsecutiveSameSubject,
      tc: constraintPolicy.teacherMaxConsecutiveHours,
      td: constraintPolicy.teacherMaxDailyHours,
    },
    teacherPolicies: teacherPolicies.map((tp) => ({
      ti: teacherIdToIndex.get(tp.teacherId) ?? -1,
      av: tp.avoidanceSlots.map(
        (slot) => [DAY_TO_INDEX[slot.day], slot.period] as [number, number],
      ),
      tp: TIME_PREF_TO_INDEX[tp.timePreference],
      mco: tp.maxConsecutiveHoursOverride,
      mdo: tp.maxDailyHoursOverride,
    })),
  }
}

function encodeCell(
  cell: TimetableCell,
  schoolConfig: SchoolConfig,
  activeDayIndices: Array<number>,
  teacherIdToIndex: Map<string, number>,
  subjectIdToIndex: Map<string, number>,
): CompactCell {
  const flatIndex = computeFlatIndex(
    cell.grade,
    cell.classNumber,
    cell.day,
    cell.period,
    schoolConfig,
    activeDayIndices,
  )

  const statusIndex = CELL_STATUS_TO_INDEX[cell.status]
  const flags = (statusIndex << 1) | (cell.isFixed ? 1 : 0)

  return {
    i: flatIndex,
    t: teacherIdToIndex.get(cell.teacherId) ?? -1,
    s: subjectIdToIndex.get(cell.subjectId) ?? -1,
    f: flags,
  }
}

export function computeFlatIndex(
  grade: number,
  classNumber: number,
  day: TimetableCell['day'],
  period: number,
  schoolConfig: SchoolConfig,
  activeDayIndices: Array<number>,
): number {
  const dayIndex = DAY_TO_INDEX[day]
  const dayPositionInActive = activeDayIndices.indexOf(dayIndex)

  const maxClassPerGrade = Math.max(
    ...Object.values(schoolConfig.classCountByGrade),
  )
  const slotsPerClass = activeDayIndices.length * schoolConfig.periodsPerDay

  return (
    ((grade - 1) * maxClassPerGrade + (classNumber - 1)) * slotsPerClass +
    dayPositionInActive * schoolConfig.periodsPerDay +
    (period - 1)
  )
}
