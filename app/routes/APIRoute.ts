import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/APIRoute')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/APIRoute"!</div>
}
