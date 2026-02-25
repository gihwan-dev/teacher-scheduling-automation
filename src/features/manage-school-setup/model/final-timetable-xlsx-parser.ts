import * as XLSX from 'xlsx'
import { normalizeImportName } from './name-normalizer'
import type { FinalTimetableImportPayload, ImportIssue } from './types'
import type { DayOfWeek } from '@/shared/lib/types'
import { MAX_CLASS_COUNT, MAX_GRADE_COUNT } from '@/shared/lib/constants'

const TARGET_SHEET_NAME: FinalTimetableImportPayload['sheetName'] = '1학기 시간표'
const CLASS_HEADER_ROW = 1
const CLASS_PERIOD_ROW = 2
const CLASS_FIRST_ROW = 3
const TEACHER_HEADER_LABEL = '교사'

const DAY_HEADERS = [
  { day: 'MON' as const, label: '월' },
  { day: 'TUE' as const, label: '화' },
  { day: 'WED' as const, label: '수' },
  { day: 'THU' as const, label: '목' },
  { day: 'FRI' as const, label: '금' },
]

const DAY_SORT_INDEX: Record<DayOfWeek, number> = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4,
  SAT: 5,
}

type Weekday = (typeof DAY_HEADERS)[number]['day']
type SheetMatrix = Map<number, Map<number, unknown>>

interface DayBlock {
  day: Weekday
  label: string
  startColumn: number
  periodColumns: Array<{ column: number; period: number }>
}

interface ParsedClassSlot {
  key: string
  grade: number
  classNumber: number
  day: Weekday
  period: number
  subjectName: string
  row: number
  column: number
}

interface DirectTeacherEntry {
  type: 'direct'
  teacherName: string
  rowOrder: number
  row: number
  column: number
  day: Weekday
  period: number
  grade: number
  classNumber: number
  subjectName: string
}

interface GradeTeacherEntry {
  type: 'grade'
  teacherName: string
  rowOrder: number
  row: number
  column: number
  day: Weekday
  period: number
  grade: number
  subjectName: string
}

type ParsedTeacherEntry = DirectTeacherEntry | GradeTeacherEntry

export function parseFinalTimetableXlsx(
  input: ArrayBuffer | Uint8Array,
): FinalTimetableImportPayload {
  const issues: Array<ImportIssue> = []
  const payload = createEmptyPayload(issues)
  const sourceData = input instanceof Uint8Array ? input : new Uint8Array(input)

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(sourceData, { type: 'array' })
  } catch {
    issues.push(
      createBlockingIssue(
        'UNKNOWN',
        '파일 파싱 중 오류가 발생했습니다. 파일이 손상되었는지 확인해 주세요.',
      ),
    )
    return payload
  }

  if (!workbook.SheetNames.includes(TARGET_SHEET_NAME)) {
    issues.push(
      createBlockingIssue(
        'SHEET_NOT_FOUND',
        `필수 시트 "${TARGET_SHEET_NAME}"을 찾을 수 없습니다.`,
        {
          sheetName: TARGET_SHEET_NAME,
        },
      ),
    )
    return payload
  }

  const sheet = workbook.Sheets[TARGET_SHEET_NAME]

  try {
    const matrix = buildSheetMatrix(sheet)
    const dayBlockResult = extractDayBlocks(matrix, CLASS_HEADER_ROW, CLASS_PERIOD_ROW)
    if (!dayBlockResult.ok) {
      issues.push(dayBlockResult.issue)
      return payload
    }

    const teacherHeaderRow = findTeacherHeaderRow(matrix)
    if (teacherHeaderRow === null) {
      issues.push(
        createBlockingIssue(
          'INVALID_STRUCTURE',
          '교사 영역 헤더를 찾을 수 없습니다.',
          {
            sheetName: TARGET_SHEET_NAME,
            column: 'A',
          },
        ),
      )
      return payload
    }

    const teacherHeaderValidationResult = validateTeacherSectionHeader(
      matrix,
      teacherHeaderRow,
      dayBlockResult.dayBlocks,
    )
    if (!teacherHeaderValidationResult.ok) {
      issues.push(teacherHeaderValidationResult.issue)
      return payload
    }

    const classSlotResult = extractClassSlots(
      matrix,
      dayBlockResult.dayBlocks,
      teacherHeaderRow,
    )
    if (!classSlotResult.ok) {
      issues.push(classSlotResult.issue)
      return payload
    }

    payload.schoolConfig = classSlotResult.schoolConfig

    const teacherEntries = extractTeacherEntries(
      matrix,
      dayBlockResult.dayBlocks,
      teacherHeaderRow,
      issues,
    )
    const matchedSlots = matchSlots(classSlotResult.classSlots, teacherEntries, issues)

    if (hasBlockingIssue(issues)) return payload

    payload.slots = sortSlots(matchedSlots)
    return payload
  } catch {
    issues.push(
      createBlockingIssue(
        'UNKNOWN',
        '시트 데이터 파싱 중 오류가 발생했습니다. 파일 형식을 확인해 주세요.',
        {
          sheetName: TARGET_SHEET_NAME,
        },
      ),
    )
    return payload
  }
}

