import { handleReportRequest } from "../server/report-handler.js";

export async function GET(request: Request): Promise<Response> {
  return handleReportRequest(request);
}
