import { handleLogout } from "../../apps/app/server/auth.js";

export async function POST(request: Request): Promise<Response> {
  return handleLogout(request);
}
