import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useShareStore } from '@/features/share-by-url'
import { URL_LENGTH_MAX, URL_LENGTH_WARNING } from '@/shared/lib/url'

function getLengthVariant(length: number) {
  if (length === 0) return null
  if (length < 4000) return { label: '양호', variant: 'secondary' as const }
  if (length < URL_LENGTH_WARNING)
    return { label: '보통', variant: 'outline' as const }
  if (length < URL_LENGTH_MAX)
    return { label: '주의', variant: 'destructive' as const }
  return { label: '초과', variant: 'destructive' as const }
}

export function ShareGeneratePanel() {
  const {
    generatedUrl,
    urlLength,
    isGenerating,
    generateError,
    generateShareUrl,
  } = useShareStore()

  const lengthInfo = getLengthVariant(urlLength)

  const handleCopy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    toast.success('클립보드에 복사했습니다')
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-3">
            <Button onClick={generateShareUrl} disabled={isGenerating}>
              {isGenerating ? '생성 중...' : '공유 링크 생성'}
            </Button>
            {lengthInfo && (
              <Badge variant={lengthInfo.variant}>
                {urlLength.toLocaleString()}자 · {lengthInfo.label}
              </Badge>
            )}
          </div>

          {generateError && (
            <Card>
              <CardContent className="py-3">
                <p className="text-sm text-destructive">{generateError}</p>
              </CardContent>
            </Card>
          )}

          {generatedUrl && (
            <div className="space-y-2">
              <textarea
                readOnly
                value={generatedUrl}
                rows={3}
                className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 text-xs font-mono break-all"
              />
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                복사
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
