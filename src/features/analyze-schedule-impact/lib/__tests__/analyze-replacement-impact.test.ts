import { describe, expect, it } from 'vitest'
import {
  analyzeMultiReplacementImpact,
  analyzeReplacementImpact,
} from '../analyze-replacement-impact'
import type { MultiReplacementCandidateImpactInput } from '../analyze-replacement-impact'
import type { ValidationViolation } from '@/entities/schedule-transaction'
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
  score: 80,
  generationTimeMs: 1000,
  createdAt: '2026-02-22T00:00:00.000Z',
}

const teachers: Array<Teacher> = [
  {
    id: 't-1',
    name: '김교사',
    subjectIds: ['s-1'],
    baseHoursPerWeek: 12,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 12 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
  {
    id: 't-2',
    name: '박교사',
    subjectIds: ['s-2'],
    baseHoursPerWeek: 12,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 12 }],
    createdAt: '2026-02-22T00:00:00.000Z',
    updatedAt: '2026-02-22T00:00:00.000Z',
  },
]

const sourceCell: TimetableCell = {
  teacherId: 't-1',
  subjectId: 's-1',
  grade: 1,
  classNumber: 1,
  day: 'MON',
  period: 1,
  isFixed: false,
  status: 'BASE',
}

const targetCell: TimetableCell = {
  teacherId: 't-2',
  subjectId: 's-2',
  grade: 1,
  classNumber: 1,
  day: 'MON',
  period: 2,
  isFixed: false,
  status: 'BASE',
}

const beforeCells: Array<TimetableCell> = [
  sourceCell,
  targetCell,
  {
    teacherId: 't-1',
    subjectId: 's-1',
    grade: 1,
    classNumber: 1,
    day: 'TUE',
    period: 1,
    isFixed: false,
    status: 'BASE',
  },
]

function makeViolation(severity: 'error' | 'warning'): ValidationViolation {
  return {
    ruleId: 'HC-08',
    severity,
    humanMessage: `${severity} violation`,
    location: {},
    relatedEntities: [],
  }
}

function makeMoveCandidate(
  id: string,
  period: number,
  scoreDelta: number,
  violations: Array<ValidationViolation>,
  totalRank: number,
) {
  return {
    id,
    type: 'MOVE' as const,
    sourceCell,
    sourceCellKey: '1-1-MON-1',
    targetCellKey: `1-1-MON-${period}`,
    targetCell: null,
    resultSourceCell: null,
    resultTargetCell: {
      ...sourceCell,
      day: 'MON' as const,
      period,
      status: 'TEMP_MODIFIED' as const,
    },
    ranking: {
      violationCount: violations.filter((violation) => violation.severity === 'error')
        .length,
      violations,
      scoreDelta,
      totalRank,
    },
  }
}

describe('analyzeReplacementImpact', () => {
  it('무위반 + 양수 점수는 LOW 리스크다', () => {
    const selected = makeMoveCandidate('selected', 3, 0.2, [], 20)
    const alternatives = [
      makeMoveCandidate('alt-1', 4, 0.1, [], 10),
      makeMoveCandidate('alt-2', 5, 0.0, [], 9),
      makeMoveCandidate('alt-3', 6, -0.1, [], 8),
      makeMoveCandidate('alt-4', 7, 0.3, [], 7),
    ]
    const report = analyzeReplacementImpact({
      snapshot,
      beforeCells,
      selectedCandidate: selected,
      allCandidates: [selected, ...alternatives],
      teachers,
    })

    expect(report.riskLevel).toBe('LOW')
    expect(report.alternatives).toHaveLength(3)
    expect(report.alternatives.every((label) => label.includes('교시'))).toBe(true)
    expect(report.affectedTeachers.length).toBeGreaterThan(0)
    expect(report.affectedClasses.length).toBeGreaterThan(0)
  })

  it('warning이 있으면 MEDIUM 리스크다', () => {
    const selected = makeMoveCandidate('selected', 3, 0.2, [makeViolation('warning')], 20)
    const report = analyzeReplacementImpact({
      snapshot,
      beforeCells,
      selectedCandidate: selected,
      allCandidates: [selected],
      teachers,
    })

    expect(report.riskLevel).toBe('MEDIUM')
  })

  it('error가 있으면 HIGH 리스크다', () => {
    const selected = makeMoveCandidate('selected', 3, 10, [makeViolation('error')], 20)
    const report = analyzeReplacementImpact({
      snapshot,
      beforeCells,
      selectedCandidate: selected,
      allCandidates: [selected],
      teachers,
    })

    expect(report.riskLevel).toBe('HIGH')
  })
})

describe('analyzeMultiReplacementImpact', () => {
  it('다중 후보도 리스크/대안을 계산한다', () => {
    const selected: MultiReplacementCandidateImpactInput = {
      id: 'multi-selected',
      sources: [
        {
          sourceKey: '1-1-MON-1',
          candidate: makeMoveCandidate('single-1', 3, 0.1, [], 10),
        },
        {
          sourceKey: '1-1-MON-2',
          candidate: {
            id: 'single-2',
            type: 'SWAP' as const,
            sourceCell: targetCell,
            sourceCellKey: '1-1-MON-2',
            targetCellKey: '1-1-TUE-1',
            targetCell: beforeCells[2],
            resultSourceCell: {
              ...beforeCells[2],
              day: 'MON' as const,
              period: 2,
              status: 'TEMP_MODIFIED' as const,
            },
            resultTargetCell: {
              ...targetCell,
              day: 'TUE' as const,
              period: 1,
              status: 'TEMP_MODIFIED' as const,
            },
            ranking: {
              violationCount: 0,
              violations: [],
              scoreDelta: -0.2,
              totalRank: 9,
            },
          },
        },
      ],
      combinedRanking: {
        totalViolationCount: 0,
        combinedScoreDelta: -0.6,
        aggregateScore: 19,
      },
    }

    const alternative: MultiReplacementCandidateImpactInput = {
      ...selected,
      id: 'multi-alt',
      combinedRanking: {
        totalViolationCount: 1,
        combinedScoreDelta: -1.2,
        aggregateScore: 5,
      },
      sources: selected.sources.map((source, index) => ({
        ...source,
        candidate: {
          ...source.candidate,
          id: `alt-${index}`,
          ranking: {
            ...source.candidate.ranking,
            violations: [makeViolation('error')],
            violationCount: 1,
          },
        },
      })),
    }

    const report = analyzeMultiReplacementImpact({
      snapshot,
      beforeCells,
      selectedCandidate: selected,
      allCandidates: [selected, alternative],
      teachers,
    })

    expect(report.riskLevel).toBe('MEDIUM')
    expect(report.alternatives).toHaveLength(1)
  })
})
