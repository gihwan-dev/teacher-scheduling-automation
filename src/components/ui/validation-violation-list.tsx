import type { ValidationViolation } from '@/entities/schedule-transaction'
import { Badge } from '@/components/ui/badge'

interface ValidationViolationListProps {
  violations: Array<ValidationViolation>
}

export function ValidationViolationList({
  violations,
}: ValidationViolationListProps) {
  if (violations.length === 0) {
    return null
  }

  return (
    <ul className="space-y-2">
      {violations.map((violation, index) => (
        <li key={`${violation.ruleId}-${index}`} className="flex items-start gap-2 text-sm">
          <Badge
            variant={violation.severity === 'error' ? 'destructive' : 'secondary'}
            className="mt-0.5 shrink-0"
          >
            {violation.severity === 'error' ? '오류' : '경고'}
          </Badge>
          <div className="min-w-0 space-y-1">
            <p>{violation.humanMessage}</p>
            <p className="text-xs text-muted-foreground">{violation.ruleId}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
