import { useCallback, useEffect } from 'react'
import { useEditStore } from '../model/store'

/**
 * 시간표 그리드 키보드 네비게이션/편집 훅
 * roving tabindex 패턴 — 그리드 컨테이너에서 키 이벤트 처리
 */
export function useGridKeyboard(containerRef: React.RefObject<HTMLDivElement | null>) {
  const {
    focusedCell,
    isEditing,
    moveFocus,
    startEdit,
    confirmEdit,
    cancelEdit,
    toggleSelection,
    toggleLock,
    clearCell,
    undo,
    redo,
  } = useEditStore()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 편집 모드에서는 Enter/Esc만 처리
      if (isEditing) {
        if (e.key === 'Enter') {
          e.preventDefault()
          confirmEdit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelEdit()
        }
        return
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          moveFocus('up')
          break
        case 'ArrowDown':
          e.preventDefault()
          moveFocus('down')
          break
        case 'ArrowLeft':
          e.preventDefault()
          moveFocus('left')
          break
        case 'ArrowRight':
          e.preventDefault()
          moveFocus('right')
          break
        case 'Enter':
          e.preventDefault()
          if (focusedCell) startEdit(focusedCell)
          break
        case ' ':
          e.preventDefault()
          if (focusedCell) toggleSelection(focusedCell)
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          if (focusedCell) clearCell(focusedCell)
          break
        case 'l':
        case 'L':
          if (isCtrlOrCmd) {
            e.preventDefault()
            if (focusedCell) toggleLock(focusedCell)
          }
          break
        case 'z':
        case 'Z':
          if (isCtrlOrCmd) {
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
          }
          break
      }
    },
    [
      isEditing,
      focusedCell,
      moveFocus,
      startEdit,
      confirmEdit,
      cancelEdit,
      toggleSelection,
      clearCell,
      toggleLock,
      undo,
      redo,
    ],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, handleKeyDown])
}
