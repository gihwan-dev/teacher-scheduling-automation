import { describe, expect, it } from 'vitest'
import { autoAssignInvigilators } from '../auto-invigilation'
import type { ExamSlot } from '@/entities/exam-mode'
import type { Teacher } from '@/entities/teacher'

const teachers: Array<Teacher> = [
  {
    id: 'teacher-1',
    name: '교사1',
    subjectIds: ['subject-1'],
    baseHoursPerWeek: 10,
    homeroom: null,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
  {
    id: 'teacher-2',
    name: '교사2',
    subjectIds: ['subject-1'],
    baseHoursPerWeek: 10,
    homeroom: null,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
]

function makeSlot(id: string, period: number): ExamSlot {
  return {
    id,
    weekTag: '2026-W08',
    date: '2026-02-23',
    day: 'MON',
    period,
    grade: 1,
    classNumber: 1,
    subjectId: 'subject-1',
    subjectName: '수학',
    durationMinutes: 50,
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  }
}

describe('autoAssignInvigilators', () => {
  it('동일 시간 교사 중복 배정을 방지하고 미해결 슬롯으로 남긴다', () => {
    const result = autoAssignInvigilators({
      weekTag: '2026-W08',
      slots: [makeSlot('slot-1', 1), makeSlot('slot-2', 1)],
      teachers: [teachers[0]],
      teacherPolicies: [],
      nowIso: '2026-02-22T00:00:00.000Z',
      historicalTeacherLoad: { 'teacher-1': 0 },
    })

    const assigned = result.assignments.filter((row) => row.status === 'ASSIGNED')
    const unresolved = result.assignments.filter((row) => row.status === 'UNRESOLVED')

    expect(assigned).toHaveLength(1)
    expect(unresolved).toHaveLength(1)
    expect(result.unresolvedSlotIds).toHaveLength(1)
  })

  it('누적 감독 횟수가 적은 교사를 우선 배정한다', () => {
    const result = autoAssignInvigilators({
      weekTag: '2026-W08',
      slots: [makeSlot('slot-1', 2)],
      teachers,
      teacherPolicies: [],
      nowIso: '2026-02-22T00:00:00.000Z',
      historicalTeacherLoad: { 'teacher-1': 4, 'teacher-2': 1 },
    })

    expect(result.assignments[0].teacherId).toBe('teacher-2')
  })
})
