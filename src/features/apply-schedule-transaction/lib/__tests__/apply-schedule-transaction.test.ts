import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyScheduleTransaction } from '../apply-schedule-transaction'
import type { ImpactAnalysisReport } from '@/entities/impact-analysis'
import type { ScheduleTransaction, ValidationViolation } from '@/entities/schedule-transaction'
import type { TimetableSnapshot } from '@/entities/timetable'
import {
  commitScheduleTransactionAtomically,
  createScheduleTransactionDraft,
  rollbackScheduleTransaction,
} from '@/shared/persistence/indexeddb/repository'
import { analyzeSnapshotDiffImpact } from '@/features/analyze-schedule-impact'

vi.mock('@/shared/persistence/indexeddb/repository', () => ({
  createScheduleTransactionDraft: vi.fn(),
  commitScheduleTransactionAtomically: vi.fn(),
  rollbackScheduleTransaction: vi.fn(),
}))

vi.mock('@/features/analyze-schedule-impact', () => ({
  analyzeSnapshotDiffImpact: vi.fn(),
}))

const mockedCreateScheduleTransactionDraft = vi.mocked(createScheduleTransactionDraft)
const mockedCommitScheduleTransactionAtomically = vi.mocked(
  commitScheduleTransactionAtomically,
)
const mockedRollbackScheduleTransaction = vi.mocked(rollbackScheduleTransaction)
const mockedAnalyzeSnapshotDiffImpact = vi.mocked(analyzeSnapshotDiffImpact)

const sourceSnapshot: TimetableSnapshot = {
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
  score: 90,
  generationTimeMs: 300,
  createdAt: '2026-02-22T00:00:00.000Z',
}

const draftTransaction: ScheduleTransaction = {
  draftId: 'draft-1',
  targetWeeks: ['2026-W08'],
  validationResult: {
    passed: true,
    violations: [],
  },
  impactReportId: 'impact-1',
  status: 'DRAFT',
  createdAt: '2026-02-22T00:00:00.000Z',
  updatedAt: '2026-02-22T00:00:00.000Z',
}

const report: ImpactAnalysisReport = {
  id: 'impact-1',
  snapshotId: 'snapshot-1',
  weekTag: '2026-W08',
  affectedTeachers: [],
  affectedClasses: [],
  hourDelta: [],
  riskLevel: 'LOW',
  alternatives: [],
  createdAt: '2026-02-22T00:00:00.000Z',
}

beforeEach(() => {
  mockedCreateScheduleTransactionDraft.mockReset()
  mockedCommitScheduleTransactionAtomically.mockReset()
  mockedRollbackScheduleTransaction.mockReset()
  mockedAnalyzeSnapshotDiffImpact.mockReset()
  mockedCreateScheduleTransactionDraft.mockResolvedValue(draftTransaction)
  mockedAnalyzeSnapshotDiffImpact.mockReturnValue(report)
  mockedRollbackScheduleTransaction.mockResolvedValue({
    ...draftTransaction,
    status: 'ROLLED_BACK',
  })
})

describe('applyScheduleTransaction', () => {
  it('검증 오류가 없으면 COMMITTED로 확정한다', async () => {
    const savedSnapshot: TimetableSnapshot = {
      ...sourceSnapshot,
      id: 'snapshot-2',
      versionNo: 2,
      baseVersionId: 'snapshot-1',
    }
    mockedCommitScheduleTransactionAtomically.mockResolvedValue({
      transaction: {
        ...draftTransaction,
        status: 'COMMITTED',
      },
      savedSnapshots: [savedSnapshot],
    })

    const result = await applyScheduleTransaction({
      kind: 'EDIT_SAVE',
      plans: [
        {
          weekTag: sourceSnapshot.weekTag,
          sourceSnapshot,
          nextCells: sourceSnapshot.cells,
          appliedScope: sourceSnapshot.appliedScope,
        },
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('COMMITTED')
    expect(result.savedSnapshots).toHaveLength(1)
    expect(mockedCommitScheduleTransactionAtomically).toHaveBeenCalledTimes(1)
    expect(mockedRollbackScheduleTransaction).not.toHaveBeenCalled()
  })

  it('검증 오류가 있으면 ROLLED_BACK으로 종료한다', async () => {
    const violations: Array<ValidationViolation> = [
      {
        ruleId: 'HC-07',
        severity: 'error',
        humanMessage: '충돌 발생',
        location: {},
        relatedEntities: [],
      },
    ]

    const result = await applyScheduleTransaction({
      kind: 'EDIT_SAVE',
      plans: [
        {
          weekTag: sourceSnapshot.weekTag,
          sourceSnapshot,
          nextCells: sourceSnapshot.cells,
          appliedScope: sourceSnapshot.appliedScope,
        },
      ],
      prevalidatedViolations: violations,
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('ROLLED_BACK')
    expect(result.violations).toEqual(violations)
    expect(mockedCommitScheduleTransactionAtomically).not.toHaveBeenCalled()
    expect(mockedRollbackScheduleTransaction).toHaveBeenCalledTimes(1)
  })

  it('커밋 예외가 발생하면 자동 롤백한다', async () => {
    mockedCommitScheduleTransactionAtomically.mockRejectedValue(
      new Error('atomic commit failed'),
    )

    const result = await applyScheduleTransaction({
      kind: 'REPLACEMENT_SCOPE',
      plans: [
        {
          weekTag: sourceSnapshot.weekTag,
          sourceSnapshot,
          nextCells: sourceSnapshot.cells,
          appliedScope: sourceSnapshot.appliedScope,
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('ROLLED_BACK')
    expect(result.rollbackReason).toBe('atomic commit failed')
    expect(mockedRollbackScheduleTransaction).toHaveBeenCalledTimes(1)
  })
})
