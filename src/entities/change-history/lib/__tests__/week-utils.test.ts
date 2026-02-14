import { describe, expect, it } from 'vitest'
import { computeWeekTag, getWeekBoundary } from '../week-utils'

describe('computeWeekTag', () => {
  it('2026-02-09 (월) → 2026-W07', () => {
    // 2026-02-09 월요일 00:00 UTC
    const ts = Date.UTC(2026, 1, 9, 0, 0, 0)
    expect(computeWeekTag(ts)).toBe('2026-W07')
  })

  it('2026-02-15 (일) → 2026-W07 (같은 주)', () => {
    const ts = Date.UTC(2026, 1, 15, 23, 59, 59)
    expect(computeWeekTag(ts)).toBe('2026-W07')
  })

  it('2026-02-16 (월) → 2026-W08 (다음 주)', () => {
    const ts = Date.UTC(2026, 1, 16, 0, 0, 0)
    expect(computeWeekTag(ts)).toBe('2026-W08')
  })

  it('2026-01-01 (목) → 2026-W01', () => {
    const ts = Date.UTC(2026, 0, 1, 12, 0, 0)
    expect(computeWeekTag(ts)).toBe('2026-W01')
  })

  it('2025-12-29 (월) → 2026-W01 (연말→연초 경계)', () => {
    // 2025-12-29 월요일은 ISO 8601에서 2026-W01에 해당
    const ts = Date.UTC(2025, 11, 29, 0, 0, 0)
    expect(computeWeekTag(ts)).toBe('2026-W01')
  })

  it('주차 번호가 한 자리면 0 패딩된다', () => {
    const ts = Date.UTC(2026, 0, 5, 12, 0, 0) // 2026-01-05 월요일 = W02
    expect(computeWeekTag(ts)).toBe('2026-W02')
  })
})

describe('getWeekBoundary', () => {
  it('월요일 입력 시 같은 날 00:00 UTC 반환', () => {
    const ts = Date.UTC(2026, 1, 9, 14, 30, 0) // 월요일 14:30
    const boundary = getWeekBoundary(ts)
    expect(boundary).toBe(Date.UTC(2026, 1, 9, 0, 0, 0))
  })

  it('수요일 입력 시 해당 주 월요일 00:00 UTC 반환', () => {
    const ts = Date.UTC(2026, 1, 11, 10, 0, 0) // 수요일
    const boundary = getWeekBoundary(ts)
    expect(boundary).toBe(Date.UTC(2026, 1, 9, 0, 0, 0))
  })

  it('일요일 입력 시 해당 주 월요일 00:00 UTC 반환', () => {
    const ts = Date.UTC(2026, 1, 15, 10, 0, 0) // 일요일
    const boundary = getWeekBoundary(ts)
    expect(boundary).toBe(Date.UTC(2026, 1, 9, 0, 0, 0))
  })

  it('토요일 입력 시 해당 주 월요일 00:00 UTC 반환', () => {
    const ts = Date.UTC(2026, 1, 14, 10, 0, 0) // 토요일
    const boundary = getWeekBoundary(ts)
    expect(boundary).toBe(Date.UTC(2026, 1, 9, 0, 0, 0))
  })
})
