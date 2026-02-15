import { generateId } from './id'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import {
  saveAllSetupData,
  saveConstraintPolicy,
  saveTeacherPolicies,
} from '@/shared/persistence/indexeddb/repository'

/**
 * 2학년 × 2반, 과목 10개, 교사 10명의 시드 데이터를 생성하여 IndexedDB에 저장한다.
 * 개발 모드에서 브라우저 콘솔: window.__seedData()
 */
export async function seedSampleData(): Promise<void> {
  const now = new Date().toISOString()

  // ── 과목 (10개, 반당 합계 35시간) ──────────────────────
  const subjectDefs = [
    { name: '국어', abbreviation: '국어', track: 'COMMON' as const, hours: 5 },
    { name: '수학', abbreviation: '수학', track: 'COMMON' as const, hours: 5 },
    { name: '영어', abbreviation: '영어', track: 'COMMON' as const, hours: 5 },
    {
      name: '사회',
      abbreviation: '사회',
      track: 'SOCIAL_SCIENCE' as const,
      hours: 4,
    },
    {
      name: '과학',
      abbreviation: '과학',
      track: 'NATURAL_SCIENCE' as const,
      hours: 4,
    },
    {
      name: '체육',
      abbreviation: '체육',
      track: 'PHYSICAL' as const,
      hours: 3,
    },
    { name: '음악', abbreviation: '음악', track: 'ARTS' as const, hours: 2 },
    { name: '미술', abbreviation: '미술', track: 'ARTS' as const, hours: 2 },
    {
      name: '기술가정',
      abbreviation: '기가',
      track: 'OTHER' as const,
      hours: 3,
    },
    { name: '도덕', abbreviation: '도덕', track: 'COMMON' as const, hours: 2 },
  ] // 5+5+5+4+4+3+2+2+3+2 = 35

  const subjects: Array<Subject> = subjectDefs.map((d) => ({
    id: generateId(),
    name: d.name,
    abbreviation: d.abbreviation,
    track: d.track,
    createdAt: now,
    updatedAt: now,
  }))

  // ── 학교 설정 ──────────────────────────────────────────
  const schoolConfig: SchoolConfig = {
    id: generateId(),
    gradeCount: 2,
    classCountByGrade: { 1: 2, 2: 2 },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    periodsPerDay: 7,
    createdAt: now,
    updatedAt: now,
  }

  // ── 교사 (10명, 각 과목 1명 × 4반 전담) ───────────────
  const teacherDefs = [
    { name: '김민준', subjectIndex: 0 }, // 국어
    { name: '이서연', subjectIndex: 1 }, // 수학
    { name: '박지호', subjectIndex: 2 }, // 영어
    { name: '최유진', subjectIndex: 3 }, // 사회
    { name: '정하늘', subjectIndex: 4 }, // 과학
    { name: '한동윤', subjectIndex: 5 }, // 체육
    { name: '유서현', subjectIndex: 6 }, // 음악
    { name: '강예린', subjectIndex: 7 }, // 미술
    { name: '윤준서', subjectIndex: 8 }, // 기술가정
    { name: '임소윤', subjectIndex: 9 }, // 도덕
  ]

  const classes = [
    { grade: 1, classNumber: 1 },
    { grade: 1, classNumber: 2 },
    { grade: 2, classNumber: 1 },
    { grade: 2, classNumber: 2 },
  ]

  const teachers: Array<Teacher> = teacherDefs.map((td) => {
    const hours = subjectDefs[td.subjectIndex].hours
    return {
      id: generateId(),
      name: td.name,
      subjectIds: [subjects[td.subjectIndex].id],
      baseHoursPerWeek: hours * classes.length,
      classAssignments: classes.map((c) => ({
        grade: c.grade,
        classNumber: c.classNumber,
        hoursPerWeek: hours,
      })),
      createdAt: now,
      updatedAt: now,
    }
  })

  // ── 고정 이벤트 (3개) ─────────────────────────────────
  const fixedEvents: Array<FixedEvent> = [
    {
      id: generateId(),
      type: 'FIXED_CLASS',
      description: '1-1 체육 (운동장 배정)',
      teacherId: teachers[5].id, // 한동윤 (체육)
      subjectId: subjects[5].id, // 체육
      grade: 1,
      classNumber: 1,
      day: 'WED',
      period: 5,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      type: 'BUSINESS_TRIP',
      description: '이서연 교사 연수',
      teacherId: teachers[1].id, // 이서연 (수학)
      subjectId: null,
      grade: null,
      classNumber: null,
      day: 'FRI',
      period: 6,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      type: 'SCHOOL_EVENT',
      description: '전교 조회',
      teacherId: null,
      subjectId: null,
      grade: null,
      classNumber: null,
      day: 'MON',
      period: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]

  // ── 제약 정책 ──────────────────────────────────────────
  const constraintPolicy: ConstraintPolicy = {
    id: generateId(),
    studentMaxConsecutiveSameSubject: 2,
    teacherMaxConsecutiveHours: 4,
    teacherMaxDailyHours: 6,
    createdAt: now,
    updatedAt: now,
  }

  // ── 교사 조건 (일부 교사만) ────────────────────────────
  const teacherPolicies: Array<TeacherPolicy> = [
    {
      id: generateId(),
      teacherId: teachers[0].id, // 김민준 (국어)
      avoidanceSlots: [
        { day: 'MON', period: 1 },
        { day: 'FRI', period: 7 },
      ],
      timePreference: 'MORNING',
      maxConsecutiveHoursOverride: null,
      maxDailyHoursOverride: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      teacherId: teachers[4].id, // 정하늘 (과학)
      avoidanceSlots: [
        { day: 'MON', period: 7 },
        { day: 'FRI', period: 6 },
        { day: 'FRI', period: 7 },
      ],
      timePreference: 'AFTERNOON',
      maxConsecutiveHoursOverride: 3,
      maxDailyHoursOverride: 5,
      createdAt: now,
      updatedAt: now,
    },
  ]

  // ── 저장 ───────────────────────────────────────────────
  await saveAllSetupData({ schoolConfig, subjects, teachers, fixedEvents })
  await saveConstraintPolicy(constraintPolicy)
  await saveTeacherPolicies(teacherPolicies)

  console.log('✅ 시드 데이터 저장 완료! 페이지를 새로고침하세요.')
  console.log(`   학교: ${schoolConfig.gradeCount}학년 × 2반, 주 5일 7교시`)
  console.log(`   과목: ${subjects.length}개`)
  console.log(`   교사: ${teachers.length}명`)
  console.log(`   고정이벤트: ${fixedEvents.length}개`)
  console.log(`   교사조건: ${teacherPolicies.length}명`)
}