function createEmptyPayload(
  issues: Array<ImportIssue>,
): FinalTimetableImportPayload {
  return {
    sheetName: TARGET_SHEET_NAME,
    schoolConfig: {
      gradeCount: 0,
      classCountByGrade: {},
      activeDays: [],
      periodsByDay: {},
    },
    slots: [],
    issues,
  }
}

function extractDayBlocks(
  matrix: SheetMatrix,
  headerRow: number,
  periodRow: number,
): { ok: true; dayBlocks: Array<DayBlock> } | { ok: false; issue: ImportIssue } {
  const headerCells = matrix.get(headerRow)
  if (!headerCells) {
    return {
      ok: false,
      issue: createBlockingIssue(
        'HEADER_MISMATCH',
        '요일 헤더 행이 비어 있습니다.',
        {
          sheetName: TARGET_SHEET_NAME,
          row: headerRow,
        },
      ),
    }
  }

  const startColumns: Array<{ day: Weekday; label: string; column: number }> = []

  for (const dayHeader of DAY_HEADERS) {
    const columns = findHeaderColumns(headerCells, dayHeader.label)
    if (columns.length !== 1) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'HEADER_MISMATCH',
          `요일 헤더 "${dayHeader.label}"을 정확히 1개 찾지 못했습니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: headerRow,
          },
        ),
      }
    }

    startColumns.push({
      day: dayHeader.day,
      label: dayHeader.label,
      column: columns[0],
    })
  }

  for (let index = 1; index < startColumns.length; index++) {
    const previous = startColumns[index - 1]
    const current = startColumns[index]
    if (current.column <= previous.column) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'HEADER_MISMATCH',
          '요일 헤더 순서가 월~금 템플릿과 일치하지 않습니다.',
          {
            sheetName: TARGET_SHEET_NAME,
            row: headerRow,
          },
        ),
      }
    }
  }

  const dayBlocks: Array<DayBlock> = []

  for (let index = 0; index < startColumns.length; index++) {
    const current = startColumns[index]

    const nextStartColumn = startColumns[index + 1]?.column ?? Number.MAX_SAFE_INTEGER
    const periodColumns = extractPeriodColumns(
      matrix,
      periodRow,
      current.column,
      nextStartColumn,
    )

    if (periodColumns.length === 0) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'INVALID_STRUCTURE',
          `${current.label} 요일 블록의 교시 정보가 없습니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: periodRow,
            column: columnIndexToLetter(current.column),
          },
        ),
      }
    }

    for (let periodIndex = 0; periodIndex < periodColumns.length; periodIndex++) {
      const periodColumn = periodColumns[periodIndex]
      if (periodColumn.period !== periodIndex + 1) {
        return {
          ok: false,
          issue: createBlockingIssue(
            'HEADER_MISMATCH',
            `${current.label} 요일 교시 헤더가 1부터 순차 증가하지 않습니다.`,
            {
              sheetName: TARGET_SHEET_NAME,
              row: periodRow,
              column: columnIndexToLetter(periodColumn.column),
            },
          ),
        }
      }
    }

    dayBlocks.push({
      day: current.day,
      label: current.label,
      startColumn: current.column,
      periodColumns,
    })
  }

  return { ok: true, dayBlocks }
}

