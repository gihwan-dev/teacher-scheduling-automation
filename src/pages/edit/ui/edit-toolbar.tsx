import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEditStore } from '@/features/edit-timetable-cell'

export function EditToolbar() {
  const {
    cells,
    undoStack,
    redoStack,
    isDirty,
    isRecomputing,
    selectedCells,
    saveSnapshot,
    recompute,
    undo,
    redo,
    lockSelected,
    unlockSelected,
    confirmChanges,
  } = useEditStore()

  const tempModifiedCount = cells.filter((c) => c.status === 'TEMP_MODIFIED').length

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button onClick={saveSnapshot} disabled={!isDirty} size="sm">
        저장
      </Button>
      <Button onClick={recompute} disabled={isRecomputing} variant="outline" size="sm">
        {isRecomputing ? '재계산 중...' : '재계산'}
      </Button>
      {tempModifiedCount > 0 && (
        <Button onClick={confirmChanges} variant="default" size="sm">
          확정
          <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
            {tempModifiedCount}
          </Badge>
        </Button>
      )}
      <div className="h-4 w-px bg-border" />
      <Button onClick={undo} disabled={undoStack.length === 0} variant="ghost" size="sm">
        실행취소
        {undoStack.length > 0 && (
          <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
            {undoStack.length}
          </Badge>
        )}
      </Button>
      <Button onClick={redo} disabled={redoStack.length === 0} variant="ghost" size="sm">
        다시실행
        {redoStack.length > 0 && (
          <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
            {redoStack.length}
          </Badge>
        )}
      </Button>
      {selectedCells.size > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <Button onClick={lockSelected} variant="outline" size="sm">
            선택 잠금
          </Button>
          <Button onClick={unlockSelected} variant="outline" size="sm">
            선택 잠금 해제
          </Button>
        </>
      )}
    </div>
  )
}
