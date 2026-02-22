import { create } from 'zustand'

import {
  applyMultiCandidateToWeekCells,
  applySingleCandidateToWeekCells,
  buildScopedMultiAlternatives,
  buildScopedSingleAlternatives,
  filterAcademicCalendarEventsForWeek,
  resolveReplacementScopeTargetWeeks,
  validateWeekCandidateResult,
} from '../lib/apply-replacement-scope'
import { findReplacementCandidates } from '../lib/replacement-finder'
import { findMultiReplacementCandidates } from '../lib/multi-replacement-finder'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { FixedEvent } from '@/entities/fixed-event'
import type { ImpactAnalysisReport } from '@/entities/impact-analysis'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TeacherPolicy } from '@/entities/teacher-policy'
import type {
  CellKey,
  TimetableCell,
  TimetableSnapshot,
} from '@/entities/timetable'
import type {
  MultiReplacementCandidate,
  MultiReplacementSearchResult,
  ReplacementApplyScopeState,
  ReplacementCandidate,
  ReplacementSearchConfig,
  ReplacementSearchResult,
  ScopeValidationIssue,
  ScopeValidationSummary,
  ScopedAlternativeCandidate,
} from './types'
import type { WeekTag } from '@/shared/lib/week-tag'
import { buildCellMap } from '@/features/edit-timetable-cell'
import { isCellEditable } from '@/features/edit-timetable-cell/lib/edit-validator'
import {
  analyzeMultiReplacementImpact,
  analyzeReplacementImpact,
} from '@/features/analyze-schedule-impact'
import {
  loadAcademicCalendarEvents,
  loadAllSetupData,
  loadConstraintPolicy,
  loadLatestSnapshotByWeek,
  loadSnapshotBySelection,
  loadSnapshotWeeks,
  loadSnapshotsByWeek,
  loadTeacherPolicies,
  saveImpactAnalysisReport,
  saveNextSnapshotVersion,
} from '@/shared/persistence/indexeddb/repository'
import { compareWeekTag, shiftWeekTag } from '@/shared/lib/week-tag'

interface PreparedScopeSave {
  weekTag: WeekTag
  sourceSnapshot: TimetableSnapshot
  nextCells: Array<TimetableCell>
}

interface ReplacementState {
  // 데이터
  snapshot: TimetableSnapshot | null
  cells: Array<TimetableCell>
  cellMap: Map<CellKey, TimetableCell>
  availableWeekTags: Array<WeekTag>
  availableVersionNos: Array<number>

  // 참조 데이터
  schoolConfig: SchoolConfig | null
  teachers: Array<Teacher>
  subjects: Array<Subject>
  fixedEvents: Array<FixedEvent>
  constraintPolicy: ConstraintPolicy | null
  teacherPolicies: Array<TeacherPolicy>
  academicCalendarEvents: Array<AcademicCalendarEvent>

  // 단일 교체 탐색 상태
  targetCellKey: CellKey | null
  searchConfig: ReplacementSearchConfig
  searchResult: ReplacementSearchResult | null
  selectedCandidate: ReplacementCandidate | null
  impactReport: ImpactAnalysisReport | null

  // 다중 교체 상태
  isMultiMode: boolean
  multiTargetCellKeys: Array<CellKey>
  multiSearchResult: MultiReplacementSearchResult | null
  selectedMultiCandidate: MultiReplacementCandidate | null
  multiImpactReport: ImpactAnalysisReport | null

  // 범위 적용 상태
  applyScope: ReplacementApplyScopeState
  scopeValidationSummary: ScopeValidationSummary

  // 뷰 컨텍스트
  viewGrade: number
  viewClassNumber: number

  // 상태 플래그
  isLoading: boolean
  isSearching: boolean
  impactReportLoading: boolean
  isApplyingScope: boolean

