import { useEffect, useRef } from 'react'
import { ShareGeneratePanel } from './share-generate-panel'
import { ShareRestorePanel } from './share-restore-panel'
import { useShareStore } from '@/features/share-by-url'

export function SharePage() {
  const { parseFromHash, reset } = useShareStore()
  const initializedRef = useRef(false)

  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const isRestoreMode = hash.includes('data=')

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    if (isRestoreMode) {
      parseFromHash(hash.startsWith('#') ? hash.slice(1) : hash)
    }

    return () => {
      reset()
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{isRestoreMode ? '시간표 복원' : '시간표 공유'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isRestoreMode
            ? '공유 링크에서 시간표 데이터를 확인하고 가져올 수 있습니다.'
            : '현재 시간표 상태를 URL로 공유할 수 있습니다.'}
        </p>
      </div>

      {isRestoreMode ? <ShareRestorePanel /> : <ShareGeneratePanel />}
    </div>
  )
}
