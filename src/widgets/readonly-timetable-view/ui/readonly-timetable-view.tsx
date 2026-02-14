import { useState } from 'react'
import type { TimetableCell } from '@/entities/timetable'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { SchoolConfig } from '@/entities/school'
import { StatusIndicator, StatusLegend, getCellStatusClasses } from '@/entities/timetable'
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
import { cn } from '@/lib/utils'

interface ReadOnlyTimetableViewProps {
  cells: Array<TimetableCell>
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
  title?: string
}

export function ReadOnlyTimetableView({
  cells,
  schoolConfig,
  teachers,
  subjects,
  title = '시간표',
}: ReadOnlyTimetableViewProps) {
  const [selectedGrade, setSelectedGrade] = useState(1)
  const [selectedClass, setSelectedClass] = useState(1)

  const teacherMap = new Map(teachers.map((t) => [t.id, t]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  const { activeDays, periodsPerDay } = schoolConfig
  const classCount = schoolConfig.classCountByGrade[selectedGrade] ?? 0

  const filteredCells = cells.filter(
    (c) => c.grade === selectedGrade && c.classNumber === selectedClass,
  )

  const cellMap = new Map<string, TimetableCell>()
  for (const cell of filteredCells) {
    cellMap.set(`${cell.day}-${cell.period}`, cell)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={String(selectedGrade)}
              onValueChange={(val) => {
                setSelectedGrade(Number(val))
                setSelectedClass(1)
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: schoolConfig.gradeCount }, (_, i) => i + 1).map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {g}학년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(selectedClass)}
              onValueChange={(val) => setSelectedClass(Number(val))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: classCount }, (_, i) => i + 1).map((c) => (
                  <SelectItem key={c} value={String(c)}>
                    {c}반
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusLegend />
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
            {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((period) => (
              <TableRow key={period}>
                <TableCell className="text-center font-medium">{period}</TableCell>
                {activeDays.map((day) => {
                  const cell = cellMap.get(`${day}-${period}`)
                  return (
                    <TableCell
                      key={day}
                      className={cn('text-center', getCellStatusClasses(cell))}
                    >
                      {cell ? (
                        <CellContent
                          cell={cell}
                          teacherMap={teacherMap}
                          subjectMap={subjectMap}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CellContent({
  cell,
  teacherMap,
  subjectMap,
}: {
  cell: TimetableCell
  teacherMap: Map<string, Teacher>
  subjectMap: Map<string, Subject>
}) {
  const subject = subjectMap.get(cell.subjectId)
  const teacher = teacherMap.get(cell.teacherId)

  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium">{subject?.abbreviation ?? cell.subjectId}</div>
      <div className="text-muted-foreground text-[10px]">{teacher?.name ?? cell.teacherId}</div>
      <StatusIndicator cell={cell} />
    </div>
  )
}
