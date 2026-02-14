import { createFileRoute } from '@tanstack/react-router'
import { GeneratePage } from '@/pages/generate'

export const Route = createFileRoute('/generate')({
  component: GeneratePage,
})
