import { describe, expect, it } from 'vitest'
import {
  buildForwardWeekWindow,
  computeWeekTagFromTimestamp,
  getIsoDateForWeekDay,
  getWeekDateRange,
  getWeekStartDate,
  shiftWeekTag,
} from '../week-tag'

describe('week-tag utilities', () => {
  it('ISO 주차를 계산한다', () => {
    const timestamp = Date.parse('2026-02-23T00:00:00.000Z')
    expect(computeWeekTagFromTimestamp(timestamp)).toBe('2026-W09')
  })

  it('weekTag에서 주 시작일(월요일)을 계산한다', () => {
    const monday = getWeekStartDate('2026-W09')
    expect(monday.toISOString().slice(0, 10)).toBe('2026-02-23')
  })

  it('요일별 ISO 날짜를 계산한다', () => {
    expect(getIsoDateForWeekDay('2026-W09', 'MON')).toBe('2026-02-23')
    expect(getIsoDateForWeekDay('2026-W09', 'THU')).toBe('2026-02-26')
    expect(getIsoDateForWeekDay('2026-W09', 'SAT')).toBe('2026-02-28')
  })

  it('활성 요일 기준 주차 날짜 범위를 계산한다', () => {
    expect(getWeekDateRange('2026-W09')).toEqual({
      startDate: '2026-02-23',
      endDate: '2026-02-28',
    })

    expect(getWeekDateRange('2026-W09', ['MON', 'TUE', 'WED', 'THU', 'FRI']))
      .toEqual({
        startDate: '2026-02-23',
        endDate: '2026-02-27',
      })
  })

  it('주차를 N주 이동한다', () => {
    expect(shiftWeekTag('2026-W09', 1)).toBe('2026-W10')
    expect(shiftWeekTag('2026-W09', -1)).toBe('2026-W08')
  })

  it('현재+미래 주차 윈도우를 생성한다', () => {
    expect(buildForwardWeekWindow('2026-W09', 3)).toEqual([
      '2026-W09',
      '2026-W10',
      '2026-W11',
      '2026-W12',
    ])
  })
})
