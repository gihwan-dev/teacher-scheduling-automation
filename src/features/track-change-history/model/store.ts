import { create } from 'zustand'

import type { ChangeActionType, ChangeEvent } from '@/entities/change-history'
import type { CellKey, TimetableCell } from '@/entities/timetable'
import { computeWeekTag } from '@/entities/change-history'
import { generateId } from '@/shared/lib/id'
import {
  loadChangeEvents,
  saveChangeEvent,
  saveChangeEvents,
  updateChangeEvent,
} from '@/shared/persistence/indexeddb/repository'

interface ChangeHistoryState {
  events: Array<ChangeEvent>
  isLoading: boolean

  loadEvents: (snapshotId: string) => Promise<void>
  appendEvent: (params: {
    snapshotId: string
    actionType: ChangeActionType
    cellKey: CellKey
    before: TimetableCell | null
    after: TimetableCell | null
    timestamp: number
  }) => Promise<void>
  markLastUndone: (snapshotId: string) => Promise<void>
  markLastRedone: (snapshotId: string) => Promise<void>
  appendRecomputeEvent: (snapshotId: string) => Promise<void>
  confirmTempModified: (snapshotId: string, cellKeys: Array<CellKey>) => Promise<void>
}

export const useChangeHistoryStore = create<ChangeHistoryState>((set, get) => ({
  events: [],
  isLoading: false,

  loadEvents: async (snapshotId) => {
    set({ isLoading: true })
    const events = await loadChangeEvents(snapshotId)
    set({ events, isLoading: false })
  },

  appendEvent: async (params) => {
    const event: ChangeEvent = {
      id: generateId(),
      snapshotId: params.snapshotId,
      weekTag: computeWeekTag(params.timestamp),
      actionType: params.actionType,
      cellKey: params.cellKey,
      before: params.before,
      after: params.after,
      timestamp: params.timestamp,
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

  appendRecomputeEvent: async (snapshotId) => {
    const timestamp = Date.now()
    const event: ChangeEvent = {
      id: generateId(),
      snapshotId,
      weekTag: computeWeekTag(timestamp),
      actionType: 'RECOMPUTE',
      cellKey: '' as CellKey,
      before: null,
      after: null,
      timestamp,
      isUndone: false,
    }
    await saveChangeEvent(event)
    set({ events: [...get().events, event] })
  },

  confirmTempModified: async (snapshotId, cellKeys) => {
    const timestamp = Date.now()
    const weekTag = computeWeekTag(timestamp)
    const newEvents: Array<ChangeEvent> = cellKeys.map((cellKey) => ({
      id: generateId(),
      snapshotId,
      weekTag,
      actionType: 'CONFIRM' as const,
      cellKey,
      before: null,
      after: null,
      timestamp,
      isUndone: false,
    }))
    await saveChangeEvents(newEvents)
    set({ events: [...get().events, ...newEvents] })
  },
}))
