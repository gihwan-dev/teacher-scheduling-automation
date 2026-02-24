import * as Sentry from '@sentry/tanstackstart-react'
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
const tracesSampleRate = Number.parseFloat(
  import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0',
)

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    ...(Number.isFinite(tracesSampleRate) && tracesSampleRate > 0
      ? {
          tracesSampleRate,
          integrations: [Sentry.browserTracingIntegration()],
        }
      : {}),
  })
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})
