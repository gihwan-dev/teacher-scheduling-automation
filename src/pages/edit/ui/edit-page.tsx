import { useEffect } from 'react'
import { EditableTimetableGrid } from './editable-timetable-grid'
import { EditToolbar } from './edit-toolbar'
import { EditValidationPanel } from './edit-validation-panel'
import { KeyboardShortcutsPanel } from './keyboard-shortcuts-panel'
import { StatusLegend } from '@/entities/timetable'
import { useEditStore } from '@/features/edit-timetable-cell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useUnsavedWarning } from '@/shared/lib/hooks/use-unsaved-warning'

export function EditPage() {
  const {
    snapshot,
    schoolConfig,
    teachers,
    subjects,
    violations,
    viewGrade,
    viewClassNumber,
    isDirty,
    isLoading,
    loadSnapshot,
    setViewTarget,
  } = useEditStore()

  useEffect(() => {
    loadSnapshot()
  }, [loadSnapshot])

  useUnsavedWarning(isDirty)

  if (isLoading) {
    return <LoadingState />
  }

  if (!snapshot) {
    return (
      <EmptyState
        title="시간표가 없습니다"
        description="먼저 시간표를 생성하세요. 생성 페이지에서 시간표를 생성한 후 저장하면 편집할 수 있습니다."
        actionLabel="생성 페이지로 이동"
        actionTo="/generate"
      />
    )
  }

  if (!schoolConfig) {
    return (
      <EmptyState
        title="설정 데이터가 없습니다"
        description="학교 설정 데이터가 없습니다. 설정 페이지에서 먼저 입력해주세요."
        actionLabel="설정 페이지로 이동"
        actionTo="/setup"
      />
    )
  }

  const classCount = schoolConfig.classCountByGrade[viewGrade] ?? 0

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">시간표 편집</h1>
        <EditToolbar />
      </div>

      {/* 학년/반 선택 + 단축키 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Select
            value={String(viewGrade)}
            onValueChange={(val) => setViewTarget(Number(val), 1)}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                { length: schoolConfig.gradeCount },
                (_, i) => i + 1,
              ).map((g) => (
                <SelectItem key={g} value={String(g)}>
                  {g}학년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(viewClassNumber)}
            onValueChange={(val) => setViewTarget(viewGrade, Number(val))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: classCount }, (_, i) => i + 1).map((c) => (
                <SelectItem key={c} value={String(c)}>
                  {c}반
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <KeyboardShortcutsPanel />
      </div>

      {/* 상태 범례 */}
      <StatusLegend />

      {/* 편집 가능 그리드 */}
      <EditableTimetableGrid
        schoolConfig={schoolConfig}
        teachers={teachers}
        subjects={subjects}
      />

      {/* 검증 결과 */}
      <EditValidationPanel violations={violations} />
    </div>
  )
}
