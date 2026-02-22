import { waitFor } from '@testing-library/dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReplacementStore } from '../store'
import type { ReplacementCandidate } from '../types'
import type { ImpactAnalysisReport } from '@/entities/impact-analysis'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import { applyScheduleTransaction } from '@/features/apply-schedule-transaction'
import {
  loadSnapshotWeeks,
  loadSnapshotsByWeek,
  saveImpactAnalysisReport,
} from '@/shared/persistence/indexeddb/repository'
import { analyzeReplacementImpact } from '@/features/analyze-schedule-impact'

vi.mock('@/shared/persistence/indexeddb/repository', () => ({
  loadAcademicCalendarEvents: vi.fn(),
  loadAllSetupData: vi.fn(),
  loadConstraintPolicy: vi.fn(),
  loadLatestSnapshotByWeek: vi.fn(),
  loadSnapshotBySelection: vi.fn(),
  loadSnapshotWeeks: vi.fn(),
  loadSnapshotsByWeek: vi.fn(),
  loadSubstituteAssignmentsByRange: vi.fn(),
  loadTeacherPolicies: vi.fn(),
  saveChangeEvents: vi.fn(),
  saveImpactAnalysisReport: vi.fn(),
  saveSubstituteAssignments: vi.fn(),
}))

vi.mock('@/features/apply-schedule-transaction', () => ({
  applyScheduleTransaction: vi.fn(),
}))

vi.mock('@/features/analyze-schedule-impact', () => ({
  analyzeReplacementImpact: vi.fn(),
  analyzeMultiReplacementImpact: vi.fn(),
}))

const mockedLoadSnapshotsByWeek = vi.mocked(loadSnapshotsByWeek)
const mockedLoadSnapshotWeeks = vi.mocked(loadSnapshotWeeks)
const mockedSaveImpactAnalysisReport = vi.mocked(saveImpactAnalysisReport)
const mockedAnalyzeReplacementImpact = vi.mocked(analyzeReplacementImpact)
const mockedApplyScheduleTransaction = vi.mocked(applyScheduleTransaction)

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
  cells: [sourceCell],
  score: 80,
  generationTimeMs: 1000,
  createdAt: '2026-02-22T00:00:00.000Z',
}

const candidate: ReplacementCandidate = {
  id: 'candidate-1',
  type: 'MOVE',
  sourceCell,
  sourceCellKey: '1-1-MON-1',
  targetCellKey: '1-1-MON-2',
  targetCell: null,
  resultSourceCell: null,
  resultTargetCell: {
    ...sourceCell,
    period: 2,
    status: 'TEMP_MODIFIED',
  },
  ranking: {
    violationCount: 0,
    violations: [],
    scoreDelta: 0.2,
    similarityScore: 99,
    idleMinimizationScore: 99,
    fairnessScore: 100,
    candidateReasons: [],
    totalRank: 10,
  },
}

const impactReport: ImpactAnalysisReport = {
  id: 'impact-1',
  snapshotId: 'snapshot-1',
  weekTag: '2026-W08',
  affectedTeachers: [{ teacherName: '김교사', summary: '배치 위치 변경 1건' }],
  affectedClasses: [{ grade: 1, classNumber: 1, summary: '변경 슬롯 1건' }],
  hourDelta: [{ target: '김교사(월)', delta: 1 }],
  riskLevel: 'LOW',
  alternatives: ['월 3교시 이동 +0.1점 / 위반 0건'],
  createdAt: '2026-02-22T00:00:00.000Z',
}

beforeEach(() => {
  mockedLoadSnapshotsByWeek.mockReset()
  mockedLoadSnapshotWeeks.mockReset()
  mockedSaveImpactAnalysisReport.mockReset()
  mockedAnalyzeReplacementImpact.mockReset()
  mockedApplyScheduleTransaction.mockReset()
  mockedLoadSnapshotsByWeek.mockResolvedValue([snapshot])
  mockedLoadSnapshotWeeks.mockResolvedValue(['2026-W08'])
  mockedApplyScheduleTransaction.mockResolvedValue({
    ok: true,
    draftId: 'draft-1',
    status: 'COMMITTED',
    savedSnapshots: [
      {
        ...snapshot,
        id: 'snapshot-2',
        versionNo: 2,
        baseVersionId: 'snapshot-1',
      },
    ],
    violations: [],
    rollbackReason: null,
  })
  useReplacementStore.setState(useReplacementStore.getInitialState(), true)
})

