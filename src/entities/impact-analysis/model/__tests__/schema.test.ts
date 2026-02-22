import { describe, expect, it } from 'vitest'
import {
  impactAnalysisReportSchema,
  impactRiskLevelSchema,
} from '../schema'

const validReport = {
  id: 'impact-1',
  snapshotId: 'snapshot-1',
  weekTag: '2026-W08',
  affectedTeachers: [{ teacherName: '김민준', summary: '배치 변경 1건' }],
  affectedClasses: [{ grade: 1, classNumber: 1, summary: '변경 슬롯 2건' }],
  hourDelta: [{ target: '김민준(월)', delta: 1 }],
  riskLevel: 'LOW' as const,
  alternatives: ['화 3교시 이동 +0.2점 / 위반 0건'],
  createdAt: '2026-02-22T00:00:00.000Z',
}

describe('impactRiskLevelSchema', () => {
  it('유효한 리스크 레벨을 허용한다', () => {
    expect(impactRiskLevelSchema.safeParse('LOW').success).toBe(true)
    expect(impactRiskLevelSchema.safeParse('MEDIUM').success).toBe(true)
    expect(impactRiskLevelSchema.safeParse('HIGH').success).toBe(true)
  })

  it('유효하지 않은 리스크 레벨을 거부한다', () => {
    expect(impactRiskLevelSchema.safeParse('CRITICAL').success).toBe(false)
  })
})

describe('impactAnalysisReportSchema', () => {
  it('유효한 리포트를 통과시킨다', () => {
    expect(impactAnalysisReportSchema.safeParse(validReport).success).toBe(true)
  })

  it('필수 필드가 없으면 실패한다', () => {
    expect(
      impactAnalysisReportSchema.safeParse({
        ...validReport,
        snapshotId: '',
      }).success,
    ).toBe(false)
  })

  it('alternatives 항목은 빈 문자열을 허용하지 않는다', () => {
    expect(
      impactAnalysisReportSchema.safeParse({
        ...validReport,
        alternatives: [''],
      }).success,
    ).toBe(false)
  })
})
