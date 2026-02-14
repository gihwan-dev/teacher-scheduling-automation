import type { ConstraintViolation } from '@/entities/constraint-policy'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface EditValidationPanelProps {
  violations: Array<ConstraintViolation>
}

export function EditValidationPanel({ violations }: EditValidationPanelProps) {
  if (violations.length === 0) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">제약 위반 없음</p>
        </CardContent>
      </Card>
    )
  }

  const errors = violations.filter((v) => v.severity === 'error')
  const warnings = violations.filter((v) => v.severity === 'warning')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          제약 검증 결과
          <span className="ml-2 text-muted-foreground font-normal">
            {errors.length > 0 && `오류 ${errors.length}건`}
            {errors.length > 0 && warnings.length > 0 && ' / '}
            {warnings.length > 0 && `경고 ${warnings.length}건`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {violations.map((v, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span
                className={v.severity === 'error' ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-400'}
                aria-label={v.severity === 'error' ? '오류' : '경고'}
              >
                {v.severity === 'error' ? '●' : '▲'}
              </span>
              <span>{v.message}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
