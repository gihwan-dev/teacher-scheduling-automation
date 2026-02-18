import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { CellKey, TimetableCell } from '@/entities/timetable'
import { StatusIndicator } from '@/entities/timetable'
import { makeCellKey } from '@/features/edit-timetable-cell'
import { useReplacementStore } from '@/features/find-replacement'
import { getDayPeriodCount, getMaxPeriodsPerDay } from '@/entities/school'
import { DAY_LABELS } from '@/shared/lib/constants'
import { cn } from '@/lib/utils'

const MULTI_COLORS = [
  'ring-blue-500',
  'ring-orange-500',
  'ring-purple-500',
] as const

interface ReplacementGridProps {
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
}

export function ReplacementGrid({
  schoolConfig,
  teachers,
  subjects,
}: ReplacementGridProps) {
  const {
    cellMap,
    targetCellKey,
    searchResult,
    viewGrade,
    viewClassNumber,
    isMultiMode,
    multiTargetCellKeys,
    multiSearchResult,
    selectTargetCell,
    addMultiTarget,
    removeMultiTarget,
  } = useReplacementStore()

  const { activeDays } = schoolConfig
  const maxPeriodsPerDay = getMaxPeriodsPerDay(schoolConfig)
  const teacherMap = new Map(teachers.map((t) => [t.id, t]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  // 단일 모드: 후보 대상 셀 키 모음
  const candidateTargetKeys = new Set(
    searchResult?.candidates.map((c) => c.targetCellKey) ?? [],
  )

  // 다중 모드: 각 소스별 후보 셀 키 모음
  const multiCandidateTargetKeys = new Set<string>()
  if (multiSearchResult) {
    for (const psr of multiSearchResult.perSourceResults) {
      for (const c of psr.result.candidates) {
        multiCandidateTargetKeys.add(c.targetCellKey)
      }
    }
  }

  const handleCellClick = (
    key: CellKey,
    cell: TimetableCell | undefined,
    isFixedOrLocked: boolean,
  ) => {
    if (isFixedOrLocked || !cell) return

    if (isMultiMode) {
      if (multiTargetCellKeys.includes(key)) {
        removeMultiTarget(key)
      } else {
        addMultiTarget(key)
      }
    } else {
      selectTargetCell(key)
    }
  }

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
            const isFixedOrLocked = cell?.isFixed || cell?.status === 'LOCKED'

            // 단일 모드 상태
            const isSource = !isMultiMode && targetCellKey === key
            const isCandidateTarget =
              !isMultiMode && candidateTargetKeys.has(key)

            // 다중 모드 상태
            const multiIndex = isMultiMode
              ? multiTargetCellKeys.indexOf(key)
              : -1
            const isMultiSelected = multiIndex >= 0
            const isMultiCandidateTarget =
              isMultiMode &&
              multiCandidateTargetKeys.has(key) &&
              !isMultiSelected

            return (
              <div
                key={day}
                role="gridcell"
                tabIndex={-1}
                className={cn(
                  'border-l min-h-16 p-1 transition-colors relative',
                  isFixedOrLocked
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer',
                  // 단일 모드
                  isSource && 'ring-2 ring-destructive ring-inset',
                  isCandidateTarget && !isSource && 'bg-primary/20',
                  // 다중 모드
                  isMultiSelected &&
                    `ring-2 ring-inset ${MULTI_COLORS[multiIndex % MULTI_COLORS.length]}`,
                  isMultiCandidateTarget && 'bg-primary/10',
                  // 호버
                  !isSource &&
                    !isCandidateTarget &&
                    !isMultiSelected &&
                    !isMultiCandidateTarget &&
                    !isFixedOrLocked &&
                    'hover:bg-muted/30',
                )}
                onClick={() => handleCellClick(key, cell, !!isFixedOrLocked)}
              >
                {/* 다중 모드 번호 뱃지 */}
                {isMultiSelected && (
                  <span
                    className={cn(
                      'absolute top-0.5 right-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white',
                      multiIndex === 0 && 'bg-blue-500',
                      multiIndex === 1 && 'bg-orange-500',
                      multiIndex === 2 && 'bg-purple-500',
                    )}
                  >
                    {multiIndex + 1}
                  </span>
                )}
                {cell ? (
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
