import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TimetableCell } from '@/entities/timetable'
import { makeCellKey } from '@/features/edit-timetable-cell'
import { useReplacementStore } from '@/features/find-replacement'
import { DAY_LABELS } from '@/shared/lib/constants'
import { cn } from '@/lib/utils'

interface ReplacementGridProps {
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
}

export function ReplacementGrid({ schoolConfig, teachers, subjects }: ReplacementGridProps) {
  const {
    cellMap,
    targetCellKey,
    searchResult,
    viewGrade,
    viewClassNumber,
    selectTargetCell,
  } = useReplacementStore()

  const { activeDays, periodsPerDay } = schoolConfig
  const teacherMap = new Map(teachers.map((t) => [t.id, t]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  // 후보 대상 셀 키 모음
  const candidateTargetKeys = new Set(
    searchResult?.candidates.map((c) => c.targetCellKey) ?? [],
  )

  return (
    <div
      role="grid"
      aria-label={`${viewGrade}학년 ${viewClassNumber}반 시간표`}
      className="rounded-lg border overflow-hidden"
    >
      {/* 헤더 행 */}
      <div
        role="row"
        className="grid border-b bg-muted/50"
        style={{ gridTemplateColumns: `4rem repeat(${activeDays.length}, 1fr)` }}
      >
        <div role="columnheader" className="p-2 text-center text-xs font-medium text-muted-foreground">
          교시
        </div>
        {activeDays.map((day) => (
          <div key={day} role="columnheader" className="p-2 text-center text-xs font-medium text-muted-foreground border-l">
            {DAY_LABELS[day]}
          </div>
        ))}
      </div>

      {/* 데이터 행 */}
      {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((period) => (
        <div
          key={period}
          role="row"
          className="grid border-b last:border-b-0"
          style={{ gridTemplateColumns: `4rem repeat(${activeDays.length}, 1fr)` }}
        >
          <div role="rowheader" className="p-2 text-center text-xs font-medium text-muted-foreground flex items-center justify-center">
            {period}
          </div>
          {activeDays.map((day) => {
            const key = makeCellKey(viewGrade, viewClassNumber, day, period)
            const cell = cellMap.get(key)
            const isSource = targetCellKey === key
            const isCandidateTarget = candidateTargetKeys.has(key)
            const isFixedOrLocked = cell?.isFixed || cell?.status === 'LOCKED'

            return (
              <div
                key={day}
                role="gridcell"
                tabIndex={-1}
                className={cn(
                  'border-l min-h-16 p-1 transition-colors',
                  isFixedOrLocked
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer',
                  isSource && 'ring-2 ring-destructive ring-inset',
                  isCandidateTarget && !isSource && 'bg-primary/20',
                  !isSource && !isCandidateTarget && !isFixedOrLocked && 'hover:bg-muted/30',
                )}
                onClick={() => {
                  if (!isFixedOrLocked && cell) selectTargetCell(key)
                }}
              >
                {cell ? (
                  <CellContent cell={cell} teacherMap={teacherMap} subjectMap={subjectMap} />
                ) : (
                  <span className="text-muted-foreground text-xs flex h-full items-center justify-center">-</span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
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
    <div className="flex flex-col items-center justify-center h-full gap-0.5">
      <div className="text-xs font-medium leading-tight">{subject?.abbreviation ?? cell.subjectId}</div>
      <div className="text-muted-foreground text-[10px] leading-tight">{teacher?.name ?? cell.teacherId}</div>
      <StatusIndicator cell={cell} />
    </div>
  )
}

function StatusIndicator({ cell }: { cell: TimetableCell }) {
  if (cell.isFixed) return <span className="text-[9px] text-muted-foreground" aria-hidden="true">📌</span>
  switch (cell.status) {
    case 'LOCKED':
      return <span className="text-[9px] text-muted-foreground" aria-hidden="true">🔒</span>
    case 'TEMP_MODIFIED':
      return <span className="text-[9px] text-muted-foreground" aria-hidden="true">✏️</span>
    case 'CONFIRMED_MODIFIED':
      return <span className="text-[9px] text-muted-foreground" aria-hidden="true">✓</span>
    default:
      return null
  }
}
