import { handleMe } from "../../server/auth.js";

export default {
  async fetch(request: Request): Promise<Response> {
    return request.method === "GET" ? handleMe(request) : new Response("Method not allowed", { status: 405 });
  },
};
