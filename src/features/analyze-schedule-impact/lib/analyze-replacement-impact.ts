import type {
  ImpactAnalysisReport,
  ImpactClassSummary,
  ImpactHourDelta,
  ImpactRiskLevel,
  ImpactTeacherSummary,
} from '@/entities/impact-analysis'
import type { ValidationViolation } from '@/entities/schedule-transaction'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import type { DayOfWeek } from '@/shared/lib/types'
import { DAY_LABELS } from '@/shared/lib/constants'
import { generateId } from '@/shared/lib/id'

export interface ReplacementCandidateImpactInput {
  id: string
  type: 'SWAP' | 'MOVE' | 'SUBSTITUTE'
  sourceCell: TimetableCell
  sourceCellKey: string
  targetCellKey: string
  targetCell: TimetableCell | null
  resultSourceCell: TimetableCell | null
  resultTargetCell: TimetableCell
  ranking: {
    violationCount: number
    violations: Array<ValidationViolation>
    scoreDelta: number
    totalRank: number
  }
}

export interface MultiReplacementCandidateImpactInput {
  id: string
  sources: Array<{
    sourceKey: string
    candidate: ReplacementCandidateImpactInput
  }>
  combinedRanking: {
    totalViolationCount: number
    combinedScoreDelta: number
    aggregateScore: number
  }
}

interface ChangedSlot {
  before: TimetableCell | null
  after: TimetableCell | null
}

export interface AnalyzeReplacementImpactInput {
  snapshot: TimetableSnapshot
  beforeCells: Array<TimetableCell>
  selectedCandidate: ReplacementCandidateImpactInput
  allCandidates: Array<ReplacementCandidateImpactInput>
  teachers: Array<Teacher>
}

export interface AnalyzeMultiReplacementImpactInput {
  snapshot: TimetableSnapshot
  beforeCells: Array<TimetableCell>
  selectedCandidate: MultiReplacementCandidateImpactInput
  allCandidates: Array<MultiReplacementCandidateImpactInput>
  teachers: Array<Teacher>
}

export function analyzeReplacementImpact(
  input: AnalyzeReplacementImpactInput,
): ImpactAnalysisReport {
  const afterCells = applySingleCandidate(input.beforeCells, input.selectedCandidate)
  const changedSlots = diffCells(input.beforeCells, afterCells)
  const riskLevel = deriveRiskLevel(
    input.selectedCandidate.ranking.violations,
    input.selectedCandidate.ranking.scoreDelta,
  )

  return {
    id: generateId(),
    snapshotId: input.snapshot.id,
    weekTag: input.snapshot.weekTag,
    affectedTeachers: buildAffectedTeachers(changedSlots, input.beforeCells, afterCells, input.teachers),
    affectedClasses: buildAffectedClasses(changedSlots),
    hourDelta: buildHourDelta(changedSlots, input.beforeCells, afterCells, input.teachers),
    riskLevel,
    alternatives: buildSingleAlternatives(
      input.selectedCandidate.id,
      input.allCandidates,
    ),
    createdAt: new Date().toISOString(),
  }
}

export function analyzeMultiReplacementImpact(
  input: AnalyzeMultiReplacementImpactInput,
): ImpactAnalysisReport {
  const afterCells = applyMultiCandidate(input.beforeCells, input.selectedCandidate)
  const changedSlots = diffCells(input.beforeCells, afterCells)
  const violations = input.selectedCandidate.sources.flatMap(
    ({ candidate }) => candidate.ranking.violations,
  )
  const riskLevel = deriveRiskLevel(
    violations,
    input.selectedCandidate.combinedRanking.combinedScoreDelta,
  )

  return {
    id: generateId(),
    snapshotId: input.snapshot.id,
    weekTag: input.snapshot.weekTag,
    affectedTeachers: buildAffectedTeachers(changedSlots, input.beforeCells, afterCells, input.teachers),
    affectedClasses: buildAffectedClasses(changedSlots),
    hourDelta: buildHourDelta(changedSlots, input.beforeCells, afterCells, input.teachers),
    riskLevel,
    alternatives: buildMultiAlternatives(
      input.selectedCandidate.id,
      input.allCandidates,
    ),
    createdAt: new Date().toISOString(),
  }
}

