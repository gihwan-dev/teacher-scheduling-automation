import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import type { WeekTag } from '@/shared/lib/week-tag'
import { cn } from '@/lib/utils'

const LATEST_VERSION_VALUE = 0

export interface WeekOption {
  value: WeekTag
  label: string
}

export interface VersionOption {
  value: number
  label: string
}

interface WeekVersionSelectorProps {
  weekOptions: Array<WeekOption>
  selectedWeek: WeekTag | null
  onWeekChange: (week: WeekTag) => void
  versionOptions?: Array<VersionOption>
  selectedVersion?: number | null
  onVersionChange?: (version: number | null) => void
  weekPlaceholder?: string
  versionPlaceholder?: string
  disabled?: boolean
  className?: string
}

export function WeekVersionSelector({
  weekOptions,
  selectedWeek,
  onWeekChange,
  versionOptions = [],
  selectedVersion = null,
  onVersionChange,
  weekPlaceholder = '주차 선택',
  versionPlaceholder = '버전 선택',
  disabled = false,
  className,
}: WeekVersionSelectorProps) {
  const versionEnabled =
    onVersionChange !== undefined && selectedWeek !== null && versionOptions.length > 0
  const versionItems = [
    { value: LATEST_VERSION_VALUE, label: '최신 버전' },
    ...versionOptions,
  ]

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <Select
        items={weekOptions}
        value={selectedWeek ?? undefined}
        onValueChange={(value) => {
          if (!value) return
          onWeekChange(value)
        }}
      >
        <SelectTrigger className="w-36" disabled={disabled}>
          <SelectValue placeholder={weekPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {weekOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {onVersionChange && (
        <Select
          items={versionItems}
          value={selectedVersion ?? LATEST_VERSION_VALUE}
          onValueChange={(value) => {
            if (value === null || value === LATEST_VERSION_VALUE) {
              onVersionChange(null)
              return
            }
            onVersionChange(value)
          }}
        >
          <SelectTrigger className="w-32" disabled={disabled || !versionEnabled}>
            <SelectValue placeholder={versionPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {versionItems.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
