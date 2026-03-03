import { createFileRoute } from '@tanstack/react-router'
import { handleCallback } from '#/server/auth'

export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => handleCallback(request),
    },
  },
})
