import { create } from 'zustand'

import { buildCellMap, makeCellKey, parseCellKey } from '../lib/cell-key'
import { isCellEditable, validateCellEdit } from '../lib/edit-validator'
import type { ConstraintPolicy, ConstraintViolation } from '@/entities/constraint-policy'
import type { FixedEvent } from '@/entities/fixed-event'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { CellKey, CellStatus, EditAction, TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import { validateTimetable } from '@/entities/constraint-policy'
import { buildBlockedSlots, expandGradeBlockedSlots } from '@/features/generate-timetable'
import { recomputeUnlocked } from '@/features/recompute-timetable'
import {
  loadAllSetupData,
  loadConstraintPolicy,
  loadLatestTimetableSnapshot,
  loadTeacherPolicies,
  updateTimetableSnapshot,
} from '@/shared/persistence/indexeddb/repository'

type Direction = 'up' | 'down' | 'left' | 'right'

interface EditState {
  // 데이터
  snapshot: TimetableSnapshot | null
  cells: Array<TimetableCell>
  cellMap: Map<CellKey, TimetableCell>

  // 내비게이션/선택
  focusedCell: CellKey | null
  selectedCells: Set<CellKey>

  // 편집 모드
  isEditing: boolean
  editingCellKey: CellKey | null
  editDraft: { teacherId: string; subjectId: string } | null

  // Undo/Redo
  undoStack: Array<EditAction>
  redoStack: Array<EditAction>

  // 검증
  violations: Array<ConstraintViolation>

  // 뷰 컨텍스트
  viewGrade: number
  viewClassNumber: number

  // 참조 데이터
  schoolConfig: SchoolConfig | null
  teachers: Array<Teacher>
  subjects: Array<Subject>
  constraintPolicy: ConstraintPolicy | null
  teacherPolicies: Array<TeacherPolicy>
  fixedEvents: Array<FixedEvent>

  // 상태 플래그
  isDirty: boolean
  isLoading: boolean
  isRecomputing: boolean

  // 액션
  loadSnapshot: () => Promise<void>
  setViewTarget: (grade: number, classNumber: number) => void
  setFocusedCell: (key: CellKey | null) => void
  moveFocus: (direction: Direction) => void
  toggleSelection: (key: CellKey) => void
  startEdit: (key: CellKey) => void
  updateEditDraft: (draft: { teacherId: string; subjectId: string }) => void
  confirmEdit: () => void
  cancelEdit: () => void
  clearCell: (key: CellKey) => void
  toggleLock: (key: CellKey) => void
  lockSelected: () => void
  unlockSelected: () => void
  undo: () => void
  redo: () => void
  recompute: () => Promise<void>
  saveSnapshot: () => Promise<void>
}

export const useEditStore = create<EditState>((set, get) => ({
  snapshot: null,
  cells: [],
  cellMap: new Map(),
  focusedCell: null,
  selectedCells: new Set(),
  isEditing: false,
  editingCellKey: null,
  editDraft: null,
  undoStack: [],
  redoStack: [],
  violations: [],
  viewGrade: 1,
  viewClassNumber: 1,
  schoolConfig: null,
  teachers: [],
  subjects: [],
  constraintPolicy: null,
  teacherPolicies: [],
  fixedEvents: [],
  isDirty: false,
  isLoading: false,
  isRecomputing: false,

  loadSnapshot: async () => {
    set({ isLoading: true })
    const [setupData, snapshot, savedPolicy, teacherPolicies] = await Promise.all([
      loadAllSetupData(),
      loadLatestTimetableSnapshot(),
      loadConstraintPolicy(),
      loadTeacherPolicies(),
    ])

    if (!snapshot) {
      set({
        isLoading: false,
        schoolConfig: setupData.schoolConfig ?? null,
      })
      return
    }

    const cells = snapshot.cells.map((c) => ({
      ...c,
      status: c.status,
    }))

    set({
      snapshot,
      cells,
      cellMap: buildCellMap(cells),
      schoolConfig: setupData.schoolConfig ?? null,
      teachers: setupData.teachers,
      subjects: setupData.subjects,
      fixedEvents: setupData.fixedEvents,
      constraintPolicy: savedPolicy ?? null,
      teacherPolicies,
      violations: savedPolicy ? validateTimetable(cells, savedPolicy) : [],
      isLoading: false,
      isDirty: false,
      undoStack: [],
      redoStack: [],
    })
  },

  setViewTarget: (grade, classNumber) => {
    set({ viewGrade: grade, viewClassNumber: classNumber, focusedCell: null, selectedCells: new Set() })
  },

  setFocusedCell: (key) => {
    set({ focusedCell: key })
  },

  moveFocus: (direction) => {
    const { focusedCell, viewGrade, viewClassNumber, schoolConfig } = get()
    if (!schoolConfig) return

    const { activeDays, periodsPerDay } = schoolConfig
    const dayIndex = focusedCell ? activeDays.indexOf(parseCellKey(focusedCell).day) : 0
    const period = focusedCell ? parseCellKey(focusedCell).period : 1

    let newDayIndex = dayIndex
    let newPeriod = period

    switch (direction) {
      case 'up':
        newPeriod = Math.max(1, period - 1)
        break
      case 'down':
        newPeriod = Math.min(periodsPerDay, period + 1)
        break
      case 'left':
        newDayIndex = Math.max(0, dayIndex - 1)
        break
      case 'right':
        newDayIndex = Math.min(activeDays.length - 1, dayIndex + 1)
        break
    }

    const newKey = makeCellKey(viewGrade, viewClassNumber, activeDays[newDayIndex], newPeriod)
    set({ focusedCell: newKey })
  },

  toggleSelection: (key) => {
    const { selectedCells } = get()
    const next = new Set(selectedCells)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    set({ selectedCells: next })
  },

  startEdit: (key) => {
    const { cellMap } = get()
    const cell = cellMap.get(key)

    if (cell && !isCellEditable(cell)) return

    set({
      isEditing: true,
      editingCellKey: key,
      editDraft: cell
        ? { teacherId: cell.teacherId, subjectId: cell.subjectId }
        : { teacherId: '', subjectId: '' },
      focusedCell: key,
    })
  },

  updateEditDraft: (draft) => {
    set({ editDraft: draft })
  },

  confirmEdit: () => {
    const { editingCellKey, editDraft, cells, constraintPolicy, teacherPolicies, fixedEvents, schoolConfig } = get()
    if (!editingCellKey || !editDraft || !constraintPolicy || !schoolConfig) return

    // 빈 draft인 경우 편집 취소
    if (!editDraft.teacherId || !editDraft.subjectId) {
      set({ isEditing: false, editingCellKey: null, editDraft: null })
      return
    }

    // blocked slots 구축
    let blockedSlots = buildBlockedSlots(fixedEvents, teacherPolicies)
    blockedSlots = expandGradeBlockedSlots(blockedSlots, schoolConfig.classCountByGrade)

    // 검증
    const result = validateCellEdit(
      cells,
      editingCellKey,
      editDraft.teacherId,
      editDraft.subjectId,
      constraintPolicy,
      teacherPolicies,
      blockedSlots,
    )

    if (!result.valid) {
      // 검증 실패 시 편집 유지 (violations만 반영)
      return
    }

    const { grade, classNumber, day, period } = parseCellKey(editingCellKey)
    const cellMap = get().cellMap
    const oldCell = cellMap.get(editingCellKey) ?? null

    // 새 셀 생성
    const newCell: TimetableCell = {
      teacherId: editDraft.teacherId,
      subjectId: editDraft.subjectId,
      grade,
      classNumber,
      day,
      period,
      isFixed: false,
      status: 'CONFIRMED_MODIFIED',
    }

    // EditAction 생성
    const action: EditAction = {
      type: 'EDIT',
      before: oldCell,
      after: newCell,
      cellKey: editingCellKey,
      timestamp: Date.now(),
    }

    // cells 업데이트
    const newCells = oldCell
      ? cells.map((c) =>
          c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period
            ? newCell
            : c,
        )
      : [...cells, newCell]

    const violations = validateTimetable(newCells, constraintPolicy)

    set({
      cells: newCells,
      cellMap: buildCellMap(newCells),
      undoStack: [...get().undoStack, action],
      redoStack: [],
      violations,
      isEditing: false,
      editingCellKey: null,
      editDraft: null,
      isDirty: true,
    })
  },

  cancelEdit: () => {
    set({ isEditing: false, editingCellKey: null, editDraft: null })
  },

  clearCell: (key) => {
    const { cells, cellMap, constraintPolicy, undoStack } = get()
    const cell = cellMap.get(key)
    if (!cell || !isCellEditable(cell)) return

    const action: EditAction = {
      type: 'CLEAR',
      before: cell,
      after: null,
      cellKey: key,
      timestamp: Date.now(),
    }

    const { grade, classNumber, day, period } = parseCellKey(key)
    const newCells = cells.filter(
      (c) => !(c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period),
    )
    const violations = constraintPolicy ? validateTimetable(newCells, constraintPolicy) : []

    set({
      cells: newCells,
      cellMap: buildCellMap(newCells),
      undoStack: [...undoStack, action],
      redoStack: [],
      violations,
      isDirty: true,
    })
  },

  toggleLock: (key) => {
    const { cells, cellMap, constraintPolicy, undoStack } = get()
    const cell = cellMap.get(key)
    if (!cell || cell.isFixed) return

    const isLocking = cell.status !== 'LOCKED'
    const newStatus: CellStatus = isLocking ? 'LOCKED' : (cell.status === 'LOCKED' ? 'CONFIRMED_MODIFIED' : cell.status)

    const action: EditAction = {
      type: isLocking ? 'LOCK' : 'UNLOCK',
      before: cell,
      after: { ...cell, status: newStatus },
      cellKey: key,
      timestamp: Date.now(),
    }

    const { grade, classNumber, day, period } = parseCellKey(key)
    const newCells = cells.map((c) =>
      c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period
        ? { ...c, status: newStatus }
        : c,
    )

    const violations = constraintPolicy ? validateTimetable(newCells, constraintPolicy) : []

    set({
      cells: newCells,
      cellMap: buildCellMap(newCells),
      undoStack: [...undoStack, action],
      redoStack: [],
      violations,
      isDirty: true,
    })
  },

  lockSelected: () => {
    const { selectedCells, cells, cellMap, constraintPolicy, undoStack } = get()
    if (selectedCells.size === 0) return

    const actions: Array<EditAction> = []
    let newCells = [...cells]

    for (const key of selectedCells) {
      const cell = cellMap.get(key)
      if (!cell || cell.isFixed || cell.status === 'LOCKED') continue

      actions.push({
        type: 'LOCK',
        before: cell,
        after: { ...cell, status: 'LOCKED' },
        cellKey: key,
        timestamp: Date.now(),
      })

      const { grade, classNumber, day, period } = parseCellKey(key)
      newCells = newCells.map((c) =>
        c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period
          ? { ...c, status: 'LOCKED' as CellStatus }
          : c,
      )
    }

    if (actions.length === 0) return

    const violations = constraintPolicy ? validateTimetable(newCells, constraintPolicy) : []

    set({
      cells: newCells,
      cellMap: buildCellMap(newCells),
      undoStack: [...undoStack, ...actions],
      redoStack: [],
      violations,
      isDirty: true,
    })
  },

  unlockSelected: () => {
    const { selectedCells, cells, cellMap, constraintPolicy, undoStack } = get()
    if (selectedCells.size === 0) return

    const actions: Array<EditAction> = []
    let newCells = [...cells]

    for (const key of selectedCells) {
      const cell = cellMap.get(key)
      if (!cell || cell.isFixed || cell.status !== 'LOCKED') continue

      actions.push({
        type: 'UNLOCK',
        before: cell,
        after: { ...cell, status: 'CONFIRMED_MODIFIED' },
        cellKey: key,
        timestamp: Date.now(),
      })

      const { grade, classNumber, day, period } = parseCellKey(key)
      newCells = newCells.map((c) =>
        c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period
          ? { ...c, status: 'CONFIRMED_MODIFIED' as CellStatus }
          : c,
      )
    }

    if (actions.length === 0) return

    const violations = constraintPolicy ? validateTimetable(newCells, constraintPolicy) : []

    set({
      cells: newCells,
      cellMap: buildCellMap(newCells),
      undoStack: [...undoStack, ...actions],
      redoStack: [],
      violations,
      isDirty: true,
    })
  },

  undo: () => {
    const { undoStack, cells, constraintPolicy } = get()
    if (undoStack.length === 0) return

    const action = undoStack[undoStack.length - 1]
    const newUndoStack = undoStack.slice(0, -1)

    const { grade, classNumber, day, period } = parseCellKey(action.cellKey)

    let newCells: Array<TimetableCell>
    if (action.before === null) {
      // 이전에 셀이 없었음 → 현재 셀 제거
      newCells = cells.filter(
        (c) => !(c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period),
      )
    } else {
      // 이전 셀로 복원
      const exists = cells.some(
        (c) => c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period,
      )
      if (exists) {
        newCells = cells.map((c) =>
          c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period
            ? action.before!
            : c,
        )
      } else {
        newCells = [...cells, action.before]
      }
    }

    const violations = constraintPolicy ? validateTimetable(newCells, constraintPolicy) : []

    set({
      cells: newCells,
      cellMap: buildCellMap(newCells),
      undoStack: newUndoStack,
      redoStack: [...get().redoStack, action],
      violations,
      isDirty: true,
    })
  },

  redo: () => {
    const { redoStack, cells, constraintPolicy } = get()
    if (redoStack.length === 0) return

    const action = redoStack[redoStack.length - 1]
    const newRedoStack = redoStack.slice(0, -1)

    const { grade, classNumber, day, period } = parseCellKey(action.cellKey)

    let newCells: Array<TimetableCell>
    if (action.after === null) {
      // 셀 제거 (clear 재적용)
      newCells = cells.filter(
        (c) => !(c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period),
      )
    } else {
      const exists = cells.some(
        (c) => c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period,
      )
      if (exists) {
        newCells = cells.map((c) =>
          c.grade === grade && c.classNumber === classNumber && c.day === day && c.period === period
            ? action.after!
            : c,
        )
      } else {
        newCells = [...cells, action.after]
      }
    }

    const violations = constraintPolicy ? validateTimetable(newCells, constraintPolicy) : []

    set({
      cells: newCells,
      cellMap: buildCellMap(newCells),
      undoStack: [...get().undoStack, action],
      redoStack: newRedoStack,
      violations,
      isDirty: true,
    })
  },

  recompute: async () => {
    const { cells, schoolConfig, teachers, subjects, fixedEvents, constraintPolicy, teacherPolicies } = get()
    if (!schoolConfig || !constraintPolicy) return

    set({ isRecomputing: true })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const result = recomputeUnlocked({
      cells,
      schoolConfig,
      teachers,
      subjects,
      fixedEvents,
      constraintPolicy,
      teacherPolicies,
    })

    set({
      cells: result.cells,
      cellMap: buildCellMap(result.cells),
      violations: result.violations,
      undoStack: [],
      redoStack: [],
      isRecomputing: false,
      isDirty: true,
    })
  },

  saveSnapshot: async () => {
    const { snapshot, cells } = get()
    if (!snapshot) return

    const updated: TimetableSnapshot = {
      ...snapshot,
      cells,
    }

    await updateTimetableSnapshot(updated)
    set({ snapshot: updated, isDirty: false })
  },
}))
