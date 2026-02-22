import { describe, expect, it } from 'vitest'
import {
  applyV6ChangeEventDefaults,
  applyV6SnapshotDefaults,
} from '../database'
import type {
  V6ChangeEventMigrationRecord,
  V6SnapshotMigrationRecord,
} from '../database'

describe('v6 migration defaults', () => {
  it('legacy snapshot에 주차/버전/적용범위 기본값을 채운다', () => {
    const legacySnapshot: V6SnapshotMigrationRecord = {
      id: 'snapshot-1',
      schoolConfigId: 'config-1',
      cells: [],
      score: 80,
      generationTimeMs: 100,
      createdAt: '2024-01-01T00:00:00.000Z',
    }

    applyV6SnapshotDefaults(legacySnapshot)

    expect(legacySnapshot.weekTag).toBe('2024-W01')
    expect(legacySnapshot.versionNo).toBe(1)
    expect(legacySnapshot.baseVersionId).toBeNull()
    expect(legacySnapshot.appliedScope).toEqual({
      type: 'THIS_WEEK',
      fromWeek: '2024-W01',
      toWeek: null,
    })
  })

  it('legacy snapshot RANGE 범위의 toWeek 누락을 보정한다', () => {
    const legacySnapshot: V6SnapshotMigrationRecord = {
      id: 'snapshot-2',
      schoolConfigId: 'config-1',
      weekTag: '2026-W08',
      versionNo: 2,
      baseVersionId: 'snapshot-1',
      appliedScope: {
        type: 'RANGE' as const,
        fromWeek: '2026-W08',
        toWeek: null,
      },
      cells: [],
      score: 80,
      generationTimeMs: 100,
      createdAt: '2026-02-22T00:00:00.000Z',
    }

    applyV6SnapshotDefaults(legacySnapshot)

    expect(legacySnapshot.appliedScope?.toWeek).toBe('2026-W08')
  })

  it('legacy change event에 감사 필드 기본값을 채운다', () => {
    const legacyEvent: V6ChangeEventMigrationRecord = {
      id: 'event-1',
      snapshotId: 'snapshot-1',
      weekTag: '2026-W08',
      actionType: 'EDIT' as const,
      cellKey: '1-1-MON-1',
      before: {
        teacherId: 'teacher-1',
        subjectId: 'subject-1',
        grade: 1,
        classNumber: 1,
        day: 'MON' as const,
        period: 1,
        isFixed: false,
        status: 'BASE' as const,
      },
      after: null,
      timestamp: 100,
      isUndone: false,
    }

    applyV6ChangeEventDefaults(legacyEvent)

    expect(legacyEvent.actor).toBe('LOCAL_OPERATOR')
    expect(legacyEvent.beforePayload).toEqual(legacyEvent.before)
    expect(legacyEvent.afterPayload).toBeNull()
    expect(legacyEvent.impactSummary).toBeNull()
    expect(legacyEvent.conflictDetected).toBe(false)
    expect(legacyEvent.rollbackRef).toBeNull()
  })
})
