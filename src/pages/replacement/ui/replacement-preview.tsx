import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import { useReplacementStore } from '@/features/find-replacement'
import { parseCellKey } from '@/features/edit-timetable-cell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DAY_LABELS } from '@/shared/lib/constants'

interface ReplacementPreviewProps {
  teachers: Array<Teacher>
  subjects: Array<Subject>
}

export function ReplacementPreview({
  teachers,
  subjects,
}: ReplacementPreviewProps) {
  const { selectedCandidate } = useReplacementStore()

  if (!selectedCandidate) return null

  const teacherMap = new Map(teachers.map((t) => [t.id, t]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  const source = parseCellKey(selectedCandidate.sourceCellKey)
  const target = parseCellKey(selectedCandidate.targetCellKey)

  const {
    sourceCell,
    targetCell,
    resultSourceCell,
    resultTargetCell,
    ranking,
  } = selectedCandidate

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">변경 미리보기</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                  위치
                </th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                  변경 전
                </th>
                <th className="text-left py-2 font-medium text-muted-foreground">
                  변경 후
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 pr-4 text-muted-foreground">
                  {DAY_LABELS[source.day]} {source.period}교시
                </td>
                <td className="py-2 pr-4">
                  {subjectMap.get(sourceCell.subjectId)?.abbreviation ??
                    sourceCell.subjectId}{' '}
                  <span className="text-muted-foreground">
                    (
                    {teacherMap.get(sourceCell.teacherId)?.name ??
                      sourceCell.teacherId}
                    )
                  </span>
                </td>
                <td className="py-2">
                  {resultSourceCell ? (
                    <>
                      {subjectMap.get(resultSourceCell.subjectId)
                        ?.abbreviation ?? resultSourceCell.subjectId}{' '}
                      <span className="text-muted-foreground">
                        (
                        {teacherMap.get(resultSourceCell.teacherId)?.name ??
                          resultSourceCell.teacherId}
                        )
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">빈 교시</span>
                  )}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 text-muted-foreground">
                  {DAY_LABELS[target.day]} {target.period}교시
                </td>
                <td className="py-2 pr-4">
                  {targetCell ? (
                    <>
                      {subjectMap.get(targetCell.subjectId)?.abbreviation ??
                        targetCell.subjectId}{' '}
                      <span className="text-muted-foreground">
                        (
                        {teacherMap.get(targetCell.teacherId)?.name ??
                          targetCell.teacherId}
                        )
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">빈 교시</span>
                  )}
                </td>
                <td className="py-2">
                  {subjectMap.get(resultTargetCell.subjectId)?.abbreviation ??
                    resultTargetCell.subjectId}{' '}
                  <span className="text-muted-foreground">
                    (
                    {teacherMap.get(resultTargetCell.teacherId)?.name ??
                      resultTargetCell.teacherId}
                    )
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 점수 변화 요약 */}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>
            점수 변화:{' '}
            <span
              className={
                ranking.scoreDelta >= 0 ? 'text-green-600' : 'text-destructive'
              }
            >
              {ranking.scoreDelta > 0 ? '+' : ''}
              {ranking.scoreDelta.toFixed(1)}
            </span>
          </span>
          <span>위반: {ranking.violationCount}건</span>
          <span>유사도: {ranking.similarityScore}%</span>
        </div>
      </CardContent>
    </Card>
  )
}
