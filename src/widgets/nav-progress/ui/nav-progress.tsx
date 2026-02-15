import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon } from '@hugeicons/core-free-icons'
import { useNavStatus } from '../lib/use-nav-status'

interface NavItem {
  to: string
  label: string
  step: number
  isDone: (status: ReturnType<typeof useNavStatus>) => boolean
}

const NAV_ITEMS: Array<NavItem> = [
  { to: '/setup', label: '설정', step: 1, isDone: (s) => s.setupDone },
  { to: '/policy', label: '교사 조건', step: 2, isDone: (s) => s.policyDone },
  { to: '/generate', label: '생성', step: 3, isDone: (s) => s.generateDone },
  { to: '/edit', label: '편집', step: 4, isDone: (s) => s.generateDone },
  { to: '/replacement', label: '교체', step: 5, isDone: (s) => s.generateDone },
  { to: '/history', label: '이력', step: 6, isDone: (s) => s.generateDone },
  { to: '/share', label: '공유', step: 7, isDone: () => true },
]

export function NavProgress() {
  const status = useNavStatus()

  return (
    <nav className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
      <Link to="/" className="text-sm font-bold">
        시간표 자동화
      </Link>
      {NAV_ITEMS.map((item) => {
        const done = item.isDone(status)
        return (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            {done ? (
              <HugeiconsIcon
                icon={Tick02Icon}
                strokeWidth={2}
                className="size-3.5 text-green-600"
              />
            ) : (
              <span className="flex size-3.5 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
                {item.step}
              </span>
            )}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