describe('replacement store impact integration', () => {
  it('후보 선택 시 영향 리포트를 생성하고 저장한다', async () => {
    mockedAnalyzeReplacementImpact.mockReturnValue(impactReport)
    mockedSaveImpactAnalysisReport.mockResolvedValue()

    useReplacementStore.setState({
      snapshot,
      cells: [sourceCell],
      schoolConfig: {
        id: 'config-1',
        gradeCount: 1,
        classCountByGrade: { 1: 1 },
        activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        periodsPerDay: 7,
        createdAt: '2026-02-22T00:00:00.000Z',
        updatedAt: '2026-02-22T00:00:00.000Z',
      },
      subjects: [
        {
          id: 's-1',
          name: '수학',
          abbreviation: '수',
          track: 'COMMON',
          createdAt: '2026-02-22T00:00:00.000Z',
          updatedAt: '2026-02-22T00:00:00.000Z',
        },
      ],
      constraintPolicy: {
        id: 'policy-1',
        studentMaxConsecutiveSameSubject: 2,
        teacherMaxConsecutiveHours: 4,
        teacherMaxDailyHours: 6,
        createdAt: '2026-02-22T00:00:00.000Z',
        updatedAt: '2026-02-22T00:00:00.000Z',
      },
      teacherPolicies: [],
      fixedEvents: [],
      teachers: [
        {
          id: 't-1',
          name: '김교사',
          subjectIds: ['s-1'],
          baseHoursPerWeek: 10,
          homeroom: null,
          classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
          createdAt: '2026-02-22T00:00:00.000Z',
          updatedAt: '2026-02-22T00:00:00.000Z',
        },
      ],
      searchResult: {
        candidates: [candidate],
        stats: { totalExamined: 1, validCandidates: 1, searchTimeMs: 5 },
        relaxationSuggestions: [],
      },
    })

    useReplacementStore.getState().selectCandidate(candidate)

    await waitFor(() => {
      expect(useReplacementStore.getState().impactReport).toEqual(impactReport)
    })
    expect(mockedSaveImpactAnalysisReport).toHaveBeenCalledWith(impactReport)
  })

  it('리포트가 없으면 교체 확정을 차단한다', async () => {
    useReplacementStore.setState({
      snapshot,
      cells: [sourceCell],
      schoolConfig: {
        id: 'config-1',
        gradeCount: 1,
        classCountByGrade: { 1: 1 },
        activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        periodsPerDay: 7,
        createdAt: '2026-02-22T00:00:00.000Z',
        updatedAt: '2026-02-22T00:00:00.000Z',
      },
      subjects: [
        {
          id: 's-1',
          name: '수학',
          abbreviation: '수',
          track: 'COMMON',
          createdAt: '2026-02-22T00:00:00.000Z',
          updatedAt: '2026-02-22T00:00:00.000Z',
        },
      ],
      constraintPolicy: {
        id: 'policy-1',
        studentMaxConsecutiveSameSubject: 2,
        teacherMaxConsecutiveHours: 4,
        teacherMaxDailyHours: 6,
        createdAt: '2026-02-22T00:00:00.000Z',
        updatedAt: '2026-02-22T00:00:00.000Z',
      },
      selectedCandidate: candidate,
      impactReport: null,
    })

    const result = await useReplacementStore.getState().confirmReplacement()
    expect(result).toBe(false)
    expect(mockedApplyScheduleTransaction).not.toHaveBeenCalled()
  })

  it('리포트가 있으면 교체를 저장한다', async () => {
    useReplacementStore.setState({
      snapshot,
      cells: [sourceCell],
      schoolConfig: {
        id: 'config-1',
        gradeCount: 1,
        classCountByGrade: { 1: 1 },
        activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        periodsPerDay: 7,
        createdAt: '2026-02-22T00:00:00.000Z',
        updatedAt: '2026-02-22T00:00:00.000Z',
      },
      subjects: [
        {
          id: 's-1',
          name: '수학',
          abbreviation: '수',
          track: 'COMMON',
          createdAt: '2026-02-22T00:00:00.000Z',
          updatedAt: '2026-02-22T00:00:00.000Z',
        },
      ],
      teachers: [
        {
          id: 't-1',
          name: '김교사',
          subjectIds: ['s-1'],
          baseHoursPerWeek: 10,
          homeroom: null,
          classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 10 }],
          createdAt: '2026-02-22T00:00:00.000Z',
          updatedAt: '2026-02-22T00:00:00.000Z',
        },
      ],
      constraintPolicy: {
        id: 'policy-1',
        studentMaxConsecutiveSameSubject: 2,
        teacherMaxConsecutiveHours: 4,
        teacherMaxDailyHours: 6,
        createdAt: '2026-02-22T00:00:00.000Z',
        updatedAt: '2026-02-22T00:00:00.000Z',
      },
      teacherPolicies: [],
      fixedEvents: [],
      selectedCandidate: candidate,
      impactReport,
    })

    const result = await useReplacementStore.getState().confirmReplacement()

    expect(result).toBe(true)
    expect(mockedApplyScheduleTransaction).toHaveBeenCalledTimes(1)
    expect(mockedApplyScheduleTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'REPLACEMENT_SCOPE',
      }),
    )
    expect(useReplacementStore.getState().selectedCandidate).toBeNull()
  })
})
