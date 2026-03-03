import { handleMe } from "../../server/auth.js";

export async function GET(request: Request): Promise<Response> {
  return handleMe(request);
}
