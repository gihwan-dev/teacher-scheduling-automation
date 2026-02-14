import type { WeekTag } from '@/entities/change-history'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface HistoryFilterBarProps {
  weekTags: Array<WeekTag>
  selectedWeekTag: string
  selectedActionType: string
  onWeekTagChange: (value: string) => void
  onActionTypeChange: (value: string) => void
}

const ACTION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'EDIT', label: '편집' },
  { value: 'CLEAR', label: '삭제' },
  { value: 'LOCK', label: '잠금' },
  { value: 'UNLOCK', label: '잠금 해제' },
  { value: 'MOVE', label: '이동' },
  { value: 'CONFIRM', label: '확정' },
  { value: 'RECOMPUTE', label: '재계산' },
]

export function HistoryFilterBar({
  weekTags,
  selectedWeekTag,
  selectedActionType,
  onWeekTagChange,
  onActionTypeChange,
}: HistoryFilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select value={selectedWeekTag} onValueChange={(val) => onWeekTagChange(val ?? 'ALL')}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="주차 선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">전체 주차</SelectItem>
          {weekTags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedActionType} onValueChange={(val) => onActionTypeChange(val ?? 'ALL')}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="액션 타입" />
        </SelectTrigger>
        <SelectContent>
          {ACTION_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
