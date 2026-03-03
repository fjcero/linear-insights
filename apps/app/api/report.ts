import { handleReportRequest } from "../server/report-handler.js";

export async function GET(request: Request): Promise<Response> {
  try {
    return await handleReportRequest(request);
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err != null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
    console.error("[api/report] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Report failed", details: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
