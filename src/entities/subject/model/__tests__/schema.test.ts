import { describe, expect, it } from 'vitest'
import { subjectSchema } from '../schema'

describe('subjectSchema', () => {
  const validSubject = {
    id: 'sub-1',
    name: '수학',
    abbreviation: '수',
    track: 'COMMON' as const,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('유효한 과목을 통과시킨다', () => {
    expect(subjectSchema.safeParse(validSubject).success).toBe(true)
  })

  it('name이 비어있으면 실패한다', () => {
    expect(subjectSchema.safeParse({ ...validSubject, name: '' }).success).toBe(
      false,
    )
  })

  it('abbreviation이 비어있으면 실패한다', () => {
    expect(
      subjectSchema.safeParse({ ...validSubject, abbreviation: '' }).success,
    ).toBe(false)
  })

  it('잘못된 track이면 실패한다', () => {
    expect(
      subjectSchema.safeParse({ ...validSubject, track: 'INVALID' }).success,
    ).toBe(false)
  })

  it('모든 유효한 track을 통과시킨다', () => {
    const tracks = [
      'COMMON',
      'NATURAL_SCIENCE',
      'SOCIAL_SCIENCE',
      'ARTS',
      'PHYSICAL',
      'OTHER',
    ]
    for (const track of tracks) {
      expect(subjectSchema.safeParse({ ...validSubject, track }).success).toBe(
        true,
      )
    }
  })
})
