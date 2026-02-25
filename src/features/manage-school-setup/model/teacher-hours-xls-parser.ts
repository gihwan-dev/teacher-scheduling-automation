import * as XLSX from 'xlsx'
import { normalizeImportName } from './name-normalizer'
import type { ImportIssue, TeacherHoursImportPayload } from './types'
import { MAX_CLASS_COUNT, MAX_GRADE_COUNT } from '@/shared/lib/constants'

const TARGET_SHEET_NAME: TeacherHoursImportPayload['sheetName'] = '교사별시수표'
const HEADER_SUBJECT_NAME = '정식과목명'
const HEADER_SUBJECT_ABBREVIATION = '단축과목명'
const HEADER_TEACHER_NAME = '교사명'
const HEADER_TOTAL = '계'

interface ClassColumn {
  index: number
  grade: number
  classNumber: number
  headerLabel: string
}

interface AssignmentAccumulator {
  teacherName: string
  subjectName: string
  grade: number
  classNumber: number
  hoursPerWeek: number
}

export function parseTeacherHoursXls(
  input: ArrayBuffer | Uint8Array,
): TeacherHoursImportPayload {
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
  const hasTargetSheet = workbook.SheetNames.includes(TARGET_SHEET_NAME)

  if (!hasTargetSheet) {
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
  let rows: Array<Array<unknown>>
  try {
    rows = XLSX.utils.sheet_to_json<Array<unknown>>(sheet, {
      header: 1,
      raw: true,
      defval: '',
    })
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
  const headerRow = rows[0] ?? []
  const totalHeaderIndexes = findHeaderIndexes(headerRow, HEADER_TOTAL)
  const totalIndex = totalHeaderIndexes[0] ?? -1
  const hasHeaderAfterTotal =
    totalIndex >= 0 &&
    headerRow
      .slice(totalIndex + 1)
      .some((headerCell) => readCellText(headerCell).length > 0)

  if (
    readCellText(headerRow[0]) !== HEADER_SUBJECT_NAME ||
    readCellText(headerRow[1]) !== HEADER_SUBJECT_ABBREVIATION ||
    readCellText(headerRow[2]) !== HEADER_TEACHER_NAME ||
    totalHeaderIndexes.length !== 1 ||
    totalIndex <= 2 ||
    hasHeaderAfterTotal
  ) {
    issues.push(
      createBlockingIssue(
        'HEADER_MISMATCH',
        '필수 헤더가 템플릿과 일치하지 않습니다.',
        {
          sheetName: TARGET_SHEET_NAME,
          row: 1,
        },
      ),
    )
    return payload
  }

  const classColumnResult = extractClassColumns(headerRow, totalIndex)
  if (!classColumnResult.ok) {
    issues.push(classColumnResult.issue)
    return payload
  }

  const classColumns = classColumnResult.classColumns
  const subjectByNormalizedName = new Map<string, { name: string; abbreviation: string }>()
  const teacherBaseHoursByName = new Map<string, number>()
  const assignmentByKey = new Map<string, AssignmentAccumulator>()

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? []
    if (isCompletelyEmptyRow(row)) continue

    const subjectName = normalizeImportName(row[0])
    const subjectAbbreviation = normalizeImportName(row[1])
    const teacherName = normalizeImportName(row[2])
    const sheetRow = rowIndex + 1

    if (!subjectName || !subjectAbbreviation || !teacherName) {
      issues.push(
        createWarningIssue(
          'INVALID_ROW',
          `필수 텍스트 누락으로 ${sheetRow}행을 건너뜁니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: sheetRow,
          },
        ),
      )
      continue
    }

    const classHours: Array<{ column: ClassColumn; hours: number }> = []
    let invalidNumberColumn: string | null = null

    for (const classColumn of classColumns) {
      const parsedHours = parseNumericCell(row[classColumn.index], true)
      if (parsedHours === null) {
        invalidNumberColumn = columnIndexToLetter(classColumn.index)
        break
      }
      classHours.push({ column: classColumn, hours: parsedHours })
    }

    if (invalidNumberColumn !== null) {
      issues.push(
        createWarningIssue(
          'INVALID_ROW',
          `숫자 파싱 실패로 ${sheetRow}행을 건너뜁니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: sheetRow,
            column: invalidNumberColumn,
          },
        ),
      )
      continue
    }

    const totalHours = parseNumericCell(row[totalIndex], false)
    if (totalHours === null) {
      issues.push(
        createWarningIssue(
          'INVALID_ROW',
          `숫자 파싱 실패로 ${sheetRow}행을 건너뜁니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: sheetRow,
            column: columnIndexToLetter(totalIndex),
            field: HEADER_TOTAL,
          },
        ),
      )
      continue
    }

    const classHoursSum = classHours.reduce((sum, entry) => sum + entry.hours, 0)
    if (classHoursSum !== totalHours) {
      issues.push(
        createWarningIssue(
          'INVALID_ROW',
          `${sheetRow}행의 "${HEADER_TOTAL}" 값과 학년/반 시수 합계가 일치하지 않습니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: sheetRow,
            column: columnIndexToLetter(totalIndex),
            field: HEADER_TOTAL,
          },
        ),
      )
    }

    const existingSubject = subjectByNormalizedName.get(subjectName)
    const canonicalSubjectName = existingSubject?.name ?? subjectName

    if (!existingSubject) {
      subjectByNormalizedName.set(subjectName, {
        name: subjectName,
        abbreviation: subjectAbbreviation,
      })
    } else {
      issues.push(
        createWarningIssue(
          'DUPLICATE_NORMALIZED_NAME',
          `정규화된 과목명 "${subjectName}"이 중복되어 첫 번째 항목을 유지합니다.`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: sheetRow,
            column: columnIndexToLetter(0),
            field: HEADER_SUBJECT_NAME,
          },
        ),
      )
    }

    teacherBaseHoursByName.set(
      teacherName,
      (teacherBaseHoursByName.get(teacherName) ?? 0) + classHoursSum,
    )

    for (const { column, hours } of classHours) {
      if (hours <= 0) continue

      const assignmentKey = [
        column.grade,
        column.classNumber,
        teacherName,
        canonicalSubjectName,
      ].join('|')
      const existingAssignment = assignmentByKey.get(assignmentKey)

      if (existingAssignment) {
        existingAssignment.hoursPerWeek += hours
        continue
      }

      assignmentByKey.set(assignmentKey, {
        teacherName,
        subjectName: canonicalSubjectName,
        grade: column.grade,
        classNumber: column.classNumber,
        hoursPerWeek: hours,
      })
    }
  }

  const collator = new Intl.Collator('ko')
  payload.subjects = [...subjectByNormalizedName.values()].sort((a, b) =>
    collator.compare(a.name, b.name),
  )
  payload.teachers = [...teacherBaseHoursByName.entries()]
    .map(([name, baseHoursPerWeek]) => ({ name, baseHoursPerWeek }))
    .sort((a, b) => collator.compare(a.name, b.name))
  payload.assignments = [...assignmentByKey.values()].sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade
    if (a.classNumber !== b.classNumber) return a.classNumber - b.classNumber

    const teacherNameCompare = collator.compare(a.teacherName, b.teacherName)
    if (teacherNameCompare !== 0) return teacherNameCompare

    return collator.compare(a.subjectName, b.subjectName)
  })

  return payload
}

