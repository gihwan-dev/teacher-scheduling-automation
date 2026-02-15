import { useEffect, useMemo, useState } from 'react'
import { HistoryFilterBar } from './history-filter-bar'
import { HistoryTimeline } from './history-timeline'
import { useChangeHistoryStore } from '@/features/track-change-history'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { loadLatestTimetableSnapshot } from '@/shared/persistence/indexeddb/repository'

export function HistoryPage() {
  const { events, isLoading, loadEvents } = useChangeHistoryStore()
  const [snapshotId, setSnapshotId] = useState<string | null>(null)
  const [selectedWeekTag, setSelectedWeekTag] = useState('ALL')
  const [selectedActionType, setSelectedActionType] = useState('ALL')

  useEffect(() => {
    loadLatestTimetableSnapshot().then((snapshot) => {
      if (snapshot) {
        setSnapshotId(snapshot.id)
        loadEvents(snapshot.id)
      }
    })
  }, [loadEvents])

  // 고유 weekTag 목록 추출
  const weekTags = useMemo(() => {
    const tags = new Set(events.map((e) => e.weekTag))
    return [...tags].sort((a, b) => b.localeCompare(a))
  }, [events])

  // 필터 적용
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedWeekTag !== 'ALL' && e.weekTag !== selectedWeekTag)
        return false
      if (selectedActionType !== 'ALL' && e.actionType !== selectedActionType)
        return false
      return true
    })
  }, [events, selectedWeekTag, selectedActionType])

  if (isLoading) {
    return <LoadingState message="이력 불러오는 중..." />
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">변경 이력</h1>

      {!snapshotId ? (
        <EmptyState
          title="시간표 스냅샷이 없습니다"
          description="먼저 시간표를 생성하세요."
          actionLabel="생성 페이지로 이동"
          actionTo="/generate"
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-lg">이력 타임라인</CardTitle>
              <HistoryFilterBar
                weekTags={weekTags}
                selectedWeekTag={selectedWeekTag}
                selectedActionType={selectedActionType}
                onWeekTagChange={setSelectedWeekTag}
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
