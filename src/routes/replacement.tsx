import { createFileRoute } from '@tanstack/react-router'
import { ReplacementPage } from '@/pages/replacement'

export const Route = createFileRoute('/replacement')({
  component: ReplacementPage,
})
