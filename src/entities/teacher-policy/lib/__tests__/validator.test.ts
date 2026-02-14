import { describe, expect, it } from 'vitest'
import { validateAllPolicies, validateTeacherPolicy } from '../validator'
import type { TeacherPolicy } from '../../model/types'
import type { Teacher } from '@/entities/teacher'
import type { SchoolConfig } from '@/entities/school'

function createSchoolConfig(overrides?: Partial<SchoolConfig>): SchoolConfig {
  return {
    id: 'school-1',
    gradeCount: 1,
    classCountByGrade: { 1: 2 },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    periodsPerDay: 6,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function createTeacher(overrides?: Partial<Teacher>): Teacher {
  return {
    id: 'teacher-1',
    name: '김교사',
    subjectIds: ['subject-1'],
    baseHoursPerWeek: 10,
    classAssignments: [
      { grade: 1, classNumber: 1, hoursPerWeek: 5 },
      { grade: 1, classNumber: 2, hoursPerWeek: 5 },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function createPolicy(overrides?: Partial<TeacherPolicy>): TeacherPolicy {
  return {
    id: 'policy-1',
    teacherId: 'teacher-1',
    avoidanceSlots: [],
    timePreference: 'NONE',
    maxConsecutiveHoursOverride: null,
    maxDailyHoursOverride: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('validateTeacherPolicy', () => {
  it('회피 없는 정상 정책은 메시지 없음', () => {
    const policy = createPolicy()
    const teacher = createTeacher()
    const config = createSchoolConfig()

    const messages = validateTeacherPolicy(policy, teacher, config)
    expect(messages).toHaveLength(0)
  })

  it('규칙 1: 모든 가용 슬롯 회피 → error + 가이드', () => {
    const config = createSchoolConfig()
    const allSlots = config.activeDays.flatMap((day) =>
      Array.from({ length: config.periodsPerDay }, (_, i) => ({ day, period: i + 1 })),
    )
    const policy = createPolicy({ avoidanceSlots: allSlots })
    const teacher = createTeacher()

    const messages = validateTeacherPolicy(policy, teacher, config)
    const error = messages.find((m) => m.severity === 'error')
    expect(error).toBeDefined()
    expect(error!.message).toContain('모든 가용 시간이 회피로 설정')
    expect(error!.guide).toContain('해제')
  })

  it('규칙 2: 가용 슬롯 < 기준 시수 → error + 해제 수량 안내', () => {
    const config = createSchoolConfig()
    // 총 슬롯: 5일 * 6교시 = 30, 교사 시수: 10
    // 25개 회피 → 가용 5개 < 시수 10
    const avoidanceSlots = config.activeDays
      .flatMap((day) =>
        Array.from({ length: config.periodsPerDay }, (_, i) => ({ day, period: i + 1 })),
      )
      .slice(0, 25)
    const policy = createPolicy({ avoidanceSlots })
    const teacher = createTeacher()

    const messages = validateTeacherPolicy(policy, teacher, config)
    const error = messages.find(
      (m) => m.severity === 'error' && m.message.includes('가용 슬롯'),
    )
    expect(error).toBeDefined()
    expect(error!.guide).toContain('5개 이상')
  })

  it('규칙 3: 회피 비율 80% 이상 → warning', () => {
    const config = createSchoolConfig()
    // 총 슬롯 30, 80% = 24개 회피, 가용 6개 (시수 5만 되도록 교사 조정)
    const avoidanceSlots = config.activeDays
      .flatMap((day) =>
        Array.from({ length: config.periodsPerDay }, (_, i) => ({ day, period: i + 1 })),
      )
      .slice(0, 24)
    const policy = createPolicy({ avoidanceSlots })
    const teacher = createTeacher({
      classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 3 }],
    })

    const messages = validateTeacherPolicy(policy, teacher, config)
    const warning = messages.find(
      (m) => m.severity === 'warning' && m.message.includes('배치 난이도'),
    )
    expect(warning).toBeDefined()
    expect(warning!.message).toContain('80%')
  })

  it('규칙 4: 비운영 요일 회피 → warning (무시됨 안내)', () => {
    const config = createSchoolConfig({ activeDays: ['MON', 'TUE', 'WED'] })
    const policy = createPolicy({
      avoidanceSlots: [{ day: 'SAT', period: 1 }],
    })
    const teacher = createTeacher({
      classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 2 }],
    })

    const messages = validateTeacherPolicy(policy, teacher, config)
    const warning = messages.find(
      (m) => m.severity === 'warning' && m.message.includes('비운영'),
    )
    expect(warning).toBeDefined()
    expect(warning!.message).toContain('무시됨')
  })

  it('규칙 4: 범위 밖 교시 회피 → warning (무시됨 안내)', () => {
    const config = createSchoolConfig({ periodsPerDay: 4 })
    const policy = createPolicy({
      avoidanceSlots: [{ day: 'MON', period: 5 }],
    })
    const teacher = createTeacher({
      classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 2 }],
    })

    const messages = validateTeacherPolicy(policy, teacher, config)
    const warning = messages.find(
      (m) => m.severity === 'warning' && m.message.includes('비운영'),
    )
    expect(warning).toBeDefined()
  })

  it('규칙 5: maxConsecutiveHoursOverride < 1 → error', () => {
    const policy = createPolicy({ maxConsecutiveHoursOverride: 0 })
    const teacher = createTeacher()
    const config = createSchoolConfig()

    const messages = validateTeacherPolicy(policy, teacher, config)
    const error = messages.find(
      (m) => m.severity === 'error' && m.message.includes('연강 허용 한도'),
    )
    expect(error).toBeDefined()
  })

  it('규칙 5: maxDailyHoursOverride < 1 → error', () => {
    const policy = createPolicy({ maxDailyHoursOverride: 0 })
    const teacher = createTeacher()
    const config = createSchoolConfig()

    const messages = validateTeacherPolicy(policy, teacher, config)
    const error = messages.find(
      (m) => m.severity === 'error' && m.message.includes('일일 최대 시수'),
    )
    expect(error).toBeDefined()
  })

  it('override null은 에러 없음', () => {
    const policy = createPolicy({
      maxConsecutiveHoursOverride: null,
      maxDailyHoursOverride: null,
    })
    const teacher = createTeacher()
    const config = createSchoolConfig()

    const messages = validateTeacherPolicy(policy, teacher, config)
    expect(messages).toHaveLength(0)
  })

  it('유효한 override 값은 에러 없음', () => {
    const policy = createPolicy({
      maxConsecutiveHoursOverride: 3,
      maxDailyHoursOverride: 5,
    })
    const teacher = createTeacher()
    const config = createSchoolConfig()

    const messages = validateTeacherPolicy(policy, teacher, config)
    expect(messages).toHaveLength(0)
  })
})

describe('validateAllPolicies', () => {
  it('에러가 있으면 valid: false', () => {
    const config = createSchoolConfig()
    const allSlots = config.activeDays.flatMap((day) =>
      Array.from({ length: config.periodsPerDay }, (_, i) => ({ day, period: i + 1 })),
    )
    const policies = [createPolicy({ avoidanceSlots: allSlots })]
    const teachers = [createTeacher()]

    const result = validateAllPolicies(policies, teachers, config)
    expect(result.valid).toBe(false)
    expect(result.messages.some((m) => m.severity === 'error')).toBe(true)
  })

  it('에러 없으면 valid: true', () => {
    const config = createSchoolConfig()
    const policies = [createPolicy()]
    const teachers = [createTeacher()]

    const result = validateAllPolicies(policies, teachers, config)
    expect(result.valid).toBe(true)
  })

  it('경고만 있으면 valid: true', () => {
    const config = createSchoolConfig({ activeDays: ['MON', 'TUE', 'WED'] })
    const policies = [
      createPolicy({
        avoidanceSlots: [{ day: 'SAT', period: 1 }],
      }),
    ]
    const teachers = [
      createTeacher({
        classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 2 }],
      }),
    ]

    const result = validateAllPolicies(policies, teachers, config)
    expect(result.valid).toBe(true)
    expect(result.messages.some((m) => m.severity === 'warning')).toBe(true)
  })

  it('존재하지 않는 교사 정책은 무시', () => {
    const config = createSchoolConfig()
    const policies = [createPolicy({ teacherId: 'nonexistent' })]
    const teachers = [createTeacher()]

    const result = validateAllPolicies(policies, teachers, config)
    expect(result.valid).toBe(true)
    expect(result.messages).toHaveLength(0)
  })

  it('다수 교사 정책 혼합 검증', () => {
    const config = createSchoolConfig()
    const teacher1 = createTeacher({ id: 'teacher-1', name: '김교사' })
    const teacher2 = createTeacher({ id: 'teacher-2', name: '이교사' })

    const policies = [
      createPolicy({ id: 'p1', teacherId: 'teacher-1' }),
      createPolicy({
        id: 'p2',
        teacherId: 'teacher-2',
        maxDailyHoursOverride: 0,
      }),
    ]

    const result = validateAllPolicies(policies, [teacher1, teacher2], config)
    expect(result.valid).toBe(false)
    expect(result.messages.filter((m) => m.teacherId === 'teacher-2')).toHaveLength(1)
  })
})
