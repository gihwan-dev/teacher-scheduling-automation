import { useEffect } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { FloppyDiskIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { SchoolConfigForm } from './school-config-form'
import { SubjectTable } from './subject-table'
import { TeacherTable } from './teacher-table'
import { FixedEventTable } from './fixed-event-table'
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
    isLoading,
    validationMessages,
    loadFromDB,
    saveToDB,
    runValidation,
  } = useSetupStore()

  useEffect(() => {
    loadFromDB()
  }, [loadFromDB])

  useUnsavedWarning(isDirty)

  const errorCount = validationMessages.filter(
    (m) => m.severity === 'error',
  ).length
  const warningCount = validationMessages.filter(
    (m) => m.severity === 'warning',
  ).length

  const handleSave = async () => {
    runValidation()
    await saveToDB()
    toast.success('설정을 저장했습니다')
  }

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
          <Button variant="outline" onClick={runValidation}>
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
            검증
          </Button>
          <Button onClick={handleSave}>
            <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} />
            저장
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
      </Tabs>

      <ValidationSummary />
    </div>
  )
}
