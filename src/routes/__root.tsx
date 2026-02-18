import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useEffect, useState } from 'react'

import appCss from '../styles.css?url'
import { Toaster } from '@/components/ui/sonner'
import { NavProgress } from '@/widgets/nav-progress'

if (import.meta.env.DEV) {
  import('@/shared/lib/seed-data').then(({ seedSampleData }) => {
    ;(window as any).__seedData = seedSampleData
  })
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: '시간표 자동화',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
  component: RootComponent,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const [isShareRestoreMode, setIsShareRestoreMode] = useState(false)

  useEffect(() => {
    const syncMode = () => {
      if (typeof window === 'undefined') return
      const isRestore =
        window.location.pathname === '/share' &&
        window.location.hash.includes('data=')
      setIsShareRestoreMode(isRestore)
    }

    syncMode()
    window.addEventListener('hashchange', syncMode)
    window.addEventListener('popstate', syncMode)
    return () => {
      window.removeEventListener('hashchange', syncMode)
      window.removeEventListener('popstate', syncMode)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!isShareRestoreMode && (
        <header className="border-b">
          <NavProgress />
        </header>
      )}
      <main>
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
