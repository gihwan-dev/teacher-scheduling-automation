import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import { useReplacementStore } from '@/features/find-replacement'
import { parseCellKey } from '@/features/edit-timetable-cell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DAY_LABELS } from '@/shared/lib/constants'
import { cn } from '@/lib/utils'

interface MultiReplacementPreviewProps {
  teachers: Array<Teacher>
  subjects: Array<Subject>
}

export function MultiReplacementPreview({
  teachers,
  subjects,
}: MultiReplacementPreviewProps) {
  const { selectedMultiCandidate } = useReplacementStore()

  if (!selectedMultiCandidate) return null

  const teacherMap = new Map(teachers.map((t) => [t.id, t]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const { combinedRanking, sources } = selectedMultiCandidate

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          다중 교체 미리보기
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                  #
                </th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                  소스
                </th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                  타겟
                </th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                  유형
                </th>
                <th className="text-left py-2 font-medium text-muted-foreground">
                  점수
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map(({ sourceKey, candidate }, index) => {
                const source = parseCellKey(sourceKey)
                const target = parseCellKey(candidate.targetCellKey)
                const sourceSubject =
                  subjectMap.get(candidate.sourceCell.subjectId)
                    ?.abbreviation ?? candidate.sourceCell.subjectId
                const sourceTeacher =
                  teacherMap.get(candidate.sourceCell.teacherId)?.name ??
                  candidate.sourceCell.teacherId
                const delta = candidate.ranking.scoreDelta

                return (
                  <tr key={index} className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="py-2 pr-4">
                      {DAY_LABELS[source.day]} {source.period}교시
                      <span className="text-muted-foreground ml-1">
                        ({sourceSubject} {sourceTeacher})
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {DAY_LABELS[target.day]} {target.period}교시
                      {candidate.targetCell && (
                        <span className="text-muted-foreground ml-1">
                          (
                          {subjectMap.get(candidate.targetCell.subjectId)
                            ?.abbreviation ??
                            candidate.targetCell.subjectId}{' '}
                          {teacherMap.get(candidate.targetCell.teacherId)
                            ?.name ?? candidate.targetCell.teacherId}
                          )
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge
                        variant={
                          candidate.type === 'SWAP' ? 'default' : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {candidate.type === 'SWAP' ? '교환' : '이동'}
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        'py-2 text-xs',
                        delta >= 0 ? 'text-green-600' : 'text-destructive',
                      )}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>
            종합 점수 변화:{' '}
            <span
              className={
                combinedRanking.combinedScoreDelta >= 0
                  ? 'text-green-600'
                  : 'text-destructive'
              }
            >
              {combinedRanking.combinedScoreDelta > 0 ? '+' : ''}
              {combinedRanking.combinedScoreDelta.toFixed(1)}
            </span>
          </span>
          <span>총 위반: {combinedRanking.totalViolationCount}건</span>
          <span>종합 랭킹: {combinedRanking.aggregateScore.toFixed(1)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