function createEmptyPayload(
  issues: Array<ImportIssue>,
): TeacherHoursImportPayload {
  return {
    sheetName: TARGET_SHEET_NAME,
    subjects: [],
    teachers: [],
    assignments: [],
    issues,
  }
}

function createBlockingIssue(
  code: 'SHEET_NOT_FOUND' | 'HEADER_MISMATCH' | 'INVALID_STRUCTURE' | 'UNKNOWN',
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
  code: 'INVALID_ROW' | 'DUPLICATE_NORMALIZED_NAME',
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

function extractClassColumns(
  headerRow: Array<unknown>,
  totalIndex: number,
):
  | { ok: true; classColumns: Array<ClassColumn> }
  | { ok: false; issue: ImportIssue } {
  const classColumns: Array<ClassColumn> = []
  const seenClassKeys = new Set<string>()

  for (let columnIndex = 3; columnIndex < totalIndex; columnIndex++) {
    const headerLabel = readCellText(headerRow[columnIndex])
    const parsed = parseClassColumnHeader(headerLabel)
    if (!parsed) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'INVALID_STRUCTURE',
          `학년/반 헤더 형식이 잘못되었습니다: "${headerLabel}".`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: 1,
            column: columnIndexToLetter(columnIndex),
          },
        ),
      }
    }

    if (
      parsed.grade < 1 ||
      parsed.grade > MAX_GRADE_COUNT ||
      parsed.classNumber < 1 ||
      parsed.classNumber > MAX_CLASS_COUNT
    ) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'INVALID_STRUCTURE',
          `학년/반 범위를 벗어난 헤더입니다: "${headerLabel}".`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: 1,
            column: columnIndexToLetter(columnIndex),
          },
        ),
      }
    }

    const classKey = `${parsed.grade}-${parsed.classNumber}`
    if (seenClassKeys.has(classKey)) {
      return {
        ok: false,
        issue: createBlockingIssue(
          'INVALID_STRUCTURE',
          `중복된 학년/반 헤더가 있습니다: "${headerLabel}".`,
          {
            sheetName: TARGET_SHEET_NAME,
            row: 1,
            column: columnIndexToLetter(columnIndex),
          },
        ),
      }
    }
    seenClassKeys.add(classKey)

    classColumns.push({
      index: columnIndex,
      grade: parsed.grade,
      classNumber: parsed.classNumber,
      headerLabel,
    })
  }

  if (classColumns.length === 0) {
    return {
      ok: false,
      issue: createBlockingIssue(
        'INVALID_STRUCTURE',
        '교사명과 계 사이에 학년/반 헤더가 없습니다.',
        {
          sheetName: TARGET_SHEET_NAME,
          row: 1,
        },
      ),
    }
  }

  return { ok: true, classColumns }
}

