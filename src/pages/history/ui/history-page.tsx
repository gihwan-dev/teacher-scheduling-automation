import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { HistoryFilterBar } from './history-filter-bar'
import { HistoryTimeline } from './history-timeline'
import type { TimetableCell, TimetableSnapshot } from '@/entities/timetable'
import type { WeekTag } from '@/shared/lib/week-tag'
import { useChangeHistoryStore } from '@/features/track-change-history'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { WeekVersionSelector } from '@/components/ui/week-version-selector'
import {
  loadSnapshotWeeks,
  loadSnapshotsByWeek,
  saveNextSnapshotVersion,
} from '@/shared/persistence/indexeddb/repository'
import {
  buildForwardWeekWindow,
  computeWeekTagFromTimestamp,
} from '@/shared/lib/week-tag'

export function HistoryPage() {
  const search = useSearch({ from: '/history' })
  const navigate = useNavigate({ from: '/history' })
  const { events, isLoading, loadEventsByWeek, appendVersionEvent } =
    useChangeHistoryStore()

  const [snapshotWeeks, setSnapshotWeeks] = useState<Array<WeekTag>>([])
  const [weekSnapshots, setWeekSnapshots] = useState<Array<TimetableSnapshot>>([])
  const [selectedActionType, setSelectedActionType] = useState('ALL')
  const [isApplying, setIsApplying] = useState(false)

  const currentWeekTag = computeWeekTagFromTimestamp(Date.now())
  const selectedWeek = search.week ?? snapshotWeeks.at(0) ?? currentWeekTag
  const selectedVersion = search.version ?? null

  const weekOptions = useMemo(() => {
    const weeks = new Set(buildForwardWeekWindow(currentWeekTag, 3))
    for (const week of snapshotWeeks) {
      weeks.add(week)
    }
    weeks.add(selectedWeek)
    return [...weeks]
      .sort((a, b) => a.localeCompare(b))
      .map((week) => ({ value: week, label: week }))
  }, [currentWeekTag, selectedWeek, snapshotWeeks])

  const versionOptions = useMemo(
    () =>
      [...weekSnapshots]
        .sort((a, b) => b.versionNo - a.versionNo)
        .map((snapshot) => ({
          value: snapshot.versionNo,
          label: `v${snapshot.versionNo}`,
        })),
    [weekSnapshots],
  )

  const latestSnapshot = weekSnapshots.at(-1) ?? null
  const selectedSnapshot =
    selectedVersion === null
      ? latestSnapshot
      : (weekSnapshots.find((snapshot) => snapshot.versionNo === selectedVersion) ??
        latestSnapshot)

  const refreshWeekData = useCallback(
    async (week: WeekTag) => {
      const [weeks, snapshots] = await Promise.all([
        loadSnapshotWeeks(),
        loadSnapshotsByWeek(week),
      ])
      setSnapshotWeeks(weeks)
      setWeekSnapshots(snapshots)
      await loadEventsByWeek(week)
    },
    [loadEventsByWeek],
  )

  useEffect(() => {
    void refreshWeekData(selectedWeek)
  }, [refreshWeekData, selectedWeek])

  useEffect(() => {
    if (!search.week) {
      navigate({
        search: () => ({
          week: selectedWeek,
        }),
        replace: true,
      })
      return
    }

    if (search.version && selectedSnapshot && search.version !== selectedSnapshot.versionNo) {
      navigate({
        search: () => ({
          week: selectedWeek,
          version: selectedSnapshot.versionNo,
        }),
        replace: true,
      })
    }
  }, [navigate, search.version, search.week, selectedSnapshot, selectedWeek])

  const handleWeekChange = (week: WeekTag) => {
    navigate({
      search: () => ({
        week,
      }),
      replace: true,
    })
  }

  const handleVersionChange = (version: number | null) => {
    navigate({
      search: () => ({
        week: selectedWeek,
        ...(version ? { version } : {}),
      }),
      replace: true,
    })
  }

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (selectedSnapshot && event.snapshotId !== selectedSnapshot.id) {
        return false
      }
      if (selectedActionType !== 'ALL' && event.actionType !== selectedActionType) {
        return false
      }
      return true
    })
  }, [events, selectedActionType, selectedSnapshot])

  const handleClone = async () => {
    if (!selectedSnapshot) return
    setIsApplying(true)
    try {
      const cloned = await saveNextSnapshotVersion({
        sourceSnapshot: selectedSnapshot,
        cells: selectedSnapshot.cells,
      })
      await appendVersionEvent({
        snapshotId: cloned.id,
        weekTag: selectedWeek,
        actionType: 'VERSION_CLONE',
        beforePayload: createSnapshotSummary(selectedSnapshot),
        afterPayload: createSnapshotSummary(cloned),
        impactSummary: `clone v${selectedSnapshot.versionNo} -> v${cloned.versionNo}`,
      })
      await refreshWeekData(selectedWeek)
      toast.success(`버전 v${cloned.versionNo}을(를) 생성했습니다.`)
      navigate({
        search: () => ({
          week: selectedWeek,
          version: cloned.versionNo,
        }),
        replace: true,
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleRestore = async () => {
    if (!selectedSnapshot || !latestSnapshot) return
    setIsApplying(true)
    try {
      const restored = await saveNextSnapshotVersion({
        sourceSnapshot: selectedSnapshot,
        cells: selectedSnapshot.cells,
      })
      const changedSlots = countChangedSlots(latestSnapshot.cells, selectedSnapshot.cells)
      await appendVersionEvent({
        snapshotId: restored.id,
        weekTag: selectedWeek,
        actionType: 'VERSION_RESTORE',
        beforePayload: createSnapshotSummary(latestSnapshot),
        afterPayload: createSnapshotSummary(restored),
        impactSummary: `restore v${selectedSnapshot.versionNo} -> v${restored.versionNo} (changed ${changedSlots} slots)`,
      })
      await refreshWeekData(selectedWeek)
      toast.success(`버전 v${restored.versionNo}으로 복원했습니다.`)
      navigate({
        search: () => ({
          week: selectedWeek,
          version: restored.versionNo,
        }),
        replace: true,
      })
    } finally {
      setIsApplying(false)
    }
  }

  if (isLoading) {
    return <LoadingState message="이력 불러오는 중..." />
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">변경 이력</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <WeekVersionSelector
            weekOptions={weekOptions}
            selectedWeek={selectedWeek}
            onWeekChange={handleWeekChange}
            versionOptions={versionOptions}
            selectedVersion={selectedVersion}
            onVersionChange={handleVersionChange}
            disabled={isApplying}
          />
          <Button
            variant="outline"
            onClick={handleClone}
            disabled={selectedSnapshot === null || isApplying}
          >
            복제
          </Button>
          <Button
            onClick={handleRestore}
            disabled={selectedSnapshot === null || latestSnapshot === null || isApplying}
          >
            복원
          </Button>
        </div>
      </div>

      {!selectedSnapshot ? (
        <EmptyState
          title="선택한 주차의 스냅샷이 없습니다"
          description="생성 페이지에서 해당 주차를 선택해 첫 버전(v1)을 생성해주세요."
          actionLabel="생성 페이지로 이동"
          actionTo="/generate"
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-lg">
                이력 타임라인 (v{selectedSnapshot.versionNo})
              </CardTitle>
              <HistoryFilterBar
                selectedActionType={selectedActionType}
                onActionTypeChange={setSelectedActionType}
              />
            </div>
          </CardHeader>
          <CardContent>
            <HistoryTimeline events={filteredEvents} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function createSnapshotSummary(snapshot: TimetableSnapshot): {
  snapshotId: string
  versionNo: number
  cellCount: number
  baseVersionId: string | null
} {
  return {
    snapshotId: snapshot.id,
    versionNo: snapshot.versionNo,
    cellCount: snapshot.cells.length,
    baseVersionId: snapshot.baseVersionId,
  }
}

function countChangedSlots(
  beforeCells: Array<TimetableCell>,
  afterCells: Array<TimetableCell>,
): number {
  const beforeMap = new Map(beforeCells.map((cell) => [slotKey(cell), slotValue(cell)]))
  const afterMap = new Map(afterCells.map((cell) => [slotKey(cell), slotValue(cell)]))
  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()])

  let changed = 0
  for (const key of allKeys) {
    if (beforeMap.get(key) !== afterMap.get(key)) {
      changed += 1
    }
  }
  return changed
}

function slotKey(cell: TimetableCell): string {
  return `${cell.grade}-${cell.classNumber}-${cell.day}-${cell.period}`
}

function slotValue(cell: TimetableCell): string {
  return `${cell.teacherId}-${cell.subjectId}-${cell.status}-${cell.isFixed ? '1' : '0'}`
}