  // 액션
  loadSnapshot: (selection?: {
    weekTag?: WeekTag
    versionNo?: number
  }) => Promise<void>
  setViewTarget: (grade: number, classNumber: number) => void
  selectTargetCell: (key: CellKey) => void
  search: () => void
  selectCandidate: (candidate: ReplacementCandidate | null) => void
  confirmReplacement: () => Promise<boolean>
  updateSearchConfig: (config: Partial<ReplacementSearchConfig>) => void

  // 범위 적용 액션
  setApplyScopeType: (type: ReplacementApplyScopeState['type']) => void
  setApplyScopeRange: (range: {
    fromWeek?: WeekTag | null
    toWeek?: WeekTag | null
  }) => void
  clearScopeValidationSummary: () => void

  // 다중 모드 액션
  toggleMultiMode: () => void
  addMultiTarget: (key: CellKey) => void
  removeMultiTarget: (key: CellKey) => void
  searchMulti: () => void
  selectMultiCandidate: (candidate: MultiReplacementCandidate | null) => void
  confirmMultiReplacement: () => Promise<boolean>
}

function createIdleScopeValidationSummary(): ScopeValidationSummary {
  return {
    status: 'IDLE',
    targetWeeks: [],
    issues: [],
  }
}

export const useReplacementStore = create<ReplacementState>((set, get) => {
  const clearScopeSummaryState = () => ({
    scopeValidationSummary: createIdleScopeValidationSummary(),
  })

  const buildBlockedSummary = (
    targetWeeks: Array<WeekTag>,
    issues: Array<ScopeValidationIssue>,
  ): ScopeValidationSummary => ({
    status: 'BLOCKED',
    targetWeeks,
    issues: [...issues].sort((a, b) => compareWeekTag(a.weekTag, b.weekTag)),
  })

  const buildAppliedSummary = (
    targetWeeks: Array<WeekTag>,
  ): ScopeValidationSummary => ({
    status: 'APPLIED',
    targetWeeks,
    issues: [],
  })

  const resolveScopeWeeks = () => {
    const { snapshot, applyScope, academicCalendarEvents } = get()
    if (!snapshot) {
      return {
        targetWeeks: [] as Array<WeekTag>,
        appliedScope: null,
        issues: [
          {
            weekTag: '1970-W01' as WeekTag,
            reason: 'MISSING_WEEK_SNAPSHOT' as const,
            message: '선택된 스냅샷이 없어 범위 계산을 수행할 수 없습니다.',
            violations: [],
            alternatives: [],
          },
        ],
      }
    }

    const resolved = resolveReplacementScopeTargetWeeks({
      selectedWeek: snapshot.weekTag,
      scopeState: applyScope,
      academicCalendarEvents,
    })

    if (resolved.issue) {
      return {
        targetWeeks: resolved.targetWeeks,
        appliedScope: resolved.appliedScope,
        issues: [
          {
            weekTag: snapshot.weekTag,
            reason: resolved.issue.reason,
            message: resolved.issue.message,
            violations: [],
            alternatives: [],
          },
        ],
      }
    }

    return {
      targetWeeks: resolved.targetWeeks,
      appliedScope: resolved.appliedScope,
      issues: [] as Array<ScopeValidationIssue>,
    }
  }

  const validateAndPrepareScopedChanges = async (input: {
    targetWeeks: Array<WeekTag>
    buildAlternatives: (params: {
      snapshot: TimetableSnapshot
      cells: Array<TimetableCell>
    }) => Array<ScopedAlternativeCandidate>
    applyToCells: (cells: Array<TimetableCell>) => {
      ok: boolean
      cells: Array<TimetableCell>
      issue?: {
        reason: ScopeValidationIssue['reason']
        message: string
      }
    }
  }): Promise<{
    prepared: Array<PreparedScopeSave>
    issues: Array<ScopeValidationIssue>
  }> => {
    const {
      snapshot,
      schoolConfig,
      constraintPolicy,
      teachers,
      subjects,
      academicCalendarEvents,
    } = get()

    if (!snapshot || !schoolConfig || !constraintPolicy) {
      return {
        prepared: [],
        issues: [
          {
            weekTag: snapshot?.weekTag ?? ('1970-W01' as WeekTag),
            reason: 'MISSING_WEEK_SNAPSHOT',
            message: '기본 컨텍스트가 없어 범위 검증을 수행할 수 없습니다.',
            violations: [],
            alternatives: [],
          },
        ],
      }
    }

    const prepared: Array<PreparedScopeSave> = []
    const issues: Array<ScopeValidationIssue> = []

    for (const weekTag of input.targetWeeks) {
      const sourceSnapshot =
        weekTag === snapshot.weekTag
          ? snapshot
          : await loadLatestSnapshotByWeek(weekTag)

      if (!sourceSnapshot) {
        issues.push({
          weekTag,
          reason: 'MISSING_WEEK_SNAPSHOT',
          message: `${weekTag} 주차 스냅샷이 없어 범위 적용을 진행할 수 없습니다.`,
          violations: [],
          alternatives: [],
        })
        continue
      }

      const applied = input.applyToCells(sourceSnapshot.cells)
      if (!applied.ok) {
        issues.push({
          weekTag,
          reason: applied.issue?.reason ?? 'VALIDATION_FAILED',
          message:
            applied.issue?.message ??
            `${weekTag} 주차에서 교체 전제조건을 만족하지 못했습니다.`,
          violations: [],
          alternatives: input.buildAlternatives({
            snapshot: sourceSnapshot,
            cells: sourceSnapshot.cells,
          }),
        })
        continue
      }

      const weekEvents = filterAcademicCalendarEventsForWeek({
        events: academicCalendarEvents,
        weekTag,
        activeDays: schoolConfig.activeDays,
      })

      const violations = validateWeekCandidateResult({
        cells: applied.cells,
        snapshot: sourceSnapshot,
        schoolConfig,
        constraintPolicy,
        teachers,
        subjects,
        academicCalendarEvents: weekEvents,
      })
      const errorViolations = violations.filter(
        (violation) => violation.severity === 'error',
      )

      if (errorViolations.length > 0) {
        issues.push({
          weekTag,
          reason: 'VALIDATION_FAILED',
          message: `${weekTag} 주차에서 ${errorViolations.length}건의 충돌이 감지되었습니다.`,
          violations: errorViolations,
          alternatives: input.buildAlternatives({
            snapshot: sourceSnapshot,
            cells: sourceSnapshot.cells,
          }),
        })
        continue
      }

      prepared.push({
        weekTag,
        sourceSnapshot,
        nextCells: applied.cells,
      })
    }

    return { prepared, issues }
  }

  const commitScopedChanges = async (input: {
    targetWeeks: Array<WeekTag>
    prepared: Array<PreparedScopeSave>
    appliedScope: NonNullable<
      ReturnType<typeof resolveReplacementScopeTargetWeeks>['appliedScope']
    >
  }): Promise<boolean> => {
    const { snapshot, cells } = get()
    if (!snapshot) {
      return false
    }

    const sortedPrepared = [...input.prepared].sort((a, b) =>
      compareWeekTag(a.weekTag, b.weekTag),
    )

    const savedSnapshots: Array<TimetableSnapshot> = []
    for (const item of sortedPrepared) {
      const saved = await saveNextSnapshotVersion({
        sourceSnapshot: item.sourceSnapshot,
        cells: item.nextCells,
        overrideWeekTag: item.weekTag,
        appliedScopeOverride: input.appliedScope,
      })
      savedSnapshots.push(saved)
    }

    const [weekTags, selectedWeekSnapshots] = await Promise.all([
      loadSnapshotWeeks(),
      loadSnapshotsByWeek(snapshot.weekTag),
    ])

    const nextCurrentSnapshot =
      savedSnapshots.find((saved) => saved.weekTag === snapshot.weekTag) ?? snapshot
    const nextCurrentCells =
      nextCurrentSnapshot.weekTag === snapshot.weekTag ? nextCurrentSnapshot.cells : cells

    set({
      snapshot: nextCurrentSnapshot,
      cells: nextCurrentCells,
      cellMap: buildCellMap(nextCurrentCells),
      availableWeekTags: weekTags,
      availableVersionNos: selectedWeekSnapshots.map((item) => item.versionNo),
      targetCellKey: null,
      searchResult: null,
      selectedCandidate: null,
      impactReport: null,
      multiTargetCellKeys: [],
      multiSearchResult: null,
      selectedMultiCandidate: null,
      multiImpactReport: null,
      impactReportLoading: false,
      scopeValidationSummary: buildAppliedSummary(input.targetWeeks),
      isApplyingScope: false,
    })

    return true
  }

  return {
    snapshot: null,
    cells: [],
    cellMap: new Map(),
    availableWeekTags: [],
    availableVersionNos: [],
    schoolConfig: null,
    teachers: [],
    subjects: [],
    fixedEvents: [],
    constraintPolicy: null,
    teacherPolicies: [],
    academicCalendarEvents: [],
    targetCellKey: null,
    searchConfig: {
      scope: 'SAME_CLASS',
      includeViolating: false,
      maxCandidates: 20,
    },
    searchResult: null,
    selectedCandidate: null,
    impactReport: null,
    isMultiMode: false,
    multiTargetCellKeys: [],
    multiSearchResult: null,
    selectedMultiCandidate: null,
    multiImpactReport: null,
    applyScope: {
      type: 'THIS_WEEK',
      fromWeek: null,
      toWeek: null,
    },
    scopeValidationSummary: createIdleScopeValidationSummary(),
    viewGrade: 1,
    viewClassNumber: 1,
    isLoading: false,
    isSearching: false,
    impactReportLoading: false,
    isApplyingScope: false,

    loadSnapshot: async (selection = {}) => {
      set({ isLoading: true })
      const [setupData, snapshot, savedPolicy, teacherPolicies, weekTags, allEvents] =
        await Promise.all([
          loadAllSetupData(),
          loadSnapshotBySelection(selection),
          loadConstraintPolicy(),
          loadTeacherPolicies(),
          loadSnapshotWeeks(),
          loadAcademicCalendarEvents(),
        ])

      if (!snapshot) {
        set({
          isLoading: false,
          schoolConfig: setupData.schoolConfig ?? null,
          availableWeekTags: weekTags,
          availableVersionNos: [],
          academicCalendarEvents: allEvents,
          applyScope: {
            type: 'THIS_WEEK',
            fromWeek: null,
            toWeek: null,
          },
          ...clearScopeSummaryState(),
        })
        return
      }

      const cells = snapshot.cells
      const versionSnapshots = await loadSnapshotsByWeek(snapshot.weekTag)
      const availableVersionNos = versionSnapshots.map((item) => item.versionNo)

      set({
        snapshot,
        cells,
        cellMap: buildCellMap(cells),
        availableWeekTags: weekTags,
        availableVersionNos,
        schoolConfig: setupData.schoolConfig ?? null,
        teachers: setupData.teachers,
        subjects: setupData.subjects,
        fixedEvents: setupData.fixedEvents,
        constraintPolicy: savedPolicy ?? null,
        teacherPolicies,
        academicCalendarEvents: allEvents,
        isLoading: false,
        targetCellKey: null,
        searchResult: null,
        selectedCandidate: null,
        impactReport: null,
        multiTargetCellKeys: [],
        multiSearchResult: null,
        selectedMultiCandidate: null,
        multiImpactReport: null,
        impactReportLoading: false,
        applyScope: {
          type: 'THIS_WEEK',
          fromWeek: snapshot.weekTag,
          toWeek: snapshot.weekTag,
        },
        ...clearScopeSummaryState(),
      })
    },

    setViewTarget: (grade, classNumber) => {
      set({
        viewGrade: grade,
        viewClassNumber: classNumber,
        targetCellKey: null,
        searchResult: null,
        selectedCandidate: null,
        impactReport: null,
        multiTargetCellKeys: [],
        multiSearchResult: null,
        selectedMultiCandidate: null,
        multiImpactReport: null,
        impactReportLoading: false,
        ...clearScopeSummaryState(),
      })
    },

    setApplyScopeType: (type) => {
      const { snapshot } = get()
      const baseWeek = snapshot?.weekTag ?? null

      if (type === 'THIS_WEEK') {
        set({
          applyScope: {
            type,
            fromWeek: baseWeek,
            toWeek: baseWeek,
          },
          ...clearScopeSummaryState(),
        })
        return
      }

      if (type === 'FROM_NEXT_WEEK') {
        set({
          applyScope: {
            type,
            fromWeek: baseWeek ? shiftWeekTag(baseWeek, 1) : null,
            toWeek: null,
          },
          ...clearScopeSummaryState(),
        })
        return
      }

      set({
        applyScope: {
          type,
          fromWeek: baseWeek,
          toWeek: baseWeek,
        },
        ...clearScopeSummaryState(),
      })
    },

    setApplyScopeRange: (range) => {
      set((state) => ({
        applyScope: {
          ...state.applyScope,
          fromWeek:
            range.fromWeek !== undefined ? range.fromWeek : state.applyScope.fromWeek,
          toWeek: range.toWeek !== undefined ? range.toWeek : state.applyScope.toWeek,
        },
        ...clearScopeSummaryState(),
      }))
    },

    clearScopeValidationSummary: () => {
      set(clearScopeSummaryState())
    },

    selectTargetCell: (key) => {
      const { cellMap } = get()
      const cell = cellMap.get(key)

      if (!cell || !isCellEditable(cell)) return

      set({
        targetCellKey: key,
        searchResult: null,
        selectedCandidate: null,
        impactReport: null,
        impactReportLoading: false,
        ...clearScopeSummaryState(),
      })
    },

    search: () => {
      const {
        targetCellKey,
        cellMap,
        cells,
        searchConfig,
        schoolConfig,
        constraintPolicy,
        teacherPolicies,
        fixedEvents,
        teachers,
        subjects,
        snapshot,
        academicCalendarEvents,
      } = get()

      if (!targetCellKey || !schoolConfig || !constraintPolicy) return

      const sourceCell = cellMap.get(targetCellKey)
      if (!sourceCell || !snapshot) return

      set({ isSearching: true })

      const weekEvents = filterAcademicCalendarEventsForWeek({
        events: academicCalendarEvents,
        weekTag: snapshot.weekTag,
        activeDays: schoolConfig.activeDays,
      })

      const result = findReplacementCandidates(targetCellKey, sourceCell, cells, searchConfig, {
        schoolConfig,
        constraintPolicy,
        teacherPolicies,
        fixedEvents,
        teachers,
        subjects,
        weekTag: snapshot.weekTag,
        academicCalendarEvents: weekEvents,
      })

      set({
        searchResult: result,
        selectedCandidate: null,
        impactReport: null,
        impactReportLoading: false,
        isSearching: false,
        ...clearScopeSummaryState(),
      })
    },

    selectCandidate: (candidate) => {
      set({
        selectedCandidate: candidate,
        impactReport: null,
        impactReportLoading: candidate !== null,
        ...clearScopeSummaryState(),
      })
      if (!candidate) {
        return
      }

      const { snapshot, cells, searchResult, teachers } = get()
      if (!snapshot) {
        set({ impactReportLoading: false })
        return
      }

      const selectedCandidateId = candidate.id
      const allCandidates = searchResult?.candidates ?? [candidate]

      void (async () => {
        try {
          const report = analyzeReplacementImpact({
            snapshot,
            beforeCells: cells,
            selectedCandidate: candidate,
            allCandidates,
            teachers,
          })
          await saveImpactAnalysisReport(report)

          if (get().selectedCandidate?.id !== selectedCandidateId) {
            return
          }
          set({
            impactReport: report,
            impactReportLoading: false,
          })
        } catch {
          if (get().selectedCandidate?.id !== selectedCandidateId) {
            return
          }
          set({
            impactReport: null,
            impactReportLoading: false,
          })
        }
      })()
    },

    confirmReplacement: async () => {
      const {
        selectedCandidate,
        snapshot,
        impactReport,
        schoolConfig,
        constraintPolicy,
        teacherPolicies,
        fixedEvents,
        teachers,
        subjects,
        searchConfig,
      } = get()

      if (
        !selectedCandidate ||
        !snapshot ||
        !impactReport ||
        !schoolConfig ||
        !constraintPolicy
      ) {
        return false
      }

      set({ isApplyingScope: true })

      const { targetWeeks, appliedScope, issues: scopeIssues } = resolveScopeWeeks()
      if (scopeIssues.length > 0 || !appliedScope) {
        set({
          scopeValidationSummary: buildBlockedSummary(targetWeeks, scopeIssues),
          isApplyingScope: false,
        })
        return false
      }

      const alternativesContext = {
        schoolConfig,
        constraintPolicy,
        teacherPolicies,
        fixedEvents,
        teachers,
        subjects,
        searchConfig,
        academicCalendarEvents: get().academicCalendarEvents,
      }

      const validated = await validateAndPrepareScopedChanges({
        targetWeeks,
        applyToCells: (cells) =>
          applySingleCandidateToWeekCells({
            cells,
            selectedCandidate,
          }),
        buildAlternatives: ({ snapshot: weekSnapshot, cells }) =>
          buildScopedSingleAlternatives({
            snapshot: weekSnapshot,
            cells,
            selectedCandidate,
            context: alternativesContext,
          }),
      })

      if (validated.issues.length > 0) {
        set({
          scopeValidationSummary: buildBlockedSummary(targetWeeks, validated.issues),
          isApplyingScope: false,
        })
        return false
      }

      return commitScopedChanges({
        targetWeeks,
        prepared: validated.prepared,
        appliedScope,
      })
    },

    updateSearchConfig: (config) => {
      set((state) => ({
        searchConfig: { ...state.searchConfig, ...config },
        ...clearScopeSummaryState(),
      }))
    },

    toggleMultiMode: () => {
      const { isMultiMode } = get()
      set({
        isMultiMode: !isMultiMode,
        targetCellKey: null,
        searchResult: null,
        selectedCandidate: null,
        impactReport: null,
        multiTargetCellKeys: [],
        multiSearchResult: null,
        selectedMultiCandidate: null,
        multiImpactReport: null,
        impactReportLoading: false,
        ...clearScopeSummaryState(),
      })
    },

    addMultiTarget: (key) => {
      const { cellMap, multiTargetCellKeys } = get()
      const cell = cellMap.get(key)
      if (!cell || !isCellEditable(cell)) return
      if (multiTargetCellKeys.includes(key)) return
      if (multiTargetCellKeys.length >= 3) return

      set({
        multiTargetCellKeys: [...multiTargetCellKeys, key],
        multiSearchResult: null,
        selectedMultiCandidate: null,
        multiImpactReport: null,
        impactReportLoading: false,
        ...clearScopeSummaryState(),
      })
    },

    removeMultiTarget: (key) => {
      const { multiTargetCellKeys } = get()
      set({
        multiTargetCellKeys: multiTargetCellKeys.filter((item) => item !== key),
        multiSearchResult: null,
        selectedMultiCandidate: null,
        multiImpactReport: null,
        impactReportLoading: false,
        ...clearScopeSummaryState(),
      })
    },

    searchMulti: () => {
      const {
        multiTargetCellKeys,
        cells,
        searchConfig,
        schoolConfig,
        constraintPolicy,
        teacherPolicies,
        fixedEvents,
        teachers,
        subjects,
        snapshot,
        academicCalendarEvents,
      } = get()

      if (multiTargetCellKeys.length < 2 || !schoolConfig || !constraintPolicy) return
      if (!snapshot) return

      set({ isSearching: true })

      const weekEvents = filterAcademicCalendarEventsForWeek({
        events: academicCalendarEvents,
        weekTag: snapshot.weekTag,
        activeDays: schoolConfig.activeDays,
      })

      const result = findMultiReplacementCandidates(multiTargetCellKeys, cells, searchConfig, {
        schoolConfig,
        constraintPolicy,
        teacherPolicies,
        fixedEvents,
        teachers,
        subjects,
        weekTag: snapshot.weekTag,
        academicCalendarEvents: weekEvents,
      })

      set({
        multiSearchResult: result,
        selectedMultiCandidate: null,
        multiImpactReport: null,
        impactReportLoading: false,
        isSearching: false,
        ...clearScopeSummaryState(),
      })
    },

    selectMultiCandidate: (candidate) => {
      set({
        selectedMultiCandidate: candidate,
        multiImpactReport: null,
        impactReportLoading: candidate !== null,
        ...clearScopeSummaryState(),
      })
      if (!candidate) {
        return
      }

      const { snapshot, cells, multiSearchResult, teachers } = get()
      if (!snapshot) {
        set({ impactReportLoading: false })
        return
      }

      const selectedCandidateId = candidate.id
      const allCandidates = multiSearchResult?.candidates ?? [candidate]

      void (async () => {
        try {
          const report = analyzeMultiReplacementImpact({
            snapshot,
            beforeCells: cells,
            selectedCandidate: candidate,
            allCandidates,
            teachers,
          })
          await saveImpactAnalysisReport(report)

          if (get().selectedMultiCandidate?.id !== selectedCandidateId) {
            return
          }

          set({
            multiImpactReport: report,
            impactReportLoading: false,
          })
        } catch {
          if (get().selectedMultiCandidate?.id !== selectedCandidateId) {
            return
          }

          set({
            multiImpactReport: null,
            impactReportLoading: false,
          })
        }
      })()
    },

    confirmMultiReplacement: async () => {
      const {
        selectedMultiCandidate,
        snapshot,
        multiImpactReport,
        schoolConfig,
        constraintPolicy,
        teacherPolicies,
        fixedEvents,
        teachers,
        subjects,
        searchConfig,
      } = get()

      if (
        !selectedMultiCandidate ||
        !snapshot ||
        !multiImpactReport ||
        !schoolConfig ||
        !constraintPolicy
      ) {
        return false
      }

      set({ isApplyingScope: true })

      const { targetWeeks, appliedScope, issues: scopeIssues } = resolveScopeWeeks()
      if (scopeIssues.length > 0 || !appliedScope) {
        set({
          scopeValidationSummary: buildBlockedSummary(targetWeeks, scopeIssues),
          isApplyingScope: false,
        })
        return false
      }

      const alternativesContext = {
        schoolConfig,
        constraintPolicy,
        teacherPolicies,
        fixedEvents,
        teachers,
        subjects,
        searchConfig,
        academicCalendarEvents: get().academicCalendarEvents,
      }

      const validated = await validateAndPrepareScopedChanges({
        targetWeeks,
        applyToCells: (cells) =>
          applyMultiCandidateToWeekCells({
            cells,
            selectedCandidate: selectedMultiCandidate,
          }),
        buildAlternatives: ({ snapshot: weekSnapshot, cells }) =>
          buildScopedMultiAlternatives({
            snapshot: weekSnapshot,
            cells,
            selectedCandidate: selectedMultiCandidate,
            context: alternativesContext,
          }),
      })

      if (validated.issues.length > 0) {
        set({
          scopeValidationSummary: buildBlockedSummary(targetWeeks, validated.issues),
          isApplyingScope: false,
        })
        return false
      }

      return commitScopedChanges({
        targetWeeks,
        prepared: validated.prepared,
        appliedScope,
      })
    },
  }
})
