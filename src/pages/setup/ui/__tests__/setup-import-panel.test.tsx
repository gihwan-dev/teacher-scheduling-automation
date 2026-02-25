import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SetupImportPanel } from '../setup-import-panel'
import type { ImportReport } from '@/features/manage-school-setup'
import { useSetupStore } from '@/features/manage-school-setup'

const createdAt = '2026-02-25T12:00:00.000Z'

function createTeacherHoursFile(): File {
  return new File(['teacher-hours'], 'teacher-hours.xls', {
    type: 'application/vnd.ms-excel',
  })
}

function createFinalTimetableFile(): File {
  return new File(['final-timetable'], 'final-timetable.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function createReport(overrides: Partial<ImportReport>): ImportReport {
  return {
    source: 'TEACHER_HOURS_XLS',
    status: 'SUCCESS',
    targetWeekTag: '2026-W09',
    createdAt,
    issues: [],
    summary: {
      errorCount: 0,
      warningCount: 0,
      blockingCount: 0,
    },
    ...overrides,
  }
}

function createDeferred() {
  let resolvePromise: (() => void) | null = null
  const promise = new Promise<void>((resolve) => {
    resolvePromise = () => resolve()
  })
  return {
    promise,
    resolve: () => {
      resolvePromise?.()
    },
  }
}

let importTeacherHoursFromFileMock: ReturnType<
  typeof vi.fn<(file: File) => Promise<void>>
>
let importFinalTimetableFromFileMock: ReturnType<
  typeof vi.fn<(file: File) => Promise<void>>
>

beforeEach(() => {
  useSetupStore.setState(useSetupStore.getInitialState(), true)

  importTeacherHoursFromFileMock = vi
    .fn<(file: File) => Promise<void>>()
    .mockResolvedValue(undefined)
  importFinalTimetableFromFileMock = vi
    .fn<(file: File) => Promise<void>>()
    .mockResolvedValue(undefined)

  useSetupStore.setState({
    importReport: null,
    importTeacherHoursFromFile: importTeacherHoursFromFileMock,
    importFinalTimetableFromFile: importFinalTimetableFromFileMock,
  })
})

describe('SetupImportPanel', () => {
  it('파일 미선택 시 두 업로드 버튼이 비활성화된다', () => {
    render(<SetupImportPanel />)

    const teacherUploadButton = screen.getByRole('button', {
      name: '교사 시수표 업로드',
    })
    const finalUploadButton = screen.getByRole('button', {
      name: '최종 시간표 업로드',
    })

    expect(teacherUploadButton.getAttribute('disabled')).not.toBeNull()
    expect(finalUploadButton.getAttribute('disabled')).not.toBeNull()
  })

  it('.xls 선택 후 클릭 시 importTeacherHoursFromFile가 1회 호출된다', async () => {
    render(<SetupImportPanel />)

    const teacherFileInput = screen.getByLabelText('교사 시수표 파일')
    const teacherUploadButton = screen.getByRole('button', {
      name: '교사 시수표 업로드',
    })
    const file = createTeacherHoursFile()

    fireEvent.change(teacherFileInput, { target: { files: [file] } })
    fireEvent.click(teacherUploadButton)

    await waitFor(() => {
      expect(importTeacherHoursFromFileMock).toHaveBeenCalledTimes(1)
    })
    expect(importTeacherHoursFromFileMock).toHaveBeenCalledWith(file)
  })

  it('.xlsx 선택 후 클릭 시 importFinalTimetableFromFile가 1회 호출된다', async () => {
    render(<SetupImportPanel />)

    const finalFileInput = screen.getByLabelText('최종 시간표 파일')
    const finalUploadButton = screen.getByRole('button', {
      name: '최종 시간표 업로드',
    })
    const file = createFinalTimetableFile()

    fireEvent.change(finalFileInput, { target: { files: [file] } })
    fireEvent.click(finalUploadButton)

    await waitFor(() => {
      expect(importFinalTimetableFromFileMock).toHaveBeenCalledTimes(1)
    })
    expect(importFinalTimetableFromFileMock).toHaveBeenCalledWith(file)
  })

  it('FAILED + blocking issue 리포트를 렌더한다', () => {
    useSetupStore.setState({
      importReport: createReport({
        source: 'FINAL_TIMETABLE_XLSX',
        status: 'FAILED',
        summary: {
          errorCount: 1,
          warningCount: 0,
          blockingCount: 1,
        },
        issues: [
          {
            code: 'HEADER_MISMATCH',
            severity: 'error',
            blocking: true,
            message: '필수 헤더가 누락되었습니다.',
            location: {
              sheetName: '교사별시수표',
              row: 11,
              column: 'C',
              field: 'teacherName',
            },
          },
        ],
      }),
    })

    render(<SetupImportPanel />)

    expect(screen.getByText('실패')).not.toBeNull()
    expect(screen.getByText('오류')).not.toBeNull()
    expect(screen.getByText('BLOCKING')).not.toBeNull()
    expect(screen.getByText('필수 헤더가 누락되었습니다.')).not.toBeNull()
    expect(
      screen.getByText(
        '(sheet: 교사별시수표, row: 11, column: C, field: teacherName)',
      ),
    ).not.toBeNull()
  })

  it('PARTIAL_SUCCESS warning 리포트를 렌더한다', () => {
    useSetupStore.setState({
      importReport: createReport({
        status: 'PARTIAL_SUCCESS',
        summary: {
          errorCount: 0,
          warningCount: 1,
          blockingCount: 0,
        },
        issues: [
          {
            code: 'INVALID_ROW',
            severity: 'warning',
            blocking: false,
            message: '일부 행이 건너뛰어졌습니다.',
          },
        ],
      }),
    })

    render(<SetupImportPanel />)

    expect(screen.getByText('부분 성공')).not.toBeNull()
    expect(screen.getByText('경고')).not.toBeNull()
    expect(screen.getByText('일부 행이 건너뛰어졌습니다.')).not.toBeNull()
  })

  it('업로드 완료 후 동일 파일을 재선택해 2회 업로드할 수 있다', async () => {
    render(<SetupImportPanel />)

    const teacherFileInput = screen.getByLabelText('교사 시수표 파일')
    const teacherUploadButton = screen.getByRole('button', {
      name: '교사 시수표 업로드',
    })
    const sameFile = createTeacherHoursFile()

    fireEvent.change(teacherFileInput, { target: { files: [sameFile] } })
    fireEvent.click(teacherUploadButton)

    await waitFor(() => {
      expect(importTeacherHoursFromFileMock).toHaveBeenCalledTimes(1)
      expect(teacherUploadButton.getAttribute('disabled')).not.toBeNull()
    })

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: '교사 시수표 업로드',
        }),
      ).not.toBeNull()
    })
    const teacherFileInputAfterReset = screen.getByLabelText('교사 시수표 파일')
    const teacherUploadButtonAfterReset = screen.getByRole('button', {
      name: '교사 시수표 업로드',
    })

    fireEvent.change(teacherFileInputAfterReset, {
      target: { files: [sameFile] },
    })
    fireEvent.click(teacherUploadButtonAfterReset)

    await waitFor(() => {
      expect(importTeacherHoursFromFileMock).toHaveBeenCalledTimes(2)
    })
    expect(importTeacherHoursFromFileMock).toHaveBeenNthCalledWith(2, sameFile)
  })

  it('교사 업로드 pending 중에는 최종 시간표 업로드를 시작할 수 없다', async () => {
    const teacherImportDeferred = createDeferred()
    importTeacherHoursFromFileMock.mockImplementation(
      () => teacherImportDeferred.promise,
    )

    render(<SetupImportPanel />)

    const teacherFileInput = screen.getByLabelText('교사 시수표 파일')
    const finalFileInput = screen.getByLabelText('최종 시간표 파일')
    const teacherFile = createTeacherHoursFile()
    const finalFile = createFinalTimetableFile()

    fireEvent.change(teacherFileInput, { target: { files: [teacherFile] } })
    fireEvent.change(finalFileInput, { target: { files: [finalFile] } })

    fireEvent.click(
      screen.getByRole('button', {
        name: '교사 시수표 업로드',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: '최종 시간표 업로드',
        }).getAttribute('disabled'),
      ).not.toBeNull()
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: '최종 시간표 업로드',
      }),
    )

    expect(importFinalTimetableFromFileMock).toHaveBeenCalledTimes(0)

    teacherImportDeferred.resolve()
    await waitFor(() => {
      expect(importTeacherHoursFromFileMock).toHaveBeenCalledTimes(1)
    })
  })
})
