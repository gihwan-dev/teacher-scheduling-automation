import { useState } from 'react'
import type { FixedEventType } from '@/entities/fixed-event'
import type { DayOfWeek } from '@/shared/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSetupStore } from '@/features/manage-school-setup'
import { DAYS_OF_WEEK, DAY_LABELS } from '@/shared/lib/constants'

const EVENT_TYPE_LABELS: Record<FixedEventType, string> = {
  FIXED_CLASS: '고정 수업',
  BUSINESS_TRIP: '출장',
  SCHOOL_EVENT: '학교 행사',
}

const EVENT_TYPES: Array<FixedEventType> = [
  'FIXED_CLASS',
  'BUSINESS_TRIP',
  'SCHOOL_EVENT',
]

const EVENT_TYPE_OPTIONS = EVENT_TYPES.map((type) => ({
  value: type,
  label: EVENT_TYPE_LABELS[type],
}))

export function FixedEventTable() {
  const {
    fixedEvents,
    teachers,
    subjects,
    schoolConfig,
    addFixedEvent,
    updateFixedEvent,
    removeFixedEvent,
  } = useSetupStore()

  const [newType, setNewType] = useState<FixedEventType>('FIXED_CLASS')
  const [newDesc, setNewDesc] = useState('')
  const [newDay, setNewDay] = useState<DayOfWeek>('MON')
  const [newPeriod, setNewPeriod] = useState(1)

  const activeDays = schoolConfig?.activeDays ?? DAYS_OF_WEEK.slice(0, 5)
  const periodsPerDay = schoolConfig?.periodsPerDay ?? 7
  const dayOptions = activeDays.map((day) => ({
    value: day,
    label: DAY_LABELS[day],
  }))
  const periodOptions = Array.from({ length: periodsPerDay }, (_, i) => {
    const period = i + 1
    return { value: period, label: `${period}교시` }
  })
  const teacherOptions = [
    { value: '', label: '없음' },
    ...teachers.map((teacher) => ({
      value: teacher.id,
      label: teacher.name,
    })),
  ]
  const subjectOptions = [
    { value: '', label: '없음' },
    ...subjects.map((subject) => ({
      value: subject.id,
      label: subject.name,
    })),
  ]

  const handleAdd = () => {
    addFixedEvent({
      type: newType,
      description: newDesc,
      teacherId: null,
      subjectId: null,
      grade: null,
      classNumber: null,
      day: newDay,
      period: newPeriod,
    })
    setNewDesc('')
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">유형</TableHead>
            <TableHead className="w-[160px]">설명</TableHead>
            <TableHead className="w-[120px]">교사</TableHead>
            <TableHead className="w-[120px]">과목</TableHead>
            <TableHead className="w-[80px]">요일</TableHead>
            <TableHead className="w-[80px]">교시</TableHead>
            <TableHead className="w-[80px]">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fixedEvents.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <Select
                  items={EVENT_TYPE_OPTIONS}
                  value={event.type}
                  onValueChange={(val) =>
                    val && updateFixedEvent(event.id, { type: val })
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  value={event.description}
                  onChange={(e) =>
                    updateFixedEvent(event.id, { description: e.target.value })
                  }
                  className="h-7"
                />
              </TableCell>
              <TableCell>
                <Select
                  items={teacherOptions}
                  value={event.teacherId ?? ''}
                  onValueChange={(val) =>
                    updateFixedEvent(event.id, { teacherId: val || null })
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  items={subjectOptions}
                  value={event.subjectId ?? ''}
                  onValueChange={(val) =>
                    updateFixedEvent(event.id, { subjectId: val || null })
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  items={dayOptions}
                  value={event.day}
                  onValueChange={(val) =>
                    val && updateFixedEvent(event.id, { day: val })
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  items={periodOptions}
                  value={event.period}
                  onValueChange={(val) =>
                    val !== null && updateFixedEvent(event.id, { period: val })
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={() => removeFixedEvent(event.id)}
                >
                  삭제
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {/* 새 이벤트 추가 행 */}
          <TableRow>
            <TableCell>
              <Select
                items={EVENT_TYPE_OPTIONS}
                value={newType}
                onValueChange={(val) => val && setNewType(val)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Input
                placeholder="설명"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="h-7"
              />
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell>
              <Select
                items={dayOptions}
                value={newDay}
                onValueChange={(val) => val && setNewDay(val)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select
                items={periodOptions}
                value={newPeriod}
                onValueChange={(val) => val !== null && setNewPeriod(val)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Button size="xs" onClick={handleAdd}>
                추가
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {fixedEvents.length === 0 && (
        <p className="text-muted-foreground text-center text-sm py-4">
          등록된 고정 이벤트가 없습니다. 위에서 이벤트를 추가하세요.
        </p>
      )}
    </div>
  )
}
