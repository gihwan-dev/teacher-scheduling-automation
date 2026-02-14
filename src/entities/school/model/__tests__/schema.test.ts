import { describe, expect, it } from 'vitest'
import { schoolConfigSchema } from '../schema'

describe('schoolConfigSchema', () => {
  const validConfig = {
    id: 'test-id',
    gradeCount: 3,
    classCountByGrade: { 1: 10, 2: 10, 3: 9 },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] as const,
    periodsPerDay: 7,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('유효한 설정을 통과시킨다', () => {
    const result = schoolConfigSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
  })

  it('gradeCount가 0이면 실패한다', () => {
    const result = schoolConfigSchema.safeParse({ ...validConfig, gradeCount: 0 })
    expect(result.success).toBe(false)
  })

  it('gradeCount가 4이면 실패한다', () => {
    const result = schoolConfigSchema.safeParse({ ...validConfig, gradeCount: 4 })
    expect(result.success).toBe(false)
  })

  it('periodsPerDay가 0이면 실패한다', () => {
    const result = schoolConfigSchema.safeParse({ ...validConfig, periodsPerDay: 0 })
    expect(result.success).toBe(false)
  })

  it('periodsPerDay가 11이면 실패한다', () => {
    const result = schoolConfigSchema.safeParse({ ...validConfig, periodsPerDay: 11 })
    expect(result.success).toBe(false)
  })

  it('activeDays가 비어있으면 실패한다', () => {
    const result = schoolConfigSchema.safeParse({ ...validConfig, activeDays: [] })
    expect(result.success).toBe(false)
  })

  it('잘못된 요일이면 실패한다', () => {
    const result = schoolConfigSchema.safeParse({ ...validConfig, activeDays: ['INVALID'] })
    expect(result.success).toBe(false)
  })

  it('classCountByGrade 반 수가 0이면 실패한다', () => {
    const result = schoolConfigSchema.safeParse({
      ...validConfig,
      classCountByGrade: { 1: 0 },
    })
    expect(result.success).toBe(false)
  })

  it('id가 비어있으면 실패한다', () => {
    const result = schoolConfigSchema.safeParse({ ...validConfig, id: '' })
    expect(result.success).toBe(false)
  })
})
