import { useReplacementStore } from '@/features/find-replacement'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

export function ImpactAnalysisPanel() {
  const {
    isMultiMode,
    selectedCandidate,
    selectedMultiCandidate,
    impactReport,
    multiImpactReport,
    impactReportLoading,
  } = useReplacementStore()

  const hasSelection = isMultiMode ? !!selectedMultiCandidate : !!selectedCandidate
  if (!hasSelection && !impactReportLoading) {
    return null
  }

  if (impactReportLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">영향 분석 리포트</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex items-center gap-2">
          <Spinner size="sm" />
          영향 분석 계산 중...
        </CardContent>
      </Card>
    )
  }

  const report = isMultiMode ? multiImpactReport : impactReport
  if (!report) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">영향 분석 리포트</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          영향 분석 리포트를 생성하지 못했습니다. 후보를 다시 선택해 주세요.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          영향 분석 리포트
          <RiskBadge riskLevel={report.riskLevel} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">영향 교사</p>
          {report.affectedTeachers.length === 0 ? (
            <p className="text-muted-foreground">영향 교사가 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {report.affectedTeachers.map((teacher, index) => (
                <li key={`${teacher.teacherName}-${index}`}>
                  <span className="font-medium">{teacher.teacherName}</span>
                  <span className="text-muted-foreground"> - {teacher.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">영향 학급</p>
          {report.affectedClasses.length === 0 ? (
            <p className="text-muted-foreground">영향 학급이 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {report.affectedClasses.map((target) => (
                <li key={`${target.grade}-${target.classNumber}`}>
                  <span className="font-medium">
                    {target.grade}학년 {target.classNumber}반
                  </span>
                  <span className="text-muted-foreground"> - {target.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">시수 변화</p>
          {report.hourDelta.length === 0 ? (
            <p className="text-muted-foreground">시수 변화가 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {report.hourDelta.map((delta, index) => (
                <li key={`${delta.target}-${index}`}>
                  <span>{delta.target}</span>
                  <span
                    className={
                      delta.delta >= 0 ? 'text-green-600 ml-2' : 'text-destructive ml-2'
                    }
                  >
                    {delta.delta > 0 ? '+' : ''}
                    {delta.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">대안 목록</p>
          {report.alternatives.length === 0 ? (
            <p className="text-muted-foreground">대안 후보가 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {report.alternatives.map((alternative, index) => (
                <li key={`${alternative}-${index}`}>{alternative}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RiskBadge({ riskLevel }: { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  if (riskLevel === 'HIGH') {
    return <Badge variant="destructive">HIGH</Badge>
  }
  if (riskLevel === 'MEDIUM') {
    return <Badge variant="default">MEDIUM</Badge>
  }
  return <Badge variant="secondary">LOW</Badge>
}
