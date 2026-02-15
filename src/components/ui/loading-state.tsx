import { Spinner } from './spinner'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({
  message = '데이터 불러오는 중...',
}: LoadingStateProps) {
  return (
    <div
      className="flex h-64 flex-col items-center justify-center gap-3"
      aria-busy="true"
    >
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
