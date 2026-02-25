import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseFinalTimetableXlsx } from '../final-timetable-xlsx-parser'

const DAY_COLUMNS = {
  MON: 'B',
  TUE: 'I',
  WED: 'Q',
  THU: 'X',
  FRI: 'AF',
} as const

const DAY_LABELS = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
} as const

function createWorkbookBinary(
  cells: Record<string, unknown>,
  sheetName = '1학기 시간표',
): Uint8Array {
  const workbook = XLSX.utils.book_new()
  const sheet: XLSX.WorkSheet = {}

  for (const [address, value] of Object.entries(cells)) {
    sheet[address] = createCell(value)
  }
  sheet['!ref'] = 'A1:AP40'

  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Uint8Array
}

function createBaseCells(): Record<string, unknown> {
  const cells: Record<string, unknown> = {
    A12: '교사',
  }

  for (const day of Object.keys(DAY_COLUMNS) as Array<keyof typeof DAY_COLUMNS>) {
    const column = DAY_COLUMNS[day]
    cells[`${column}1`] = DAY_LABELS[day]
    cells[`${column}2`] = 1
    cells[`${column}12`] = DAY_LABELS[day]
    cells[`${column}13`] = 1
  }

  return cells
}

function createClassSectionOnlyCells(): Record<string, unknown> {
  const cells: Record<string, unknown> = {}

  for (const day of Object.keys(DAY_COLUMNS) as Array<keyof typeof DAY_COLUMNS>) {
    const column = DAY_COLUMNS[day]
    cells[`${column}1`] = DAY_LABELS[day]
    cells[`${column}2`] = 1
  }

  return cells
}

function createCell(value: unknown): XLSX.CellObject {
  if (typeof value === 'number') return { t: 'n', v: value }
  if (typeof value === 'boolean') return { t: 'b', v: value }
  return { t: 's', v: value === null || value === undefined ? '' : String(value) }
}

