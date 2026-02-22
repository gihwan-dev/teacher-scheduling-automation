import type { ChangeEvent } from '@/entities/change-history'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ACTION_CONFIG: Record<
  string,
  {
    label: string
    icon: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
  }
> = {
  EDIT: { label: '편집', icon: '✏️', variant: 'default' },
  CLEAR: { label: '삭제', icon: '🗑️', variant: 'destructive' },
  LOCK: { label: '잠금', icon: '🔒', variant: 'secondary' },
  UNLOCK: { label: '잠금 해제', icon: '🔓', variant: 'secondary' },
  MOVE: { label: '이동', icon: '↔️', variant: 'outline' },
  CONFIRM: { label: '확정', icon: '✓', variant: 'default' },
  RECOMPUTE: { label: '재계산', icon: '🔄', variant: 'outline' },
  VERSION_CLONE: { label: '버전 복제', icon: '🧾', variant: 'secondary' },
  VERSION_RESTORE: { label: '버전 복원', icon: '⟲', variant: 'default' },
  TRANSACTION_COMMIT: {
    label: '트랜잭션 확정',
    icon: '✔',
    variant: 'default',
  },
  TRANSACTION_ROLLBACK: {
    label: '트랜잭션 롤백',
    icon: '↺',
    variant: 'destructive',
  },
}

interface HistoryEventCardProps {
  event: ChangeEvent
}

export function HistoryEventCard({ event }: HistoryEventCardProps) {
  const config = ACTION_CONFIG[event.actionType] ?? {
    label: event.actionType,
    icon: '?',
    variant: 'outline' as const,
  }
  const time = new Date(event.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3',
        event.isUndone && 'opacity-50',
      )}
    >
      <span className="text-lg" aria-hidden="true">
        {config.icon}
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={config.variant} className="text-[10px]">
            {config.label}
          </Badge>
          {event.cellKey.length > 0 && (
            <span className="text-xs text-muted-foreground font-mono">
              {event.cellKey}
            </span>
          )}
          {event.isUndone && (
            <Badge variant="outline" className="text-[10px]">
              취소됨
            </Badge>
          )}
          {event.conflictDetected && (
            <Badge variant="destructive" className="text-[10px]">
              충돌
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>{time}</span>
          {event.before && (
            <span>
              이전: {event.before.subjectId} / {event.before.teacherId}
            </span>
          )}
          {event.after && (
            <span>
              이후: {event.after.subjectId} / {event.after.teacherId}
            </span>
          )}
        </div>
        {(event.impactSummary || event.rollbackRef) && (
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {event.impactSummary && <p>{event.impactSummary}</p>}
            {event.rollbackRef && (
              <p className="font-mono text-[10px]">rollbackRef: {event.rollbackRef}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
