import { handleReportRequest } from "../server/report-handler.js";

export default {
  async fetch(request: Request): Promise<Response> {
    return request.method === "GET" ? handleReportRequest(request) : new Response("Method not allowed", { status: 405 });
  },
};
