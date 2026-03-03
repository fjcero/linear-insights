import { createFileRoute } from '@tanstack/react-router'
import { handleLogin } from '#/server/auth'

export const Route = createFileRoute('/auth/login')({
  server: {
    handlers: {
      GET: async ({ request }) => handleLogin(request),
    },
  },
})
