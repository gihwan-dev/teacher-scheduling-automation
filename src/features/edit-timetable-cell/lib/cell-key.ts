import type { CellKey, TimetableCell } from '@/entities/timetable'
import type { DayOfWeek } from '@/shared/lib/types'

export function makeCellKey(
  grade: number,
  classNumber: number,
  day: DayOfWeek,
  period: number,
): CellKey {
  return `${grade}-${classNumber}-${day}-${period}`
}

export function parseCellKey(key: CellKey): {
  grade: number
  classNumber: number
  day: DayOfWeek
  period: number
} {
  const parts = key.split('-')
  return {
    grade: Number(parts[0]),
    classNumber: Number(parts[1]),
    day: parts[2] as DayOfWeek,
    period: Number(parts[3]),
  }
}

export function buildCellMap(cells: Array<TimetableCell>): Map<CellKey, TimetableCell> {
  const map = new Map<CellKey, TimetableCell>()
  for (const cell of cells) {
    const key = makeCellKey(cell.grade, cell.classNumber, cell.day, cell.period)
    map.set(key, cell)
  }
  return map
}
