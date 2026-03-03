import { handleCallback } from "../../server/auth.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    return handleCallback(request);
  },
};
