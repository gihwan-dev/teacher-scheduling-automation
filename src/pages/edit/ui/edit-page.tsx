import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { EditableTimetableGrid } from './editable-timetable-grid'
import { EditToolbar } from './edit-toolbar'
import { EditValidationPanel } from './edit-validation-panel'
import { KeyboardShortcutsPanel } from './keyboard-shortcuts-panel'
import type { WeekTag } from '@/shared/lib/week-tag'
import { StatusLegend } from '@/entities/timetable'
import { useEditStore } from '@/features/edit-timetable-cell'
import { WeekVersionSelector } from '@/components/ui/week-version-selector'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useUnsavedWarning } from '@/shared/lib/hooks/use-unsaved-warning'
import { Button } from '@/components/ui/button'
import { loadAcademicCalendarEventsByRange } from '@/shared/persistence/indexeddb/repository'
import {
  buildForwardWeekWindow,
  computeWeekTagFromTimestamp,
  getWeekDateRange,
} from '@/shared/lib/week-tag'

export function EditPage() {
  const search = useSearch({ from: '/edit' })
  const navigate = useNavigate({ from: '/edit' })
  const {
    snapshot,
    availableWeekTags,
    availableVersionNos,
    schoolConfig,
    teachers,
    subjects,
    violations,
    viewGrade,
    viewClassNumber,
    isDirty,
    isLoading,
    loadSnapshot,
    setViewTarget,
  } = useEditStore()
  const [isExamWeek, setIsExamWeek] = useState(false)

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
        search: (prev) => ({
          ...prev,
          week: snapshot.weekTag,
        }),
        replace: true,
      })
      return
    }
    if (search.version && search.version !== snapshot.versionNo) {
      navigate({
        search: (prev) => ({
          ...prev,
          week: snapshot.weekTag,
          version: snapshot.versionNo,
        }),
        replace: true,
      })
    }
  }, [navigate, search.version, search.week, snapshot])

  useEffect(() => {
    if (!snapshot || !schoolConfig) {
      setIsExamWeek(false)
      return
    }

    void (async () => {
      const { startDate, endDate } = getWeekDateRange(
        snapshot.weekTag,
        schoolConfig.activeDays,
      )
      const events = await loadAcademicCalendarEventsByRange(startDate, endDate)
      setIsExamWeek(events.some((event) => event.eventType === 'EXAM_PERIOD'))
    })()
  }, [schoolConfig, snapshot])

  useUnsavedWarning(isDirty)

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
        description="먼저 시간표를 생성하세요. 생성 페이지에서 시간표를 생성한 후 저장하면 편집할 수 있습니다."
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

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">시간표 편집</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <WeekVersionSelector
            weekOptions={weekOptions}
            selectedWeek={selectedWeek}
            onWeekChange={handleWeekChange}
            versionOptions={versionOptions}
            selectedVersion={selectedVersion}
            onVersionChange={handleVersionChange}
            disabled={isLoading}
          />
          <EditToolbar />
        </div>
      </div>

      {isExamWeek && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">
            시험주차 감지: 일반 수업 편집은 HC-04 규칙으로 차단됩니다.
          </p>
          <p className="text-muted-foreground mt-1">
            시험 시간표/감독 배정은 `시험` 페이지에서 진행해 주세요.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() =>
              navigate({
                to: '/exam',
                search: () => ({ week: snapshot.weekTag }),
              })
            }
          >
            시험 페이지로 이동
          </Button>
        </div>
      )}

      {/* 학년/반 선택 + 단축키 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
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
        </div>
        <KeyboardShortcutsPanel />
      </div>

      {/* 상태 범례 */}
      <StatusLegend />

      {/* 편집 가능 그리드 */}
      <EditableTimetableGrid
        schoolConfig={schoolConfig}
        teachers={teachers}
        subjects={subjects}
      />

      {/* 검증 결과 */}
      <EditValidationPanel violations={violations} />
    </div>
  )
}
