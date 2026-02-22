import type {
  ImpactAnalysisReport,
  ImpactClassSummary,
  ImpactHourDelta,
  ImpactRiskLevel,
  ImpactTeacherSummary,
} from '@/entities/impact-analysis'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import type { DayOfWeek } from '@/shared/lib/types'
import { DAY_LABELS } from '@/shared/lib/constants'
import { generateId } from '@/shared/lib/id'

interface ChangedSlot {
  before: TimetableCell | null
  after: TimetableCell | null
}

export interface AnalyzeSnapshotDiffImpactInput {
  snapshot: TimetableSnapshot
  beforeCells: Array<TimetableCell>
  afterCells: Array<TimetableCell>
  teachers: Array<Teacher>
  alternatives?: Array<string>
}

export function analyzeSnapshotDiffImpact(
  input: AnalyzeSnapshotDiffImpactInput,
): ImpactAnalysisReport {
  const { snapshot, beforeCells, afterCells, teachers, alternatives = [] } = input
  const changedSlots = diffCells(beforeCells, afterCells)

  return {
    id: generateId(),
    snapshotId: snapshot.id,
    weekTag: snapshot.weekTag,
    affectedTeachers: buildAffectedTeachers(changedSlots, beforeCells, afterCells, teachers),
    affectedClasses: buildAffectedClasses(changedSlots),
    hourDelta: buildHourDelta(changedSlots, beforeCells, afterCells, teachers),
    riskLevel: deriveRiskLevel(changedSlots.length),
    alternatives: alternatives.slice(0, 5),
    createdAt: new Date().toISOString(),
  }
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
  if (changedSlots.length === 0) {
    return []
  }

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

  return deltas.sort((a, b) => {
    if (a.target === b.target) {
      return b.delta - a.delta
    }
    return a.target.localeCompare(b.target)
  })
}

function buildTeacherDayCountMap(
  cells: Array<TimetableCell>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const cell of cells) {
    const key = `${cell.teacherId}|${cell.day}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function deriveRiskLevel(changedSlotCount: number): ImpactRiskLevel {
  if (changedSlotCount >= 12) {
    return 'HIGH'
  }
  if (changedSlotCount >= 4) {
    return 'MEDIUM'
  }
  return 'LOW'
}

function cellKey(cell: TimetableCell): string {
  return `${cell.grade}-${cell.classNumber}-${cell.day}-${cell.period}`
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
  return (
    before.teacherId === after.teacherId &&
    before.subjectId === after.subjectId &&
    before.grade === after.grade &&
    before.classNumber === after.classNumber &&
    before.day === after.day &&
    before.period === after.period &&
    before.isFixed === after.isFixed &&
    before.status === after.status
  )
}