function parseClassColumnHeader(
  headerLabel: string,
): { grade: number; classNumber: number } | null {
  const gradeClassPattern1 = headerLabel.match(/^(\d+)\s*-\s*(\d+)$/)
  if (gradeClassPattern1) {
    return {
      grade: Number(gradeClassPattern1[1]),
      classNumber: Number(gradeClassPattern1[2]),
    }
  }

  const gradeClassPattern2 = headerLabel.match(/^(\d+)\s*학년\s*(\d+)\s*반$/)
  if (gradeClassPattern2) {
    return {
      grade: Number(gradeClassPattern2[1]),
      classNumber: Number(gradeClassPattern2[2]),
    }
  }

  return null
}

function findHeaderIndexes(row: Array<unknown>, headerLabel: string): Array<number> {
  const indexes: Array<number> = []

  for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
    if (readCellText(row[columnIndex]) === headerLabel) {
      indexes.push(columnIndex)
    }
  }

  return indexes
}

function parseNumericCell(
  value: unknown,
  allowEmptyAsZero: boolean,
): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : null
  }

  const text = readCellText(value)
  if (!text) return allowEmptyAsZero ? 0 : null

  const isPlainInteger = /^\d+$/.test(text)
  const isCommaGroupedInteger = /^\d{1,3}(,\d{3})+$/.test(text)
  if (!isPlainInteger && !isCommaGroupedInteger) return null

  const sanitized = text.replaceAll(',', '')
  const parsed = Number(sanitized)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function isCompletelyEmptyRow(row: Array<unknown>): boolean {
  return row.every((cell) => readCellText(cell).length === 0)
}

function readCellText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value).trim()
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
