import { sentryTanstackStart } from '@sentry/tanstackstart-react'
import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const shouldEnableSentryBuildPlugin = Boolean(
    env.SENTRY_ORG && env.SENTRY_PROJECT && env.SENTRY_AUTH_TOKEN,
  )

  return {
    plugins: [
      devtools(),
      nitro(),
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      tanstackStart(),
      ...(shouldEnableSentryBuildPlugin
        ? sentryTanstackStart({
            org: env.SENTRY_ORG,
            project: env.SENTRY_PROJECT,
            authToken: env.SENTRY_AUTH_TOKEN,
          })
        : []),
      viteReact(),
    ],
  }
})

export default config
