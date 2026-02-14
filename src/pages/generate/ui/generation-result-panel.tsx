import type { GenerationResult } from '@/features/generate-timetable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGenerateStore } from '@/features/generate-timetable/model/store'

interface GenerationResultPanelProps {
  result: GenerationResult
}

export function GenerationResultPanel({ result }: GenerationResultPanelProps) {
  const { saveResult } = useGenerateStore()

  return (
    <div className="space-y-4">
      {/* 통계 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>생성 결과</CardTitle>
            <Badge variant={result.success ? 'default' : 'destructive'}>
              {result.success ? '성공' : '실패'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatItem label="총 슬롯" value={result.stats.totalSlots} />
            <StatItem label="배치 완료" value={result.stats.filledSlots} />
            <StatItem label="고정 수업" value={result.stats.fixedSlots} />
            <StatItem label="점수" value={result.snapshot?.score.toFixed(1) ?? '-'} />
            <StatItem label="생성 시간" value={`${result.stats.generationTimeMs}ms`} />
          </div>
          {result.success && (
            <div className="mt-4">
              <Button onClick={saveResult}>결과 저장</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 위반 사항 */}
      {result.violations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>제약 위반</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.violations.map((v, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={v.severity === 'error' ? 'destructive' : 'secondary'}
                    className="mt-0.5 shrink-0"
                  >
                    {v.severity === 'error' ? '오류' : '경고'}
                  </Badge>
                  <span>{v.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 미배치 */}
      {result.unplacedAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>미배치 항목</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.unplacedAssignments.map((u, i) => (
                <li key={i} className="text-sm">
                  교사 {u.teacherId} → {u.grade}학년 {u.classNumber}반 (잔여 {u.remainingHours}
                  시수) — {reasonLabel(u.reason)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 완화 제안 */}
      {result.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>개선 제안</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={
                      s.priority === 'high'
                        ? 'destructive'
                        : s.priority === 'medium'
                          ? 'secondary'
                          : 'outline'
                    }
                    className="mt-0.5 shrink-0"
                  >
                    {s.priority === 'high' ? '높음' : s.priority === 'medium' ? '보통' : '낮음'}
                  </Badge>
                  <span>{s.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'TEACHER_NO_AVAILABLE_SLOTS':
      return '교사 가용 슬롯 부족'
    case 'CLASS_NO_AVAILABLE_SLOTS':
      return '반 가용 슬롯 부족'
    case 'TEACHER_CLASS_NO_OVERLAP':
      return '교사-반 시간 겹침'
    case 'BACKTRACKING_EXHAUSTED':
      return '배치 탐색 한도 초과'
    default:
      return reason
  }
}
