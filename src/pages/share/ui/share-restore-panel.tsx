import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useShareStore } from '@/features/share-by-url'
import {
  ReadOnlyTeacherTimetableView,
  ReadOnlyTimetableView,
} from '@/widgets/readonly-timetable-view'

export function ShareRestorePanel() {
  const { previewData, isRestoring, restoreError } = useShareStore()
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class')

  if (restoreError) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <h2 className="text-lg font-semibold text-destructive">
            잘못된 공유 링크
          </h2>
          <p className="text-sm text-muted-foreground">{restoreError}</p>
        </CardContent>
      </Card>
    )
  }

  if (isRestoring && !previewData) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-muted-foreground">데이터 분석 중...</p>
      </div>
    )
  }

  if (!previewData) return null

  const { schoolConfig, subjects, teachers, snapshot } = previewData

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === 'teacher' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('teacher')}
        >
          교사 중심 보기
        </Button>
        <Button
          variant={viewMode === 'class' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('class')}
        >
          학급 중심 보기
        </Button>
      </div>

      {viewMode === 'class' ? (
        <ReadOnlyTimetableView
          cells={snapshot.cells}
          schoolConfig={schoolConfig}
          teachers={teachers}
          subjects={subjects}
          title="공유된 시간표"
        />
      ) : (
        <ReadOnlyTeacherTimetableView
          cells={snapshot.cells}
          schoolConfig={schoolConfig}
          teachers={teachers}
          subjects={subjects}
          title="교사 시간표"
        />
      )}
    </div>
  )
}
