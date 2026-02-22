import { useMemo } from 'react'
import type { WeekTag } from '@/shared/lib/week-tag'
import { useReplacementStore } from '@/features/find-replacement'
import { resolveReplacementScopeTargetWeeks } from '@/features/find-replacement/lib/apply-replacement-scope'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ValidationViolationList } from '@/components/ui/validation-violation-list'

interface ReplacementScopePanelProps {
  weekOptions: Array<{ value: WeekTag; label: string }>
}

const SCOPE_OPTIONS = [
  {
    value: 'THIS_WEEK' as const,
    label: '이번 주만',
  },
  {
    value: 'FROM_NEXT_WEEK' as const,
    label: '다음 주부터 학기말',
  },
  {
    value: 'RANGE' as const,
    label: '특정 주차 범위',
  },
]

export function ReplacementScopePanel({ weekOptions }: ReplacementScopePanelProps) {
  const {
    snapshot,
    applyScope,
    academicCalendarEvents,
    isApplyingScope,
    scopeValidationSummary,
    setApplyScopeType,
    setApplyScopeRange,
  } = useReplacementStore()

  const resolvedScope = useMemo(() => {
    if (!snapshot) {
      return null
    }
    return resolveReplacementScopeTargetWeeks({
      selectedWeek: snapshot.weekTag,
      scopeState: applyScope,
      academicCalendarEvents,
    })
  }, [academicCalendarEvents, applyScope, snapshot])

  if (!snapshot) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">적용 범위</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {SCOPE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={applyScope.type === option.value ? 'default' : 'outline'}
              onClick={() => setApplyScopeType(option.value)}
              disabled={isApplyingScope}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {applyScope.type === 'RANGE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Select
              items={weekOptions}
              value={applyScope.fromWeek ?? undefined}
              onValueChange={(value) => {
                if (!value) return
                setApplyScopeRange({ fromWeek: value })
              }}
            >
              <SelectTrigger disabled={isApplyingScope}>
                <SelectValue placeholder="시작 주차" />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((option) => (
                  <SelectItem key={`from-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              items={weekOptions}
              value={applyScope.toWeek ?? undefined}
              onValueChange={(value) => {
                if (!value) return
                setApplyScopeRange({ toWeek: value })
              }}
            >
              <SelectTrigger disabled={isApplyingScope}>
                <SelectValue placeholder="종료 주차" />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((option) => (
                  <SelectItem key={`to-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {resolvedScope && (
          <div className="rounded-md border p-3 space-y-2">
            {resolvedScope.issue ? (
              <p className="text-sm text-destructive">{resolvedScope.issue.message}</p>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-muted-foreground">대상 주차</span>
                  <Badge variant="secondary">{resolvedScope.targetWeeks.length}개</Badge>
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  {resolvedScope.targetWeeks.join(', ')}
                </p>
              </>
            )}
          </div>
        )}

        {scopeValidationSummary.status === 'APPLIED' && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
            범위 적용 완료: {scopeValidationSummary.targetWeeks.length}개 주차에 반영했습니다.
          </div>
        )}

        {scopeValidationSummary.status === 'BLOCKED' && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
            <p className="text-sm font-medium text-destructive">범위 적용이 차단되었습니다.</p>
            {scopeValidationSummary.issues.map((issue, index) => (
              <div key={`${issue.weekTag}-${index}`} className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">{issue.weekTag}</span>
                  <span className="text-muted-foreground"> - {issue.message}</span>
                </p>
                {issue.violations.length > 0 && (
                  <ValidationViolationList violations={issue.violations} />
                )}
                {issue.alternatives.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">대안 후보</p>
                    <ul className="space-y-1">
                      {issue.alternatives.map((alternative) => (
                        <li
                          key={`${issue.weekTag}-${alternative.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          {alternative.label} · {alternative.riskLevel} · 점수{' '}
                          {alternative.scoreDelta > 0 ? '+' : ''}
                          {alternative.scoreDelta.toFixed(1)} · 위반 {alternative.violationCount}건
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
