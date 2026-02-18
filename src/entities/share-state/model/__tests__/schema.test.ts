import { describe, expect, it } from 'vitest'
import { sharePayloadSchema } from '../schema'

const validPayload = {
  v: 1,
  meta: { score: 85.5, genMs: 1200, ts: '2024-01-01T00:00:00.000Z' },
  school: { g: 2, c: { 1: 2, 2: 2 }, d: [0, 1, 2, 3, 4], p: 7 },
  subjects: [
    { n: '국어', a: '국', t: 0 },
    { n: '수학', a: '수', t: 0 },
  ],
  teachers: [
    { n: '김교사', s: [0], h: 20, ca: [[1, 1, 5]] },
    { n: '이교사', s: [1], h: 18, ca: [[1, 2, 4]] },
  ],
  grid: [
    { i: 0, t: 0, s: 0, f: 0 },
    { i: 42, t: 1, s: 1, f: 7 },
  ],
  policy: { sc: 2, tc: 4, td: 6 },
  teacherPolicies: [{ ti: 0, av: [[4, 7]], tp: 0, mco: 3, mdo: null }],
}

describe('sharePayloadSchema', () => {
  it('유효한 payload를 통과시킨다', () => {
    expect(sharePayloadSchema.safeParse(validPayload).success).toBe(true)
  })

  it('빈 grid/teacherPolicies도 통과한다', () => {
    const minimal = { ...validPayload, grid: [], teacherPolicies: [] }
    expect(sharePayloadSchema.safeParse(minimal).success).toBe(true)
  })

  it('지원하지 않는 버전을 거부한다', () => {
    const bad = { ...validPayload, v: 3 }
    expect(sharePayloadSchema.safeParse(bad).success).toBe(false)
  })

  it('필수 필드 누락을 거부한다', () => {
    const { meta: _, ...noMeta } = validPayload
    expect(sharePayloadSchema.safeParse(noMeta).success).toBe(false)
  })

  it('교사의 과목 인덱스가 범위를 초과하면 거부한다', () => {
    const bad = {
      ...validPayload,
      teachers: [{ n: '교사', s: [99], h: 10, ca: [] }],
    }
    expect(sharePayloadSchema.safeParse(bad).success).toBe(false)
  })

  it('셀의 교사 인덱스가 범위를 초과하면 거부한다', () => {
    const bad = {
      ...validPayload,
      grid: [{ i: 0, t: 99, s: 0, f: 0 }],
    }
    expect(sharePayloadSchema.safeParse(bad).success).toBe(false)
  })

  it('셀의 과목 인덱스가 범위를 초과하면 거부한다', () => {
    const bad = {
      ...validPayload,
      grid: [{ i: 0, t: 0, s: 99, f: 0 }],
    }
    expect(sharePayloadSchema.safeParse(bad).success).toBe(false)
  })

  it('교사정책의 교사 인덱스가 범위를 초과하면 거부한다', () => {
    const bad = {
      ...validPayload,
      teacherPolicies: [{ ti: 99, av: [], tp: 0, mco: null, mdo: null }],
    }
    expect(sharePayloadSchema.safeParse(bad).success).toBe(false)
  })

  it('flags가 0~7 범위를 초과하면 거부한다', () => {
    const bad = {
      ...validPayload,
      grid: [{ i: 0, t: 0, s: 0, f: 8 }],
    }
    expect(sharePayloadSchema.safeParse(bad).success).toBe(false)
  })

  it('flags가 음수이면 거부한다', () => {
    const bad = {
      ...validPayload,
      grid: [{ i: 0, t: 0, s: 0, f: -1 }],
    }
    expect(sharePayloadSchema.safeParse(bad).success).toBe(false)
  })

  it('요일 인덱스가 0~5 범위를 초과하면 거부한다', () => {
    const bad = { ...validPayload, school: { ...validPayload.school, d: [6] } }
    expect(sharePayloadSchema.safeParse(bad).success).toBe(false)
  })

  it('과목 track 인덱스가 범위를 초과하면 거부한다', () => {
    const bad = {
      ...validPayload,
      subjects: [{ n: '과목', a: 'X', t: 99 }],
    }
    expect(sharePayloadSchema.safeParse(bad).success).toBe(false)
  })
})
