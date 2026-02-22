import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { SchoolConfig } from '@/entities/school'
import type { ValidationViolation } from '@/entities/schedule-transaction'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import type { ReplacementCandidate } from '@/features/find-replacement/model/types'
import type { WeekTag } from '@/shared/lib/week-tag'
import { db } from '@/shared/persistence/indexeddb/database'

export const ACCEPTANCE_TIMESTAMP = '2026-02-22T00:00:00.000Z'
export const ACCEPTANCE_WEEK: WeekTag = '2026-W09'

export async function resetAcceptanceDatabase(): Promise<void> {
  await db.schoolConfigs.clear()
  await db.subjects.clear()
  await db.teachers.clear()
  await db.fixedEvents.clear()
  await db.setupSnapshots.clear()
  await db.timetableSnapshots.clear()
  await db.constraintPolicies.clear()
  await db.teacherPolicies.clear()
  await db.changeEvents.clear()
  await db.academicCalendarEvents.clear()
  await db.scheduleTransactions.clear()
  await db.impactAnalysisReports.clear()
}

export function makeSchoolConfig(
  overrides: Partial<SchoolConfig> = {},
): SchoolConfig {
  return {
    id: 'school-1',
    gradeCount: 1,
    classCountByGrade: { 1: 1 },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    periodsPerDay: 7,
    createdAt: ACCEPTANCE_TIMESTAMP,
    updatedAt: ACCEPTANCE_TIMESTAMP,
    ...overrides,
  }
}

export function makeSubject(id: string, name: string): Subject {
  return {
    id,
    name,
    abbreviation: name.slice(0, 2),
    track: 'COMMON',
    createdAt: ACCEPTANCE_TIMESTAMP,
    updatedAt: ACCEPTANCE_TIMESTAMP,
  }
}

export function makeTeacher(input: {
  id: string
  name: string
  subjectIds?: Array<string>
  classAssignments?: Array<{
    grade: number
    classNumber: number
    hoursPerWeek: number
  }>
}): Teacher {
  const classAssignments = input.classAssignments ?? [
    { grade: 1, classNumber: 1, hoursPerWeek: 5 },
  ]
  return {
    id: input.id,
    name: input.name,
    subjectIds: input.subjectIds ?? ['subject-1'],
    baseHoursPerWeek: classAssignments.reduce((total, item) => total + item.hoursPerWeek, 0),
    homeroom: null,
    classAssignments,
    createdAt: ACCEPTANCE_TIMESTAMP,
    updatedAt: ACCEPTANCE_TIMESTAMP,
  }
}

export function makeConstraintPolicy(
  overrides: Partial<ConstraintPolicy> = {},
): ConstraintPolicy {
  return {
    id: 'policy-1',
    studentMaxConsecutiveSameSubject: 2,
    teacherMaxConsecutiveHours: 4,
    teacherMaxDailyHours: 6,
    createdAt: ACCEPTANCE_TIMESTAMP,
    updatedAt: ACCEPTANCE_TIMESTAMP,
    ...overrides,
  }
}

export function makeCell(overrides: Partial<TimetableCell> = {}): TimetableCell {
  return {
    teacherId: 'teacher-1',
    subjectId: 'subject-1',
    grade: 1,
    classNumber: 1,
    day: 'MON',
    period: 1,
    isFixed: false,
    status: 'BASE',
    ...overrides,
  }
}

export function makeSnapshot(
  overrides: Partial<TimetableSnapshot> = {},
): TimetableSnapshot {
  const weekTag = overrides.weekTag ?? ACCEPTANCE_WEEK
  return {
    id: 'snapshot-1',
    schoolConfigId: 'school-1',
    weekTag,
    versionNo: 1,
    baseVersionId: null,
    appliedScope: {
      type: 'THIS_WEEK',
      fromWeek: weekTag,
      toWeek: null,
    },
    cells: [],
    score: 80,
    generationTimeMs: 1000,
    createdAt: ACCEPTANCE_TIMESTAMP,
    ...overrides,
  }
}

export function makeCalendarEvent(
  overrides: Partial<AcademicCalendarEvent>,
): AcademicCalendarEvent {
  return {
    id: 'calendar-event-1',
    eventType: 'HOLIDAY',
    startDate: '2026-02-23',
    endDate: '2026-02-23',
    scopeType: 'SCHOOL',
    scopeValue: null,
    periodOverride: null,
    createdAt: ACCEPTANCE_TIMESTAMP,
    updatedAt: ACCEPTANCE_TIMESTAMP,
    ...overrides,
  }
}

export function makeErrorViolation(
  ruleId = 'HC-08',
  message = '검증 오류',
): ValidationViolation {
  return {
    ruleId,
    severity: 'error',
    humanMessage: message,
    location: {},
    relatedEntities: [],
  }
}

export function makeMoveCandidate(
  overrides: Partial<ReplacementCandidate> = {},
): ReplacementCandidate {
  const sourceCell =
    overrides.sourceCell ?? makeCell({ day: 'MON', period: 1, status: 'BASE' })
  const resultTargetCell =
    overrides.resultTargetCell ??
    makeCell({
      teacherId: sourceCell.teacherId,
      subjectId: sourceCell.subjectId,
      grade: sourceCell.grade,
      classNumber: sourceCell.classNumber,
      day: 'MON',
      period: 2,
      status: 'TEMP_MODIFIED',
    })

  return {
    id: 'candidate-1',
    type: 'MOVE',
    sourceCell,
    sourceCellKey: '1-1-MON-1',
    targetCellKey: '1-1-MON-2',
    targetCell: null,
    resultSourceCell: null,
    resultTargetCell,
    ranking: {
      violationCount: 0,
      violations: [],
      scoreDelta: 0.1,
      similarityScore: 100,
      idleMinimizationScore: 100,
      fairnessScore: 100,
      candidateReasons: [],
      totalRank: 10,
    },
    ...overrides,
  }
}
