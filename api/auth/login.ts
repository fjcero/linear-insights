import { handleLogin } from "../../apps/app/server/auth.js";

export async function GET(request: Request): Promise<Response> {
  return handleLogin(request);
}
