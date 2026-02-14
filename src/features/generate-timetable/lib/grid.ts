import type { DayOfWeek } from '@/shared/lib/types'
import type { TimetableCell } from '@/entities/timetable'

/**
 * 시간표 그리드 자료구조.
 * O(1) 제약 검사를 위한 인덱스 맵 관리.
 */
export class TimetableGrid {
  private cells: Array<TimetableCell> = []

  // 교사 충돌 검사: "teacherId-day-period" → classKey ("grade-classNumber")
  private teacherSlotMap = new Map<string, string>()

  // 반 슬롯 점유: "grade-classNumber-day-period" → true
  private classSlotMap = new Map<string, true>()

  // 교사 일일 시수: "teacherId-day" → count
  private teacherDayHours = new Map<string, number>()

  // 교사 일별 교시 점유: "teacherId-day" → Set<period>
  private teacherDayPeriods = new Map<string, Set<number>>()

  // 반-요일별 과목 배치: "grade-classNumber-day" → Array<{period, subjectId}>
  private classDaySubjects = new Map<string, Array<{ period: number; subjectId: string }>>()

  getAllCells(): Array<TimetableCell> {
    return [...this.cells]
  }

  getCellCount(): number {
    return this.cells.length
  }

  getFixedCellCount(): number {
    return this.cells.filter((c) => c.isFixed).length
  }

  placeCell(cell: TimetableCell): void {
    this.cells.push(cell)

    const teacherSlotKey = `${cell.teacherId}-${cell.day}-${cell.period}`
    const classKey = `${cell.grade}-${cell.classNumber}`
    this.teacherSlotMap.set(teacherSlotKey, classKey)

    const classSlotKey = `${classKey}-${cell.day}-${cell.period}`
    this.classSlotMap.set(classSlotKey, true)

    const teacherDayKey = `${cell.teacherId}-${cell.day}`
    this.teacherDayHours.set(teacherDayKey, (this.teacherDayHours.get(teacherDayKey) ?? 0) + 1)

    let periods = this.teacherDayPeriods.get(teacherDayKey)
    if (!periods) {
      periods = new Set()
      this.teacherDayPeriods.set(teacherDayKey, periods)
    }
    periods.add(cell.period)

    const classDayKey = `${classKey}-${cell.day}`
    let subjects = this.classDaySubjects.get(classDayKey)
    if (!subjects) {
      subjects = []
      this.classDaySubjects.set(classDayKey, subjects)
    }
    subjects.push({ period: cell.period, subjectId: cell.subjectId })
  }

  removeCell(cell: TimetableCell): void {
    const idx = this.cells.findIndex(
      (c) =>
        c.teacherId === cell.teacherId &&
        c.grade === cell.grade &&
        c.classNumber === cell.classNumber &&
        c.day === cell.day &&
        c.period === cell.period,
    )
    if (idx === -1) return
    this.cells.splice(idx, 1)

    const teacherSlotKey = `${cell.teacherId}-${cell.day}-${cell.period}`
    this.teacherSlotMap.delete(teacherSlotKey)

    const classKey = `${cell.grade}-${cell.classNumber}`
    const classSlotKey = `${classKey}-${cell.day}-${cell.period}`
    this.classSlotMap.delete(classSlotKey)

    const teacherDayKey = `${cell.teacherId}-${cell.day}`
    const hours = this.teacherDayHours.get(teacherDayKey)
    if (hours !== undefined) {
      if (hours <= 1) {
        this.teacherDayHours.delete(teacherDayKey)
      } else {
        this.teacherDayHours.set(teacherDayKey, hours - 1)
      }
    }

    const periods = this.teacherDayPeriods.get(teacherDayKey)
    if (periods) {
      periods.delete(cell.period)
      if (periods.size === 0) {
        this.teacherDayPeriods.delete(teacherDayKey)
      }
    }

    const classDayKey = `${classKey}-${cell.day}`
    const subjects = this.classDaySubjects.get(classDayKey)
    if (subjects) {
      const sIdx = subjects.findIndex(
        (s) => s.period === cell.period && s.subjectId === cell.subjectId,
      )
      if (sIdx !== -1) subjects.splice(sIdx, 1)
      if (subjects.length === 0) this.classDaySubjects.delete(classDayKey)
    }
  }

  isTeacherBusy(teacherId: string, day: DayOfWeek, period: number): boolean {
    return this.teacherSlotMap.has(`${teacherId}-${day}-${period}`)
  }

  isClassSlotFilled(grade: number, classNumber: number, day: DayOfWeek, period: number): boolean {
    return this.classSlotMap.has(`${grade}-${classNumber}-${day}-${period}`)
  }

  getTeacherDayHours(teacherId: string, day: DayOfWeek): number {
    return this.teacherDayHours.get(`${teacherId}-${day}`) ?? 0
  }

  getTeacherDayPeriods(teacherId: string, day: DayOfWeek): Set<number> {
    return this.teacherDayPeriods.get(`${teacherId}-${day}`) ?? new Set()
  }

  /**
   * 교사의 해당 요일 최대 연속 수업 수 계산
   */
  getTeacherConsecutiveCount(teacherId: string, day: DayOfWeek): number {
    const periods = this.teacherDayPeriods.get(`${teacherId}-${day}`)
    if (!periods || periods.size === 0) return 0

    const sorted = [...periods].sort((a, b) => a - b)
    let maxConsecutive = 1
    let current = 1
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        current++
        maxConsecutive = Math.max(maxConsecutive, current)
      } else {
        current = 1
      }
    }
    return maxConsecutive
  }

  /**
   * 특정 반-요일에서 동일 과목 최대 연속 교시 수 계산
   */
  getClassSubjectConsecutiveCount(
    grade: number,
    classNumber: number,
    day: DayOfWeek,
    subjectId: string,
  ): number {
    const classDayKey = `${grade}-${classNumber}-${day}`
    const subjects = this.classDaySubjects.get(classDayKey)
    if (!subjects) return 0

    const matchingPeriods = subjects
      .filter((s) => s.subjectId === subjectId)
      .map((s) => s.period)
      .sort((a, b) => a - b)

    if (matchingPeriods.length === 0) return 0

    let maxConsecutive = 1
    let current = 1
    for (let i = 1; i < matchingPeriods.length; i++) {
      if (matchingPeriods[i] === matchingPeriods[i - 1] + 1) {
        current++
        maxConsecutive = Math.max(maxConsecutive, current)
      } else {
        current = 1
      }
    }
    return maxConsecutive
  }

  /**
   * 특정 반-요일에 배치된 과목별 교시 수 맵
   */
  getClassDaySubjectCounts(
    grade: number,
    classNumber: number,
    day: DayOfWeek,
  ): Map<string, number> {
    const classDayKey = `${grade}-${classNumber}-${day}`
    const subjects = this.classDaySubjects.get(classDayKey)
    const counts = new Map<string, number>()
    if (!subjects) return counts
    for (const s of subjects) {
      counts.set(s.subjectId, (counts.get(s.subjectId) ?? 0) + 1)
    }
    return counts
  }

  /**
   * 특정 교사의 특정 반에 배치된 셀 가져오기
   */
  getTeacherClassCells(
    teacherId: string,
    grade: number,
    classNumber: number,
  ): Array<TimetableCell> {
    return this.cells.filter(
      (c) => c.teacherId === teacherId && c.grade === grade && c.classNumber === classNumber,
    )
  }
}
