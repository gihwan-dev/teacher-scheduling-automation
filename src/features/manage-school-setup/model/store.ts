import { create } from 'zustand'
import {  runFullValidation } from './validation'
import type {ValidationMessage} from './validation';
import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'
import {
  loadAllSetupData,
  saveAllSetupData,
} from '@/shared/persistence/indexeddb/repository'
import { generateId } from '@/shared/lib/id'

export type SetupTab = 'school' | 'subjects' | 'teachers' | 'fixedEvents'

interface SetupState {
  schoolConfig: SchoolConfig | null
  subjects: Array<Subject>
  teachers: Array<Teacher>
  fixedEvents: Array<FixedEvent>
  activeTab: SetupTab
  isDirty: boolean
  validationMessages: Array<ValidationMessage>
  isLoading: boolean

  // Tab
  setActiveTab: (tab: SetupTab) => void

  // SchoolConfig
  setSchoolConfig: (config: SchoolConfig) => void

  // Subjects
  addSubject: (subject: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateSubject: (id: string, updates: Partial<Subject>) => void
  removeSubject: (id: string) => void

  // Teachers
  addTeacher: (teacher: Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTeacher: (id: string, updates: Partial<Teacher>) => void
  removeTeacher: (id: string) => void

  // FixedEvents
  addFixedEvent: (event: Omit<FixedEvent, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateFixedEvent: (id: string, updates: Partial<FixedEvent>) => void
  removeFixedEvent: (id: string) => void

  // Persistence
  loadFromDB: () => Promise<void>
  saveToDB: () => Promise<void>

  // Validation
  runValidation: () => void
}

function now(): string {
  return new Date().toISOString()
}

export const useSetupStore = create<SetupState>((set, get) => ({
  schoolConfig: null,
  subjects: [],
  teachers: [],
  fixedEvents: [],
  activeTab: 'school',
  isDirty: false,
  validationMessages: [],
  isLoading: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  // SchoolConfig
  setSchoolConfig: (config) =>
    set({ schoolConfig: { ...config, updatedAt: now() }, isDirty: true }),

  // Subjects
  addSubject: (data) => {
    const timestamp = now()
    const subject: Subject = {
      ...data,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    set((s) => ({ subjects: [...s.subjects, subject], isDirty: true }))
  },

  updateSubject: (id, updates) =>
    set((s) => ({
      subjects: s.subjects.map((sub) =>
        sub.id === id ? { ...sub, ...updates, updatedAt: now() } : sub,
      ),
      isDirty: true,
    })),

  removeSubject: (id) =>
    set((s) => ({
      subjects: s.subjects.filter((sub) => sub.id !== id),
      isDirty: true,
    })),

  // Teachers
  addTeacher: (data) => {
    const timestamp = now()
    const teacher: Teacher = {
      ...data,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    set((s) => ({ teachers: [...s.teachers, teacher], isDirty: true }))
  },

  updateTeacher: (id, updates) =>
    set((s) => ({
      teachers: s.teachers.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: now() } : t,
      ),
      isDirty: true,
    })),

  removeTeacher: (id) =>
    set((s) => ({
      teachers: s.teachers.filter((t) => t.id !== id),
      isDirty: true,
    })),

  // FixedEvents
  addFixedEvent: (data) => {
    const timestamp = now()
    const event: FixedEvent = {
      ...data,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    set((s) => ({ fixedEvents: [...s.fixedEvents, event], isDirty: true }))
  },

  updateFixedEvent: (id, updates) =>
    set((s) => ({
      fixedEvents: s.fixedEvents.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: now() } : e,
      ),
      isDirty: true,
    })),

  removeFixedEvent: (id) =>
    set((s) => ({
      fixedEvents: s.fixedEvents.filter((e) => e.id !== id),
      isDirty: true,
    })),

  // Persistence
  loadFromDB: async () => {
    set({ isLoading: true })
    const data = await loadAllSetupData()
    set({
      schoolConfig: data.schoolConfig ?? null,
      subjects: data.subjects,
      teachers: data.teachers,
      fixedEvents: data.fixedEvents,
      isDirty: false,
      isLoading: false,
    })
  },

  saveToDB: async () => {
    const { schoolConfig, subjects, teachers, fixedEvents } = get()
    if (!schoolConfig) return
    await saveAllSetupData({ schoolConfig, subjects, teachers, fixedEvents })
    set({ isDirty: false })
  },

  // Validation
  runValidation: () => {
    const { schoolConfig, subjects, teachers, fixedEvents } = get()
    const messages = runFullValidation(schoolConfig, subjects, teachers, fixedEvents)
    set({ validationMessages: messages })
  },
}))
