import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseTeacherHoursXls } from '../teacher-hours-xls-parser'

function createWorkbookBinary(
  rows: Array<Array<unknown>>,
  sheetName = '교사별시수표',
): Uint8Array {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  return XLSX.write(workbook, { bookType: 'xls', type: 'buffer' }) as Uint8Array
}

describe('parseTeacherHoursXls', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('xlsx')
    vi.resetModules()
  })

  it('정상 파싱', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-2', '1-1', '2학년 1반', '계'],
      ['B과목', 'B', '나교사', 2, 1, 0, 3],
      ['A과목', 'A', '가교사', 0, 3, 2, 5],
    ])

    const payload = parseTeacherHoursXls(workbook)

    expect(payload.issues).toEqual([])
    expect(payload.subjects).toEqual([
      { name: 'A과목', abbreviation: 'A' },
      { name: 'B과목', abbreviation: 'B' },
    ])
    expect(payload.teachers).toEqual([
      { name: '가교사', baseHoursPerWeek: 5 },
      { name: '나교사', baseHoursPerWeek: 3 },
    ])
    expect(payload.assignments).toEqual([
      {
        grade: 1,
        classNumber: 1,
        teacherName: '가교사',
        subjectName: 'A과목',
        hoursPerWeek: 3,
      },
      {
        grade: 1,
        classNumber: 1,
        teacherName: '나교사',
        subjectName: 'B과목',
        hoursPerWeek: 1,
      },
      {
        grade: 1,
        classNumber: 2,
        teacherName: '나교사',
        subjectName: 'B과목',
        hoursPerWeek: 2,
      },
      {
        grade: 2,
        classNumber: 1,
        teacherName: '가교사',
        subjectName: 'A과목',
        hoursPerWeek: 2,
      },
    ])
  })

  it('시트가 없으면 SHEET_NOT_FOUND blocking 에러를 반환한다', () => {
    const workbook = createWorkbookBinary(
      [
        ['정식과목명', '단축과목명', '교사명', '1-1', '계'],
        ['국어', '국', '김교사', 3, 3],
      ],
      '다른시트',
    )

    const payload = parseTeacherHoursXls(workbook)
    const sheetIssue = payload.issues.find(
      (issue) => issue.code === 'SHEET_NOT_FOUND',
    )

    expect(sheetIssue).toBeDefined()
    expect(sheetIssue?.blocking).toBe(true)
    expect(payload.subjects).toEqual([])
    expect(payload.teachers).toEqual([])
    expect(payload.assignments).toEqual([])
  })

  it('핵심 헤더 불일치면 HEADER_MISMATCH blocking 에러를 반환한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '약칭', '교사명', '1-1', '계'],
      ['국어', '국', '김교사', 3, 3],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const headerIssue = payload.issues.find(
      (issue) => issue.code === 'HEADER_MISMATCH',
    )

    expect(headerIssue).toBeDefined()
    expect(headerIssue?.blocking).toBe(true)
    expect(payload.subjects).toEqual([])
  })

  it('"계" 뒤에 비어있지 않은 헤더가 있으면 HEADER_MISMATCH blocking 에러를 반환한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-1', '계', '비고'],
      ['국어', '국', '김교사', 3, 3, '메모'],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const headerIssue = payload.issues.find(
      (issue) => issue.code === 'HEADER_MISMATCH',
    )

    expect(headerIssue).toBeDefined()
    expect(headerIssue?.blocking).toBe(true)
    expect(payload.subjects).toEqual([])
    expect(payload.teachers).toEqual([])
    expect(payload.assignments).toEqual([])
  })

  it('학년/반 헤더 구조가 잘못되면 INVALID_STRUCTURE blocking 에러를 반환한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '4-1', '계'],
      ['국어', '국', '김교사', 3, 3],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const structureIssue = payload.issues.find(
      (issue) => issue.code === 'INVALID_STRUCTURE',
    )

    expect(structureIssue).toBeDefined()
    expect(structureIssue?.blocking).toBe(true)
    expect(payload.subjects).toEqual([])
  })

  it('중복된 학년/반 헤더가 있으면 INVALID_STRUCTURE blocking 에러와 column 정보를 반환한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-1', '1학년 1반', '계'],
      ['국어', '국', '김교사', 2, 1, 3],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const structureIssue = payload.issues.find(
      (issue) => issue.code === 'INVALID_STRUCTURE',
    )

    expect(structureIssue).toBeDefined()
    expect(structureIssue?.blocking).toBe(true)
    expect(structureIssue?.location?.column).toBe('E')
    expect(payload.subjects).toEqual([])
    expect(payload.teachers).toEqual([])
    expect(payload.assignments).toEqual([])
  })

  it('교사명과 계 사이 학년/반 헤더가 없으면 INVALID_STRUCTURE blocking 에러를 반환한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '계'],
      ['국어', '국', '김교사', 3],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const structureIssue = payload.issues.find(
      (issue) => issue.code === 'INVALID_STRUCTURE',
    )

    expect(structureIssue).toBeDefined()
    expect(structureIssue?.blocking).toBe(true)
    expect(payload.subjects).toEqual([])
    expect(payload.teachers).toEqual([])
    expect(payload.assignments).toEqual([])
  })

  it('유효하지 않은 행은 INVALID_ROW 경고 후 payload에서 제외한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-1', '계'],
      ['수학', '수', '김교사', 2, 2],
      ['영어', '영', '', 1, 1],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const invalidRowIssues = payload.issues.filter(
      (issue) => issue.code === 'INVALID_ROW',
    )

    expect(invalidRowIssues).toHaveLength(1)
    expect(invalidRowIssues[0]?.blocking).toBe(false)
    expect(payload.subjects).toEqual([{ name: '수학', abbreviation: '수' }])
    expect(payload.teachers).toEqual([{ name: '김교사', baseHoursPerWeek: 2 }])
    expect(payload.assignments).toEqual([
      {
        teacherName: '김교사',
        subjectName: '수학',
        grade: 1,
        classNumber: 1,
        hoursPerWeek: 2,
      },
    ])
  })

  it('"계" 불일치가 발생하면 INVALID_ROW 경고를 기록하고 행 반영은 유지한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-1', '계'],
      ['수학', '수', '김교사', 2, 99],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const mismatchIssues = payload.issues.filter(
      (issue) => issue.code === 'INVALID_ROW',
    )

    expect(mismatchIssues).toHaveLength(1)
    expect(mismatchIssues[0]?.blocking).toBe(false)
    expect(mismatchIssues[0]?.message).toContain('"계" 값과 학년/반 시수 합계가 일치하지 않습니다.')
    expect(payload.subjects).toEqual([{ name: '수학', abbreviation: '수' }])
    expect(payload.teachers).toEqual([{ name: '김교사', baseHoursPerWeek: 2 }])
    expect(payload.assignments).toEqual([
      {
        teacherName: '김교사',
        subjectName: '수학',
        grade: 1,
        classNumber: 1,
        hoursPerWeek: 2,
      },
    ])
  })

  it('sheet_to_json 예외가 발생해도 UNKNOWN blocking 이슈와 빈 payload를 반환한다', () => {
    const sheetToJsonSpy = vi.spyOn(XLSX.utils, 'sheet_to_json')
    sheetToJsonSpy.mockImplementation(() => {
      throw new Error('corrupted')
    })
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-1', '계'],
      ['국어', '국', '김교사', 3, 3],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const unknownIssue = payload.issues.find((issue) => issue.code === 'UNKNOWN')

    expect(unknownIssue).toBeDefined()
    expect(unknownIssue?.blocking).toBe(true)
    expect(payload.subjects).toEqual([])
    expect(payload.teachers).toEqual([])
    expect(payload.assignments).toEqual([])
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

    const { parseTeacherHoursXls: parseTeacherHoursXlsWithMockedRead } =
      await import('../teacher-hours-xls-parser')

    const payload = parseTeacherHoursXlsWithMockedRead(new Uint8Array([0x00, 0xff, 0x10]))
    const unknownIssue = payload.issues.find((issue) => issue.code === 'UNKNOWN')

    expect(unknownIssue).toBeDefined()
    expect(unknownIssue?.blocking).toBe(true)
    expect(payload.subjects).toEqual([])
    expect(payload.teachers).toEqual([])
    expect(payload.assignments).toEqual([])
  })

  it('음수/소수 시수는 유효하지 않은 숫자로 처리해 행을 제외한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-1', '계'],
      ['국어', '국', '김교사', 2, 2],
      ['영어', '영', '이교사', -1, -1],
      ['과학', '과', '박교사', 1.5, 1.5],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const invalidRowIssues = payload.issues.filter(
      (issue) => issue.code === 'INVALID_ROW',
    )

    expect(invalidRowIssues).toHaveLength(2)
    expect(payload.subjects).toEqual([{ name: '국어', abbreviation: '국' }])
    expect(payload.teachers).toEqual([{ name: '김교사', baseHoursPerWeek: 2 }])
    expect(payload.assignments).toEqual([
      {
        teacherName: '김교사',
        subjectName: '국어',
        grade: 1,
        classNumber: 1,
        hoursPerWeek: 2,
      },
    ])
  })

  it('잘못된 콤마 숫자 형식은 INVALID_ROW 경고 후 행에서 제외한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-1', '계'],
      ['국어', '국', '김교사', 2, 2],
      ['영어', '영', '이교사', '1,2', 12],
      ['과학', '과', '박교사', '1,,2', 12],
      ['역사', '역', '최교사', ',12', 12],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const invalidRowIssues = payload.issues.filter(
      (issue) => issue.code === 'INVALID_ROW',
    )

    expect(invalidRowIssues).toHaveLength(3)
    expect(payload.subjects).toEqual([{ name: '국어', abbreviation: '국' }])
    expect(payload.teachers).toEqual([{ name: '김교사', baseHoursPerWeek: 2 }])
    expect(payload.assignments).toEqual([
      {
        teacherName: '김교사',
        subjectName: '국어',
        grade: 1,
        classNumber: 1,
        hoursPerWeek: 2,
      },
    ])
  })

  it('"계" 컬럼 숫자 파싱 실패 시 INVALID_ROW(field: 계) 경고 후 행을 제외한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-1', '계'],
      ['수학', '수', '김교사', 2, 2],
      ['영어', '영', '이교사', 1, 'abc'],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const invalidTotalIssue = payload.issues.find(
      (issue) =>
        issue.code === 'INVALID_ROW' &&
        issue.location?.row === 3 &&
        issue.location?.field === '계',
    )

    expect(invalidTotalIssue).toBeDefined()
    expect(invalidTotalIssue?.blocking).toBe(false)
    expect(invalidTotalIssue?.location?.field).toBe('계')
    expect(payload.subjects).toEqual([{ name: '수학', abbreviation: '수' }])
    expect(payload.teachers).toEqual([{ name: '김교사', baseHoursPerWeek: 2 }])
    expect(payload.assignments).toEqual([
      {
        teacherName: '김교사',
        subjectName: '수학',
        grade: 1,
        classNumber: 1,
        hoursPerWeek: 2,
      },
    ])
  })

  it('정규화 이름 충돌 시 DUPLICATE_NORMALIZED_NAME 경고와 first-win을 적용한다', () => {
    const workbook = createWorkbookBinary([
      ['정식과목명', '단축과목명', '교사명', '1-1', '계'],
      ['수학(심화)', '수A', '김교사', 1, 1],
      ['수학', '수B', '이교사', 2, 2],
    ])

    const payload = parseTeacherHoursXls(workbook)
    const duplicateIssue = payload.issues.find(
      (issue) => issue.code === 'DUPLICATE_NORMALIZED_NAME',
    )

    expect(duplicateIssue).toBeDefined()
    expect(duplicateIssue?.blocking).toBe(false)
    expect(payload.subjects).toEqual([{ name: '수학', abbreviation: '수A' }])
    expect(payload.teachers).toEqual([
      { name: '김교사', baseHoursPerWeek: 1 },
      { name: '이교사', baseHoursPerWeek: 2 },
    ])
    expect(payload.assignments).toEqual([
      {
        grade: 1,
        classNumber: 1,
        teacherName: '김교사',
        subjectName: '수학',
        hoursPerWeek: 1,
      },
      {
        grade: 1,
        classNumber: 1,
        teacherName: '이교사',
        subjectName: '수학',
        hoursPerWeek: 2,
      },
    ])
  })
})
