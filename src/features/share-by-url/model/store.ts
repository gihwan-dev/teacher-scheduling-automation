import { create } from 'zustand'
import { buildShareUrl } from '../lib/share-builder'
import { importRestoredData, parseShareHash } from '../lib/share-restorer'
import type { RestoredData } from './types'

interface ShareState {
  // 링크 생성
  generatedUrl: string | null
  urlLength: number
  isGenerating: boolean
  generateError: string | null

  // 복원
  previewData: RestoredData | null
  isRestoring: boolean
  restoreError: string | null
  isImported: boolean

  // 액션
  generateShareUrl: () => Promise<void>
  parseFromHash: (hash: string) => void
  importToLocal: () => Promise<void>
  reset: () => void
}

export const useShareStore = create<ShareState>((set, get) => ({
  generatedUrl: null,
  urlLength: 0,
  isGenerating: false,
  generateError: null,

  previewData: null,
  isRestoring: false,
  restoreError: null,
  isImported: false,

  generateShareUrl: async () => {
    set({ isGenerating: true, generateError: null, generatedUrl: null, urlLength: 0 })
    try {
      const result = await buildShareUrl()
      set({ generatedUrl: result.url, urlLength: result.urlLength, isGenerating: false })
    } catch (e) {
      set({ generateError: (e as Error).message, isGenerating: false })
    }
  },

  parseFromHash: (hash: string) => {
    set({ isRestoring: true, restoreError: null, previewData: null })
    try {
      const data = parseShareHash(hash)
      set({ previewData: data, isRestoring: false })
    } catch (e) {
      set({ restoreError: (e as Error).message, isRestoring: false })
    }
  },

  importToLocal: async () => {
    const { previewData } = get()
    if (!previewData) return

    set({ isRestoring: true, restoreError: null })
    try {
      await importRestoredData(previewData)
      set({ isImported: true, isRestoring: false })
    } catch (e) {
      set({ restoreError: (e as Error).message, isRestoring: false })
    }
  },

  reset: () =>
    set({
      generatedUrl: null,
      urlLength: 0,
      isGenerating: false,
      generateError: null,
      previewData: null,
      isRestoring: false,
      restoreError: null,
      isImported: false,
    }),
}))
