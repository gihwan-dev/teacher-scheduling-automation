import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'

import { buttonVariants } from './button'
import { Card, CardContent } from './card'
import type { IconSvgElement } from '@hugeicons/react'

interface EmptyStateProps {
  icon?: IconSvgElement
  title: string
  description: string
  actionLabel?: string
  actionTo?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionTo,
}: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          {icon && (
            <HugeiconsIcon
              icon={icon}
              strokeWidth={1.5}
              className="size-10 text-muted-foreground"
            />
          )}
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
          {actionLabel && actionTo && (
            <Link
              to={actionTo}
              className={buttonVariants({ className: 'mt-2' })}
            >
              {actionLabel}
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
