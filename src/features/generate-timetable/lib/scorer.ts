import type { DayOfWeek } from '@/shared/lib/types'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { AssignmentUnit } from '../model/types'
import type { TimetableGrid } from './grid'

// 선호 제약 가중치
const WEIGHTS = {
  daySpread: 0.35,
  teacherConsecutive: 0.2,
  studentConsecutive: 0.2,
  teacherDailyBalance: 0.1,
  timePreference: 0.15,
}

/**
 * 개별 슬롯에 배치했을 때의 선호 제약 점수 (높을수록 좋음, 0~100)
 */
export function scoreSlot(
  grid: TimetableGrid,
  unit: AssignmentUnit,
  day: DayOfWeek,
  period: number,
  policy: ConstraintPolicy,
  activeDays: Array<DayOfWeek>,
  teacherPolicies?: Array<TeacherPolicy>,
  periodsPerDay?: number,
): number {
  let score = 0

  // 1. 과목 요일 균등 분배 (같은 반에서 이 과목이 이 요일에 이미 배치된 수가 적을수록 높음)
  const subjectCounts = grid.getClassDaySubjectCounts(unit.grade, unit.classNumber, day)
  const existingOnDay = subjectCounts.get(unit.subjectId) ?? 0
  const daySpreadScore = existingOnDay === 0 ? 100 : Math.max(0, 100 - existingOnDay * 50)
  score += WEIGHTS.daySpread * daySpreadScore

  // 2. 교사 연속 수업 최소화 (per-teacher override)
  const teacherPeriods = grid.getTeacherDayPeriods(unit.teacherId, day)
  const wouldBeConsecutive = countConsecutiveIfAdded(teacherPeriods, period)
  const tp = teacherPolicies?.find((p) => p.teacherId === unit.teacherId)
  const maxAllowed = tp?.maxConsecutiveHoursOverride ?? policy.teacherMaxConsecutiveHours
  const teacherConsecScore =
    wouldBeConsecutive <= maxAllowed - 1
      ? 100
      : wouldBeConsecutive === maxAllowed
        ? 40
        : Math.max(0, 100 - (wouldBeConsecutive - maxAllowed + 1) * 60)
  score += WEIGHTS.teacherConsecutive * teacherConsecScore

  // 3. 학생 동일과목 연강 최소화
  const currentStudentConsec = grid.getClassSubjectConsecutiveCount(
    unit.grade,
    unit.classNumber,
    day,
    unit.subjectId,
  )
  const adjacentSameSubject = hasAdjacentSameSubject(grid, unit, day, period)
  const studentConsecScore = adjacentSameSubject
    ? Math.max(0, 100 - (currentStudentConsec + 1) * 40)
    : 100
  score += WEIGHTS.studentConsecutive * studentConsecScore

  // 4. 교사 일별 시수 균형
  const hours: Array<number> = []
  for (const d of activeDays) {
    const h = grid.getTeacherDayHours(unit.teacherId, d)
    hours.push(d === day ? h + 1 : h)
  }
  const avg = hours.reduce((s, h) => s + h, 0) / hours.length
  const variance = hours.reduce((s, h) => s + (h - avg) ** 2, 0) / hours.length
  const balanceScore = Math.max(0, 100 - variance * 25)
  score += WEIGHTS.teacherDailyBalance * balanceScore

  // 5. 선호 시간대 점수
  const preference = tp?.timePreference ?? 'NONE'
  const midpoint = periodsPerDay ? Math.ceil(periodsPerDay / 2) : 3
  let prefScore: number
  if (preference === 'MORNING') {
    prefScore = period <= midpoint ? 100 : 20
  } else if (preference === 'AFTERNOON') {
    prefScore = period > midpoint ? 100 : 20
  } else {
    prefScore = 50
  }
  score += WEIGHTS.timePreference * prefScore

  return Math.round(score * 100) / 100
}

/**
 * 전체 시간표 점수 계산 (0~100)
 */
