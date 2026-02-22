import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  FloppyDiskIcon,
  LockIcon,
  RedoIcon,
  RotateClockwiseIcon,
  SquareUnlock02Icon,
  Tick02Icon,
  UndoIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
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

  const tempModifiedCount = cells.filter(
    (c) => c.status === 'TEMP_MODIFIED',
  ).length

  const handleSave = async () => {
    const saved = await saveSnapshot()
    if (saved) {
      toast.success('스냅샷을 저장했습니다')
      return
    }
    toast.error('트랜잭션 저장에 실패했습니다. 검증 결과를 확인하세요.')
  }

  const handleRecompute = async () => {
    await recompute()
    toast.success('재계산이 완료되었습니다')
  }

  const handleConfirm = () => {
    confirmChanges()
    toast.success('변경사항을 확정했습니다')
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button onClick={handleSave} disabled={!isDirty} size="sm">
        <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} />
        저장
      </Button>
      <Button
        onClick={handleRecompute}
        disabled={isRecomputing}
        variant="outline"
        size="sm"
      >
        {isRecomputing ? (
          <>
            <Spinner size="sm" />
            재계산 중...
          </>
        ) : (
          <>
            <HugeiconsIcon icon={RotateClockwiseIcon} strokeWidth={2} />
            재계산
          </>
        )}
      </Button>
      {tempModifiedCount > 0 && (
        <Button onClick={handleConfirm} variant="default" size="sm">
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
          확정
          <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
            {tempModifiedCount}
          </Badge>
        </Button>
      )}
      <div className="h-4 w-px bg-border" />
      <Button
        onClick={undo}
        disabled={undoStack.length === 0}
        variant="ghost"
        size="sm"
      >
        <HugeiconsIcon icon={UndoIcon} strokeWidth={2} />
        실행취소
        {undoStack.length > 0 && (
          <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
            {undoStack.length}
          </Badge>
        )}
      </Button>
      <Button
        onClick={redo}
        disabled={redoStack.length === 0}
        variant="ghost"
        size="sm"
      >
        <HugeiconsIcon icon={RedoIcon} strokeWidth={2} />
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
            <HugeiconsIcon icon={LockIcon} strokeWidth={2} />
            선택 잠금
          </Button>
          <Button onClick={unlockSelected} variant="outline" size="sm">
            <HugeiconsIcon icon={SquareUnlock02Icon} strokeWidth={2} />
            선택 잠금 해제
          </Button>
        </>
      )}
    </div>
  )
}
