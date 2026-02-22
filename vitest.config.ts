import { defineConfig } from 'vitest/config'

const config = defineConfig({
  resolve: {
    alias: {
      '@': '/Users/choegihwan/Documents/Projects/scheduling-automation/src',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['/Users/choegihwan/Documents/Projects/scheduling-automation/src/test-setup.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
})

export default config
