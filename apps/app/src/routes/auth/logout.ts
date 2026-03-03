import { createFileRoute } from '@tanstack/react-router'
import { handleLogout } from '#/server/auth'

export const Route = createFileRoute('/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => handleLogout(request),
    },
  },
})
