//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      '.claude/**',
      '.output/**',
      'eslint.config.js',
      'prettier.config.js',
    ],
  },
  ...tanstackConfig,
]
