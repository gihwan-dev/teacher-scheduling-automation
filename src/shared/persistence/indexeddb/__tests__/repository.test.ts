import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../database'
import {
  loadAllSetupData,
  loadFixedEvents,
  loadSchoolConfig,
  loadSubjects,
  loadTeachers,
  saveAllSetupData,
  saveFixedEvents,
  saveSchoolConfig,
  saveSubjects,
  saveTeachers,
} from '../repository'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'

const ts = '2024-01-01T00:00:00.000Z'

const sampleSchoolConfig: SchoolConfig = {
  id: 'config-1',
  gradeCount: 3,
  classCountByGrade: { 1: 10, 2: 10, 3: 9 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 7,
  createdAt: ts,
  updatedAt: ts,
}

const sampleSubjects: Array<Subject> = [
  {
    id: 'sub-1',
    name: '수학',
    abbreviation: '수',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: 'sub-2',
    name: '영어',
    abbreviation: '영',
    track: 'COMMON',
    createdAt: ts,
    updatedAt: ts,
  },
]

const sampleTeachers: Array<Teacher> = [
  {
    id: 'teacher-1',
    name: '김교사',
    subjectIds: ['sub-1'],
    baseHoursPerWeek: 18,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 3 }],
    createdAt: ts,
    updatedAt: ts,
  },
]

const sampleFixedEvents: Array<FixedEvent> = [
  {
    id: 'event-1',
    type: 'FIXED_CLASS',
    description: '고정 수학',
    teacherId: 'teacher-1',
    subjectId: 'sub-1',
    grade: 1,
    classNumber: 1,
    day: 'MON',
    period: 1,
    createdAt: ts,
    updatedAt: ts,
  },
]

beforeEach(async () => {
  await db.schoolConfigs.clear()
  await db.subjects.clear()
  await db.teachers.clear()
  await db.fixedEvents.clear()
  await db.setupSnapshots.clear()
})

describe('SchoolConfig persistence', () => {
  it('저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveSchoolConfig(sampleSchoolConfig)
    const loaded = await loadSchoolConfig()
    expect(loaded).toEqual(sampleSchoolConfig)
  })
})

describe('Subjects persistence', () => {
  it('저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveSubjects(sampleSubjects)
    const loaded = await loadSubjects()
    expect(loaded).toEqual(expect.arrayContaining(sampleSubjects))
    expect(loaded).toHaveLength(sampleSubjects.length)
  })
})

describe('Teachers persistence', () => {
  it('저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveTeachers(sampleTeachers)
    const loaded = await loadTeachers()
    expect(loaded).toEqual(sampleTeachers)
  })
})

describe('FixedEvents persistence', () => {
  it('저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveFixedEvents(sampleFixedEvents)
    const loaded = await loadFixedEvents()
    expect(loaded).toEqual(sampleFixedEvents)
  })
})

describe('Full setup round-trip', () => {
  it('전체 데이터 저장 후 로드하면 동일한 데이터 반환', async () => {
    await saveAllSetupData({
      schoolConfig: sampleSchoolConfig,
      subjects: sampleSubjects,
      teachers: sampleTeachers,
      fixedEvents: sampleFixedEvents,
    })

    const loaded = await loadAllSetupData()
    expect(loaded.schoolConfig).toEqual(sampleSchoolConfig)
    expect(loaded.subjects).toEqual(expect.arrayContaining(sampleSubjects))
    expect(loaded.teachers).toEqual(sampleTeachers)
    expect(loaded.fixedEvents).toEqual(sampleFixedEvents)
  })

  it('빈 상태에서 로드하면 기본값 반환', async () => {
    const loaded = await loadAllSetupData()
    expect(loaded.schoolConfig).toBeUndefined()
    expect(loaded.subjects).toEqual([])
    expect(loaded.teachers).toEqual([])
    expect(loaded.fixedEvents).toEqual([])
  })

  it('데이터 덮어쓰기가 정상 동작한다', async () => {
    await saveAllSetupData({
      schoolConfig: sampleSchoolConfig,
      subjects: sampleSubjects,
      teachers: sampleTeachers,
      fixedEvents: sampleFixedEvents,
    })

    const updatedConfig = {
      ...sampleSchoolConfig,
      periodsPerDay: 8,
      updatedAt: '2024-02-01T00:00:00.000Z',
    }
    await saveAllSetupData({
      schoolConfig: updatedConfig,
      subjects: [sampleSubjects[0]],
      teachers: [],
      fixedEvents: [],
    })

    const loaded = await loadAllSetupData()
    expect(loaded.schoolConfig?.periodsPerDay).toBe(8)
    expect(loaded.subjects).toHaveLength(1)
    expect(loaded.teachers).toHaveLength(0)
    expect(loaded.fixedEvents).toHaveLength(0)
  })
})
