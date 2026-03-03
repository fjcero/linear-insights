import { handleLogout } from "../../server/auth.js";

export async function POST(request: Request): Promise<Response> {
  return handleLogout(request);
}
