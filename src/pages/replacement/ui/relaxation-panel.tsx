import { useReplacementStore } from '@/features/find-replacement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function RelaxationPanel() {
  const { searchResult } = useReplacementStore()

  if (!searchResult) return null
  if (searchResult.candidates.length > 0) return null
  if (searchResult.relaxationSuggestions.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">완화 제안</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">
          현재 조건으로는 교체 후보가 없습니다. 아래 제약을 완화하면 후보를 찾을 수 있습니다.
        </p>
        {searchResult.relaxationSuggestions.map((suggestion, index) => (
          <div key={index} className="flex items-start gap-2 rounded-md border p-3">
            <Badge
              variant={
                suggestion.priority === 'high'
                  ? 'destructive'
                  : suggestion.priority === 'medium'
                    ? 'default'
                    : 'secondary'
              }
              className="shrink-0 text-[10px] mt-0.5"
            >
              {suggestion.priority === 'high' ? '높음' : suggestion.priority === 'medium' ? '보통' : '낮음'}
            </Badge>
            <p className="text-sm">{suggestion.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
