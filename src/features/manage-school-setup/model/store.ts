import { create } from 'zustand'
import { runFullValidation } from './validation'
import type { ValidationMessage } from './validation'
import type { SchoolConfig } from '@/entities/school'
import type { AcademicCalendarEvent } from '@/entities/academic-calendar'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { FixedEvent } from '@/entities/fixed-event'
import type { TimetableSnapshot } from '@/entities/timetable'
import {
  loadAcademicCalendarEvents,
  loadAllSetupData,
  loadLatestTimetableSnapshot,
  saveAcademicCalendarEvents,
  saveAllSetupData,
} from '@/shared/persistence/indexeddb/repository'
import { generateId } from '@/shared/lib/id'

export type SetupTab =
  | 'school'
  | 'subjects'
  | 'teachers'
  | 'fixedEvents'
  | 'academicCalendar'

interface SetupState {
  schoolConfig: SchoolConfig | null
  subjects: Array<Subject>
  teachers: Array<Teacher>
  fixedEvents: Array<FixedEvent>
  academicCalendarEvents: Array<AcademicCalendarEvent>
  baselineAcademicCalendarEvents: Array<AcademicCalendarEvent>
  latestSnapshot: TimetableSnapshot | null
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
  addFixedEvent: (
    event: Omit<FixedEvent, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void
  updateFixedEvent: (id: string, updates: Partial<FixedEvent>) => void
  removeFixedEvent: (id: string) => void

  // AcademicCalendarEvents
  addAcademicCalendarEvent: (
    event: Omit<AcademicCalendarEvent, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void
  updateAcademicCalendarEvent: (
    id: string,
    updates: Partial<AcademicCalendarEvent>,
  ) => void
  removeAcademicCalendarEvent: (id: string) => void

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
  academicCalendarEvents: [],
  baselineAcademicCalendarEvents: [],
  latestSnapshot: null,
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

  // AcademicCalendarEvents
  addAcademicCalendarEvent: (data) => {
    const timestamp = now()
    const event: AcademicCalendarEvent = {
      ...data,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    set((s) => ({
      academicCalendarEvents: [...s.academicCalendarEvents, event],
      isDirty: true,
    }))
  },

  updateAcademicCalendarEvent: (id, updates) =>
    set((s) => ({
      academicCalendarEvents: s.academicCalendarEvents.map((event) =>
        event.id === id ? { ...event, ...updates, updatedAt: now() } : event,
      ),
      isDirty: true,
    })),

  removeAcademicCalendarEvent: (id) =>
    set((s) => ({
      academicCalendarEvents: s.academicCalendarEvents.filter(
        (event) => event.id !== id,
      ),
      isDirty: true,
    })),

  // Persistence
  loadFromDB: async () => {
    set({ isLoading: true })
    const [data, academicCalendarEvents, latestSnapshot] = await Promise.all([
      loadAllSetupData(),
      loadAcademicCalendarEvents(),
      loadLatestTimetableSnapshot(),
    ])
    set({
      schoolConfig: data.schoolConfig ?? null,
      subjects: data.subjects,
      teachers: data.teachers,
      fixedEvents: data.fixedEvents,
      academicCalendarEvents,
      baselineAcademicCalendarEvents: academicCalendarEvents,
      latestSnapshot: latestSnapshot ?? null,
      isDirty: false,
      isLoading: false,
    })
  },

  saveToDB: async () => {
    const {
      schoolConfig,
      subjects,
      teachers,
      fixedEvents,
      academicCalendarEvents,
    } = get()
    if (!schoolConfig) return
    await Promise.all([
      saveAllSetupData({ schoolConfig, subjects, teachers, fixedEvents }),
      saveAcademicCalendarEvents(academicCalendarEvents),
    ])
    set({
      baselineAcademicCalendarEvents: academicCalendarEvents,
      isDirty: false,
    })
  },

  // Validation
  runValidation: () => {
    const { schoolConfig, subjects, teachers, fixedEvents } = get()
    const messages = runFullValidation(
      schoolConfig,
      subjects,
      teachers,
      fixedEvents,
    )
    set({ validationMessages: messages })
  },
}))
