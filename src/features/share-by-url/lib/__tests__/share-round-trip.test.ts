import { describe, expect, it } from 'vitest'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableSnapshot } from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import { sharePayloadSchema } from '@/entities/share-state'
import { compressToUrl, decompressFromUrl } from '@/shared/lib/url/compress'
import { restoreFromPayload } from '@/shared/lib/url/decoder'
import { buildSharePayload } from '@/shared/lib/url/encoder'

const schoolConfig: SchoolConfig = {
  id: 'sc-1',
  gradeCount: 2,
  classCountByGrade: { 1: 3, 2: 3 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const subjects: Array<Subject> = [
  {
    id: 'sub-1',
    name: '국어',
    abbreviation: '국',
    track: 'COMMON',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'sub-2',
    name: '수학',
    abbreviation: '수',
    track: 'NATURAL_SCIENCE',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'sub-3',
    name: '영어',
    abbreviation: '영',
    track: 'ARTS',
    createdAt: '',
    updatedAt: '',
  },
]

const teachers: Array<Teacher> = [
  {
    id: 'tea-1',
    name: '김교사',
    subjectIds: ['sub-1', 'sub-3'],
    baseHoursPerWeek: 20,
    homeroom: null,
    classAssignments: [
      { grade: 1, classNumber: 1, hoursPerWeek: 5 },
      { grade: 1, classNumber: 2, hoursPerWeek: 3 },
    ],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tea-2',
    name: '이교사',
    subjectIds: ['sub-2'],
    baseHoursPerWeek: 18,
    homeroom: null,
    classAssignments: [{ grade: 2, classNumber: 1, hoursPerWeek: 4 }],
    createdAt: '',
    updatedAt: '',
  },
]

const snapshot: TimetableSnapshot = {
  id: 'snap-1',
  schoolConfigId: 'sc-1',
  weekTag: '2024-W24',
  versionNo: 1,
  baseVersionId: null,
  appliedScope: {
    type: 'THIS_WEEK',
    fromWeek: '2024-W24',
    toWeek: null,
  },
  cells: [
    {
      teacherId: 'tea-1',
      subjectId: 'sub-1',
      grade: 1,
      classNumber: 1,
      day: 'MON',
      period: 1,
      isFixed: false,
      status: 'BASE',
    },
    {
      teacherId: 'tea-1',
      subjectId: 'sub-3',
      grade: 1,
      classNumber: 2,
      day: 'WED',
      period: 5,
      isFixed: true,
      status: 'LOCKED',
    },
    {
      teacherId: 'tea-2',
      subjectId: 'sub-2',
      grade: 2,
      classNumber: 1,
      day: 'FRI',
      period: 7,
      isFixed: false,
      status: 'TEMP_MODIFIED',
    },
  ],
  score: 92.3,
  generationTimeMs: 3500,
  createdAt: '2024-06-15T09:30:00.000Z',
}

const constraintPolicy: ConstraintPolicy = {
  id: 'cp-1',
  studentMaxConsecutiveSameSubject: 2,
  teacherMaxConsecutiveHours: 4,
  teacherMaxDailyHours: 7,
  createdAt: '',
  updatedAt: '',
}

const teacherPolicies: Array<TeacherPolicy> = [
  {
    id: 'tp-1',
    teacherId: 'tea-1',
    avoidanceSlots: [
      { day: 'FRI', period: 6 },
      { day: 'FRI', period: 7 },
    ],
    timePreference: 'MORNING',
    maxConsecutiveHoursOverride: 3,
    maxDailyHoursOverride: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tp-2',
    teacherId: 'tea-2',
    avoidanceSlots: [],
    timePreference: 'NONE',
    maxConsecutiveHoursOverride: null,
    maxDailyHoursOverride: 5,
    createdAt: '',
    updatedAt: '',
  },
]

describe('share round-trip', () => {
  it('encode → compress → decompress → validate → decode 후 데이터가 동치이다', () => {
    // 1. 인코딩
    const payload = buildSharePayload(
      schoolConfig,
      subjects,
      teachers,
      snapshot,
      constraintPolicy,
      teacherPolicies,
    )

    // 2. 압축 round-trip
    const json = JSON.stringify(payload)
    const compressed = compressToUrl(json)
    const decompressed = decompressFromUrl(compressed)
    expect(JSON.parse(decompressed)).toEqual(payload)

    // 3. Zod 검증
    const validated = sharePayloadSchema.parse(JSON.parse(decompressed))
    expect(validated).toEqual(payload)

    // 4. 디코딩
    const restored = restoreFromPayload(validated)

    // 5. 동치성 검증 — 구조적 데이터 비교 (UUID는 다르므로 값만 비교)
    expect(restored.schoolConfig.gradeCount).toBe(schoolConfig.gradeCount)
    expect(restored.schoolConfig.activeDays).toEqual(schoolConfig.activeDays)
    expect(restored.schoolConfig.periodsPerDay).toBe(schoolConfig.periodsPerDay)

    expect(restored.subjects).toHaveLength(subjects.length)
    restored.subjects.forEach((s, i) => {
      expect(s.name).toBe(subjects[i].name)
      expect(s.abbreviation).toBe(subjects[i].abbreviation)
      expect(s.track).toBe(subjects[i].track)
    })

    expect(restored.teachers).toHaveLength(teachers.length)
    restored.teachers.forEach((t, i) => {
      expect(t.name).toBe(teachers[i].name)
      expect(t.baseHoursPerWeek).toBe(teachers[i].baseHoursPerWeek)
      expect(t.classAssignments.length).toBe(
        teachers[i].classAssignments.length,
      )
    })

    expect(restored.snapshot.cells).toHaveLength(snapshot.cells.length)
    restored.snapshot.cells.forEach((cell, i) => {
      const orig = snapshot.cells[i]
      expect(cell.grade).toBe(orig.grade)
      expect(cell.classNumber).toBe(orig.classNumber)
      expect(cell.day).toBe(orig.day)
      expect(cell.period).toBe(orig.period)
      expect(cell.isFixed).toBe(orig.isFixed)
      expect(cell.status).toBe(orig.status)
    })

    expect(restored.snapshot.score).toBe(snapshot.score)
    expect(restored.snapshot.generationTimeMs).toBe(snapshot.generationTimeMs)
    expect(restored.snapshot.weekTag).toMatch(/^\d{4}-W\d{2}$/)
    expect(restored.snapshot.versionNo).toBe(1)
    expect(restored.snapshot.baseVersionId).toBeNull()
    expect(restored.snapshot.appliedScope.type).toBe('THIS_WEEK')
    expect(restored.snapshot.appliedScope.fromWeek).toBe(
      restored.snapshot.weekTag,
    )
    expect(restored.snapshot.appliedScope.toWeek).toBeNull()

    expect(restored.constraintPolicy.studentMaxConsecutiveSameSubject).toBe(2)
    expect(restored.constraintPolicy.teacherMaxConsecutiveHours).toBe(4)
    expect(restored.constraintPolicy.teacherMaxDailyHours).toBe(7)

    expect(restored.teacherPolicies).toHaveLength(2)
    expect(restored.teacherPolicies[0].avoidanceSlots).toEqual([
      { day: 'FRI', period: 6 },
      { day: 'FRI', period: 7 },
    ])
    expect(restored.teacherPolicies[0].timePreference).toBe('MORNING')
    expect(restored.teacherPolicies[1].maxDailyHoursOverride).toBe(5)
  })

  it('교사-과목 참조가 round-trip 후에도 일관적이다', () => {
    const payload = buildSharePayload(
      schoolConfig,
      subjects,
      teachers,
      snapshot,
      constraintPolicy,
      teacherPolicies,
    )
    const restored = restoreFromPayload(payload)

    // 김교사 → [국어, 영어] 참조
    expect(restored.teachers[0].subjectIds).toEqual([
      restored.subjects[0].id,
      restored.subjects[2].id,
    ])

    // 이교사 → [수학] 참조
    expect(restored.teachers[1].subjectIds).toEqual([restored.subjects[1].id])
  })

  it('셀의 teacher/subject 참조가 round-trip 후에도 일관적이다', () => {
    const payload = buildSharePayload(
      schoolConfig,
      subjects,
      teachers,
      snapshot,
      constraintPolicy,
      teacherPolicies,
    )
    const restored = restoreFromPayload(payload)

    // cell 0: 김교사, 국어
    expect(restored.snapshot.cells[0].teacherId).toBe(restored.teachers[0].id)
    expect(restored.snapshot.cells[0].subjectId).toBe(restored.subjects[0].id)

    // cell 1: 김교사, 영어
    expect(restored.snapshot.cells[1].teacherId).toBe(restored.teachers[0].id)
    expect(restored.snapshot.cells[1].subjectId).toBe(restored.subjects[2].id)

    // cell 2: 이교사, 수학
    expect(restored.snapshot.cells[2].teacherId).toBe(restored.teachers[1].id)
    expect(restored.snapshot.cells[2].subjectId).toBe(restored.subjects[1].id)
  })

  it('빈 시간표도 round-trip이 성공한다', () => {
    const emptySnapshot = { ...snapshot, cells: [] }
    const payload = buildSharePayload(
      schoolConfig,
      subjects,
      teachers,
      emptySnapshot,
      constraintPolicy,
      [],
    )
    const json = JSON.stringify(payload)
    const compressed = compressToUrl(json)
    const decompressed = decompressFromUrl(compressed)
    const validated = sharePayloadSchema.parse(JSON.parse(decompressed))
    const restored = restoreFromPayload(validated)

    expect(restored.snapshot.cells).toHaveLength(0)
    expect(restored.teacherPolicies).toHaveLength(0)
  })

  it('손상된 압축 문자열은 에러를 반환한다', () => {
    expect(() => decompressFromUrl('corrupted-data!!!')).toThrow()
  })

  it('잘못된 JSON은 파싱 에러를 반환한다', () => {
    const compressed = compressToUrl('not-a-json{{{')
    const decompressed = decompressFromUrl(compressed)
    expect(() => JSON.parse(decompressed)).toThrow()
  })
})
