import { describe, expect, it } from 'vitest'
import {
  canEnableExamModeForWeek,
  validateInvigilationAssignments,
} from '../validator'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { ExamSlot, InvigilationAssignment } from '@/entities/exam-mode'
import type { SchoolConfig } from '@/entities/school'

const schoolConfig: SchoolConfig = {
  id: 'school-1',
  gradeCount: 1,
  classCountByGrade: { 1: 1 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: '2026-02-22T00:00:00.000Z',
  updatedAt: '2026-02-22T00:00:00.000Z',
}

const examSlot: ExamSlot = {
  id: 'slot-1',
  weekTag: '2026-W08',
  date: '2026-02-23',
  day: 'MON',
  period: 1,
  grade: 1,
  classNumber: 1,
  subjectId: 'subject-1',
  subjectName: '수학',
  durationMinutes: 50,
  createdAt: '2026-02-22T00:00:00.000Z',
  updatedAt: '2026-02-22T00:00:00.000Z',
}

const examPeriodEvent: AcademicCalendarEvent = {
  id: 'event-1',
  eventType: 'EXAM_PERIOD',
  startDate: '2026-02-23',
  endDate: '2026-02-27',
  scopeType: 'SCHOOL',
  scopeValue: null,
  periodOverride: null,
  createdAt: '2026-02-22T00:00:00.000Z',
  updatedAt: '2026-02-22T00:00:00.000Z',
}

describe('canEnableExamModeForWeek', () => {
  it('시험기간(EXAM_PERIOD)이 없으면 시험 모드 시작을 차단한다', () => {
    const result = canEnableExamModeForWeek({
      weekTag: '2026-W09',
      schoolConfig,
      academicCalendarEvents: [],
    })

    expect(result.ok).toBe(false)
    expect(result.message).not.toBeNull()
  })

  it('시험기간(EXAM_PERIOD)이 있으면 시험 모드 시작을 허용한다', () => {
    const result = canEnableExamModeForWeek({
      weekTag: '2026-W09',
      schoolConfig,
      academicCalendarEvents: [examPeriodEvent],
    })

    expect(result.ok).toBe(true)
    expect(result.message).toBeNull()
  })
})

describe('validateInvigilationAssignments', () => {
  it('동일 시간 교사 중복 배정을 충돌로 반환한다', () => {
    const slots: Array<ExamSlot> = [examSlot, { ...examSlot, id: 'slot-2' }]
    const assignments: Array<InvigilationAssignment> = [
      {
        id: 'assignment-1',
        weekTag: '2026-W08',
        slotId: 'slot-1',
        teacherId: 'teacher-1',
        status: 'ASSIGNED',
        isManual: false,
        reason: null,
        createdAt: '2026-02-22T00:00:00.000Z',
        updatedAt: '2026-02-22T00:00:00.000Z',
      },
      {
        id: 'assignment-2',
        weekTag: '2026-W08',
        slotId: 'slot-2',
        teacherId: 'teacher-1',
        status: 'ASSIGNED',
        isManual: false,
        reason: null,
        createdAt: '2026-02-22T00:00:00.000Z',
        updatedAt: '2026-02-22T00:00:00.000Z',
      },
    ]

    const conflicts = validateInvigilationAssignments({
      slots,
      assignments,
      teacherPolicies: [],
    })

    expect(conflicts.some((conflict) => conflict.type === 'TEACHER_DOUBLE_BOOKED')).toBe(
      true,
    )
  })
})
