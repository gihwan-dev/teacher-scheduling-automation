import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useShareStore } from '@/features/share-by-url'
import { ReadOnlyTimetableView } from '@/widgets/readonly-timetable-view'

export function ShareRestorePanel() {
  const { previewData, isRestoring, restoreError, isImported, importToLocal } =
    useShareStore()
  const navigate = useNavigate()

  const handleImport = async () => {
    await importToLocal()
    toast.success('시간표를 가져왔습니다')
  }

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
      {/* 컴팩트 정보 바 */}
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="secondary">{snapshot.score.toFixed(1)}점</Badge>
            <span>{teachers.length}명 교사</span>
            <span>{subjects.length}개 과목</span>
            <span>{new Date(snapshot.createdAt).toLocaleString('ko-KR')}</span>
          </div>
          {isImported ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/edit' })}
            >
              편집 페이지로 이동
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              disabled={isRestoring}
            >
              {isRestoring ? '가져오는 중...' : '내 시간표로 가져오기'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 읽기 전용 시간표 그리드 */}
      <ReadOnlyTimetableView
        cells={snapshot.cells}
        schoolConfig={schoolConfig}
        teachers={teachers}
        subjects={subjects}
        title="공유된 시간표"
      />
    </div>
  )
}