describe('parseFinalTimetableXlsx', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('xlsx')
    vi.resetModules()
  })

  it('정상 파싱(클래스+교사, direct + grade-level 하이브리드)', () => {
    const cells = createBaseCells()
    cells.A3 = '1-1'
    cells.B3 = '국어'
    cells.I3 = '스포츠'
    cells.A4 = '1-2'
    cells.B4 = '수학'
    cells.I4 = '스포츠'

    cells.A14 = '김교사'
    cells.B14 = '1-1 국어'
    cells.I14 = '1학년 스포츠'
    cells.A15 = '이교사'
    cells.B15 = '1-2 수학'
    cells.I15 = '1학년 스포츠'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))

    expect(payload.issues).toEqual([])
    expect(payload.schoolConfig).toEqual({
      gradeCount: 1,
      classCountByGrade: { 1: 2 },
      activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      periodsByDay: { MON: 1, TUE: 1, WED: 1, THU: 1, FRI: 1 },
    })
    expect(payload.slots).toEqual([
      {
        grade: 1,
        classNumber: 1,
        day: 'MON',
        period: 1,
        subjectName: '국어',
        teacherName: '김교사',
      },
      {
        grade: 1,
        classNumber: 1,
        day: 'TUE',
        period: 1,
        subjectName: '스포츠',
        teacherName: '김교사',
      },
      {
        grade: 1,
        classNumber: 2,
        day: 'MON',
        period: 1,
        subjectName: '수학',
        teacherName: '이교사',
      },
      {
        grade: 1,
        classNumber: 2,
        day: 'TUE',
        period: 1,
        subjectName: '스포츠',
        teacherName: '이교사',
      },
    ])
  })

  it('비연속 학년 입력에서도 gradeCount는 최대 학년 번호로 계산한다', () => {
    const cells = createBaseCells()
    cells.A3 = '1-1'
    cells.B3 = '국어'
    cells.A4 = '3-2'
    cells.B4 = '수학'

    cells.A14 = '김교사'
    cells.B14 = '1-1 국어'
    cells.A15 = '이교사'
    cells.B15 = '3-2 수학'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))

    expect(payload.issues).toEqual([])
    expect(payload.schoolConfig).toEqual({
      gradeCount: 3,
      classCountByGrade: { 1: 1, 3: 2 },
      activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      periodsByDay: { MON: 1, TUE: 1, WED: 1, THU: 1, FRI: 1 },
    })
    expect(payload.slots).toEqual([
      {
        grade: 1,
        classNumber: 1,
        day: 'MON',
        period: 1,
        subjectName: '국어',
        teacherName: '김교사',
      },
      {
        grade: 3,
        classNumber: 2,
        day: 'MON',
        period: 1,
        subjectName: '수학',
        teacherName: '이교사',
      },
    ])
  })

  it('시트가 없으면 SHEET_NOT_FOUND blocking 에러를 반환한다', () => {
    const cells = createBaseCells()
    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells, '다른시트'))
    const issue = payload.issues.find((entry) => entry.code === 'SHEET_NOT_FOUND')

    expect(issue).toBeDefined()
    expect(issue?.blocking).toBe(true)
    expect(payload.slots).toEqual([])
  })

  it('교사 섹션이 없으면 INVALID_STRUCTURE blocking 에러를 반환한다', () => {
    const cells = createClassSectionOnlyCells()
    cells.A3 = '1-1'
    cells.B3 = '국어'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))
    const issue = payload.issues.find((entry) => entry.code === 'INVALID_STRUCTURE')

    expect(issue).toBeDefined()
    expect(issue?.blocking).toBe(true)
    expect(payload.slots).toEqual([])
  })

  it('교사 섹션 헤더가 누락되면 HEADER_MISMATCH blocking 에러를 반환한다', () => {
    const cells = createBaseCells()
    delete cells.B12
    cells.A3 = '1-1'
    cells.B3 = '국어'
    cells.A14 = '김교사'
    cells.B14 = '1-1 국어'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))
    const issue = payload.issues.find((entry) => entry.code === 'HEADER_MISMATCH')

    expect(issue).toBeDefined()
    expect(issue?.blocking).toBe(true)
    expect(payload.slots).toEqual([])
  })

  it('동일 슬롯에 다중 교사 direct 매칭 시 MATCH_CONFLICT blocking 에러를 반환한다', () => {
    const cells = createBaseCells()
    cells.A3 = '1-1'
    cells.B3 = '국어'
    cells.A14 = '김교사'
    cells.B14 = '1-1 국어'
    cells.A15 = '이교사'
    cells.B15 = '1-1 국어'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))
    const issue = payload.issues.find((entry) => entry.code === 'MATCH_CONFLICT')

    expect(issue).toBeDefined()
    expect(issue?.blocking).toBe(true)
    expect(payload.slots).toEqual([])
  })

  it('direct 매칭 과목 불일치면 MATCH_CONFLICT blocking 에러를 반환한다', () => {
    const cells = createBaseCells()
    cells.A3 = '1-1'
    cells.B3 = '국어'
    cells.A14 = '김교사'
    cells.B14 = '1-1 수학'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))
    const issue = payload.issues.find((entry) => entry.code === 'MATCH_CONFLICT')

    expect(issue).toBeDefined()
    expect(issue?.blocking).toBe(true)
    expect(payload.slots).toEqual([])
  })

  it('/ 포함 과목의 direct 매칭이 정상 통과한다', () => {
    const cells = createBaseCells()
    cells.A3 = '1-1'
    cells.B3 = '과학/실험'
    cells.A14 = '김교사'
    cells.B14 = '1-1 과학/실험'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))

    expect(payload.issues).toEqual([])
    expect(payload.slots).toEqual([
      {
        grade: 1,
        classNumber: 1,
        day: 'MON',
        period: 1,
        subjectName: '과학/실험',
        teacherName: '김교사',
      },
    ])
  })

  it('교사 매칭 불능 슬롯이 있으면 MATCH_NOT_FOUND blocking 에러를 반환한다', () => {
    const cells = createBaseCells()
    cells.A3 = '1-1'
    cells.B3 = '국어'
    cells.A14 = '김교사'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))
    const issue = payload.issues.find((entry) => entry.code === 'MATCH_NOT_FOUND')

    expect(issue).toBeDefined()
    expect(issue?.blocking).toBe(true)
    expect(payload.slots).toEqual([])
  })

  it('grade-level 배정이 부족하면 MATCH_NOT_FOUND blocking 에러를 반환한다', () => {
    const cells = createBaseCells()
    cells.A3 = '1-1'
    cells.I3 = '스포츠'
    cells.A4 = '1-2'
    cells.I4 = '스포츠'
    cells.A14 = '김교사'
    cells.I14 = '1학년 스포츠'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))
    const issue = payload.issues.find((entry) => entry.code === 'MATCH_NOT_FOUND')

    expect(issue).toBeDefined()
    expect(issue?.blocking).toBe(true)
    expect(payload.slots).toEqual([])
  })

  it('grade-level 과다 배정이면 MATCH_CONFLICT blocking 에러를 반환한다', () => {
    const cells = createBaseCells()
    cells.A3 = '1-1'
    cells.I3 = '스포츠'
    cells.A4 = '1-2'
    cells.I4 = '스포츠'
    cells.A14 = '김교사'
    cells.I14 = '1학년 스포츠'
    cells.A15 = '이교사'
    cells.I15 = '1학년 스포츠'
    cells.A16 = '박교사'
    cells.I16 = '1학년 스포츠'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))
    const issue = payload.issues.find((entry) => entry.code === 'MATCH_CONFLICT')

    expect(issue).toBeDefined()
    expect(issue?.blocking).toBe(true)
    expect(payload.slots).toEqual([])
  })

  it('비정형 교사 셀은 INVALID_ROW warning만 기록하고 무시한다', () => {
    const cells = createBaseCells()
    cells.A3 = '1-1'
    cells.B3 = '국어'
    cells.A14 = '김교사'
    cells.B14 = '1-1 국어'
    cells.I14 = '동아리'

    const payload = parseFinalTimetableXlsx(createWorkbookBinary(cells))
    const warningIssues = payload.issues.filter((entry) => entry.code === 'INVALID_ROW')

    expect(warningIssues).toHaveLength(1)
    expect(warningIssues[0]?.blocking).toBe(false)
    expect(payload.issues.some((entry) => entry.blocking)).toBe(false)
    expect(payload.slots).toEqual([
      {
        grade: 1,
        classNumber: 1,
        day: 'MON',
        period: 1,
        subjectName: '국어',
        teacherName: '김교사',
      },
    ])
  })

  it('XLSX.read 예외가 발생해도 UNKNOWN blocking 이슈와 빈 payload를 반환한다', async () => {
    vi.doMock('xlsx', async () => {
      const actual = await vi.importActual<typeof XLSX>('xlsx')
      return {
        ...actual,
        read: () => {
          throw new Error('corrupted')
        },
      }
    })

    const { parseFinalTimetableXlsx: parseWithMockedRead } = await import(
      '../final-timetable-xlsx-parser'
    )

    const payload = parseWithMockedRead(new Uint8Array([0x00, 0xff, 0x10]))
    const issue = payload.issues.find((entry) => entry.code === 'UNKNOWN')

    expect(issue).toBeDefined()
    expect(issue?.blocking).toBe(true)
    expect(payload.slots).toEqual([])
  })
})