function validateTeacherSectionHeader(
  matrix: SheetMatrix,
  teacherHeaderRow: number,
  dayBlocks: Array<DayBlock>,
): { ok: true } | { ok: false; issue: ImportIssue } {
  const headerLabel = readCellText(matrix, teacherHeaderRow, 0)
  if (headerLabel !== TEACHER_HEADER_LABEL) {
    return {
      ok: false,
      issue: createBlockingIssue(
        'HEADER_MISMATCH',
        `교사 영역 헤더 "${TEACHER_HEADER_LABEL}"이 누락되었습니다.`,
        {
          sheetName: TARGET_SHEET_NAME,
          row: teacherHeaderRow,
          column: 'A',
        },
      ),
    }
  }

  const teacherPeriodRow = teacherHeaderRow + 1
  for (const dayBlock of dayBlocks) {
    const teacherDayHeader = readCellText(matrix, teacherHeaderRow, dayBlock.startColumn)
    if (teacherDayHeader !== dayBlock.label) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'HEADER_MISMATCH',
          `교사 영역의 ${dayBlock.label} 헤더가 누락되었거나 위치가 다릅니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: teacherHeaderRow,
            column: columnIndexToLetter(dayBlock.startColumn),
          },
        ),
      }
    }

    for (const periodColumn of dayBlock.periodColumns) {
      const parsedPeriod = parsePositiveInteger(
        readCellValue(matrix, teacherPeriodRow, periodColumn.column),
      )
      if (parsedPeriod !== periodColumn.period) {
        return {
          ok: false,
          issue: createBlockingIssue(
            'HEADER_MISMATCH',
            '교사 영역 교시 헤더가 클래스 영역과 일치하지 않습니다.',
            {
              sheetName: TARGET_SHEET_NAME,
              row: teacherPeriodRow,
              column: columnIndexToLetter(periodColumn.column),
            },
          ),
        }
      }
    }
  }

  return { ok: true }
}

function extractClassSlots(
  matrix: SheetMatrix,
  dayBlocks: Array<DayBlock>,
  teacherHeaderRow: number,
): 
  | {
      ok: true
      classSlots: Array<ParsedClassSlot>
      schoolConfig: FinalTimetableImportPayload['schoolConfig']
    }
  | { ok: false; issue: ImportIssue } {
  const classSlots: Array<ParsedClassSlot> = []
  const maxClassNumberByGrade = new Map<number, number>()
  let maxGradeNumber = 0
  const seenClassKeys = new Set<string>()

  for (let row = CLASS_FIRST_ROW; row < teacherHeaderRow; row++) {
    const classLabel = normalizeImportName(readCellValue(matrix, row, 0))
    if (!classLabel) continue

    const parsedClass = parseClassLabel(classLabel)
    if (!parsedClass) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'INVALID_STRUCTURE',
          `학급 표기 형식이 잘못되었습니다: "${classLabel}".`,
          {
            sheetName: TARGET_SHEET_NAME,
            row,
            column: 'A',
          },
        ),
      }
    }

    if (
      parsedClass.grade < 1 ||
      parsedClass.grade > MAX_GRADE_COUNT ||
      parsedClass.classNumber < 1 ||
      parsedClass.classNumber > MAX_CLASS_COUNT
    ) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'INVALID_STRUCTURE',
          `학급 표기가 허용 범위를 벗어났습니다: "${classLabel}".`,
          {
            sheetName: TARGET_SHEET_NAME,
            row,
            column: 'A',
          },
        ),
      }
    }

    const classKey = `${parsedClass.grade}|${parsedClass.classNumber}`
    if (seenClassKeys.has(classKey)) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'INVALID_STRUCTURE',
          `중복된 학급 행이 있습니다: "${classLabel}".`,
          {
            sheetName: TARGET_SHEET_NAME,
            row,
            column: 'A',
          },
        ),
      }
    }
    seenClassKeys.add(classKey)

    if (parsedClass.grade > maxGradeNumber) {
      maxGradeNumber = parsedClass.grade
    }
    const currentMaxClassNumber = maxClassNumberByGrade.get(parsedClass.grade) ?? 0
    if (parsedClass.classNumber > currentMaxClassNumber) {
      maxClassNumberByGrade.set(parsedClass.grade, parsedClass.classNumber)
    }

    for (const dayBlock of dayBlocks) {
      for (const periodColumn of dayBlock.periodColumns) {
        const subjectName = normalizeImportName(
          readCellValue(matrix, row, periodColumn.column),
        )
        if (!subjectName) continue

        classSlots.push({
          key: makeSlotKey(
            parsedClass.grade,
            parsedClass.classNumber,
            dayBlock.day,
            periodColumn.period,
          ),
          grade: parsedClass.grade,
          classNumber: parsedClass.classNumber,
          day: dayBlock.day,
          period: periodColumn.period,
          subjectName,
          row,
          column: periodColumn.column,
        })
      }
    }
  }

  if (maxClassNumberByGrade.size === 0) {
    return {
      ok: false,
      issue: createBlockingIssue(
        'INVALID_STRUCTURE',
        '클래스 영역에서 학급 데이터를 찾을 수 없습니다.',
        {
          sheetName: TARGET_SHEET_NAME,
          row: CLASS_FIRST_ROW,
          column: 'A',
        },
      ),
    }
  }

  const classCountByGrade: Record<number, number> = {}
  for (const [grade, maxClassNumber] of [...maxClassNumberByGrade.entries()].sort(
    ([gradeA], [gradeB]) => gradeA - gradeB,
  )) {
    classCountByGrade[grade] = maxClassNumber
  }

  const periodsByDay: Partial<Record<DayOfWeek, number>> = {}
  for (const dayBlock of dayBlocks) {
    const maxPeriod = dayBlock.periodColumns[dayBlock.periodColumns.length - 1].period
    periodsByDay[dayBlock.day] = maxPeriod
  }

  return {
    ok: true,
    classSlots,
    schoolConfig: {
      gradeCount: maxGradeNumber,
      classCountByGrade,
      activeDays: dayBlocks.map((dayBlock) => dayBlock.day),
      periodsByDay,
    },
  }
}

function extractTeacherEntries(
  matrix: SheetMatrix,
  dayBlocks: Array<DayBlock>,
  teacherHeaderRow: number,
  issues: Array<ImportIssue>,
): Array<ParsedTeacherEntry> {
  const entries: Array<ParsedTeacherEntry> = []
  const maxRow = getMaxRow(matrix)
  const teacherFirstRow = teacherHeaderRow + 2
  let teacherRowOrder = 0

  for (let row = teacherFirstRow; row <= maxRow; row++) {
    const teacherLabel = normalizeImportName(readCellValue(matrix, row, 0))
    if (!teacherLabel) continue

    if (isTeacherSectionTerminator(teacherLabel)) break

    const teacherName = normalizeTeacherName(teacherLabel)
    if (!teacherName) {
      issues.push(
        createWarningIssue(
          'INVALID_ROW',
          `교사명 파싱 실패로 ${row}행을 건너뜁니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row,
            column: 'A',
          },
        ),
      )
      continue
    }

    teacherRowOrder += 1

    for (const dayBlock of dayBlocks) {
      for (const periodColumn of dayBlock.periodColumns) {
        const rawCellValue = readCellValue(matrix, row, periodColumn.column)
        const normalizedCellValue = normalizeImportName(rawCellValue)
        if (!normalizedCellValue) continue

        const parsedCell = parseTeacherAssignmentCell(normalizedCellValue)
        if (!parsedCell) {
          issues.push(
            createWarningIssue(
              'INVALID_ROW',
              `비정형 교사 셀 값으로 ${row}행 ${columnIndexToLetter(periodColumn.column)}열을 건너뜁니다.`,
              {
                sheetName: TARGET_SHEET_NAME,
                row,
                column: columnIndexToLetter(periodColumn.column),
              },
            ),
          )
          continue
        }

        if (parsedCell.grade < 1 || parsedCell.grade > MAX_GRADE_COUNT) {
          issues.push(
            createWarningIssue(
              'INVALID_ROW',
              `학년 정보가 범위를 벗어나 ${row}행 ${columnIndexToLetter(periodColumn.column)}열을 건너뜁니다.`,
              {
                sheetName: TARGET_SHEET_NAME,
                row,
                column: columnIndexToLetter(periodColumn.column),
              },
            ),
          )
          continue
        }

        if (
          parsedCell.type === 'direct' &&
          (parsedCell.classNumber < 1 || parsedCell.classNumber > MAX_CLASS_COUNT)
        ) {
          issues.push(
            createWarningIssue(
              'INVALID_ROW',
              `반 정보가 범위를 벗어나 ${row}행 ${columnIndexToLetter(periodColumn.column)}열을 건너뜁니다.`,
              {
                sheetName: TARGET_SHEET_NAME,
                row,
                column: columnIndexToLetter(periodColumn.column),
              },
            ),
          )
          continue
        }

        const subjectName = normalizeImportName(parsedCell.subjectName)
        if (!subjectName) {
          issues.push(
            createWarningIssue(
              'INVALID_ROW',
              `과목명이 비어 있어 ${row}행 ${columnIndexToLetter(periodColumn.column)}열을 건너뜁니다.`,
              {
                sheetName: TARGET_SHEET_NAME,
                row,
                column: columnIndexToLetter(periodColumn.column),
              },
            ),
          )
          continue
        }

        if (parsedCell.type === 'direct') {
          entries.push({
            type: 'direct',
            teacherName,
            rowOrder: teacherRowOrder,
            row,
            column: periodColumn.column,
            day: dayBlock.day,
            period: periodColumn.period,
            grade: parsedCell.grade,
            classNumber: parsedCell.classNumber,
            subjectName,
          })
          continue
        }

        entries.push({
          type: 'grade',
          teacherName,
          rowOrder: teacherRowOrder,
          row,
          column: periodColumn.column,
          day: dayBlock.day,
          period: periodColumn.period,
          grade: parsedCell.grade,
          subjectName,
        })
      }
    }
  }

  return entries
}

