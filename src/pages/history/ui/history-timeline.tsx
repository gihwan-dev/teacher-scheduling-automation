import { HistoryEventCard } from './history-event-card'
import type { ChangeEvent, WeekTag } from '@/entities/change-history'

interface HistoryTimelineProps {
  events: Array<ChangeEvent>
}

export function HistoryTimeline({ events }: HistoryTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        표시할 이력이 없습니다.
      </div>
    )
  }

  // weekTag별 그룹핑
  const grouped = new Map<WeekTag, Array<ChangeEvent>>()
  for (const event of events) {
    const existing = grouped.get(event.weekTag) ?? []
    existing.push(event)
    grouped.set(event.weekTag, existing)
  }

  // 주차 역순 정렬
  const sortedWeeks = [...grouped.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      {sortedWeeks.map((weekTag) => {
        const weekEvents = grouped.get(weekTag)!
        // 시간순 역정렬
        const sorted = [...weekEvents].sort((a, b) => b.timestamp - a.timestamp)

        return (
          <div key={weekTag} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{weekTag}</h3>
            <div className="space-y-2">
              {sorted.map((event) => (
                <HistoryEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
