import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTeacherPolicyStore } from '@/features/manage-teacher-policy'

export function PolicyValidationSummary() {
  const { validationMessages } = useTeacherPolicyStore()

  const errors = validationMessages.filter((m) => m.severity === 'error')
  const warnings = validationMessages.filter((m) => m.severity === 'warning')

  if (validationMessages.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-center text-sm">
            검증을 실행하면 결과가 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          검증 결과
          {errors.length > 0 && (
            <Badge variant="destructive">오류 {errors.length}</Badge>
          )}
          {warnings.length > 0 && (
            <Badge variant="secondary">경고 {warnings.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {errors.map((msg, i) => (
            <li key={`error-${i}`} className="flex items-start gap-2 text-sm">
              <span className="text-destructive font-medium shrink-0">
                [오류]
              </span>
              <span>
                {msg.message}
                {msg.guide && (
                  <span className="text-muted-foreground ml-1">
                    — {msg.guide}
                  </span>
                )}
              </span>
            </li>
          ))}
          {warnings.map((msg, i) => (
            <li key={`warn-${i}`} className="flex items-start gap-2 text-sm">
              <span className="text-yellow-600 font-medium shrink-0">
                [경고]
              </span>
              <span>{msg.message}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
