import { describe, expect, it } from 'vitest'
import {
  cellStatusSchema,
  timetableCellSchema,
  timetableSnapshotSchema,
} from '../schema'

describe('timetableCellSchema', () => {
  const validCell = {
    teacherId: 'teacher-1',
    subjectId: 'subject-1',
    grade: 1,
    classNumber: 1,
    day: 'MON' as const,
    period: 1,
    isFixed: false,
    status: 'BASE' as const,
  }

  it('유효한 셀을 통과시킨다', () => {
    expect(timetableCellSchema.safeParse(validCell).success).toBe(true)
  })

  it('status가 없으면 기본값 BASE가 적용된다', () => {
    const { status: _, ...cellWithoutStatus } = validCell
    const result = timetableCellSchema.safeParse(cellWithoutStatus)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('BASE')
    }
  })

  it('유효한 status 값을 통과시킨다', () => {
    for (const status of [
      'BASE',
      'TEMP_MODIFIED',
      'CONFIRMED_MODIFIED',
      'LOCKED',
    ] as const) {
      expect(
        timetableCellSchema.safeParse({ ...validCell, status }).success,
      ).toBe(true)
    }
  })

  it('잘못된 status 값을 거부한다', () => {
    expect(
      timetableCellSchema.safeParse({ ...validCell, status: 'INVALID' })
        .success,
    ).toBe(false)
  })

  it('teacherId가 빈 문자열이면 실패한다', () => {
    expect(
      timetableCellSchema.safeParse({ ...validCell, teacherId: '' }).success,
    ).toBe(false)
  })

  it('subjectId가 빈 문자열이면 실패한다', () => {
    expect(
      timetableCellSchema.safeParse({ ...validCell, subjectId: '' }).success,
    ).toBe(false)
  })

  it('grade가 0이면 실패한다', () => {
    expect(
      timetableCellSchema.safeParse({ ...validCell, grade: 0 }).success,
    ).toBe(false)
  })

  it('grade가 4이면 실패한다', () => {
    expect(
      timetableCellSchema.safeParse({ ...validCell, grade: 4 }).success,
    ).toBe(false)
  })

  it('period가 0이면 실패한다', () => {
    expect(
      timetableCellSchema.safeParse({ ...validCell, period: 0 }).success,
    ).toBe(false)
  })

  it('period가 11이면 실패한다', () => {
    expect(
      timetableCellSchema.safeParse({ ...validCell, period: 11 }).success,
    ).toBe(false)
  })
})

describe('cellStatusSchema', () => {
  it('유효한 status를 통과시킨다', () => {
    expect(cellStatusSchema.safeParse('BASE').success).toBe(true)
    expect(cellStatusSchema.safeParse('TEMP_MODIFIED').success).toBe(true)
    expect(cellStatusSchema.safeParse('CONFIRMED_MODIFIED').success).toBe(true)
    expect(cellStatusSchema.safeParse('LOCKED').success).toBe(true)
  })

  it('잘못된 status를 거부한다', () => {
    expect(cellStatusSchema.safeParse('INVALID').success).toBe(false)
    expect(cellStatusSchema.safeParse('').success).toBe(false)
  })
})

describe('timetableSnapshotSchema', () => {
  const validSnapshot = {
    id: 'snapshot-1',
    schoolConfigId: 'config-1',
    cells: [
      {
        teacherId: 'teacher-1',
        subjectId: 'subject-1',
        grade: 1,
        classNumber: 1,
        day: 'MON' as const,
        period: 1,
        isFixed: false,
        status: 'BASE' as const,
      },
    ],
    score: 85.5,
    generationTimeMs: 1200,
    createdAt: '2024-01-01T00:00:00.000Z',
  }

  it('유효한 스냅샷을 통과시킨다', () => {
    expect(timetableSnapshotSchema.safeParse(validSnapshot).success).toBe(true)
  })

  it('cells가 빈 배열이어도 통과한다', () => {
    expect(
      timetableSnapshotSchema.safeParse({ ...validSnapshot, cells: [] })
        .success,
    ).toBe(true)
  })

  it('score가 음수이면 실패한다', () => {
    expect(
      timetableSnapshotSchema.safeParse({ ...validSnapshot, score: -1 })
        .success,
    ).toBe(false)
  })

  it('generationTimeMs가 음수이면 실패한다', () => {
    expect(
      timetableSnapshotSchema.safeParse({
        ...validSnapshot,
        generationTimeMs: -1,
      }).success,
    ).toBe(false)
  })
})