function matchSlots(
  classSlots: Array<ParsedClassSlot>,
  teacherEntries: Array<ParsedTeacherEntry>,
  issues: Array<ImportIssue>,
): Array<FinalTimetableImportPayload['slots'][number]> {
  const classSlotByKey = new Map(classSlots.map((slot) => [slot.key, slot]))
  const assignedBySlotKey = new Map<string, FinalTimetableImportPayload['slots'][number]>()
  const directEntries = teacherEntries.filter(
    (entry): entry is DirectTeacherEntry => entry.type === 'direct',
  )
  const gradeEntries = teacherEntries.filter(
    (entry): entry is GradeTeacherEntry => entry.type === 'grade',
  )

  for (const entry of directEntries) {
    const slotKey = makeSlotKey(entry.grade, entry.classNumber, entry.day, entry.period)
    const classSlot = classSlotByKey.get(slotKey)
    if (!classSlot) {
      issues.push(
        createBlockingIssue(
          'MATCH_NOT_FOUND',
          `${entry.teacherName} 교사의 direct 매칭 대상(${entry.grade}-${entry.classNumber} ${entry.day} ${entry.period}교시)을 찾을 수 없습니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: entry.row,
            column: columnIndexToLetter(entry.column),
          },
        ),
      )
      continue
    }

    if (classSlot.subjectName !== entry.subjectName) {
      issues.push(
        createBlockingIssue(
          'MATCH_CONFLICT',
          `${entry.grade}-${entry.classNumber} ${entry.day} ${entry.period}교시 과목 불일치: 클래스="${classSlot.subjectName}", 교사="${entry.subjectName}".`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: entry.row,
            column: columnIndexToLetter(entry.column),
          },
        ),
      )
      continue
    }

    const existing = assignedBySlotKey.get(slotKey)
    if (existing) {
      issues.push(
        createBlockingIssue(
          'MATCH_CONFLICT',
          `${entry.grade}-${entry.classNumber} ${entry.day} ${entry.period}교시에 다중 교사 매칭이 발생했습니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: entry.row,
            column: columnIndexToLetter(entry.column),
          },
        ),
      )
      continue
    }

    assignedBySlotKey.set(slotKey, {
      grade: classSlot.grade,
      classNumber: classSlot.classNumber,
      day: classSlot.day,
      period: classSlot.period,
      subjectName: classSlot.subjectName,
      teacherName: entry.teacherName,
    })
  }

  const gradeGroups = new Map<string, Array<GradeTeacherEntry>>()
  for (const gradeEntry of gradeEntries) {
    const groupKey = [
      gradeEntry.day,
      gradeEntry.period,
      gradeEntry.grade,
      gradeEntry.subjectName,
    ].join('|')
    const group = gradeGroups.get(groupKey)
    if (group) {
      group.push(gradeEntry)
      continue
    }
    gradeGroups.set(groupKey, [gradeEntry])
  }

  const sortedGroups = [...gradeGroups.values()].sort((groupA, groupB) => {
    const firstA = groupA[0]
    const firstB = groupB[0]

    if (firstA.grade !== firstB.grade) return firstA.grade - firstB.grade
    const dayDifference = DAY_SORT_INDEX[firstA.day] - DAY_SORT_INDEX[firstB.day]
    if (dayDifference !== 0) return dayDifference
    if (firstA.period !== firstB.period) return firstA.period - firstB.period
    return firstA.subjectName.localeCompare(firstB.subjectName, 'ko')
  })

  for (const group of sortedGroups) {
    const firstEntry = group[0]

    const sortedEntries = [...group].sort((entryA, entryB) => {
      if (entryA.rowOrder !== entryB.rowOrder) return entryA.rowOrder - entryB.rowOrder
      return entryA.row - entryB.row
    })

    const candidateSlots = classSlots
      .filter(
        (classSlot) =>
          classSlot.grade === firstEntry.grade &&
          classSlot.day === firstEntry.day &&
          classSlot.period === firstEntry.period &&
          classSlot.subjectName === firstEntry.subjectName &&
          !assignedBySlotKey.has(classSlot.key),
      )
      .sort((slotA, slotB) => slotA.classNumber - slotB.classNumber)

    if (sortedEntries.length < candidateSlots.length) {
      issues.push(
        createBlockingIssue(
          'MATCH_NOT_FOUND',
          `${firstEntry.grade}학년 ${firstEntry.day} ${firstEntry.period}교시 "${firstEntry.subjectName}"의 grade-level 배정이 부족합니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: firstEntry.row,
            column: columnIndexToLetter(firstEntry.column),
          },
        ),
      )
    }

    if (sortedEntries.length > candidateSlots.length) {
      const overflowEntry = sortedEntries[candidateSlots.length] ?? firstEntry
      issues.push(
        createBlockingIssue(
          'MATCH_CONFLICT',
          `${firstEntry.grade}학년 ${firstEntry.day} ${firstEntry.period}교시 "${firstEntry.subjectName}"의 grade-level 배정이 초과되었습니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: overflowEntry.row,
            column: columnIndexToLetter(overflowEntry.column),
          },
        ),
      )
    }

    const assignCount = Math.min(sortedEntries.length, candidateSlots.length)
    for (let index = 0; index < assignCount; index++) {
      const teacherEntry = sortedEntries[index]
      const classSlot = candidateSlots[index]

      assignedBySlotKey.set(classSlot.key, {
        grade: classSlot.grade,
        classNumber: classSlot.classNumber,
        day: classSlot.day,
        period: classSlot.period,
        subjectName: classSlot.subjectName,
        teacherName: teacherEntry.teacherName,
      })
    }
  }

  for (const classSlot of classSlots) {
    if (assignedBySlotKey.has(classSlot.key)) continue
    issues.push(
      createBlockingIssue(
        'MATCH_NOT_FOUND',
        `${classSlot.grade}-${classSlot.classNumber} ${classSlot.day} ${classSlot.period}교시 "${classSlot.subjectName}"의 교사 매칭을 찾을 수 없습니다.`,
        {
          sheetName: TARGET_SHEET_NAME,
          row: classSlot.row,
          column: columnIndexToLetter(classSlot.column),
        },
      ),
    )
  }

  return [...assignedBySlotKey.values()]
}

