import { handleReportRequest } from "../apps/app/server/report-handler.js";

export async function GET(request: Request): Promise<Response> {
  try {
    return await handleReportRequest(request);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : String(err);
    console.error("[api/report] Error:", err);
    return new Response(
      JSON.stringify({ error: "Report failed", details: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
