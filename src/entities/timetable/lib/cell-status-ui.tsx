import { getCellStatusStyle } from './cell-status'
import type { TimetableCell } from '../model/types'

export function StatusIndicator({ cell }: { cell: TimetableCell }) {
  const style = getCellStatusStyle(cell)
  if (!style.icon) return null

  return (
    <span className={`text-[9px] ${style.textClass || 'text-muted-foreground'}`} aria-hidden="true">
      {style.icon}
    </span>
  )
}

const LEGEND_ITEMS = [
  { label: '임시 수정됨', icon: '✏️', bgClass: 'bg-amber-50 dark:bg-amber-950/30' },
  { label: '확정됨', icon: '✓', bgClass: 'bg-primary/10' },
  { label: '잠김', icon: '🔒', bgClass: 'bg-muted' },
  { label: '고정', icon: '📌', bgClass: 'bg-muted/50 border-dashed' },
] as const

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" role="list" aria-label="상태 범례">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-1" role="listitem">
          <span className={`inline-block h-3 w-3 rounded border ${item.bgClass}`} aria-hidden="true" />
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
