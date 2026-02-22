import { describe, expect, it } from 'vitest'
import {
  scheduleTransactionSchema,
  scheduleTransactionStatusSchema,
  validationViolationSchema,
} from '../schema'

const violation = {
  ruleId: 'HC-07',
  severity: 'error' as const,
  humanMessage: '같은 교시 교사 중복이 발생했습니다.',
  location: {
    weekTag: '2026-W08',
    grade: 1,
    classNumber: 2,
    day: 'MON' as const,
    period: 3,
  },
  relatedEntities: [{ type: 'TEACHER' as const, label: '김교사' }],
}

const validTransaction = {
  draftId: 'draft-1',
  targetWeeks: ['2026-W08', '2026-W09'],
  validationResult: {
    passed: false,
    violations: [violation],
  },
  impactReportId: 'impact-1',
  status: 'DRAFT' as const,
  createdAt: '2026-02-22T00:00:00.000Z',
  updatedAt: '2026-02-22T00:00:00.000Z',
}

describe('scheduleTransactionStatusSchema', () => {
  it('유효한 상태를 허용한다', () => {
    expect(scheduleTransactionStatusSchema.safeParse('DRAFT').success).toBe(
      true,
    )
    expect(
      scheduleTransactionStatusSchema.safeParse('COMMITTED').success,
    ).toBe(true)
    expect(
      scheduleTransactionStatusSchema.safeParse('ROLLED_BACK').success,
    ).toBe(true)
  })

  it('유효하지 않은 상태를 거부한다', () => {
    expect(scheduleTransactionStatusSchema.safeParse('DONE').success).toBe(
      false,
    )
  })
})

describe('validationViolationSchema', () => {
  it('유효한 위반 정보를 허용한다', () => {
    expect(validationViolationSchema.safeParse(violation).success).toBe(true)
  })

  it('주차 형식이 잘못되면 거부한다', () => {
    expect(
      validationViolationSchema.safeParse({
        ...violation,
        location: {
          ...violation.location,
          weekTag: '2026-W8',
        },
      }).success,
    ).toBe(false)
  })
})

describe('scheduleTransactionSchema', () => {
  it('유효한 트랜잭션을 허용한다', () => {
    expect(scheduleTransactionSchema.safeParse(validTransaction).success).toBe(
      true,
    )
  })

  it('targetWeeks가 비어있으면 거부한다', () => {
    expect(
      scheduleTransactionSchema.safeParse({
        ...validTransaction,
        targetWeeks: [],
      }).success,
    ).toBe(false)
  })

  it('impactReportId가 없으면 거부한다', () => {
    expect(
      scheduleTransactionSchema.safeParse({
        ...validTransaction,
        impactReportId: '',
      }).success,
    ).toBe(false)
  })
})
