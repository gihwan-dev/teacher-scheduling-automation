import * as Sentry from '@sentry/tanstackstart-react'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import type { RequestHandler } from '@tanstack/react-start/server'
import type { Register } from '@tanstack/react-router'

const dsn = process.env.SENTRY_DSN ?? process.env.VITE_SENTRY_DSN
const tracesSampleRate = Number.parseFloat(
  process.env.SENTRY_TRACES_SAMPLE_RATE ??
    process.env.VITE_SENTRY_TRACES_SAMPLE_RATE ??
    '0',
)
const isSentryEnabled = Boolean(dsn)

if (isSentryEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    ...(Number.isFinite(tracesSampleRate) && tracesSampleRate > 0
      ? { tracesSampleRate }
      : {}),
  })
}

const fetch = createStartHandler(defaultStreamHandler)

export type ServerEntry = { fetch: RequestHandler<Register> }
type SentryServerEntry = Parameters<typeof Sentry.wrapFetchWithSentry>[0]

export function createServerEntry(entry: ServerEntry): ServerEntry {
  if (!isSentryEnabled) {
    return entry
  }

  const wrapped = Sentry.wrapFetchWithSentry(entry as unknown as SentryServerEntry)

  return {
    async fetch(...args) {
      try {
        return await wrapped.fetch(...args)
      } catch (error) {
        Sentry.captureException(error)
        throw error
      }
    },
  }
}

export default createServerEntry({ fetch })
