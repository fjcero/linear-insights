import { LinearClient } from "@linear/sdk";

const API_KEY = process.env.LINEAR_API_KEY;

function getClient(): LinearClient {
  if (!API_KEY?.trim()) {
    throw new Error("LINEAR_API_KEY is not set. Add it to .env.local and use direnv (or export it).");
  }
  return new LinearClient({ apiKey: API_KEY.trim() });
}

let client: LinearClient | null = null;

/**
 * Returns the shared Linear client (uses LINEAR_API_KEY from env).
 * Uses a singleton so the same client is reused.
 */
export function getLinearClient(): LinearClient {
  if (!client) {
    client = getClient();
  }
  return client;
}

/**
 * Optional: pass an API key explicitly (e.g. for tests or multiple keys).
 */
export function createLinearClient(apiKey: string): LinearClient {
  return new LinearClient({ apiKey: apiKey.trim() });
}
