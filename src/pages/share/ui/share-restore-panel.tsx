import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useShareStore } from '@/features/share-by-url'

export function ShareRestorePanel() {
  const { previewData, isRestoring, restoreError, isImported, importToLocal } = useShareStore()
  const navigate = useNavigate()

  const handleImport = async () => {
    await importToLocal()
  }

  if (restoreError) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <h2 className="text-lg font-semibold text-destructive">잘못된 공유 링크</h2>
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

  const { schoolConfig, subjects, teachers, snapshot, constraintPolicy } = previewData

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-lg font-semibold">공유 시간표 프리뷰</h2>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="text-muted-foreground">학년 수</div>
            <div>{schoolConfig.gradeCount}개 학년</div>

            <div className="text-muted-foreground">교사 수</div>
            <div>{teachers.length}명</div>

            <div className="text-muted-foreground">과목 수</div>
            <div>{subjects.length}개</div>

            <div className="text-muted-foreground">셀 수</div>
            <div>{snapshot.cells.length}개</div>

            <div className="text-muted-foreground">점수</div>
            <div>
              <Badge variant="secondary">{snapshot.score.toFixed(1)}점</Badge>
            </div>

            <div className="text-muted-foreground">생성 시각</div>
            <div>{new Date(snapshot.createdAt).toLocaleString('ko-KR')}</div>

            <div className="text-muted-foreground">학생 연속 제한</div>
            <div>{constraintPolicy.studentMaxConsecutiveSameSubject}교시</div>

            <div className="text-muted-foreground">교사 연속 제한</div>
            <div>{constraintPolicy.teacherMaxConsecutiveHours}교시</div>
          </div>

          {isImported ? (
            <div className="space-y-2">
              <p className="text-sm text-green-600 font-medium">가져오기 완료!</p>
              <Button variant="outline" onClick={() => navigate({ to: '/edit' })}>
                편집 페이지로 이동
              </Button>
            </div>
          ) : (
            <Button onClick={handleImport} disabled={isRestoring}>
              {isRestoring ? '가져오는 중...' : '가져오기'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
