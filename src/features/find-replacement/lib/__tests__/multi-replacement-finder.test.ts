import { describe, expect, it } from 'vitest'
import {
  findMultiReplacementCandidates,
  isCombinationCompatible,
} from '../multi-replacement-finder'
import type { ReplacementFinderContext } from '../replacement-finder'
import type { CellKey, TimetableCell } from '@/entities/timetable'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { SchoolConfig } from '@/entities/school'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type {
  ReplacementCandidate,
  ReplacementSearchConfig,
} from '../../model/types'
import type { DayOfWeek } from '@/shared/lib/types'

function makeCell(
  overrides: Partial<TimetableCell> &
    Pick<TimetableCell, 'teacherId' | 'subjectId' | 'day' | 'period'>,
): TimetableCell {
  return {
    grade: 1,
    classNumber: 1,
    isFixed: false,
    status: 'BASE',
    ...overrides,
  }
}

function makeCellKey(
  grade: number,
  classNumber: number,
  day: DayOfWeek,
  period: number,
): CellKey {
  return `${grade}-${classNumber}-${day}-${period}`
}

const defaultPolicy: ConstraintPolicy = {
  id: 'p1',
  studentMaxConsecutiveSameSubject: 2,
  teacherMaxConsecutiveHours: 4,
  teacherMaxDailyHours: 6,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

const defaultSchoolConfig: SchoolConfig = {
  id: 'sc1',
  gradeCount: 1,
  classCountByGrade: { 1: 1 },
  activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periodsPerDay: 6,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

const defaultConfig: ReplacementSearchConfig = {
  scope: 'SAME_CLASS',
  includeViolating: false,
  maxCandidates: 20,
}

const defaultTeachers: Array<Teacher> = [
  {
    id: 'T1',
    name: '교사1',
    subjectIds: ['S1'],
    baseHoursPerWeek: 2,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 2 }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'T2',
    name: '교사2',
    subjectIds: ['S2'],
    baseHoursPerWeek: 2,
    classAssignments: [{ grade: 1, classNumber: 1, hoursPerWeek: 2 }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
]

const defaultSubjects: Array<Subject> = [
  {
    id: 'S1',
    name: '과목1',
    abbreviation: '과1',
    track: 'COMMON',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'S2',
    name: '과목2',
    abbreviation: '과2',
    track: 'COMMON',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
]

function makeContext(
  overrides?: Partial<ReplacementFinderContext>,
): ReplacementFinderContext {
  return {
    schoolConfig: defaultSchoolConfig,
    constraintPolicy: defaultPolicy,
    teacherPolicies: [],
    fixedEvents: [],
    teachers: defaultTeachers,
    subjects: defaultSubjects,
    weekTag: '2026-W09',
    academicCalendarEvents: [],
    ...overrides,
  }
}

describe('isCombinationCompatible', () => {
  it('독립적인 후보 조합은 호환된다', () => {
    const combo = [
      {
        sourceKey: '1-1-MON-1' as CellKey,
        candidate: {
          type: 'SWAP' as const,
          sourceCellKey: '1-1-MON-1' as CellKey,
          targetCellKey: '1-1-MON-2' as CellKey,
          resultTargetCell: makeCell({
            teacherId: 'T1',
            subjectId: 'S1',
            day: 'MON',
            period: 2,
          }),
          resultSourceCell: makeCell({
            teacherId: 'T2',
            subjectId: 'S2',
            day: 'MON',
            period: 1,
          }),
        } as ReplacementCandidate,
      },
      {
        sourceKey: '1-1-TUE-1' as CellKey,
        candidate: {
          type: 'SWAP' as const,
          sourceCellKey: '1-1-TUE-1' as CellKey,
          targetCellKey: '1-1-TUE-2' as CellKey,
          resultTargetCell: makeCell({
            teacherId: 'T3',
            subjectId: 'S3',
            day: 'TUE',
            period: 2,
          }),
          resultSourceCell: makeCell({
            teacherId: 'T4',
            subjectId: 'S4',
            day: 'TUE',
            period: 1,
          }),
        } as ReplacementCandidate,
      },
    ]

    expect(isCombinationCompatible(combo)).toBe(true)
  })

  it('같은 슬롯을 건드리는 조합을 거부한다', () => {
    const combo = [
      {
        sourceKey: '1-1-MON-1' as CellKey,
        candidate: {
          type: 'SWAP' as const,
          sourceCellKey: '1-1-MON-1' as CellKey,
          targetCellKey: '1-1-MON-3' as CellKey,
          resultTargetCell: makeCell({
            teacherId: 'T1',
            subjectId: 'S1',
            day: 'MON',
            period: 3,
          }),
          resultSourceCell: makeCell({
            teacherId: 'T3',
            subjectId: 'S3',
            day: 'MON',
            period: 1,
          }),
        } as ReplacementCandidate,
      },
      {
        sourceKey: '1-1-MON-2' as CellKey,
        candidate: {
          type: 'SWAP' as const,
          sourceCellKey: '1-1-MON-2' as CellKey,
          targetCellKey: '1-1-MON-3' as CellKey, // 같은 타겟 슬롯!
          resultTargetCell: makeCell({
            teacherId: 'T2',
            subjectId: 'S2',
            day: 'MON',
            period: 3,
          }),
          resultSourceCell: makeCell({
            teacherId: 'T3',
            subjectId: 'S3',
            day: 'MON',
            period: 2,
          }),
        } as ReplacementCandidate,
      },
    ]

    expect(isCombinationCompatible(combo)).toBe(false)
  })

  it('교사 시간 충돌이 있는 조합을 감지한다', () => {
    // T1이 MON-2와 TUE-2 모두에 배치되는 건 OK (다른 요일)
    // 하지만 T1이 MON-2에 두 번 배치되면 충돌
    const combo = [
      {
        sourceKey: '1-1-MON-1' as CellKey,
        candidate: {
          type: 'MOVE' as const,
          sourceCellKey: '1-1-MON-1' as CellKey,
          targetCellKey: '1-1-MON-3' as CellKey,
          resultTargetCell: makeCell({
            teacherId: 'T1',
            subjectId: 'S1',
            day: 'MON',
            period: 3,
          }),
          resultSourceCell: null,
        } as ReplacementCandidate,
      },
      {
        sourceKey: '1-1-TUE-1' as CellKey,
        candidate: {
          type: 'MOVE' as const,
          sourceCellKey: '1-1-TUE-1' as CellKey,
          targetCellKey: '1-1-MON-4' as CellKey,
          resultTargetCell: makeCell({
            teacherId: 'T1',
            subjectId: 'S2',
            day: 'MON',
            period: 3,
          }), // T1이 MON-3에 또 배치
          resultSourceCell: null,
        } as ReplacementCandidate,
      },
    ]

    expect(isCombinationCompatible(combo)).toBe(false)
  })
})

describe('findMultiReplacementCandidates', () => {
  it('독립 소스의 조합 후보를 생성한다', () => {
    const cells: Array<TimetableCell> = [
      makeCell({ teacherId: 'T1', subjectId: 'S1', day: 'MON', period: 1 }),
      makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'MON', period: 2 }),
      makeCell({ teacherId: 'T3', subjectId: 'S3', day: 'TUE', period: 1 }),
      makeCell({ teacherId: 'T4', subjectId: 'S4', day: 'TUE', period: 2 }),
    ]

    const sourceKeys: Array<CellKey> = [
      makeCellKey(1, 1, 'MON', 1),
      makeCellKey(1, 1, 'TUE', 1),
    ]

    const result = findMultiReplacementCandidates(
      sourceKeys,
      cells,
      defaultConfig,
      makeContext(),
    )

    expect(result.perSourceResults).toHaveLength(2)
    expect(result.stats.totalCombinationsExamined).toBeGreaterThan(0)
  })

  it('소스 중 하나에 후보가 없으면 결과가 비어있다', () => {
    // MON만 1교시, 슬롯 1개 → MON-1에서 교체 후보 없음
    const schoolConfig: SchoolConfig = {
      ...defaultSchoolConfig,
      activeDays: ['MON'],
      periodsPerDay: 1,
    }
    const cells: Array<TimetableCell> = [
      makeCell({ teacherId: 'T1', subjectId: 'S1', day: 'MON', period: 1 }),
    ]
    const sourceKeys: Array<CellKey> = [makeCellKey(1, 1, 'MON', 1)]

    const result = findMultiReplacementCandidates(
      sourceKeys,
      cells,
      defaultConfig,
      makeContext({ schoolConfig }),
    )

    expect(result.candidates).toHaveLength(0)
  })

  it('결과에 per-source 결과가 포함된다', () => {
    const cells: Array<TimetableCell> = [
      makeCell({ teacherId: 'T1', subjectId: 'S1', day: 'MON', period: 1 }),
      makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'TUE', period: 1 }),
    ]
    const sourceKeys: Array<CellKey> = [
      makeCellKey(1, 1, 'MON', 1),
      makeCellKey(1, 1, 'TUE', 1),
    ]

    const result = findMultiReplacementCandidates(
      sourceKeys,
      cells,
      defaultConfig,
      makeContext(),
    )

    expect(result.perSourceResults).toHaveLength(2)
    expect(result.perSourceResults[0].sourceKey).toBe(sourceKeys[0])
    expect(result.perSourceResults[1].sourceKey).toBe(sourceKeys[1])
  })

  it('stats에 timedOut 플래그를 반환한다', () => {
    const cells: Array<TimetableCell> = [
      makeCell({ teacherId: 'T1', subjectId: 'S1', day: 'MON', period: 1 }),
      makeCell({ teacherId: 'T2', subjectId: 'S2', day: 'TUE', period: 1 }),
    ]
    const sourceKeys: Array<CellKey> = [makeCellKey(1, 1, 'MON', 1)]

    const result = findMultiReplacementCandidates(
      sourceKeys,
      cells,
      defaultConfig,
      makeContext(),
    )

    expect(typeof result.stats.timedOut).toBe('boolean')
    expect(typeof result.stats.searchTimeMs).toBe('number')
  })
})
