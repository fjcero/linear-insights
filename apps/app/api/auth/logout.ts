import { handleLogout } from "../../server/auth.js";

export default {
  async fetch(request: Request): Promise<Response> {
    return request.method === "POST" ? handleLogout(request) : new Response("Method not allowed", { status: 405 });
  },
};
