import { useEffect, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { ReplacementGrid } from './replacement-grid'
import { CandidateListPanel } from './candidate-list-panel'
import { ReplacementPreview } from './replacement-preview'
import { RelaxationPanel } from './relaxation-panel'
import { MultiCandidateListPanel } from './multi-candidate-list-panel'
import { MultiReplacementPreview } from './multi-replacement-preview'
import { ImpactAnalysisPanel } from './impact-analysis-panel'
import type { WeekTag } from '@/shared/lib/week-tag'
import { useReplacementStore } from '@/features/find-replacement'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { WeekVersionSelector } from '@/components/ui/week-version-selector'
import {
  buildForwardWeekWindow,
  computeWeekTagFromTimestamp,
} from '@/shared/lib/week-tag'

export function ReplacementPage() {
  const search = useSearch({ from: '/replacement' })
  const navigate = useNavigate({ from: '/replacement' })
  const {
    snapshot,
    availableWeekTags,
    availableVersionNos,
    schoolConfig,
    teachers,
    subjects,
    targetCellKey,
    viewGrade,
    viewClassNumber,
    isLoading,
    isSearching,
    isMultiMode,
    multiTargetCellKeys,
    loadSnapshot,
    setViewTarget,
    search: searchCandidates,
    searchMulti,
    toggleMultiMode,
  } = useReplacementStore()

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

  const versionOptions = useMemo(
    () =>
      [...availableVersionNos]
        .sort((a, b) => b - a)
        .map((versionNo) => ({
          value: versionNo,
          label: `v${versionNo}`,
        })),
    [availableVersionNos],
  )

  const selectedWeek = search.week ?? snapshot?.weekTag ?? null
  const selectedVersion = search.version ?? null

  useEffect(() => {
    loadSnapshot({
      weekTag: search.week,
      versionNo: search.version,
    })
  }, [loadSnapshot, search.version, search.week])

  useEffect(() => {
    if (!snapshot) return
    if (!search.week) {
      navigate({
        search: () => ({
          week: snapshot.weekTag,
        }),
        replace: true,
      })
      return
    }
    if (search.version && search.version !== snapshot.versionNo) {
      navigate({
        search: () => ({
          week: snapshot.weekTag,
          version: snapshot.versionNo,
        }),
        replace: true,
      })
    }
  }, [navigate, search.version, search.week, snapshot])

  const handleWeekChange = (week: WeekTag) => {
    navigate({
      search: () => ({
        week,
      }),
      replace: true,
    })
  }

  const handleVersionChange = (version: number | null) => {
    const week = selectedWeek ?? search.week
    if (!week) return
    navigate({
      search: () => ({
        week,
        ...(version ? { version } : {}),
      }),
      replace: true,
    })
  }

  if (isLoading) {
    return <LoadingState />
  }

  if (!snapshot) {
    return (
      <EmptyState
        title="시간표가 없습니다"
        description="먼저 시간표를 생성하세요. 생성 페이지에서 시간표를 생성한 후 저장하면 교체 탐색을 할 수 있습니다."
        actionLabel="생성 페이지로 이동"
        actionTo="/generate"
      />
    )
  }

  if (!schoolConfig) {
    return (
      <EmptyState
        title="설정 데이터가 없습니다"
        description="학교 설정 데이터가 없습니다. 설정 페이지에서 먼저 입력해주세요."
        actionLabel="설정 페이지로 이동"
        actionTo="/setup"
      />
    )
  }

  const classCount = schoolConfig.classCountByGrade[viewGrade] ?? 0
  const gradeOptions = Array.from(
    { length: schoolConfig.gradeCount },
    (_, i) => {
      const grade = i + 1
      return { value: String(grade), label: `${grade}학년` }
    },
  )
  const classOptions = Array.from({ length: classCount }, (_, i) => {
    const classNumber = i + 1
    return { value: String(classNumber), label: `${classNumber}반` }
  })

  const canSearch = isMultiMode
    ? multiTargetCellKeys.length >= 2
    : !!targetCellKey

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">교체 후보 탐색</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isMultiMode
            ? '교체할 셀을 2~3개 선택한 후 탐색 버튼을 눌러 호환되는 교체 조합을 확인하세요.'
            : '교체할 셀을 선택한 후 탐색 버튼을 눌러 안전한 교체 후보를 확인하세요.'}
        </p>
      </div>

      {/* 컨트롤바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <WeekVersionSelector
          weekOptions={weekOptions}
          selectedWeek={selectedWeek}
          onWeekChange={handleWeekChange}
          versionOptions={versionOptions}
          selectedVersion={selectedVersion}
          onVersionChange={handleVersionChange}
          disabled={isSearching}
        />

        <Select
          items={gradeOptions}
          value={String(viewGrade)}
          onValueChange={(val) => setViewTarget(Number(val), 1)}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {gradeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={classOptions}
          value={String(viewClassNumber)}
          onValueChange={(val) => setViewTarget(viewGrade, Number(val))}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={isMultiMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleMultiMode}
        >
          {isMultiMode ? '다중 모드' : '단일 모드'}
          {isMultiMode && multiTargetCellKeys.length > 0 && (
            <Badge variant="secondary" className="ml-1.5">
              {multiTargetCellKeys.length}
            </Badge>
          )}
        </Button>

        <Button
          onClick={isMultiMode ? searchMulti : searchCandidates}
          disabled={!canSearch || isSearching}
        >
          {isSearching ? (
            <>
              <Spinner size="sm" />
              탐색 중...
            </>
          ) : (
            <>
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
              탐색
            </>
          )}
        </Button>
      </div>

      {/* 2컬럼 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <ReplacementGrid
          schoolConfig={schoolConfig}
          teachers={teachers}
          subjects={subjects}
        />
        {isMultiMode ? (
          <MultiCandidateListPanel teachers={teachers} subjects={subjects} />
        ) : (
          <CandidateListPanel teachers={teachers} subjects={subjects} />
        )}
      </div>

      {/* 미리보기 */}
      {isMultiMode ? (
        <MultiReplacementPreview teachers={teachers} subjects={subjects} />
      ) : (
        <ReplacementPreview teachers={teachers} subjects={subjects} />
      )}

      {/* 영향 분석 */}
      <ImpactAnalysisPanel />

      {/* 완화 제안 (단일 모드 전용) */}
      {!isMultiMode && <RelaxationPanel />}
    </div>
  )
}