function applySingleCandidate(
  beforeCells: Array<TimetableCell>,
  candidate: ReplacementCandidateImpactInput,
): Array<TimetableCell> {
  if (candidate.type === 'SUBSTITUTE') {
    return beforeCells.map((cell) => {
      if (!isSameCell(cell, candidate.sourceCell)) {
        return cell
      }
      return candidate.resultTargetCell
    })
  }

  if (candidate.type === 'SWAP' && candidate.targetCell) {
    return beforeCells.map((cell) => {
      if (isSameCell(cell, candidate.sourceCell)) {
        return candidate.resultSourceCell ?? cell
      }
      if (isSameCell(cell, candidate.targetCell!)) {
        return candidate.resultTargetCell
      }
      return cell
    })
  }

  return beforeCells
    .filter((cell) => !isSameCell(cell, candidate.sourceCell))
    .concat(candidate.resultTargetCell)
}

function applyMultiCandidate(
  beforeCells: Array<TimetableCell>,
  candidate: MultiReplacementCandidateImpactInput,
): Array<TimetableCell> {
  let nextCells = [...beforeCells]
  for (const { candidate: single } of candidate.sources) {
    nextCells = applySingleCandidate(nextCells, single)
  }
  return nextCells
}

function diffCells(
  beforeCells: Array<TimetableCell>,
  afterCells: Array<TimetableCell>,
): Array<ChangedSlot> {
  const beforeMap = new Map(beforeCells.map((cell) => [cellKey(cell), cell]))
  const afterMap = new Map(afterCells.map((cell) => [cellKey(cell), cell]))
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()])
  const changed: Array<ChangedSlot> = []

  for (const key of keys) {
    const before = beforeMap.get(key) ?? null
    const after = afterMap.get(key) ?? null
    if (isEquivalentCell(before, after)) {
      continue
    }
    changed.push({ before, after })
  }

  return changed
}

function buildAffectedTeachers(
  changedSlots: Array<ChangedSlot>,
  beforeCells: Array<TimetableCell>,
  afterCells: Array<TimetableCell>,
  teachers: Array<Teacher>,
): Array<ImpactTeacherSummary> {
  const teacherNameMap = new Map(teachers.map((teacher) => [teacher.id, teacher.name]))
  const affectedTeacherIds = new Set<string>()

  for (const slot of changedSlots) {
    if (slot.before) {
      affectedTeacherIds.add(slot.before.teacherId)
    }
    if (slot.after) {
      affectedTeacherIds.add(slot.after.teacherId)
    }
  }

  return [...affectedTeacherIds].map((teacherId) => {
    const beforeCount = beforeCells.filter((cell) => cell.teacherId === teacherId).length
    const afterCount = afterCells.filter((cell) => cell.teacherId === teacherId).length
    const delta = afterCount - beforeCount
    const touchedCount = changedSlots.filter(
      (slot) => slot.before?.teacherId === teacherId || slot.after?.teacherId === teacherId,
    ).length

    return {
      teacherName: teacherNameMap.get(teacherId) ?? teacherId,
      summary:
        delta === 0
          ? `배치 위치 변경 ${touchedCount}건`
          : `주간 배정 시수 ${delta > 0 ? '+' : ''}${delta}`,
    }
  })
}

function buildAffectedClasses(changedSlots: Array<ChangedSlot>): Array<ImpactClassSummary> {
  const touchedClasses = new Set<string>()
  for (const slot of changedSlots) {
    if (slot.before) {
      touchedClasses.add(`${slot.before.grade}-${slot.before.classNumber}`)
    }
    if (slot.after) {
      touchedClasses.add(`${slot.after.grade}-${slot.after.classNumber}`)
    }
  }

  return [...touchedClasses].map((value) => {
    const [grade, classNumber] = value.split('-').map(Number)
    const touchedCount = changedSlots.filter((slot) => {
      const beforeMatch =
        slot.before?.grade === grade && slot.before.classNumber === classNumber
      const afterMatch =
        slot.after?.grade === grade && slot.after.classNumber === classNumber
      return beforeMatch || afterMatch
    }).length

    return {
      grade,
      classNumber,
      summary: `변경 슬롯 ${touchedCount}건`,
    }
  })
}

