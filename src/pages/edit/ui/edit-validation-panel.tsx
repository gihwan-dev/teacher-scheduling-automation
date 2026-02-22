import type { ValidationViolation } from '@/entities/schedule-transaction'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ValidationViolationList } from '@/components/ui/validation-violation-list'

interface EditValidationPanelProps {
  violations: Array<ValidationViolation>
}

export function EditValidationPanel({ violations }: EditValidationPanelProps) {
  if (violations.length === 0) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">
            제약 위반 없음
          </p>
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
        <ValidationViolationList violations={violations} />
      </CardContent>
    </Card>
  )
}
