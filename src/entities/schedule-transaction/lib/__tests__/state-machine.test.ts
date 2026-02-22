import { describe, expect, it } from 'vitest'
import {
  ScheduleTransactionTransitionError,
  assertTransitionAllowed,
  isTransitionAllowed,
  transitionScheduleTransactionStatus,
} from '../state-machine'

describe('schedule transaction state-machine', () => {
  it('DRAFT -> COMMITTED 전이를 허용한다', () => {
    expect(isTransitionAllowed('DRAFT', 'COMMITTED')).toBe(true)
    expect(transitionScheduleTransactionStatus('DRAFT', 'COMMITTED')).toBe(
      'COMMITTED',
    )
  })

  it('DRAFT -> ROLLED_BACK 전이를 허용한다', () => {
    expect(isTransitionAllowed('DRAFT', 'ROLLED_BACK')).toBe(true)
    expect(transitionScheduleTransactionStatus('DRAFT', 'ROLLED_BACK')).toBe(
      'ROLLED_BACK',
    )
  })

  it('COMMITTED -> ROLLED_BACK 전이를 차단한다', () => {
    expect(isTransitionAllowed('COMMITTED', 'ROLLED_BACK')).toBe(false)
    expect(() => assertTransitionAllowed('COMMITTED', 'ROLLED_BACK')).toThrow(
      ScheduleTransactionTransitionError,
    )
  })

  it('ROLLED_BACK -> COMMITTED 전이를 차단한다', () => {
    expect(isTransitionAllowed('ROLLED_BACK', 'COMMITTED')).toBe(false)
    try {
      transitionScheduleTransactionStatus('ROLLED_BACK', 'COMMITTED')
      throw new Error('must not reach')
    } catch (error) {
      expect(error).toBeInstanceOf(ScheduleTransactionTransitionError)
      if (error instanceof ScheduleTransactionTransitionError) {
        expect(error.code).toBe('INVALID_TRANSACTION_TRANSITION')
      }
    }
  })

  it('DRAFT -> DRAFT 전이를 차단한다', () => {
    expect(isTransitionAllowed('DRAFT', 'DRAFT')).toBe(false)
    expect(() => transitionScheduleTransactionStatus('DRAFT', 'DRAFT')).toThrow(
      ScheduleTransactionTransitionError,
    )
  })
})
