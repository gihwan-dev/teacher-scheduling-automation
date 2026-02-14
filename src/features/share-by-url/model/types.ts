import type { RestoredState } from '@/shared/lib/url'

export type ShareStatus = 'idle' | 'generating' | 'generated' | 'error'
export type RestoreStatus = 'idle' | 'parsing' | 'previewing' | 'importing' | 'imported' | 'error'

export type RestoredData = RestoredState
