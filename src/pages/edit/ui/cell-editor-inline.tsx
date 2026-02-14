import { useEffect, useRef } from 'react'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import { useEditStore } from '@/features/edit-timetable-cell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CellEditorInlineProps {
  teachers: Array<Teacher>
  subjects: Array<Subject>
}

export function CellEditorInline({ teachers, subjects }: CellEditorInlineProps) {
  const { editDraft, updateEditDraft, confirmEdit, cancelEdit } = useEditStore()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cancelEdit()
      }
    }
    const el = containerRef.current
    if (el) {
      el.addEventListener('keydown', handleKeyDown)
      return () => el.removeEventListener('keydown', handleKeyDown)
    }
  }, [cancelEdit])

  if (!editDraft) return null

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-1 p-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Select
        value={editDraft.subjectId}
        onValueChange={(val) => { if (val) updateEditDraft({ ...editDraft, subjectId: val }) }}
      >
        <SelectTrigger className="h-6 text-[10px] w-full" size="sm">
          <SelectValue placeholder="과목" />
        </SelectTrigger>
        <SelectContent>
          {subjects.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.abbreviation}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={editDraft.teacherId}
        onValueChange={(val) => { if (val) updateEditDraft({ ...editDraft, teacherId: val }) }}
      >
        <SelectTrigger className="h-6 text-[10px] w-full" size="sm">
          <SelectValue placeholder="교사" />
        </SelectTrigger>
        <SelectContent>
          {teachers.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={confirmEdit}
          className="flex-1 rounded bg-primary px-1 py-0.5 text-[9px] text-primary-foreground hover:bg-primary/80"
        >
          확인
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="flex-1 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-muted/80"
        >
          취소
        </button>
      </div>
    </div>
  )
}
