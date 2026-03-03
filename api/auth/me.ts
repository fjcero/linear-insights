import { handleMe } from "../../apps/app/server/auth.js";

export async function GET(request: Request): Promise<Response> {
  return handleMe(request);
}
