import { useEffect } from 'react'
import { SchoolConfigForm } from './school-config-form'
import { SubjectTable } from './subject-table'
import { TeacherTable } from './teacher-table'
import { FixedEventTable } from './fixed-event-table'
import { AcademicCalendarTable } from './academic-calendar-table'
import { HourShortageReport } from './hour-shortage-report'
import { SetupImportPanel } from './setup-import-panel'
import { ValidationSummary } from './validation-summary'
import type { SetupTab } from '@/features/manage-school-setup'
import { useSetupStore } from '@/features/manage-school-setup'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUnsavedWarning } from '@/shared/lib/hooks/use-unsaved-warning'

export function SetupPage() {
  const {
    activeTab,
    setActiveTab,
    isDirty,
    isAutoSaving,
    lastAutoSavedAt,
    autoSaveError,
    isLoading,
    validationMessages,
    loadFromDB,
    flushAutoSave,
    runValidation,
  } = useSetupStore()

  useEffect(() => {
    loadFromDB()
  }, [loadFromDB])

  useEffect(() => {
    const handlePageHide = () => {
      void flushAutoSave('pagehide')
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushAutoSave('pagehide')
      }
    }
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [flushAutoSave])

  useUnsavedWarning(isDirty || isAutoSaving)

  const errorCount = validationMessages.filter(
    (m) => m.severity === 'error',
  ).length
  const warningCount = validationMessages.filter(
    (m) => m.severity === 'warning',
  ).length

  if (isLoading) {
    return <LoadingState />
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">학교 운영 데이터 설정</h1>
          <p className="text-muted-foreground text-sm mt-1">
            시간표 자동 생성에 필요한 기초 데이터를 입력합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && <Badge variant="outline">변경사항 있음</Badge>}
          {isAutoSaving && <Badge variant="secondary">저장 중</Badge>}
          {!isAutoSaving && autoSaveError && (
            <div className="flex items-center gap-2">
              <Badge variant="destructive">자동 저장 실패: {autoSaveError}</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void flushAutoSave('manual')}
              >
                다시 시도
              </Button>
            </div>
          )}
          {!isAutoSaving && !autoSaveError && lastAutoSavedAt && (
            <p className="text-muted-foreground text-xs">
              마지막 저장: {lastAutoSavedAt}
            </p>
          )}
          <Button variant="outline" onClick={runValidation}>
            검증
          </Button>
        </div>
      </div>

      {validationMessages.length > 0 && (
        <div className="flex gap-2">
          {errorCount > 0 && (
            <Badge variant="destructive">오류 {errorCount}</Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary">경고 {warningCount}</Badge>
          )}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as SetupTab)}
      >
        <TabsList>
          <TabsTrigger value="school">학교 구조</TabsTrigger>
          <TabsTrigger value="subjects">과목 관리</TabsTrigger>
          <TabsTrigger value="teachers">교사 관리</TabsTrigger>
          <TabsTrigger value="fixedEvents">고정 이벤트</TabsTrigger>
          <TabsTrigger value="academicCalendar">학사일정</TabsTrigger>
          <TabsTrigger value="import">가져오기</TabsTrigger>
        </TabsList>

        <TabsContent value="school">
          <SchoolConfigForm />
        </TabsContent>

        <TabsContent value="subjects">
          <SubjectTable />
        </TabsContent>

        <TabsContent value="teachers">
          <TeacherTable />
        </TabsContent>

        <TabsContent value="fixedEvents">
          <FixedEventTable />
        </TabsContent>

        <TabsContent value="academicCalendar" className="space-y-4">
          <AcademicCalendarTable />
          <HourShortageReport />
        </TabsContent>

        <TabsContent value="import">
          <SetupImportPanel />
        </TabsContent>
      </Tabs>

      <ValidationSummary />
    </div>
  )
}
