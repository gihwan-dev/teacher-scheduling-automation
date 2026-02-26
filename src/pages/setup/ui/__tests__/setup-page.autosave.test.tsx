import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SetupPage } from '../setup-page'
import { useSetupStore } from '@/features/manage-school-setup'
import { useUnsavedWarning } from '@/shared/lib/hooks/use-unsaved-warning'

vi.mock('../school-config-form', () => ({
  SchoolConfigForm: () => <div>school-config-form-mock</div>,
}))

vi.mock('../subject-table', () => ({
  SubjectTable: () => <div>subject-table-mock</div>,
}))

vi.mock('../teacher-table', () => ({
  TeacherTable: () => <div>teacher-table-mock</div>,
}))

vi.mock('../fixed-event-table', () => ({
  FixedEventTable: () => <div>fixed-event-table-mock</div>,
}))

vi.mock('../academic-calendar-table', () => ({
  AcademicCalendarTable: () => <div>academic-calendar-table-mock</div>,
}))

vi.mock('../hour-shortage-report', () => ({
  HourShortageReport: () => <div>hour-shortage-report-mock</div>,
}))

vi.mock('../validation-summary', () => ({
  ValidationSummary: () => <div>validation-summary-mock</div>,
}))

vi.mock('../setup-import-panel', () => ({
  SetupImportPanel: () => <div>setup-import-panel-mock</div>,
}))

vi.mock('@/shared/lib/hooks/use-unsaved-warning', () => ({
  useUnsavedWarning: vi.fn(),
}))

const useUnsavedWarningMock = vi.mocked(useUnsavedWarning)

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })

  useSetupStore.setState(useSetupStore.getInitialState(), true)
  useSetupStore.setState({
    activeTab: 'school',
    isLoading: false,
    isDirty: false,
    isAutoSaving: false,
    autoSaveError: null,
    lastAutoSavedAt: null,
    loadFromDB: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    flushAutoSave: vi
      .fn<(reason: 'debounce' | 'pagehide' | 'manual') => Promise<void>>()
      .mockResolvedValue(undefined),
  })
})

describe('SetupPage autosave UI and lifecycle', () => {
  it('save button is not rendered', () => {
    render(<SetupPage />)

    expect(
      screen.queryByRole('button', {
        name: '저장',
      }),
    ).toBeNull()
  })

  it('useUnsavedWarning is called with isDirty || isAutoSaving', () => {
    useSetupStore.setState({ isDirty: false, isAutoSaving: true })

    render(<SetupPage />)

    expect(useUnsavedWarningMock).toHaveBeenCalledWith(true)
  })

  it("pagehide and visibilitychange(hidden) call flushAutoSave('pagehide')", () => {
    const flushAutoSave = vi
      .fn<(reason: 'debounce' | 'pagehide' | 'manual') => Promise<void>>()
      .mockResolvedValue(undefined)
    useSetupStore.setState({ flushAutoSave })

    render(<SetupPage />)

    fireEvent(window, new Event('pagehide'))
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    fireEvent(document, new Event('visibilitychange'))

    expect(flushAutoSave).toHaveBeenCalledWith('pagehide')
    expect(flushAutoSave).toHaveBeenCalledTimes(2)
  })

  it('autosave status UI renders for saving, error, and lastSaved states', () => {
    useSetupStore.setState({ isAutoSaving: true, autoSaveError: null })
    const savingView = render(<SetupPage />)
    expect(screen.getByText('저장 중')).not.toBeNull()
    savingView.unmount()

    useSetupStore.setState({
      isAutoSaving: false,
      autoSaveError: '오류 발생',
      lastAutoSavedAt: null,
    })
    const errorView = render(<SetupPage />)
    expect(screen.getByText('자동 저장 실패: 오류 발생')).not.toBeNull()
    errorView.unmount()

    useSetupStore.setState({
      isAutoSaving: false,
      autoSaveError: null,
      lastAutoSavedAt: '2026-02-25T09:30:00.000Z',
    })
    render(<SetupPage />)
    expect(
      screen.getByText('마지막 저장: 2026-02-25T09:30:00.000Z'),
    ).not.toBeNull()
  })

  it("autoSaveError retry button triggers flushAutoSave('manual')", () => {
    const flushAutoSave = vi
      .fn<(reason: 'debounce' | 'pagehide' | 'manual') => Promise<void>>()
      .mockResolvedValue(undefined)
    useSetupStore.setState({
      isAutoSaving: false,
      autoSaveError: '오류 발생',
      flushAutoSave,
    })

    render(<SetupPage />)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(flushAutoSave).toHaveBeenCalledWith('manual')
  })
})