function sortSlots(
  slots: Array<FinalTimetableImportPayload['slots'][number]>,
): Array<FinalTimetableImportPayload['slots'][number]> {
  return [...slots].sort((slotA, slotB) => {
    if (slotA.grade !== slotB.grade) return slotA.grade - slotB.grade
    if (slotA.classNumber !== slotB.classNumber) return slotA.classNumber - slotB.classNumber

    const dayDifference = DAY_SORT_INDEX[slotA.day] - DAY_SORT_INDEX[slotB.day]
    if (dayDifference !== 0) return dayDifference

    return slotA.period - slotB.period
  })
}

function buildSheetMatrix(sheet: XLSX.WorkSheet): SheetMatrix {
  const matrix: SheetMatrix = new Map()
  const entries = Object.entries(sheet)
  for (const [address, cellObject] of entries) {
    if (address.startsWith('!')) continue

    const decoded = XLSX.utils.decode_cell(address)
    const row = decoded.r + 1
    const column = decoded.c

    if (!matrix.has(row)) {
      matrix.set(row, new Map<number, unknown>())
    }

    matrix.get(row)?.set(column, cellObject.v)
  }

  return matrix
}

function findTeacherHeaderRow(matrix: SheetMatrix): number | null {
  const maxRow = getMaxRow(matrix)
  for (let row = CLASS_FIRST_ROW; row <= maxRow; row++) {
    if (readCellText(matrix, row, 0) === TEACHER_HEADER_LABEL) return row
  }
  return null
}

