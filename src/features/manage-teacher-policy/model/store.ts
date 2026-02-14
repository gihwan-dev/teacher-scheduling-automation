import { create } from 'zustand'

import type { SchoolConfig } from '@/entities/school'
import type { Teacher } from '@/entities/teacher'
import type { AvoidanceSlot, PolicyValidationMessage, TeacherPolicy, TimePreference } from '@/entities/teacher-policy'
import { validateAllPolicies } from '@/entities/teacher-policy'
import { generateId } from '@/shared/lib/id'
import {
  loadAllSetupData,
  loadTeacherPolicies,
  saveTeacherPolicies,
} from '@/shared/persistence/indexeddb/repository'

function now(): string {
  return new Date().toISOString()
}

interface TeacherPolicyState {
  policies: Array<TeacherPolicy>
  teachers: Array<Teacher>
  schoolConfig: SchoolConfig | null
  selectedTeacherId: string | null
  isDirty: boolean
  isLoading: boolean
  validationMessages: Array<PolicyValidationMessage>
  isSaveBlocked: boolean

  // Actions
  toggleAvoidanceSlot: (teacherId: string, slot: AvoidanceSlot) => void
  setTimePreference: (teacherId: string, pref: TimePreference) => void
  setMaxConsecutiveOverride: (teacherId: string, value: number | null) => void
  setMaxDailyOverride: (teacherId: string, value: number | null) => void
  resetPolicy: (teacherId: string) => void
  selectTeacher: (teacherId: string) => void
  loadFromDB: () => Promise<void>
  saveToDB: () => Promise<boolean>
  runValidation: () => void
}

function getOrCreatePolicy(
  policies: Array<TeacherPolicy>,
  teacherId: string,
): TeacherPolicy {
  const existing = policies.find((p) => p.teacherId === teacherId)
  if (existing) return existing

  const timestamp = now()
  return {
    id: generateId(),
    teacherId,
    avoidanceSlots: [],
    timePreference: 'NONE',
    maxConsecutiveHoursOverride: null,
    maxDailyHoursOverride: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function upsertPolicy(
  policies: Array<TeacherPolicy>,
  updated: TeacherPolicy,
): Array<TeacherPolicy> {
  const exists = policies.some((p) => p.teacherId === updated.teacherId)
  if (exists) {
    return policies.map((p) =>
      p.teacherId === updated.teacherId ? { ...updated, updatedAt: now() } : p,
    )
  }
  return [...policies, updated]
}

export const useTeacherPolicyStore = create<TeacherPolicyState>((set, get) => ({
  policies: [],
  teachers: [],
  schoolConfig: null,
  selectedTeacherId: null,
  isDirty: false,
  isLoading: false,
  validationMessages: [],
  isSaveBlocked: false,

  selectTeacher: (teacherId) => set({ selectedTeacherId: teacherId }),

  toggleAvoidanceSlot: (teacherId, slot) => {
    const { policies } = get()
    const policy = getOrCreatePolicy(policies, teacherId)
    const exists = policy.avoidanceSlots.some(
      (s) => s.day === slot.day && s.period === slot.period,
    )
    const newSlots = exists
      ? policy.avoidanceSlots.filter(
          (s) => !(s.day === slot.day && s.period === slot.period),
        )
      : [...policy.avoidanceSlots, slot]

    const updated = { ...policy, avoidanceSlots: newSlots }
    set({ policies: upsertPolicy(policies, updated), isDirty: true })
  },

  setTimePreference: (teacherId, pref) => {
    const { policies } = get()
    const policy = getOrCreatePolicy(policies, teacherId)
    const updated = { ...policy, timePreference: pref }
    set({ policies: upsertPolicy(policies, updated), isDirty: true })
  },

  setMaxConsecutiveOverride: (teacherId, value) => {
    const { policies } = get()
    const policy = getOrCreatePolicy(policies, teacherId)
    const updated = { ...policy, maxConsecutiveHoursOverride: value }
    set({ policies: upsertPolicy(policies, updated), isDirty: true })
  },

  setMaxDailyOverride: (teacherId, value) => {
    const { policies } = get()
    const policy = getOrCreatePolicy(policies, teacherId)
    const updated = { ...policy, maxDailyHoursOverride: value }
    set({ policies: upsertPolicy(policies, updated), isDirty: true })
  },

  resetPolicy: (teacherId) => {
    const { policies } = get()
    set({
      policies: policies.filter((p) => p.teacherId !== teacherId),
      isDirty: true,
    })
  },

  loadFromDB: async () => {
    set({ isLoading: true })
    const [setupData, policies] = await Promise.all([
      loadAllSetupData(),
      loadTeacherPolicies(),
    ])
    const teachers = setupData.teachers
    const selectedTeacherId = teachers.length > 0 ? teachers[0].id : null
    set({
      schoolConfig: setupData.schoolConfig ?? null,
      teachers,
      policies,
      selectedTeacherId,
      isDirty: false,
      isLoading: false,
      validationMessages: [],
      isSaveBlocked: false,
    })
  },

  saveToDB: async () => {
    const { policies, teachers, schoolConfig } = get()
    if (!schoolConfig) return false

    const { valid, messages } = validateAllPolicies(policies, teachers, schoolConfig)
    set({ validationMessages: messages, isSaveBlocked: !valid })

    if (!valid) return false

    await saveTeacherPolicies(policies)
    set({ isDirty: false })
    return true
  },

  runValidation: () => {
    const { policies, teachers, schoolConfig } = get()
    if (!schoolConfig) return

    const { valid, messages } = validateAllPolicies(policies, teachers, schoolConfig)
    set({ validationMessages: messages, isSaveBlocked: !valid })
  },
}))
