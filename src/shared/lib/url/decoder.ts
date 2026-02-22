import {
  INDEX_TO_CELL_STATUS,
  INDEX_TO_DAY,
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
import { computeWeekTagFromIso } from '@/shared/lib/week-tag'

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
  const teachers: Array<Teacher> = payload.teachers.map((t) => ({
    id: generateId(),
    name: t.n,
    subjectIds: t.s.map((idx) => subjectIds[idx]),
    baseHoursPerWeek: t.h,
    classAssignments: t.ca.map(([grade, classNumber, hoursPerWeek]) => ({
      grade,
      classNumber,
      hoursPerWeek,
    })),
    createdAt: now,
    updatedAt: now,
  }))
  const teacherIds = teachers.map((t) => t.id)

  // SchoolConfig
  const schoolConfigId = generateId()
  const schoolConfig: SchoolConfig = {
    id: schoolConfigId,
    gradeCount: payload.school.g,
    classCountByGrade: payload.school.c,
    activeDays,
    periodsPerDay: payload.school.p,
    createdAt: now,
    updatedAt: now,
  }

  // Grid → TimetableCell
  const maxClassPerGrade = Math.max(...Object.values(payload.school.c))
  const slotsPerClass = activeDays.length * payload.school.p

  const cells: Array<TimetableCell> = payload.grid.map((compact) => {
    const { grade, classNumber, day, period } = decodeFlatIndex(
      compact.i,
      maxClassPerGrade,
      slotsPerClass,
      activeDays,
      payload.school.p,
    )

    const isFixed = (compact.f & 1) === 1
    const statusIndex = compact.f >> 1
    const status = INDEX_TO_CELL_STATUS[statusIndex] ?? 'BASE'

    return {
      teacherId: teacherIds[compact.t],
      subjectId: subjectIds[compact.s],
      grade,
      classNumber,
      day,
      period,
      isFixed,
      status,
    }
  })

  const weekTag = computeWeekTagFromIso(payload.meta.ts)
  const snapshot: TimetableSnapshot = {
    id: generateId(),
    schoolConfigId,
    weekTag,
    versionNo: 1,
    baseVersionId: null,
    appliedScope: {
      type: 'THIS_WEEK',
      fromWeek: weekTag,
      toWeek: null,
    },
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