function findHeaderColumns(rowCells: Map<number, unknown>, headerLabel: string): Array<number> {
  const columns: Array<number> = []
  for (const [column, value] of rowCells.entries()) {
    if (readCellTextValue(value) === headerLabel) {
      columns.push(column)
    }
  }
  return columns.sort((columnA, columnB) => columnA - columnB)
}

function extractPeriodColumns(
  matrix: SheetMatrix,
  periodRow: number,
  startColumn: number,
  endColumnExclusive: number,
): Array<{ column: number; period: number }> {
  const periodRowCells = matrix.get(periodRow)
  if (!periodRowCells) return []

  const periodColumns: Array<{ column: number; period: number }> = []
  for (const [column, value] of periodRowCells.entries()) {
    if (column < startColumn || column >= endColumnExclusive) continue
    const period = parsePositiveInteger(value)
    if (period === null) continue
    periodColumns.push({ column, period })
  }

  return periodColumns.sort((columnA, columnB) => columnA.column - columnB.column)
}

function parseClassLabel(
  value: string,
): { grade: number; classNumber: number } | null {
  const compact = value.replace(/\s+/g, '')
  const directPattern = compact.match(/^(\d+)-(\d+)$/)
  if (directPattern) {
    return {
      grade: Number(directPattern[1]),
      classNumber: Number(directPattern[2]),
    }
  }

  const koreanPattern = compact.match(/^(\d+)학년(\d+)반$/)
  if (koreanPattern) {
    return {
      grade: Number(koreanPattern[1]),
      classNumber: Number(koreanPattern[2]),
    }
  }

  return null
}

