import { handleReportRequest } from "../server/report-handler.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
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
  },
};
