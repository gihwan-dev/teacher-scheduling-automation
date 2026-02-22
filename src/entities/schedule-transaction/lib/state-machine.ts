import type { ScheduleTransactionStatus } from '../model/types'

const ALLOWED_TRANSITIONS: Record<
  ScheduleTransactionStatus,
  Array<ScheduleTransactionStatus>
> = {
  DRAFT: ['COMMITTED', 'ROLLED_BACK'],
  COMMITTED: [],
  ROLLED_BACK: [],
}

export class ScheduleTransactionTransitionError extends Error {
  code = 'INVALID_TRANSACTION_TRANSITION' as const

  constructor(from: ScheduleTransactionStatus, to: ScheduleTransactionStatus) {
    super(`Invalid schedule transaction transition: ${from} -> ${to}`)
    this.name = 'ScheduleTransactionTransitionError'
  }
}

export function isTransitionAllowed(
  from: ScheduleTransactionStatus,
  to: ScheduleTransactionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function assertTransitionAllowed(
  from: ScheduleTransactionStatus,
  to: ScheduleTransactionStatus,
): void {
  if (!isTransitionAllowed(from, to)) {
    throw new ScheduleTransactionTransitionError(from, to)
  }
}

export function transitionScheduleTransactionStatus(
  from: ScheduleTransactionStatus,
  to: ScheduleTransactionStatus,
): ScheduleTransactionStatus {
  assertTransitionAllowed(from, to)
  return to
}
