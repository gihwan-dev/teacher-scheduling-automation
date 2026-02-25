import { useState } from 'react'
import type { ImportIssue, ImportReport } from '@/features/manage-school-setup'
import { useSetupStore } from '@/features/manage-school-setup'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function getStatusBadgeVariant(
  status: ImportReport['status'],
): 'default' | 'secondary' | 'destructive' {
  if (status === 'PARTIAL_SUCCESS') return 'secondary'
  if (status === 'FAILED') return 'destructive'
  return 'default'
}

function getStatusLabel(status: ImportReport['status']): string {
  if (status === 'PARTIAL_SUCCESS') return '부분 성공'
  if (status === 'FAILED') return '실패'
  return '성공'
}

function getIssueSeverityBadgeVariant(
  severity: ImportIssue['severity'],
): 'destructive' | 'secondary' {
  return severity === 'error' ? 'destructive' : 'secondary'
}

function getIssueSeverityLabel(severity: ImportIssue['severity']): string {
  return severity === 'error' ? '오류' : '경고'
}

function formatIssueLocation(issue: ImportIssue): string | null {
  if (!issue.location) return null

  const parts: Array<string> = []
  if (issue.location.sheetName) parts.push(`sheet: ${issue.location.sheetName}`)
  if (typeof issue.location.row === 'number') {
    parts.push(`row: ${issue.location.row}`)
  }
  if (issue.location.column) parts.push(`column: ${issue.location.column}`)
  if (issue.location.field) parts.push(`field: ${issue.location.field}`)

  if (parts.length === 0) return null
  return `(${parts.join(', ')})`
}

export function SetupImportPanel() {
  const {
    importTeacherHoursFromFile,
    importFinalTimetableFromFile,
    importReport,
  } = useSetupStore()

  const [teacherHoursFile, setTeacherHoursFile] = useState<File | null>(null)
  const [finalTimetableFile, setFinalTimetableFile] = useState<File | null>(null)
  const [teacherInputKey, setTeacherInputKey] = useState(0)
  const [finalInputKey, setFinalInputKey] = useState(0)
  const [isTeacherImportPending, setIsTeacherImportPending] = useState(false)
  const [isFinalImportPending, setIsFinalImportPending] = useState(false)
  const isAnyImportPending = isTeacherImportPending || isFinalImportPending

  const clearTeacherFileInput = () => {
    setTeacherHoursFile(null)
    setTeacherInputKey((prev) => prev + 1)
  }

  const clearFinalFileInput = () => {
    setFinalTimetableFile(null)
    setFinalInputKey((prev) => prev + 1)
  }

  const handleTeacherImport = async () => {
    if (!teacherHoursFile || isAnyImportPending) return

    setIsTeacherImportPending(true)
    try {
      await importTeacherHoursFromFile(teacherHoursFile)
    } finally {
      setIsTeacherImportPending(false)
      clearTeacherFileInput()
    }
  }

  const handleFinalImport = async () => {
    if (!finalTimetableFile || isAnyImportPending) return

    setIsFinalImportPending(true)
    try {
      await importFinalTimetableFromFile(finalTimetableFile)
    } finally {
      setIsFinalImportPending(false)
      clearFinalFileInput()
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>파일 가져오기</CardTitle>
          <CardDescription>
            업로드 버튼을 눌렀을 때만 반영됩니다. 가져오기 완료 후 같은 파일도 다시
            선택할 수 있습니다.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">교사 시수표 (.xls)</CardTitle>
          <CardDescription>
            교사별 시수 데이터를 불러와 과목/교사/배정을 갱신합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="teacher-hours-file">교사 시수표 파일</Label>
            <Input
              key={teacherInputKey}
              id="teacher-hours-file"
              type="file"
              accept=".xls,application/vnd.ms-excel"
              disabled={isAnyImportPending}
              onChange={(event) =>
                setTeacherHoursFile(event.currentTarget.files?.[0] ?? null)
              }
            />
            <p className="text-muted-foreground text-xs">
              {teacherHoursFile?.name ?? '선택된 파일이 없습니다.'}
            </p>
          </div>
          <Button
            type="button"
            onClick={handleTeacherImport}
            disabled={teacherHoursFile === null || isAnyImportPending}
          >
            {isTeacherImportPending ? '업로드 중...' : '교사 시수표 업로드'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">최종 시간표 (.xlsx)</CardTitle>
          <CardDescription>
            최종 시간표를 불러와 기준 주차 스냅샷을 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="final-timetable-file">최종 시간표 파일</Label>
            <Input
              key={finalInputKey}
              id="final-timetable-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isAnyImportPending}
              onChange={(event) =>
                setFinalTimetableFile(event.currentTarget.files?.[0] ?? null)
              }
            />
            <p className="text-muted-foreground text-xs">
              {finalTimetableFile?.name ?? '선택된 파일이 없습니다.'}
            </p>
          </div>
          <Button
            type="button"
            onClick={handleFinalImport}
            disabled={finalTimetableFile === null || isAnyImportPending}
          >
            {isFinalImportPending ? '업로드 중...' : '최종 시간표 업로드'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            가져오기 리포트
            {importReport && (
              <Badge variant={getStatusBadgeVariant(importReport.status)}>
                {getStatusLabel(importReport.status)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!importReport && (
            <p className="text-muted-foreground text-sm">
              가져오기를 실행하면 최신 결과 리포트가 여기에 표시됩니다.
            </p>
          )}

          {importReport && (
            <>
              <div className="text-sm space-y-1">
                <p>
                  오류 {importReport.summary.errorCount}건 · 경고{' '}
                  {importReport.summary.warningCount}건 · BLOCKING{' '}
                  {importReport.summary.blockingCount}건
                </p>
                <p className="text-muted-foreground">
                  생성 시각: {importReport.createdAt}
                </p>
                <p className="text-muted-foreground">
                  대상 주차: {importReport.targetWeekTag}
                </p>
              </div>

              {importReport.issues.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  이슈가 없습니다.
                </p>
              )}

              {importReport.issues.length > 0 && (
                <ul className="space-y-2">
                  {importReport.issues.map((issue, index) => {
                    const locationText = formatIssueLocation(issue)
                    return (
                      <li
                        key={`${issue.code}-${index}-${issue.message}`}
                        className="bg-background rounded-lg border p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={getIssueSeverityBadgeVariant(issue.severity)}
                          >
                            {getIssueSeverityLabel(issue.severity)}
                          </Badge>
                          {issue.blocking && (
                            <Badge variant="destructive">BLOCKING</Badge>
                          )}
                          <span className="text-sm">{issue.message}</span>
                        </div>
                        {locationText && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {locationText}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
