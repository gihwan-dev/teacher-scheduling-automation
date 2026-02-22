import { useMemo, useState } from 'react'
import type {
  AcademicCalendarEventType,
  AcademicCalendarScopeType,
} from '@/entities/academic-calendar'
import { useSetupStore } from '@/features/manage-school-setup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const EVENT_TYPE_OPTIONS: Array<{ value: AcademicCalendarEventType; label: string }> = [
  { value: 'HOLIDAY', label: '공휴일' },
  { value: 'CLOSURE_DAY', label: '휴업일' },
  { value: 'EXAM_PERIOD', label: '시험기간' },
  { value: 'GRADE_EVENT', label: '학년행사' },
  { value: 'SCHOOL_EVENT', label: '전교행사' },
  { value: 'SHORTENED_DAY', label: '단축수업' },
  { value: 'SEMESTER_START', label: '학기시작' },
  { value: 'SEMESTER_END', label: '학기종료' },
]

const SCOPE_OPTIONS: Array<{ value: AcademicCalendarScopeType; label: string }> = [
  { value: 'SCHOOL', label: '전교' },
  { value: 'GRADE', label: '학년' },
  { value: 'CLASS', label: '학급' },
]

export function AcademicCalendarTable() {
  const {
    schoolConfig,
    academicCalendarEvents,
    addAcademicCalendarEvent,
    updateAcademicCalendarEvent,
    removeAcademicCalendarEvent,
  } = useSetupStore()

  const todayIso = useMemo(() => formatDateInput(new Date()), [])
  const [newType, setNewType] = useState<AcademicCalendarEventType>('HOLIDAY')
  const [newStartDate, setNewStartDate] = useState(todayIso)
  const [newEndDate, setNewEndDate] = useState(todayIso)
  const [newScopeType, setNewScopeType] =
    useState<AcademicCalendarScopeType>('SCHOOL')
  const [newScopeValue, setNewScopeValue] = useState('')
  const [newPeriodOverride, setNewPeriodOverride] = useState(
    String(schoolConfig?.periodsPerDay ?? 7),
  )

  const periodsPerDay = schoolConfig?.periodsPerDay ?? 7
  const eventTypeItems = EVENT_TYPE_OPTIONS
  const scopeItems = SCOPE_OPTIONS

  const handleAdd = () => {
    addAcademicCalendarEvent({
      eventType: newType,
      startDate: newStartDate,
      endDate: newEndDate,
      scopeType: newScopeType,
      scopeValue: normalizeScopeValue(newScopeType, newScopeValue),
      periodOverride:
        newType === 'SHORTENED_DAY'
          ? clampPeriod(newPeriodOverride, periodsPerDay)
          : null,
    })
    setNewScopeValue('')
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[130px]">유형</TableHead>
            <TableHead className="w-[130px]">시작일</TableHead>
            <TableHead className="w-[130px]">종료일</TableHead>
            <TableHead className="w-[90px]">범위</TableHead>
            <TableHead className="w-[130px]">범위값</TableHead>
            <TableHead className="w-[120px]">단축교시</TableHead>
            <TableHead className="w-[80px]">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {academicCalendarEvents.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <Select
                  items={eventTypeItems}
                  value={event.eventType}
                  onValueChange={(value) => {
                    if (!value) return
                    updateAcademicCalendarEvent(event.id, {
                      eventType: value,
                      periodOverride:
                        value === 'SHORTENED_DAY'
                          ? event.periodOverride ?? periodsPerDay
                          : null,
                    })
                  }}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypeItems.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  type="date"
                  className="h-7"
                  value={event.startDate}
                  onChange={(e) =>
                    updateAcademicCalendarEvent(event.id, {
                      startDate: e.target.value,
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  type="date"
                  className="h-7"
                  value={event.endDate}
                  onChange={(e) =>
                    updateAcademicCalendarEvent(event.id, {
                      endDate: e.target.value,
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <Select
                  items={scopeItems}
                  value={event.scopeType}
                  onValueChange={(value) => {
                    if (!value) return
                    updateAcademicCalendarEvent(event.id, {
                      scopeType: value,
                      scopeValue: normalizeScopeValue(value, event.scopeValue ?? ''),
                    })
                  }}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeItems.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  className="h-7"
                  value={event.scopeValue ?? ''}
                  placeholder={scopePlaceholder(event.scopeType)}
                  disabled={event.scopeType === 'SCHOOL'}
                  onChange={(e) =>
                    updateAcademicCalendarEvent(event.id, {
                      scopeValue: normalizeScopeValue(event.scopeType, e.target.value),
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  className="h-7"
                  type="number"
                  min={1}
                  max={periodsPerDay}
                  disabled={event.eventType !== 'SHORTENED_DAY'}
                  value={event.periodOverride ?? ''}
                  placeholder="-"
                  onChange={(e) =>
                    updateAcademicCalendarEvent(event.id, {
                      periodOverride:
                        event.eventType === 'SHORTENED_DAY'
                          ? clampPeriod(e.target.value, periodsPerDay)
                          : null,
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={() => removeAcademicCalendarEvent(event.id)}
                >
                  삭제
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>
              <Select
                items={eventTypeItems}
                value={newType}
                onValueChange={(value) => value && setNewType(value)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypeItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Input
                type="date"
                className="h-7"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
              />
            </TableCell>
            <TableCell>
              <Input
                type="date"
                className="h-7"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </TableCell>
            <TableCell>
              <Select
                items={scopeItems}
                value={newScopeType}
                onValueChange={(value) => value && setNewScopeType(value)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Input
                className="h-7"
                value={newScopeValue}
                disabled={newScopeType === 'SCHOOL'}
                placeholder={scopePlaceholder(newScopeType)}
                onChange={(e) => setNewScopeValue(e.target.value)}
              />
            </TableCell>
            <TableCell>
              <Input
                className="h-7"
                type="number"
                min={1}
                max={periodsPerDay}
                disabled={newType !== 'SHORTENED_DAY'}
                value={newType === 'SHORTENED_DAY' ? newPeriodOverride : ''}
                placeholder="-"
                onChange={(e) => setNewPeriodOverride(e.target.value)}
              />
            </TableCell>
            <TableCell>
              <Button size="xs" onClick={handleAdd}>
                추가
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {academicCalendarEvents.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          등록된 학사일정이 없습니다. 위에서 이벤트를 추가해 주세요.
        </p>
      )}
    </div>
  )
}

function normalizeScopeValue(
  scopeType: AcademicCalendarScopeType,
  scopeValue: string,
): string | null {
  if (scopeType === 'SCHOOL') {
    return null
  }
  const trimmed = scopeValue.trim()
  return trimmed.length > 0 ? trimmed : null
}

function scopePlaceholder(scopeType: AcademicCalendarScopeType): string {
  if (scopeType === 'GRADE') {
    return '예: 1'
  }
  if (scopeType === 'CLASS') {
    return '예: 1-2'
  }
  return '-'
}

function clampPeriod(value: string, periodsPerDay: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    return 1
  }
  if (parsed < 1) {
    return 1
  }
  if (parsed > periodsPerDay) {
    return periodsPerDay
  }
  return parsed
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
