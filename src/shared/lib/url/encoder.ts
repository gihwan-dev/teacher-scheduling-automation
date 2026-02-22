import {
  CELL_STATUS_TO_INDEX,
  DAY_TO_INDEX,
  SHARE_SCHEMA_VERSION,
  SUBJECT_TYPE_TO_INDEX,
  TIME_PREF_TO_INDEX,
  TRACK_TO_INDEX,
} from './constants'
import type { CompactCell, SharePayload } from './types'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { Subject } from '@/entities/subject'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import type {SchoolConfig} from '@/entities/school';
import type {Teacher} from '@/entities/teacher';
import {  getTeacherAssignments } from '@/entities/teacher'
import {  getDayPeriodCount } from '@/entities/school'

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
  const periodsPerDay = schoolConfig.periodsPerDay

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
      p: periodsPerDay,
      pb: schoolConfig.activeDays.map((day) => [
        DAY_TO_INDEX[day],
        getDayPeriodCount(schoolConfig, day),
      ]),
    },
    subjects: subjects.map((s) => ({
      n: s.name,
      a: s.abbreviation,
      t: TRACK_TO_INDEX[s.track],
    })),
    teachers: teachers.map((t) => {
      const normalizedAssignments = getTeacherAssignments(t)
      const hasNewAssignments = t.assignments !== undefined
      const hasAmbiguousLegacySubjects = t.subjectIds.length > 1
      const assignmentSource =
        hasNewAssignments || !hasAmbiguousLegacySubjects
          ? normalizedAssignments
          : []

      const subjectIndices = Array.from(
        new Set([
          ...t.subjectIds,
          ...assignmentSource.map((assignment) => assignment.subjectId),
        ]),
      )
        .map((subjectId) => subjectIdToIndex.get(subjectId) ?? -1)
        .filter((index) => index >= 0)

      const classAssignments = hasNewAssignments
        ? assignmentSource
            .filter(
              (assignment) =>
                assignment.subjectType === 'CLASS' &&
                assignment.grade !== null &&
                assignment.classNumber !== null,
            )
            .map(
              (assignment) =>
                [assignment.grade!, assignment.classNumber!, assignment.hoursPerWeek] as [
                  number,
                  number,
                  number,
                ],
            )
        : t.classAssignments.map(
            (assignment) =>
              [assignment.grade, assignment.classNumber, assignment.hoursPerWeek] as [
                number,
                number,
                number,
              ],
          )

      const compactAssignments = assignmentSource
        .map((assignment) => {
          const subjectIndex = subjectIdToIndex.get(assignment.subjectId)
          if (subjectIndex === undefined) return null
          return [
            subjectIndex,
            SUBJECT_TYPE_TO_INDEX[assignment.subjectType],
            assignment.grade ?? 0,
            assignment.classNumber ?? 0,
            assignment.hoursPerWeek,
          ] as [number, number, number, number, number]
        })
        .filter((assignment): assignment is [number, number, number, number, number] => {
          return assignment !== null
        })

      return {
        n: t.name,
        s: subjectIndices,
        h: t.baseHoursPerWeek,
        ...(t.homeroom
          ? {
              hr: [t.homeroom.grade, t.homeroom.classNumber] as [number, number],
            }
          : {}),
        ca: classAssignments,
        as: compactAssignments.length > 0 ? compactAssignments : undefined,
      }
    }),
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
    st: SUBJECT_TYPE_TO_INDEX[cell.subjectType ?? 'CLASS'],
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
  const periodsPerDay = schoolConfig.periodsPerDay
  const slotsPerClass = activeDayIndices.length * periodsPerDay

  return (
    ((grade - 1) * maxClassPerGrade + (classNumber - 1)) * slotsPerClass +
    dayPositionInActive * periodsPerDay +
    (period - 1)
  )
}
