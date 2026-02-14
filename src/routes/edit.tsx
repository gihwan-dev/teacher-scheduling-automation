import { createFileRoute } from '@tanstack/react-router'
import { EditPage } from '@/pages/edit'

export const Route = createFileRoute('/edit')({
  component: EditPage,
})
