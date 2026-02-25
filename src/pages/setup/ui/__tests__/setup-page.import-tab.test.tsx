import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SetupPage } from '../setup-page'
import { useSetupStore } from '@/features/manage-school-setup'

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

beforeEach(() => {
  useSetupStore.setState(useSetupStore.getInitialState(), true)
  useSetupStore.setState({
    activeTab: 'school',
    isLoading: false,
    loadFromDB: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  })
})

describe('SetupPage import tab', () => {
  it('import 탭 트리거가 노출된다', () => {
    render(<SetupPage />)

    expect(
      screen.getByRole('tab', {
        name: '가져오기',
      }),
    ).not.toBeNull()
  })

  it('import 탭 클릭 시 import 패널이 렌더된다', async () => {
    render(<SetupPage />)

    fireEvent.click(
      screen.getByRole('tab', {
        name: '가져오기',
      }),
    )

    await waitFor(() => {
      expect(useSetupStore.getState().activeTab).toBe('import')
    })
    expect(screen.getByText('setup-import-panel-mock')).not.toBeNull()
  })
})
