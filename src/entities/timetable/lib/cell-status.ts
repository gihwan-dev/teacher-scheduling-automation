import type { CellStatus, TimetableCell } from '../model/types'

export interface CellStatusStyle {
  bgClass: string
  textClass: string
  icon: string
  label: string
}

const STATUS_STYLES: Record<CellStatus, CellStatusStyle> = {
  BASE: {
    bgClass: 'bg-background hover:bg-muted/30',
    textClass: '',
    icon: '',
    label: '',
  },
  TEMP_MODIFIED: {
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    icon: '✏️',
    label: '임시 수정됨',
  },
  CONFIRMED_MODIFIED: {
    bgClass: 'bg-primary/10',
    textClass: 'text-primary',
    icon: '✓',
    label: '확정됨',
  },
  LOCKED: {
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    icon: '🔒',
    label: '잠김',
  },
}

const EMPTY_STYLE: CellStatusStyle = {
  bgClass: 'bg-background hover:bg-muted/30',
  textClass: '',
  icon: '',
  label: '',
}
const FIXED_STYLE: CellStatusStyle = {
  bgClass: 'bg-muted/50 border-dashed',
  textClass: 'text-muted-foreground',
  icon: '📌',
  label: '고정',
}

export function getCellStatusStyle(
  cell: TimetableCell | undefined,
): CellStatusStyle {
  if (!cell) return EMPTY_STYLE
  if (cell.isFixed) return FIXED_STYLE
  return STATUS_STYLES[cell.status]
}

export function getCellStatusClasses(cell: TimetableCell | undefined): string {
  return getCellStatusStyle(cell).bgClass
}

export function getStatusLabel(cell: TimetableCell): string {
  if (cell.isFixed) return '고정'
  return STATUS_STYLES[cell.status].label
}

export function getStatusIcon(cell: TimetableCell): string {
  if (cell.isFixed) return '📌'
  return STATUS_STYLES[cell.status].icon
}
