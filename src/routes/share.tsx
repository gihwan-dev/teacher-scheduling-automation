import { createFileRoute } from '@tanstack/react-router'
import { SharePage } from '@/pages/share'

export const Route = createFileRoute('/share')({
  component: SharePage,
})
