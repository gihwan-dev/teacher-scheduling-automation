import { create } from 'zustand'

import { findReplacementCandidates } from '../lib/replacement-finder'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { FixedEvent } from '@/entities/fixed-event'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type { CellKey, TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import type {
  ReplacementCandidate,
  ReplacementSearchConfig,
  ReplacementSearchResult,
} from './types'
import { buildCellMap } from '@/features/edit-timetable-cell'
import { isCellEditable } from '@/features/edit-timetable-cell/lib/edit-validator'
import {
  loadAllSetupData,
  loadConstraintPolicy,
  loadLatestTimetableSnapshot,
  loadTeacherPolicies,
  updateTimetableSnapshot,
} from '@/shared/persistence/indexeddb/repository'

interface ReplacementState {
  // 데이터
  snapshot: TimetableSnapshot | null
  cells: Array<TimetableCell>
  cellMap: Map<CellKey, TimetableCell>

  // 참조 데이터
  schoolConfig: SchoolConfig | null
  teachers: Array<Teacher>
  subjects: Array<Subject>
  fixedEvents: Array<FixedEvent>
  constraintPolicy: ConstraintPolicy | null
  teacherPolicies: Array<TeacherPolicy>

  // 교체 탐색 상태
  targetCellKey: CellKey | null
  searchConfig: ReplacementSearchConfig
  searchResult: ReplacementSearchResult | null
  selectedCandidate: ReplacementCandidate | null

  // 뷰 컨텍스트
  viewGrade: number
  viewClassNumber: number

  // 상태 플래그
  isLoading: boolean
  isSearching: boolean

  // 액션
  loadSnapshot: () => Promise<void>
  setViewTarget: (grade: number, classNumber: number) => void
  selectTargetCell: (key: CellKey) => void
  search: () => void
  selectCandidate: (candidate: ReplacementCandidate | null) => void
  confirmReplacement: () => Promise<void>
  updateSearchConfig: (config: Partial<ReplacementSearchConfig>) => void
}

export const useReplacementStore = create<ReplacementState>((set, get) => ({
  snapshot: null,
  cells: [],
  cellMap: new Map(),
  schoolConfig: null,
  teachers: [],
  subjects: [],
  fixedEvents: [],
  constraintPolicy: null,
  teacherPolicies: [],
  targetCellKey: null,
  searchConfig: {
    scope: 'SAME_CLASS',
    includeViolating: false,
    maxCandidates: 20,
  },
  searchResult: null,
  selectedCandidate: null,
  viewGrade: 1,
  viewClassNumber: 1,
  isLoading: false,
  isSearching: false,

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

    const cells = snapshot.cells

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
      isLoading: false,
      targetCellKey: null,
      searchResult: null,
      selectedCandidate: null,
    })
  },

  setViewTarget: (grade, classNumber) => {
    set({
      viewGrade: grade,
      viewClassNumber: classNumber,
      targetCellKey: null,
      searchResult: null,
      selectedCandidate: null,
    })
  },

  selectTargetCell: (key) => {
    const { cellMap } = get()
    const cell = cellMap.get(key)

    // 빈 셀이나 편집 불가 셀은 선택 불가
    if (!cell || !isCellEditable(cell)) return

    set({
      targetCellKey: key,
      searchResult: null,
      selectedCandidate: null,
    })
  },

  search: () => {
    const { targetCellKey, cellMap, cells, searchConfig, schoolConfig, constraintPolicy, teacherPolicies, fixedEvents } = get()
    if (!targetCellKey || !schoolConfig || !constraintPolicy) return

    const sourceCell = cellMap.get(targetCellKey)
    if (!sourceCell) return

    set({ isSearching: true })

    const result = findReplacementCandidates(
      targetCellKey,
      sourceCell,
      cells,
      searchConfig,
      {
        schoolConfig,
        constraintPolicy,
        teacherPolicies,
        fixedEvents,
      },
    )

    set({
      searchResult: result,
      selectedCandidate: null,
      isSearching: false,
    })
  },

  selectCandidate: (candidate) => {
    set({ selectedCandidate: candidate })
  },

  confirmReplacement: async () => {
    const { selectedCandidate, cells, snapshot } = get()
    if (!selectedCandidate || !snapshot) return

    let newCells: Array<TimetableCell>

    if (selectedCandidate.type === 'SWAP') {
      const { sourceCell, targetCell, resultSourceCell, resultTargetCell } = selectedCandidate
      newCells = cells.map((c) => {
        if (
          c.grade === sourceCell.grade && c.classNumber === sourceCell.classNumber &&
          c.day === sourceCell.day && c.period === sourceCell.period
        ) {
          return resultSourceCell!
        }
        if (
          targetCell &&
          c.grade === targetCell.grade && c.classNumber === targetCell.classNumber &&
          c.day === targetCell.day && c.period === targetCell.period
        ) {
          return resultTargetCell
        }
        return c
      })
    } else {
      // MOVE: source 제거 + target에 추가
      const { sourceCell, resultTargetCell } = selectedCandidate
      newCells = cells
        .filter(
          (c) =>
            !(
              c.grade === sourceCell.grade &&
              c.classNumber === sourceCell.classNumber &&
              c.day === sourceCell.day &&
              c.period === sourceCell.period
            ),
        )
        .concat(resultTargetCell)
    }

    const updated: TimetableSnapshot = {
      ...snapshot,
      cells: newCells,
    }

    await updateTimetableSnapshot(updated)

    set({
      snapshot: updated,
      cells: newCells,
      cellMap: buildCellMap(newCells),
      targetCellKey: null,
      searchResult: null,
      selectedCandidate: null,
    })
  },

  updateSearchConfig: (config) => {
    set((state) => ({
      searchConfig: { ...state.searchConfig, ...config },
    }))
  },
}))
