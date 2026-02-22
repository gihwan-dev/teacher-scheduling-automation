import { create } from 'zustand'

import type { ChangeActionType, ChangeEvent } from '@/entities/change-history'
import type { CellKey, TimetableCell } from '@/entities/timetable'
import type { WeekTag } from '@/shared/lib/week-tag'
import { generateId } from '@/shared/lib/id'
import {
  loadChangeEvents,
  loadChangeEventsByWeek,
  saveChangeEvent,
  saveChangeEvents,
  updateChangeEvent,
} from '@/shared/persistence/indexeddb/repository'

interface ChangeHistoryState {
  events: Array<ChangeEvent>
  isLoading: boolean

  loadEvents: (snapshotId: string) => Promise<void>
  loadEventsByWeek: (weekTag: WeekTag) => Promise<void>
  appendEvent: (params: {
    snapshotId: string
    weekTag: WeekTag
    actionType: ChangeActionType
    cellKey: CellKey
    before: TimetableCell | null
    after: TimetableCell | null
    timestamp: number
  }) => Promise<void>
  appendVersionEvent: (params: {
    snapshotId: string
    weekTag: WeekTag
    actionType: 'VERSION_CLONE' | 'VERSION_RESTORE'
    beforePayload: unknown | null
    afterPayload: unknown | null
    impactSummary: string | null
  }) => Promise<void>
  markLastUndone: (snapshotId: string) => Promise<void>
  markLastRedone: (snapshotId: string) => Promise<void>
  appendRecomputeEvent: (snapshotId: string, weekTag: WeekTag) => Promise<void>
  confirmTempModified: (
    snapshotId: string,
    weekTag: WeekTag,
    cellKeys: Array<CellKey>,
  ) => Promise<void>
}

export const useChangeHistoryStore = create<ChangeHistoryState>((set, get) => ({
  events: [],
  isLoading: false,

  loadEvents: async (snapshotId) => {
    set({ isLoading: true })
    const events = await loadChangeEvents(snapshotId)
    set({ events, isLoading: false })
  },

  loadEventsByWeek: async (weekTag) => {
    set({ isLoading: true })
    const events = await loadChangeEventsByWeek(weekTag)
    set({ events, isLoading: false })
  },

  appendEvent: async (params) => {
    const event: ChangeEvent = {
      id: generateId(),
      snapshotId: params.snapshotId,
      weekTag: params.weekTag,
      actionType: params.actionType,
      actor: 'LOCAL_OPERATOR',
      cellKey: params.cellKey,
      before: params.before,
      after: params.after,
      beforePayload: params.before,
      afterPayload: params.after,
      impactSummary: null,
      conflictDetected: false,
      rollbackRef: null,
      timestamp: params.timestamp,
      isUndone: false,
    }
    await saveChangeEvent(event)
    set({ events: [...get().events, event] })
  },

  appendVersionEvent: async (params) => {
    const event: ChangeEvent = {
      id: generateId(),
      snapshotId: params.snapshotId,
      weekTag: params.weekTag,
      actionType: params.actionType,
      actor: 'LOCAL_OPERATOR',
      cellKey: 'VERSION',
      before: null,
      after: null,
      beforePayload: params.beforePayload,
      afterPayload: params.afterPayload,
      impactSummary: params.impactSummary,
      conflictDetected: false,
      rollbackRef: null,
      timestamp: Date.now(),
      isUndone: false,
    }
    await saveChangeEvent(event)
    set({ events: [...get().events, event] })
  },

  markLastUndone: async (snapshotId) => {
    const { events } = get()
    // snapshotId에 해당하고 isUndone이 false인 마지막 이벤트
    const target = [...events]
      .reverse()
      .find((e) => e.snapshotId === snapshotId && !e.isUndone)
    if (!target) return

    const updated = { ...target, isUndone: true }
    await updateChangeEvent(updated)
    set({
      events: events.map((e) => (e.id === target.id ? updated : e)),
    })
  },

  markLastRedone: async (snapshotId) => {
    const { events } = get()
    // snapshotId에 해당하고 isUndone이 true인 마지막 이벤트 (가장 최근에 undone된 것)
    const target = [...events]
      .reverse()
      .find((e) => e.snapshotId === snapshotId && e.isUndone)
    if (!target) return

    const updated = { ...target, isUndone: false }
    await updateChangeEvent(updated)
    set({
      events: events.map((e) => (e.id === target.id ? updated : e)),
    })
  },

  appendRecomputeEvent: async (snapshotId, weekTag) => {
    const timestamp = Date.now()
    const event: ChangeEvent = {
      id: generateId(),
      snapshotId,
      weekTag,
      actionType: 'RECOMPUTE',
      actor: 'LOCAL_OPERATOR',
      cellKey: 'VERSION',
      before: null,
      after: null,
      beforePayload: null,
      afterPayload: null,
      impactSummary: null,
      conflictDetected: false,
      rollbackRef: null,
      timestamp,
      isUndone: false,
    }
    await saveChangeEvent(event)
    set({ events: [...get().events, event] })
  },

  confirmTempModified: async (snapshotId, weekTag, cellKeys) => {
    const timestamp = Date.now()
    const newEvents: Array<ChangeEvent> = cellKeys.map((cellKey) => ({
      id: generateId(),
      snapshotId,
      weekTag,
      actionType: 'CONFIRM' as const,
      actor: 'LOCAL_OPERATOR',
      cellKey,
      before: null,
      after: null,
      beforePayload: null,
      afterPayload: null,
      impactSummary: null,
      conflictDetected: false,
      rollbackRef: null,
      timestamp,
      isUndone: false,
    }))
    await saveChangeEvents(newEvents)
    set({ events: [...get().events, ...newEvents] })
  },
}))