function buildHourDelta(
  changedSlots: Array<ChangedSlot>,
  beforeCells: Array<TimetableCell>,
  afterCells: Array<TimetableCell>,
  teachers: Array<Teacher>,
): Array<ImpactHourDelta> {
  const teacherNameMap = new Map(teachers.map((teacher) => [teacher.id, teacher.name]))
  const beforeMap = buildTeacherDayCountMap(beforeCells)
  const afterMap = buildTeacherDayCountMap(afterCells)
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()])
  const deltas: Array<ImpactHourDelta> = []

  for (const key of keys) {
    const beforeCount = beforeMap.get(key) ?? 0
    const afterCount = afterMap.get(key) ?? 0
    const delta = afterCount - beforeCount
    if (delta === 0) {
      continue
    }

    const [teacherId, day] = key.split('|') as [string, DayOfWeek]
    const teacherName = teacherNameMap.get(teacherId) ?? teacherId
    deltas.push({
      target: `${teacherName}(${DAY_LABELS[day]})`,
      delta,
    })
  }

  if (deltas.length > 0) {
    return deltas
  }

  const affectedTeacherIds = new Set<string>()
  for (const slot of changedSlots) {
    if (slot.before) {
      affectedTeacherIds.add(slot.before.teacherId)
    }
    if (slot.after) {
      affectedTeacherIds.add(slot.after.teacherId)
    }
  }

  return [...affectedTeacherIds].map((teacherId) => ({
    target: `${teacherNameMap.get(teacherId) ?? teacherId}(주간)`,
    delta: 0,
  }))
}

function buildTeacherDayCountMap(cells: Array<TimetableCell>): Map<string, number> {
  const map = new Map<string, number>()
  for (const cell of cells) {
    const key = `${cell.teacherId}|${cell.day}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function buildSingleAlternatives(
  selectedCandidateId: string,
  allCandidates: Array<ReplacementCandidateImpactInput>,
): Array<string> {
  return [...allCandidates]
    .filter((candidate) => candidate.id !== selectedCandidateId)
    .sort((a, b) => b.ranking.totalRank - a.ranking.totalRank)
    .slice(0, 3)
    .map((candidate) => {
      const target = parseCellKey(candidate.targetCellKey)
      const scoreDelta = candidate.ranking.scoreDelta
      const scoreLabel =
        scoreDelta > 0 ? `+${scoreDelta.toFixed(1)}` : scoreDelta.toFixed(1)
      const typeLabel =
        candidate.type === 'SWAP'
          ? '교환'
          : candidate.type === 'SUBSTITUTE'
            ? '대강'
            : '이동'

      return `${DAY_LABELS[target.day]} ${target.period}교시 ${typeLabel} ${scoreLabel}점 / 위반 ${candidate.ranking.violationCount}건`
    })
}

function buildMultiAlternatives(
  selectedCandidateId: string,
  allCandidates: Array<MultiReplacementCandidateImpactInput>,
): Array<string> {
  return [...allCandidates]
    .filter((candidate) => candidate.id !== selectedCandidateId)
    .sort(
      (a, b) =>
        b.combinedRanking.aggregateScore - a.combinedRanking.aggregateScore,
    )
    .slice(0, 3)
    .map((candidate) => {
      const slots = candidate.sources
        .map(({ candidate: sourceCandidate }) => {
          const target = parseCellKey(sourceCandidate.targetCellKey)
          return `${DAY_LABELS[target.day]} ${target.period}교시`
        })
        .join(', ')
      const delta = candidate.combinedRanking.combinedScoreDelta
      const deltaLabel = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)

      return `조합(${slots}) ${deltaLabel}점 / 위반 ${candidate.combinedRanking.totalViolationCount}건`
    })
}

function deriveRiskLevel(
  violations: Array<ValidationViolation>,
  scoreDelta: number,
): ImpactRiskLevel {
  const errorCount = violations.filter((violation) => violation.severity === 'error').length
  const warningCount = violations.filter(
    (violation) => violation.severity === 'warning',
  ).length

  if (errorCount >= 1) {
    return 'HIGH'
  }
  if (warningCount >= 1 || scoreDelta < -0.5) {
    return 'MEDIUM'
  }
  return 'LOW'
}

function isSameCell(a: TimetableCell, b: TimetableCell): boolean {
  return (
    a.grade === b.grade &&
    a.classNumber === b.classNumber &&
    a.day === b.day &&
    a.period === b.period
  )
}

function isEquivalentCell(
  before: TimetableCell | null,
  after: TimetableCell | null,
): boolean {
  if (before === null && after === null) {
    return true
  }
  if (before === null || after === null) {
    return false
  }
  return before.teacherId === after.teacherId && before.subjectId === after.subjectId
}

function cellKey(cell: TimetableCell): string {
  return `${cell.grade}-${cell.classNumber}-${cell.day}-${cell.period}`
}

function parseCellKey(
  key: string,
): { grade: number; classNumber: number; day: DayOfWeek; period: number } {
  const [grade, classNumber, day, period] = key.split('-')
  return {
    grade: Number(grade),
    classNumber: Number(classNumber),
    day: day as DayOfWeek,
    period: Number(period),
  }
}
