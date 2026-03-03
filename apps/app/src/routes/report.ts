import { createFileRoute } from '@tanstack/react-router'
import { handleReportRequest } from '#/server/report-handler'

export const Route = createFileRoute('/report')({
  server: {
    handlers: {
      GET: async ({ request }) => handleReportRequest(request),
    },
  },
})