export function computeTotalScore(
  grid: TimetableGrid,
  policy: ConstraintPolicy,
  activeDays: Array<DayOfWeek>,
  periodsPerDay: number,
  teacherPolicies?: Array<TeacherPolicy>,
): number {
  const cells = grid.getAllCells()
  if (cells.length === 0) return 0

  let daySpreadTotal = 0
  let teacherConsecTotal = 0
  let studentConsecTotal = 0
  let teacherBalanceTotal = 0
  let timePrefTotal = 0

  // 과목 요일 분산: 반별로 각 과목의 요일 분포 균등 측정
  const classSubjectDayCounts = new Map<string, Map<string, number>>()
  for (const cell of cells) {
    const classKey = `${cell.grade}-${cell.classNumber}`
    const subjectDayKey = `${cell.subjectId}-${cell.day}`
    if (!classSubjectDayCounts.has(classKey)) {
      classSubjectDayCounts.set(classKey, new Map())
    }
    const map = classSubjectDayCounts.get(classKey)!
    map.set(subjectDayKey, (map.get(subjectDayKey) ?? 0) + 1)
  }

  // 반-과목별 요일 분산 점수
  const classSubjectHours = new Map<string, Map<string, number>>()
  for (const cell of cells) {
    const classKey = `${cell.grade}-${cell.classNumber}`
    if (!classSubjectHours.has(classKey)) {
      classSubjectHours.set(classKey, new Map())
    }
    const map = classSubjectHours.get(classKey)!
    map.set(cell.subjectId, (map.get(cell.subjectId) ?? 0) + 1)
  }

  let spreadCount = 0
  for (const [classKey, subjectMap] of classSubjectHours) {
    for (const [subjectId, totalHours] of subjectMap) {
      const daysUsed = new Set<string>()
      for (const cell of cells) {
        if (
          `${cell.grade}-${cell.classNumber}` === classKey &&
          cell.subjectId === subjectId
        ) {
          daysUsed.add(cell.day)
        }
      }
      const idealDays = Math.min(totalHours, activeDays.length)
      const spreadRatio = daysUsed.size / idealDays
      daySpreadTotal += spreadRatio * 100
      spreadCount++
    }
  }
  daySpreadTotal = spreadCount > 0 ? daySpreadTotal / spreadCount : 100

  // 교사 연속 수업 점수 (per-teacher override 반영)
  const teacherIds = new Set(cells.map((c) => c.teacherId))
  let teacherConsecCount = 0
  for (const teacherId of teacherIds) {
    const tp = teacherPolicies?.find((p) => p.teacherId === teacherId)
    const maxConsec = tp?.maxConsecutiveHoursOverride ?? policy.teacherMaxConsecutiveHours
    for (const day of activeDays) {
      const consec = grid.getTeacherConsecutiveCount(teacherId, day)
      const ratio = consec <= maxConsec
        ? 100
        : Math.max(0, 100 - (consec - maxConsec) * 30)
      teacherConsecTotal += ratio
      teacherConsecCount++
    }
  }
  teacherConsecTotal = teacherConsecCount > 0 ? teacherConsecTotal / teacherConsecCount : 100

  // 학생 연강 점수
  const classKeys = new Set(cells.map((c) => `${c.grade}-${c.classNumber}`))
  let studentConsecCount = 0
  for (const classKey of classKeys) {
    const [grade, classNumber] = classKey.split('-').map(Number)
    for (const day of activeDays) {
      const subjectCounts = grid.getClassDaySubjectCounts(grade, classNumber, day)
      for (const [subjectId] of subjectCounts) {
        const consec = grid.getClassSubjectConsecutiveCount(grade, classNumber, day, subjectId)
        const ratio = consec <= policy.studentMaxConsecutiveSameSubject
          ? 100
          : Math.max(0, 100 - (consec - policy.studentMaxConsecutiveSameSubject) * 40)
        studentConsecTotal += ratio
        studentConsecCount++
      }
    }
  }
  studentConsecTotal = studentConsecCount > 0 ? studentConsecTotal / studentConsecCount : 100

  // 교사 일별 시수 균형
  let balanceCount = 0
  for (const teacherId of teacherIds) {
    const hours: Array<number> = []
    for (const day of activeDays) {
      hours.push(grid.getTeacherDayHours(teacherId, day))
    }
    const total = hours.reduce((s, h) => s + h, 0)
    if (total === 0) continue
    const avg = total / hours.length
    const variance = hours.reduce((s, h) => s + (h - avg) ** 2, 0) / hours.length
    teacherBalanceTotal += Math.max(0, 100 - variance * 15)
    balanceCount++
  }
  teacherBalanceTotal = balanceCount > 0 ? teacherBalanceTotal / balanceCount : 100

  // 선호 시간대 점수
  const midpoint = Math.ceil(periodsPerDay / 2)
  let prefCount = 0
  for (const teacherId of teacherIds) {
    const tp = teacherPolicies?.find((p) => p.teacherId === teacherId)
    const pref = tp?.timePreference ?? 'NONE'
    const teacherCells = cells.filter((c) => c.teacherId === teacherId)
    for (const cell of teacherCells) {
      let prefScore: number
      if (pref === 'MORNING') {
        prefScore = cell.period <= midpoint ? 100 : 20
      } else if (pref === 'AFTERNOON') {
        prefScore = cell.period > midpoint ? 100 : 20
      } else {
        prefScore = 50
      }
      timePrefTotal += prefScore
      prefCount++
    }
  }
  timePrefTotal = prefCount > 0 ? timePrefTotal / prefCount : 50

  const totalScore =
    WEIGHTS.daySpread * daySpreadTotal +
    WEIGHTS.teacherConsecutive * teacherConsecTotal +
    WEIGHTS.studentConsecutive * studentConsecTotal +
    WEIGHTS.teacherDailyBalance * teacherBalanceTotal +
    WEIGHTS.timePreference * timePrefTotal

  return Math.round(totalScore * 100) / 100
}

function countConsecutiveIfAdded(existingPeriods: Set<number>, newPeriod: number): number {
  const all = [...existingPeriods, newPeriod].sort((a, b) => a - b)
  let maxConsec = 1
  let current = 1
  for (let i = 1; i < all.length; i++) {
    if (all[i] === all[i - 1] + 1) {
      current++
      maxConsec = Math.max(maxConsec, current)
    } else {
      current = 1
    }
  }
  return maxConsec
}

function hasAdjacentSameSubject(
  grid: TimetableGrid,
  unit: AssignmentUnit,
  day: DayOfWeek,
  period: number,
): boolean {
  const subjects = grid.getClassDaySubjectCounts(unit.grade, unit.classNumber, day)
  if (!subjects.has(unit.subjectId)) return false

  // 인접 교시에 같은 과목이 있는지 확인
  const cells = grid.getAllCells().filter(
    (c) =>
      c.grade === unit.grade &&
      c.classNumber === unit.classNumber &&
      c.day === day &&
      c.subjectId === unit.subjectId &&
      (c.period === period - 1 || c.period === period + 1),
  )
  return cells.length > 0
}
