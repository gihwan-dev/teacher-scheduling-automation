import { useEffect, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlayIcon } from '@hugeicons/core-free-icons'
import { ConstraintConfigForm } from './constraint-config-form'
import { GenerationResultPanel } from './generation-result-panel'
import { TimetableView } from './timetable-view'
import type { WeekTag } from '@/shared/lib/week-tag'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { WeekVersionSelector } from '@/components/ui/week-version-selector'
import { useGenerateStore } from '@/features/generate-timetable/model/store'
import {
  buildForwardWeekWindow,
  computeWeekTagFromTimestamp,
} from '@/shared/lib/week-tag'

export function GeneratePage() {
  const search = useSearch({ from: '/generate' })
  const navigate = useNavigate({ from: '/generate' })
  const {
    schoolConfig,
    teachers,
    subjects,
    fixedEvents,
    targetWeekTag,
    availableWeekTags,
    result,
    isGenerating,
    isLoading,
    setupLoaded,
    loadSetupData,
    setTargetWeekTag,
    generate,
  } = useGenerateStore()

  const weekOptions = useMemo(() => {
    const currentWeekTag = computeWeekTagFromTimestamp(Date.now())
    const weeks = new Set(buildForwardWeekWindow(currentWeekTag, 3))
    for (const week of availableWeekTags) {
      weeks.add(week)
    }
    if (search.week) {
      weeks.add(search.week)
    }
    return [...weeks]
      .sort((a, b) => a.localeCompare(b))
      .map((week) => ({ value: week, label: week }))
  }, [availableWeekTags, search.week])

  useEffect(() => {
    loadSetupData()
  }, [loadSetupData])

  useEffect(() => {
    if (!search.week) return
    if (search.week === targetWeekTag) return
    setTargetWeekTag(search.week)
  }, [search.week, setTargetWeekTag, targetWeekTag])

  useEffect(() => {
    if (search.week) return
    navigate({
      search: () => ({
        week: targetWeekTag,
      }),
      replace: true,
    })
  }, [navigate, search.week, targetWeekTag])

  const handleGenerate = async () => {
    await generate()
    toast.success(`${targetWeekTag} 시간표 생성이 완료되었습니다`)
  }

  const handleWeekChange = (week: WeekTag) => {
    setTargetWeekTag(week)
    navigate({
      search: (prev) => ({
        ...prev,
        week,
      }),
      replace: true,
    })
  }

  if (isLoading || !setupLoaded) {
    return <LoadingState />
  }

  if (!schoolConfig) {
    return (
      <EmptyState
        title="설정 데이터가 없습니다"
        description="설정 페이지에서 학교 구조를 먼저 입력해주세요."
        actionLabel="설정 페이지로 이동"
        actionTo="/setup"
      />
    )
  }

  const totalClasses = Object.values(schoolConfig.classCountByGrade).reduce(
    (s, c) => s + c,
    0,
  )
  const multiSubjectTeachers = teachers.filter((t) => t.subjectIds.length > 1)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">시간표 생성</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            설정 데이터를 기반으로 선택 주차의 시간표를 생성합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WeekVersionSelector
            weekOptions={weekOptions}
            selectedWeek={targetWeekTag}
            onWeekChange={handleWeekChange}
            versionOptions={[]}
            disabled={isGenerating}
          />
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Spinner size="sm" />
                생성 중...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={PlayIcon} strokeWidth={2} />
                생성
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 설정 요약 */}
      <Card>
        <CardHeader>
          <CardTitle>설정 데이터 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="text-center">
              <p className="text-muted-foreground text-xs">학년</p>
              <p className="text-lg font-semibold">{schoolConfig.gradeCount}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">총 반 수</p>
              <p className="text-lg font-semibold">{totalClasses}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">교사</p>
              <p className="text-lg font-semibold">{teachers.length}명</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">과목</p>
              <p className="text-lg font-semibold">{subjects.length}개</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">고정 이벤트</p>
              <p className="text-lg font-semibold">{fixedEvents.length}건</p>
            </div>
          </div>
          {multiSubjectTeachers.length > 0 && (
            <div className="mt-3">
              <Badge variant="secondary">
                다과목 교사 {multiSubjectTeachers.length}명 (첫 번째 과목으로
                배정)
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 제약 설정 */}
      <ConstraintConfigForm />

      {/* 생성 결과 */}
      {result && <GenerationResultPanel result={result} />}

      {/* 시간표 뷰 */}
      {result?.snapshot && (
        <TimetableView
          cells={result.snapshot.cells}
          schoolConfig={schoolConfig}
          teachers={teachers}
          subjects={subjects}
        />
      )}
    </div>
  )
}
