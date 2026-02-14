import { HeadContent, Link, Outlet, Scripts, createRootRoute  } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <Link to="/" className="text-sm font-bold">
            시간표 자동화
          </Link>
          <Link
            to="/setup"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            설정
          </Link>
          <Link
            to="/policy"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            교사 조건
          </Link>
          <Link
            to="/generate"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            생성
          </Link>
          <Link
            to="/edit"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            편집
          </Link>
          <Link
            to="/replacement"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            교체
          </Link>
          <Link
            to="/history"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            이력
          </Link>
          <Link
            to="/share"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            공유
          </Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
