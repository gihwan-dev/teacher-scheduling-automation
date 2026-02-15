import { create } from 'zustand'

import { generateTimetable } from '../lib/solver'
import type { ConstraintPolicy } from '@/entities/constraint-policy'
import type { TeacherPolicy } from '@/entities/teacher-policy'

import type { FixedEvent } from '@/entities/fixed-event'
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'

import type { GenerationResult } from './types'
import {
  loadAllSetupData,
  loadConstraintPolicy,
  loadTeacherPolicies,
  saveConstraintPolicy,
  saveTimetableSnapshot,
} from '@/shared/persistence/indexeddb/repository'
import { generateId } from '@/shared/lib/id'

function now(): string {
  return new Date().toISOString()
}

function createDefaultPolicy(): ConstraintPolicy {
  const timestamp = now()
  return {
    id: generateId(),
    studentMaxConsecutiveSameSubject: 2,
    teacherMaxConsecutiveHours: 4,
    teacherMaxDailyHours: 6,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

interface GenerateState {
  // Setup data
  schoolConfig: SchoolConfig | null
  teachers: Array<Teacher>
  subjects: Array<Subject>
  fixedEvents: Array<FixedEvent>

  // Generate state
  constraintPolicy: ConstraintPolicy
  teacherPolicies: Array<TeacherPolicy>
  result: GenerationResult | null
  isGenerating: boolean
  isLoading: boolean
  setupLoaded: boolean

  // Actions
  setConstraintPolicy: (policy: Partial<ConstraintPolicy>) => void
  generate: () => Promise<void>
  saveResult: () => Promise<void>
  loadSetupData: () => Promise<void>
}

export const useGenerateStore = create<GenerateState>((set, get) => ({
  schoolConfig: null,
  teachers: [],
  subjects: [],
  fixedEvents: [],
  constraintPolicy: createDefaultPolicy(),
  teacherPolicies: [],
  result: null,
  isGenerating: false,
  isLoading: false,
  setupLoaded: false,

  setConstraintPolicy: (updates) =>
    set((s) => ({
      constraintPolicy: { ...s.constraintPolicy, ...updates, updatedAt: now() },
    })),

  loadSetupData: async () => {
    set({ isLoading: true })
    const [setupData, savedPolicy, teacherPolicies] = await Promise.all([
      loadAllSetupData(),
      loadConstraintPolicy(),
      loadTeacherPolicies(),
    ])
    set({
      schoolConfig: setupData.schoolConfig ?? null,
      teachers: setupData.teachers,
      subjects: setupData.subjects,
      fixedEvents: setupData.fixedEvents,
      constraintPolicy: savedPolicy ?? createDefaultPolicy(),
      teacherPolicies,
      isLoading: false,
      setupLoaded: true,
    })
  },

  generate: async () => {
    const {
      schoolConfig,
      teachers,
      subjects,
      fixedEvents,
      constraintPolicy,
      teacherPolicies,
    } = get()
    if (!schoolConfig) return

    set({ isGenerating: true, result: null })

    // 비동기적으로 실행하여 UI 블로킹 방지
    await new Promise((resolve) => setTimeout(resolve, 0))

    const result = generateTimetable({
      schoolConfig,
      teachers,
      subjects,
      fixedEvents,
      constraintPolicy,
      teacherPolicies,
    })

    set({ result, isGenerating: false })
  },

  saveResult: async () => {
    const { result, constraintPolicy } = get()
    if (!result?.snapshot) return

    await Promise.all([
      saveTimetableSnapshot(result.snapshot),
      saveConstraintPolicy(constraintPolicy),
    ])
  },
}))
