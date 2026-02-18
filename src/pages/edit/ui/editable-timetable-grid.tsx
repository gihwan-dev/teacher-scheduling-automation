import { useRef } from 'react'
import { CellEditorInline } from './cell-editor-inline'
import type { TimetableCell } from '@/entities/timetable'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { SchoolConfig } from '@/entities/school'
import {
  StatusIndicator,
  getCellStatusClasses,
  getStatusLabel,
} from '@/entities/timetable'
import { getDayPeriodCount, getMaxPeriodsPerDay } from '@/entities/school'
import { DAY_LABELS } from '@/shared/lib/constants'
import { makeCellKey, useEditStore } from '@/features/edit-timetable-cell'
import { useGridKeyboard } from '@/features/edit-timetable-cell/lib/use-grid-keyboard'
import { cn } from '@/lib/utils'

interface EditableTimetableGridProps {
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
}

export function EditableTimetableGrid({
  schoolConfig,
  teachers,
  subjects,
}: EditableTimetableGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useGridKeyboard(containerRef)

  const {
    cellMap,
    focusedCell,
    selectedCells,
    isEditing,
    editingCellKey,
    viewGrade,
    viewClassNumber,
    setFocusedCell,
    startEdit,
  } = useEditStore()

  const { activeDays } = schoolConfig
  const maxPeriodsPerDay = getMaxPeriodsPerDay(schoolConfig)
  const teacherMap = new Map(teachers.map((t) => [t.id, t]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="grid"
      aria-label={`${viewGrade}학년 ${viewClassNumber}반 시간표`}
      aria-activedescendant={focusedCell ?? undefined}
      className="rounded-lg border overflow-hidden focus:outline-none"
    >
      {/* 헤더 행 */}
      <div
        role="row"
        className="grid border-b bg-muted/50"
        style={{
          gridTemplateColumns: `4rem repeat(${activeDays.length}, 1fr)`,
        }}
      >
        <div
          role="columnheader"
          className="p-2 text-center text-xs font-medium text-muted-foreground"
        >
          교시
        </div>
        {activeDays.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="p-2 text-center text-xs font-medium text-muted-foreground border-l"
          >
            {DAY_LABELS[day]}
          </div>
        ))}
      </div>

      {/* 데이터 행 */}
      {Array.from({ length: maxPeriodsPerDay }, (_, i) => i + 1).map((period) => (
        <div
          key={period}
          role="row"
          className="grid border-b last:border-b-0"
          style={{
            gridTemplateColumns: `4rem repeat(${activeDays.length}, 1fr)`,
          }}
        >
          <div
            role="rowheader"
            className="p-2 text-center text-xs font-medium text-muted-foreground flex items-center justify-center"
          >
            {period}
          </div>
          {activeDays.map((day) => {
            const dayMax = getDayPeriodCount(schoolConfig, day)
            if (period > dayMax) {
              return (
                <div
                  key={day}
                  role="gridcell"
                  className="border-l min-h-16 p-1 bg-muted/40"
                />
              )
            }
            const key = makeCellKey(viewGrade, viewClassNumber, day, period)
            const cell = cellMap.get(key)
            const isFocused = focusedCell === key
            const isSelected = selectedCells.has(key)
            const isEditingThis = isEditing && editingCellKey === key

            return (
              <div
                key={day}
                id={key}
                role="gridcell"
                aria-selected={isSelected}
                aria-label={getCellAriaLabel(cell, teacherMap, subjectMap)}
                className={cn(
                  'border-l min-h-16 p-1 cursor-pointer transition-colors',
                  getCellStatusClasses(cell),
                  isFocused && 'bg-primary/15 ring-2 ring-primary ring-inset',
                  isSelected &&
                    !isFocused &&
                    'bg-accent ring-1 ring-accent-foreground/20 ring-inset',
                )}
                onClick={() => setFocusedCell(key)}
                onDoubleClick={() => startEdit(key)}
              >
                {isEditingThis ? (
                  <CellEditorInline teachers={teachers} subjects={subjects} />
                ) : cell ? (
                  <CellContent
                    cell={cell}
                    teacherMap={teacherMap}
                    subjectMap={subjectMap}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs flex h-full items-center justify-center">
                    -
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function getCellAriaLabel(
  cell: TimetableCell | undefined,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
): string {
  if (!cell) return '빈 셀'
  const subject = subjectMap.get(cell.subjectId)?.name ?? cell.subjectId
  const teacher = teacherMap.get(cell.teacherId)?.name ?? cell.teacherId
  const statusLabel = getStatusLabel(cell)
  return `${subject} ${teacher}${statusLabel ? ` ${statusLabel}` : ''}`
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
    <div className="flex flex-col items-center justify-center h-full gap-0.5">
      <div className="text-xs font-medium leading-tight">
        {subject?.abbreviation ?? cell.subjectId}
      </div>
      <div className="text-muted-foreground text-[10px] leading-tight">
        {teacher?.name ?? cell.teacherId}
      </div>
      <StatusIndicator cell={cell} />
    </div>
  )
}
