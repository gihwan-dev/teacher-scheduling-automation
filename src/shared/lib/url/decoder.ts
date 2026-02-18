import {
  INDEX_TO_CELL_STATUS,
  INDEX_TO_DAY,
  INDEX_TO_SUBJECT_TYPE,
  INDEX_TO_TIME_PREF,
  INDEX_TO_TRACK,
} from './constants'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { SharePayload } from './types'
import type { DayOfWeek } from '@/shared/lib/types'
import { generateId } from '@/shared/lib/id'
import { DAYS_OF_WEEK } from '@/shared/lib/constants'

export interface RestoredState {
  schoolConfig: SchoolConfig
  subjects: Array<Subject>
  teachers: Array<Teacher>
  snapshot: TimetableSnapshot
  constraintPolicy: ConstraintPolicy
  teacherPolicies: Array<TeacherPolicy>
}

export function restoreFromPayload(payload: SharePayload): RestoredState {
  const now = new Date().toISOString()
  const activeDays: Array<DayOfWeek> = payload.school.d.map(
    (i) => INDEX_TO_DAY[i],
  )
  const periodsPerDay =
    payload.school.p ??
    Math.max(
      ...(payload.school.pb?.map(([, periods]) => periods) ?? [7]),
    )
  const periodsByDay = DAYS_OF_WEEK.reduce(
    (acc, day) => {
      acc[day] = activeDays.includes(day) ? periodsPerDay : 1
      return acc
    },
    {} as Record<DayOfWeek, number>,
  )
  if (payload.school.pb) {
    for (const [dayIndex, periods] of payload.school.pb) {
      const day = INDEX_TO_DAY[dayIndex]
      periodsByDay[day] = periods
    }
  }

  // Subjects: 새 UUID 생성
  const subjects: Array<Subject> = payload.subjects.map((s) => ({
    id: generateId(),
    name: s.n,
    abbreviation: s.a,
    track: INDEX_TO_TRACK[s.t],
    createdAt: now,
    updatedAt: now,
  }))
  const subjectIds = subjects.map((s) => s.id)

  // Teachers: 새 UUID 생성, subject 참조 인덱스→ID
  const teachers: Array<Teacher> = payload.teachers.map((t) => {
    const legacySubjectIds = (t.s ?? [])
      .map((idx) => subjectIds[idx])
      .filter((subjectId): subjectId is string => Boolean(subjectId))

    const hasAmbiguousLegacySubjects =
      !t.as?.length && legacySubjectIds.length > 1 && (t.ca?.length ?? 0) > 0

    const assignments =
      t.as && t.as.length > 0
        ? t.as
            .map(([subjectIndex, subjectTypeIndex, grade, classNumber, hours]) => {
              const subjectId = subjectIds[subjectIndex]
              if (!subjectId) return null
              return {
                id: generateId(),
                subjectId,
                subjectType: INDEX_TO_SUBJECT_TYPE[subjectTypeIndex] ?? 'CLASS',
                grade: grade > 0 ? grade : null,
                classNumber: classNumber > 0 ? classNumber : null,
                hoursPerWeek: hours,
              }
            })
            .filter(
              (assignment): assignment is NonNullable<typeof assignment> =>
                assignment !== null,
            )
        : hasAmbiguousLegacySubjects
          ? []
          : (() => {
              const defaultSubjectId = legacySubjectIds[0] ?? subjectIds[0]
              return (t.ca ?? []).map(([grade, classNumber, hoursPerWeek]) => ({
                id: generateId(),
                subjectId: defaultSubjectId,
                subjectType: 'CLASS' as const,
                grade,
                classNumber,
                hoursPerWeek,
              }))
            })()

    const teacherSubjectIds =
      legacySubjectIds.length > 0
        ? legacySubjectIds
        : [...new Set(assignments.map((assignment) => assignment.subjectId))]

    const legacyClassAssignments =
      !t.as?.length && t.ca && t.ca.length > 0
        ? t.ca.map(([grade, classNumber, hoursPerWeek]) => ({
            grade,
            classNumber,
            hoursPerWeek,
          }))
        : assignments
            .filter(
              (assignment) =>
                assignment.subjectType === 'CLASS' &&
                assignment.grade !== null &&
                assignment.classNumber !== null,
            )
            .map((assignment) => ({
              grade: assignment.grade!,
              classNumber: assignment.classNumber!,
              hoursPerWeek: assignment.hoursPerWeek,
            }))

    return {
      id: generateId(),
      name: t.n,
      subjectIds: teacherSubjectIds,
      baseHoursPerWeek: t.h,
      assignments,
      classAssignments: legacyClassAssignments,
      createdAt: now,
      updatedAt: now,
    }
  })
  const teacherIds = teachers.map((t) => t.id)

  // SchoolConfig
  const schoolConfigId = generateId()
  const schoolConfig: SchoolConfig = {
    id: schoolConfigId,
    gradeCount: payload.school.g,
    classCountByGrade: payload.school.c,
    activeDays,
    periodsByDay,
    periodsPerDay,
    createdAt: now,
    updatedAt: now,
  }

  // Grid → TimetableCell
  const maxClassPerGrade = Math.max(...Object.values(payload.school.c))
  const slotsPerClass = activeDays.length * periodsPerDay

  const cells: Array<TimetableCell> = payload.grid.map((compact) => {
    const { grade, classNumber, day, period } = decodeFlatIndex(
      compact.i,
      maxClassPerGrade,
      slotsPerClass,
      activeDays,
      periodsPerDay,
    )

    const isFixed = (compact.f & 1) === 1
    const statusIndex = compact.f >> 1
    const status = INDEX_TO_CELL_STATUS[statusIndex] ?? 'BASE'

    return {
      teacherId: teacherIds[compact.t],
      subjectId: subjectIds[compact.s],
      subjectType: INDEX_TO_SUBJECT_TYPE[compact.st ?? 0] ?? 'CLASS',
      grade,
      classNumber,
      day,
      period,
      isFixed,
      status,
    }
  })

  const snapshot: TimetableSnapshot = {
    id: generateId(),
    schoolConfigId,
    cells,
    score: payload.meta.score,
    generationTimeMs: payload.meta.genMs,
    createdAt: payload.meta.ts,
  }

  // ConstraintPolicy
  const constraintPolicy: ConstraintPolicy = {
    id: generateId(),
    studentMaxConsecutiveSameSubject: payload.policy.sc,
    teacherMaxConsecutiveHours: payload.policy.tc,
    teacherMaxDailyHours: payload.policy.td,
    createdAt: now,
    updatedAt: now,
  }

  // TeacherPolicies
  const teacherPolicies: Array<TeacherPolicy> = payload.teacherPolicies.map(
    (tp) => ({
      id: generateId(),
      teacherId: teacherIds[tp.ti],
      avoidanceSlots: tp.av.map(([dayIdx, period]) => ({
        day: INDEX_TO_DAY[dayIdx],
        period,
      })),
      timePreference: INDEX_TO_TIME_PREF[tp.tp],
      maxConsecutiveHoursOverride: tp.mco,
      maxDailyHoursOverride: tp.mdo,
      createdAt: now,
      updatedAt: now,
    }),
  )

  return {
    schoolConfig,
    subjects,
    teachers,
    snapshot,
    constraintPolicy,
    teacherPolicies,
  }
}

function decodeFlatIndex(
  flatIndex: number,
  maxClassPerGrade: number,
  slotsPerClass: number,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
): { grade: number; classNumber: number; day: DayOfWeek; period: number } {
  const gradeClassIndex = Math.floor(flatIndex / slotsPerClass)
  const slotRemainder = flatIndex % slotsPerClass

  const grade = Math.floor(gradeClassIndex / maxClassPerGrade) + 1
  const classNumber = (gradeClassIndex % maxClassPerGrade) + 1

  const dayPosition = Math.floor(slotRemainder / periodsPerDay)
  const period = (slotRemainder % periodsPerDay) + 1
  const day = activeDays[dayPosition]

  return { grade, classNumber, day, period }
}