function parseTeacherAssignmentCell(
  value: string,
):
  | { type: 'direct'; grade: number; classNumber: number; subjectName: string }
  | { type: 'grade'; grade: number; subjectName: string }
  | null {
  const normalized = value.replace(/\s+/g, ' ').trim()
  const directPattern = normalized.match(/^(\d+)\s*-\s*(\d+)\s+(.+)$/)
  if (directPattern) {
    return {
      type: 'direct',
      grade: Number(directPattern[1]),
      classNumber: Number(directPattern[2]),
      subjectName: directPattern[3],
    }
  }

  const gradePattern = normalized.match(/^(\d+)\s*학년\s+(.+)$/)
  if (gradePattern) {
    return {
      type: 'grade',
      grade: Number(gradePattern[1]),
      subjectName: gradePattern[2],
    }
  }

  return null
}

function normalizeTeacherName(value: string): string {
  const firstSegment = value.split('/')[0]
  return normalizeImportName(firstSegment)
}

function isTeacherSectionTerminator(value: string): boolean {
  const compact = value.replace(/\s+/g, '')
  return compact === '근무상황'
}

function makeSlotKey(
  grade: number,
  classNumber: number,
  day: Weekday,
  period: number,
): string {
  return `${grade}|${classNumber}|${day}|${period}`
}

function createBlockingIssue(
  code:
    | 'SHEET_NOT_FOUND'
    | 'HEADER_MISMATCH'
    | 'INVALID_STRUCTURE'
    | 'MATCH_NOT_FOUND'
    | 'MATCH_CONFLICT'
    | 'UNKNOWN',
  message: string,
  location?: ImportIssue['location'],
): ImportIssue {
  return {
    code,
    severity: 'error',
    blocking: true,
    message,
    location,
  }
}

function createWarningIssue(
  code: 'INVALID_ROW',
  message: string,
  location?: ImportIssue['location'],
): ImportIssue {
  return {
    code,
    severity: 'warning',
    blocking: false,
    message,
    location,
  }
}

function hasBlockingIssue(issues: Array<ImportIssue>): boolean {
  return issues.some((issue) => issue.blocking)
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }

  const text = readCellTextValue(value)
  if (!text || !/^\d+$/.test(text)) return null

  const parsed = Number(text)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function readCellValue(matrix: SheetMatrix, row: number, column: number): unknown {
  return matrix.get(row)?.get(column)
}

function readCellText(matrix: SheetMatrix, row: number, column: number): string {
  return readCellTextValue(readCellValue(matrix, row, column))
}

function readCellTextValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value).trim()
}

function getMaxRow(matrix: SheetMatrix): number {
  return Math.max(0, ...matrix.keys())
}

function columnIndexToLetter(columnIndex: number): string {
  let current = columnIndex + 1
  let result = ''

  while (current > 0) {
    const remainder = (current - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    current = Math.floor((current - 1) / 26)
  }

  return result
}
