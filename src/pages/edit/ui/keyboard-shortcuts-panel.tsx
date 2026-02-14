import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const shortcuts = [
  { keys: ['Arrow'], description: '셀 이동' },
  { keys: ['Enter'], description: '편집 시작/확정' },
  { keys: ['Esc'], description: '편집 취소' },
  { keys: ['Space'], description: '선택 토글' },
  { keys: ['Ctrl', 'L'], description: '잠금 토글' },
  { keys: ['Ctrl', 'Z'], description: '실행취소' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: '다시실행' },
  { keys: ['Delete'], description: '셀 비우기' },
]

export function KeyboardShortcutsPanel() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-muted-foreground"
      >
        {isOpen ? '단축키 숨기기' : '단축키 보기'}
      </Button>
      {isOpen && (
        <Card className="mt-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">키보드 단축키</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {shortcuts.map((s) => (
                <div key={s.description} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{s.description}</span>
                  <span className="flex items-center gap-0.5">
                    {s.keys.map((key, i) => (
                      <span key={i}>
                        {i > 0 && <span className="text-[10px] text-muted-foreground mx-0.5">+</span>}
                        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">{key}</kbd>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
