import { useMemo, useState } from 'react'
import type { TimetableCell } from '@/entities/timetable'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { SchoolConfig } from '@/entities/school'
import { getDayPeriodCount, getMaxPeriodsPerDay } from '@/entities/school'
import { DAY_LABELS } from '@/shared/lib/constants'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ReadOnlyTeacherTimetableViewProps {
  cells: Array<TimetableCell>
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
  title?: string
}

export function ReadOnlyTeacherTimetableView({
  cells,
  schoolConfig,
  teachers,
  subjects,
  title = '교사 시간표',
}: ReadOnlyTeacherTimetableViewProps) {
  const teacherOptions = teachers.map((teacher) => ({
    value: teacher.id,
    label: teacher.name,
  }))
  const [selectedTeacherId, setSelectedTeacherId] = useState(
    teacherOptions[0]?.value ?? '',
  )
  const [selectedSlot, setSelectedSlot] = useState<{
    day: string
    period: number
  } | null>(null)

  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
  const { activeDays } = schoolConfig
  const maxPeriodsPerDay = getMaxPeriodsPerDay(schoolConfig)

  const teacherCells = useMemo(() => {
    return cells.filter((cell) => cell.teacherId === selectedTeacherId)
  }, [cells, selectedTeacherId])

  const slotMap = useMemo(() => {
    const map = new Map<string, Array<TimetableCell>>()
    for (const cell of teacherCells) {
      const key = `${cell.day}-${cell.period}`
      const existing = map.get(key)
      if (existing) {
        existing.push(cell)
      } else {
        map.set(key, [cell])
      }
    }
    return map
  }, [teacherCells])

  const selectedSlotCells = useMemo(() => {
    if (!selectedSlot) return []
    return slotMap.get(`${selectedSlot.day}-${selectedSlot.period}`) ?? []
  }, [selectedSlot, slotMap])

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{title}</CardTitle>
            <Select
              items={teacherOptions}
              value={selectedTeacherId}
              onValueChange={(value) => value && setSelectedTeacherId(value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="교사 선택" />
              </SelectTrigger>
              <SelectContent>
                {teacherOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">교시</TableHead>
                {activeDays.map((day) => (
                  <TableHead key={day} className="text-center">
                    {DAY_LABELS[day]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: maxPeriodsPerDay }, (_, i) => i + 1).map(
                (period) => (
                  <TableRow key={period}>
                    <TableCell className="text-center font-medium">
                      {period}
                    </TableCell>
                    {activeDays.map((day) => {
                      const dayMax = getDayPeriodCount(schoolConfig, day)
                      if (period > dayMax) {
                        return <TableCell key={day} className="bg-muted/40" />
                      }

                      const key = `${day}-${period}`
                      const slotCells = slotMap.get(key) ?? []
                      const first = slotCells.at(0)
                      const subjectLabel = first
                        ? (subjectMap.get(first.subjectId)?.abbreviation ??
                          first.subjectId)
                        : '-'

                      return (
                        <TableCell key={day} className="text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedSlot({ day, period })}
                            className="w-full rounded-md px-2 py-1 hover:bg-muted"
                          >
                            <div className="text-xs font-medium">
                              {subjectLabel}
                            </div>
                            {slotCells.length > 0 && (
                              <div className="text-[10px] text-muted-foreground">
                                {slotCells.length}개 학급
                              </div>
                            )}
                          </button>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>학급 동시 확인</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {selectedSlot ? (
            <Badge variant="secondary">
              {DAY_LABELS[selectedSlot.day as keyof typeof DAY_LABELS]}{' '}
              {selectedSlot.period}교시
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">
              좌측 시간표에서 교시를 선택하세요.
            </p>
          )}

          {selectedSlotCells.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {selectedSlotCells.map((cell, index) => {
                const subject = subjectMap.get(cell.subjectId)
                return (
                  <li key={`${cell.grade}-${cell.classNumber}-${index}`}>
                    {cell.grade}학년 {cell.classNumber}반 ·{' '}
                    {subject?.name ?? cell.subjectId}
                  </li>
                )
              })}
            </ul>
          ) : selectedSlot ? (
            <p className="text-sm text-muted-foreground">해당 교시에 수업이 없습니다.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
