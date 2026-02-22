import { describe, expect, it } from 'vitest'
import { analyzeSnapshotDiffImpact } from '../analyze-snapshot-diff-impact'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'

const snapshot: TimetableSnapshot = {
  id: 'snapshot-1',
  schoolConfigId: 'config-1',
  weekTag: '2026-W08',
  versionNo: 1,
  baseVersionId: null,
  appliedScope: {
    type: 'THIS_WEEK',
    fromWeek: '2026-W08',
    toWeek: null,
  },
  cells: [],
  score: 88,
  generationTimeMs: 500,
  createdAt: '2026-02-22T00:00:00.000Z',
}

const teachers: Array<Teacher> = [
  {
    id: 't-1',
    name: '김교사',
    subjectIds: ['s-1'],
    baseHoursPerWeek: 10,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
]

function cell(day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI', period: number): TimetableCell {
  return {
    teacherId: 't-1',
    subjectId: 's-1',
    grade: 1,
    classNumber: 1,
    day,
    period,
    isFixed: false,
    status: 'BASE',
  }
}

describe('analyzeSnapshotDiffImpact', () => {
  it('변경 슬롯 수가 적으면 LOW 리스크를 계산한다', () => {
    const report = analyzeSnapshotDiffImpact({
      snapshot,
      beforeCells: [cell('MON', 1)],
      afterCells: [cell('MON', 2)],
      teachers,
      alternatives: ['대안 A', '대안 B'],
    })

    expect(report.riskLevel).toBe('LOW')
    expect(report.affectedTeachers).toHaveLength(1)
    expect(report.affectedClasses).toHaveLength(1)
    expect(report.alternatives).toEqual(['대안 A', '대안 B'])
  })

  it('변경 슬롯 수가 4개 이상이면 MEDIUM 리스크를 계산한다', () => {
    const before = [cell('MON', 1), cell('MON', 2), cell('TUE', 1), cell('TUE', 2)]
    const after = [cell('MON', 3), cell('MON', 4), cell('TUE', 3), cell('TUE', 4)]

    const report = analyzeSnapshotDiffImpact({
      snapshot,
      beforeCells: before,
      afterCells: after,
      teachers,
      alternatives: ['A', 'B', 'C', 'D', 'E', 'F'],
    })

    expect(report.riskLevel).toBe('MEDIUM')
    expect(report.alternatives).toHaveLength(5)
  })
})
