import { createFileRoute } from '@tanstack/react-router'
import { handleMe } from '#/server/auth'

export const Route = createFileRoute('/auth/me')({
  server: {
    handlers: {
      GET: async ({ request }) => handleMe(request),
    },
  },
})
