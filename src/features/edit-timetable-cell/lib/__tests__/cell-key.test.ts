import { describe, expect, it } from 'vitest'
import { buildCellMap, makeCellKey, parseCellKey } from '../cell-key'
import type { TimetableCell } from '@/entities/timetable'

describe('makeCellKey', () => {
  it('올바른 CellKey 형식을 생성한다', () => {
    expect(makeCellKey(1, 2, 'MON', 3)).toBe('1-2-MON-3')
  })

  it('다양한 요일에 대해 올바르게 생성한다', () => {
    expect(makeCellKey(2, 5, 'FRI', 7)).toBe('2-5-FRI-7')
    expect(makeCellKey(3, 1, 'WED', 1)).toBe('3-1-WED-1')
  })
})

describe('parseCellKey', () => {
  it('CellKey를 올바르게 분해한다', () => {
    const result = parseCellKey('1-2-MON-3')
    expect(result).toEqual({ grade: 1, classNumber: 2, day: 'MON', period: 3 })
  })

  it('makeCellKey와 round-trip이 성립한다', () => {
    const key = makeCellKey(2, 5, 'FRI', 7)
    const parsed = parseCellKey(key)
    expect(parsed).toEqual({ grade: 2, classNumber: 5, day: 'FRI', period: 7 })
    expect(
      makeCellKey(parsed.grade, parsed.classNumber, parsed.day, parsed.period),
    ).toBe(key)
  })
})

describe('buildCellMap', () => {
  function makeCell(overrides: Partial<TimetableCell> = {}): TimetableCell {
    return {
      teacherId: 't-1',
      subjectId: 'sub-1',
      grade: 1,
      classNumber: 1,
      day: 'MON',
      period: 1,
      isFixed: false,
      status: 'BASE',
      ...overrides,
    }
  }

  it('셀 배열을 CellKey 맵으로 변환한다', () => {
    const cells = [
      makeCell({ grade: 1, classNumber: 1, day: 'MON', period: 1 }),
      makeCell({ grade: 1, classNumber: 1, day: 'MON', period: 2 }),
      makeCell({ grade: 1, classNumber: 2, day: 'TUE', period: 1 }),
    ]
    const map = buildCellMap(cells)

    expect(map.size).toBe(3)
    expect(map.get('1-1-MON-1')).toBe(cells[0])
    expect(map.get('1-1-MON-2')).toBe(cells[1])
    expect(map.get('1-2-TUE-1')).toBe(cells[2])
  })

  it('빈 배열은 빈 맵을 반환한다', () => {
    const map = buildCellMap([])
    expect(map.size).toBe(0)
  })

  it('같은 위치의 셀이 있으면 마지막 셀이 남는다', () => {
    const cells = [
      makeCell({
        teacherId: 't-1',
        grade: 1,
        classNumber: 1,
        day: 'MON',
        period: 1,
      }),
      makeCell({
        teacherId: 't-2',
        grade: 1,
        classNumber: 1,
        day: 'MON',
        period: 1,
      }),
    ]
    const map = buildCellMap(cells)
    expect(map.size).toBe(1)
    expect(map.get('1-1-MON-1')?.teacherId).toBe('t-2')
  })
})
