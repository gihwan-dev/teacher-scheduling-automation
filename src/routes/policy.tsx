import { createFileRoute } from '@tanstack/react-router'
import { PolicyPage } from '@/pages/policy'

export const Route = createFileRoute('/policy')({
  component: PolicyPage,
})
