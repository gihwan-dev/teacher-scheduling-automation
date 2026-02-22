import { useState } from 'react'
import { toast } from 'sonner'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { ReplacementCandidate } from '@/features/find-replacement'
import { useReplacementStore } from '@/features/find-replacement'
import { resolveReplacementScopeTargetWeeks } from '@/features/find-replacement/lib/apply-replacement-scope'
import { parseCellKey } from '@/features/edit-timetable-cell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ValidationViolationList } from '@/components/ui/validation-violation-list'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DAY_LABELS } from '@/shared/lib/constants'
import { cn } from '@/lib/utils'

interface CandidateListPanelProps {
  teachers: Array<Teacher>
  subjects: Array<Subject>
}

export function CandidateListPanel({
  teachers,
  subjects,
}: CandidateListPanelProps) {
  const {
    searchResult,
    selectedCandidate,
    impactReport,
    impactReportLoading,
    isApplyingScope,
    snapshot,
    applyScope,
    academicCalendarEvents,
    scopeValidationSummary,
    selectCandidate,
    confirmReplacement,
  } = useReplacementStore()
  const [isConfirming, setIsConfirming] = useState(false)

  const teacherMap = new Map(teachers.map((t) => [t.id, t]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  if (!searchResult) return null

  const { candidates, stats } = searchResult
  const resolvedScope =
    snapshot === null
      ? null
      : resolveReplacementScopeTargetWeeks({
          selectedWeek: snapshot.weekTag,
          scopeState: applyScope,
          academicCalendarEvents,
        })
  const targetWeeksCount = resolvedScope?.targetWeeks.length ?? 0

  const handleConfirm = async () => {
    setIsConfirming(true)
    const success = await confirmReplacement()
    setIsConfirming(false)
    if (success) {
      toast.success(`교체를 ${targetWeeksCount}개 주차에 적용했습니다`)
      return
    }
    toast.error('범위 적용이 차단되었습니다. 적용 범위 섹션을 확인해 주세요.')
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          후보 목록
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            {stats.validCandidates}건 / {stats.totalExamined}건 검사 (
            {stats.searchTimeMs}ms)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            교체 가능한 후보가 없습니다.
          </p>
        ) : (
          <>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {candidates.map((candidate, index) => (
                <CandidateRow
                  key={candidate.id}
                  candidate={candidate}
                  rank={index + 1}
                  isSelected={selectedCandidate?.id === candidate.id}
                  teacherMap={teacherMap}
                  subjectMap={subjectMap}
                  onSelect={() => selectCandidate(candidate)}
                />
              ))}
            </div>

            {selectedCandidate && impactReportLoading && (
              <p className="text-xs text-muted-foreground mt-3">
                영향 분석 리포트 생성 중...
              </p>
            )}

            {selectedCandidate && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      className="w-full mt-3"
                      disabled={
                        isConfirming ||
                        isApplyingScope ||
                        impactReportLoading ||
                        impactReport === null ||
                        !!resolvedScope?.issue
                      }
                    />
                  }
                >
                  교체 확정
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      교체를 확정하시겠습니까?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      선택한 후보를 범위에 맞게 교체합니다.
                      <span className="block mt-1">
                        적용 범위: <strong>{toScopeLabel(applyScope.type)}</strong> (
                        {targetWeeksCount}개 주차)
                      </span>
                      {resolvedScope?.issue && (
                        <span className="block mt-1 text-destructive">
                          {resolvedScope.issue.message}
                        </span>
                      )}
                      {impactReport && (
                        <span className="block mt-2">
                          영향 리스크: <strong>{impactReport.riskLevel}</strong>
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm}>
                      확정
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {scopeValidationSummary.status === 'BLOCKED' && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <p className="text-xs font-medium text-destructive">
                  범위 적용 차단 ({scopeValidationSummary.issues.length}개 주차)
                </p>
                {scopeValidationSummary.issues.map((issue, index) => (
                  <div key={`${issue.weekTag}-${index}`} className="space-y-2">
                    <p className="text-xs">
                      <span className="font-medium">{issue.weekTag}</span>
                      <span className="text-muted-foreground"> - {issue.message}</span>
                    </p>
                    {issue.violations.length > 0 && (
                      <ValidationViolationList violations={issue.violations} />
                    )}
                    {issue.alternatives.length > 0 && (
                      <ul className="space-y-1">
                        {issue.alternatives.map((alternative) => (
                          <li
                            key={`${issue.weekTag}-${alternative.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            {alternative.label} · {alternative.riskLevel} · 점수{' '}
                            {alternative.scoreDelta > 0 ? '+' : ''}
                            {alternative.scoreDelta.toFixed(1)} · 위반{' '}
                            {alternative.violationCount}건
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function toScopeLabel(type: 'THIS_WEEK' | 'FROM_NEXT_WEEK' | 'RANGE'): string {
  if (type === 'THIS_WEEK') {
    return '이번 주만'
  }
  if (type === 'FROM_NEXT_WEEK') {
    return '다음 주부터 학기말'
  }
  return '특정 주차 범위'
}

function CandidateRow({
  candidate,
  rank,
  isSelected,
  teacherMap,
  subjectMap,
  onSelect,
}: {
  candidate: ReplacementCandidate
  rank: number
  isSelected: boolean
  teacherMap: Map<string, Teacher>
  subjectMap: Map<string, Subject>
  onSelect: () => void
}) {
  const target = parseCellKey(candidate.targetCellKey)
  const targetTeacher = candidate.targetCell
    ? (teacherMap.get(candidate.targetCell.teacherId)?.name ??
      candidate.targetCell.teacherId)
    : null
  const targetSubject = candidate.targetCell
    ? (subjectMap.get(candidate.targetCell.subjectId)?.abbreviation ??
      candidate.targetCell.subjectId)
    : null

  const scoreDelta = candidate.ranking.scoreDelta
  const scoreDeltaLabel =
    scoreDelta > 0 ? `+${scoreDelta.toFixed(1)}` : scoreDelta.toFixed(1)

  return (
    <button
      className={cn(
        'w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
        isSelected ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/50',
      )}
      onClick={onSelect}
    >
      <span className="text-xs text-muted-foreground w-5 shrink-0">{rank}</span>
      <Badge
        variant={candidate.type === 'SWAP' ? 'default' : 'secondary'}
        className="shrink-0 text-[10px]"
      >
        {candidate.type === 'SWAP'
          ? '교환'
          : candidate.type === 'SUBSTITUTE'
            ? '대강'
            : '이동'}
      </Badge>
      <span className="flex-1 truncate">
        {DAY_LABELS[target.day]} {target.period}교시
        {targetTeacher && targetSubject && (
          <span className="text-muted-foreground">
            {' '}
            ({targetSubject} {targetTeacher})
          </span>
        )}
      </span>
      <span
        className={cn(
          'text-xs shrink-0',
          scoreDelta >= 0 ? 'text-green-600' : 'text-destructive',
        )}
      >
        {scoreDeltaLabel}
      </span>
      {candidate.ranking.violationCount > 0 && (
        <Badge variant="destructive" className="text-[10px] shrink-0">
          {candidate.ranking.violationCount}
        </Badge>
      )}
      {candidate.ranking.candidateReasons.length > 0 && (
        <span className="text-[10px] text-muted-foreground ml-1">
          {candidate.ranking.candidateReasons.join(' · ')}
        </span>
      )}
    </button>
  )
}
