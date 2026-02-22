import { describe, expect, it } from 'vitest'
import { restoreFromPayload } from '../decoder'
import type { SharePayload } from '../types'

const validPayload: SharePayload = {
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
    { i: 0, t: 0, s: 0, f: 0 }, // grade1, class1, MON, period1, BASE, !fixed
    { i: 42, t: 1, s: 1, f: 7 }, // grade1, class2, TUE, period3, LOCKED, fixed
  ],
  policy: { sc: 2, tc: 4, td: 6 },
  teacherPolicies: [{ ti: 0, av: [[4, 7]], tp: 0, mco: 3, mdo: null }],
}

describe('restoreFromPayload', () => {
  it('올바른 수의 과목을 복원한다', () => {
    const result = restoreFromPayload(validPayload)
    expect(result.subjects).toHaveLength(2)
    expect(result.subjects[0].name).toBe('국어')
    expect(result.subjects[1].name).toBe('수학')
  })

  it('올바른 수의 교사를 복원한다', () => {
    const result = restoreFromPayload(validPayload)
    expect(result.teachers).toHaveLength(2)
    expect(result.teachers[0].name).toBe('김교사')
    expect(result.teachers[1].name).toBe('이교사')
  })

  it('교사의 subjectIds가 새 UUID로 매핑된다', () => {
    const result = restoreFromPayload(validPayload)
    // 교사 0은 과목 0(국어)을 참조
    expect(result.teachers[0].subjectIds).toEqual([result.subjects[0].id])
    // 교사 1은 과목 1(수학)을 참조
    expect(result.teachers[1].subjectIds).toEqual([result.subjects[1].id])
  })

  it('셀 위치를 올바르게 디코딩한다', () => {
    const result = restoreFromPayload(validPayload)
    const cell0 = result.snapshot.cells[0]
    expect(cell0.grade).toBe(1)
    expect(cell0.classNumber).toBe(1)
    expect(cell0.day).toBe('MON')
    expect(cell0.period).toBe(1)
  })

  it('flags bitfield에서 isFixed와 status를 디코딩한다', () => {
    const result = restoreFromPayload(validPayload)
    // f=0 → status=BASE, isFixed=false
    expect(result.snapshot.cells[0].isFixed).toBe(false)
    expect(result.snapshot.cells[0].status).toBe('BASE')
    // f=7 → status=LOCKED(3), isFixed=true
    expect(result.snapshot.cells[1].isFixed).toBe(true)
    expect(result.snapshot.cells[1].status).toBe('LOCKED')
  })

  it('셀의 teacher/subject ID가 새 UUID로 매핑된다', () => {
    const result = restoreFromPayload(validPayload)
    const cell0 = result.snapshot.cells[0]
    expect(cell0.teacherId).toBe(result.teachers[0].id)
    expect(cell0.subjectId).toBe(result.subjects[0].id)
  })

  it('제약 정책을 올바르게 복원한다', () => {
    const result = restoreFromPayload(validPayload)
    expect(result.constraintPolicy.studentMaxConsecutiveSameSubject).toBe(2)
    expect(result.constraintPolicy.teacherMaxConsecutiveHours).toBe(4)
    expect(result.constraintPolicy.teacherMaxDailyHours).toBe(6)
  })

  it('교사 정책을 올바르게 복원한다', () => {
    const result = restoreFromPayload(validPayload)
    expect(result.teacherPolicies).toHaveLength(1)
    const tp = result.teacherPolicies[0]
    expect(tp.teacherId).toBe(result.teachers[0].id)
    expect(tp.avoidanceSlots).toEqual([{ day: 'FRI', period: 7 }])
    expect(tp.timePreference).toBe('MORNING')
    expect(tp.maxConsecutiveHoursOverride).toBe(3)
    expect(tp.maxDailyHoursOverride).toBeNull()
  })

  it('모든 ID가 유효한 UUID 형태이다', () => {
    const result = restoreFromPayload(validPayload)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    expect(result.schoolConfig.id).toMatch(uuidRegex)
    expect(result.snapshot.id).toMatch(uuidRegex)
    result.subjects.forEach((s) => expect(s.id).toMatch(uuidRegex))
    result.teachers.forEach((t) => expect(t.id).toMatch(uuidRegex))
  })

  it('빈 grid를 올바르게 복원한다', () => {
    const emptyPayload = { ...validPayload, grid: [] }
    const result = restoreFromPayload(emptyPayload)
    expect(result.snapshot.cells).toHaveLength(0)
  })

  it('스냅샷 주차/버전 기본 필드를 복원한다', () => {
    const result = restoreFromPayload(validPayload)
    expect(result.snapshot.weekTag).toMatch(/^\d{4}-W\d{2}$/)
    expect(result.snapshot.versionNo).toBe(1)
    expect(result.snapshot.baseVersionId).toBeNull()
    expect(result.snapshot.appliedScope).toEqual({
      type: 'THIS_WEEK',
      fromWeek: result.snapshot.weekTag,
      toWeek: null,
    })
  })
})
