import type { ValidationViolation } from '@/entities/schedule-transaction'
import type {
  ApplyScheduleTransactionInput,
  ApplyScheduleTransactionResult,
} from '../model/types'
import { analyzeSnapshotDiffImpact } from '@/features/analyze-schedule-impact'
import {
  commitScheduleTransactionAtomically,
  createScheduleTransactionDraft,
  rollbackScheduleTransaction,
} from '@/shared/persistence/indexeddb/repository'

const DEFAULT_ACTOR = 'LOCAL_OPERATOR'

export async function applyScheduleTransaction(
  input: ApplyScheduleTransactionInput,
): Promise<ApplyScheduleTransactionResult> {
  if (input.plans.length === 0) {
    throw new Error('적용할 트랜잭션 계획이 없습니다.')
  }

  const actor = input.actor ?? DEFAULT_ACTOR
  const uniqueWeeks = [...new Set(input.plans.map((plan) => plan.weekTag))]
  const violations = input.prevalidatedViolations ?? []
  const blockingViolations = violations.filter(
    (violation) => violation.severity === 'error',
  )

  const impactReports = input.plans.map((plan) =>
    analyzeSnapshotDiffImpact({
      snapshot: plan.sourceSnapshot,
      beforeCells: plan.sourceSnapshot.cells,
      afterCells: plan.nextCells,
      teachers: input.teachers ?? [],
      alternatives: input.impactAlternatives ?? [],
    }),
  )

  const draft = await createScheduleTransactionDraft({
    targetWeeks: uniqueWeeks,
    validationResult: {
      passed: blockingViolations.length === 0,
      violations,
    },
    impactReportId: impactReports[0]?.id ?? 'impact-missing',
  })

  const rollbackBase = {
    transaction: draft,
    actor,
    weekTag: input.plans[0].weekTag,
    snapshotId: input.plans[0].sourceSnapshot.id,
    violations,
  }

  if (blockingViolations.length > 0) {
    const reason = `${blockingViolations.length}건의 검증 오류로 확정이 차단되었습니다.`
    await rollbackScheduleTransaction({
      ...rollbackBase,
      reason,
      conflictDetected: true,
    })
    return {
      ok: false,
      draftId: draft.draftId,
      status: 'ROLLED_BACK',
      savedSnapshots: [],
      violations: blockingViolations,
      rollbackReason: reason,
    }
  }

  try {
    const committed = await commitScheduleTransactionAtomically({
      transaction: draft,
      plans: input.plans,
      impactReports,
      actor,
      actionType: input.preferredCommitActionType ?? 'TRANSACTION_COMMIT',
      impactSummary:
        input.impactSummary ?? buildDefaultImpactSummary(input.kind, uniqueWeeks.length),
    })
    return {
      ok: true,
      draftId: draft.draftId,
      status: 'COMMITTED',
      savedSnapshots: committed.savedSnapshots,
      violations: [],
      rollbackReason: null,
    }
  } catch (error) {
    const reason = toRollbackReason(error)
    await rollbackScheduleTransaction({
      ...rollbackBase,
      reason,
      conflictDetected: true,
    })
    return {
      ok: false,
      draftId: draft.draftId,
      status: 'ROLLED_BACK',
      savedSnapshots: [],
      violations,
      rollbackReason: reason,
    }
  }
}

function buildDefaultImpactSummary(
  kind: ApplyScheduleTransactionInput['kind'],
  targetWeekCount: number,
): string {
  switch (kind) {
    case 'EDIT_SAVE':
      return `편집 저장 트랜잭션 확정 (${targetWeekCount}개 주차)`
    case 'REPLACEMENT_SCOPE':
      return `교체 범위 트랜잭션 확정 (${targetWeekCount}개 주차)`
    case 'VERSION_RESTORE':
      return `버전 복원 트랜잭션 확정 (${targetWeekCount}개 주차)`
    default:
      return `트랜잭션 확정 (${targetWeekCount}개 주차)`
  }
}

function toRollbackReason(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return '트랜잭션 적용 중 오류가 발생했습니다.'
}

export function hasBlockingViolations(
  violations: Array<ValidationViolation>,
): boolean {
  return violations.some((violation) => violation.severity === 'error')
}
