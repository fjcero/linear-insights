import { LinearClient } from "@linear/sdk";

/**
 * Create a Linear API client from an API key or OAuth access token.
 * Both token types are passed via the `apiKey` option — the Linear SDK treats them identically.
 */
export function createLinearClient(token: string): LinearClient {
  if (!token?.trim()) {
    throw new Error(
      "A Linear token is required. Pass LINEAR_API_KEY (API key) or an OAuth access token."
    );
  }
  return new LinearClient({ apiKey: token.trim() });
}

export interface ViewerInfo {
  id: string;
  name: string;
  email: string;
}

/**
 * Fetch the authenticated user's profile from Linear.
 * Useful after OAuth to get the user ID for cache scoping.
 */
export async function getViewerInfo(client: LinearClient): Promise<ViewerInfo> {
  const viewer = await client.viewer;
  return {
    id: viewer.id,
    name: viewer.name,
    email: viewer.email,
  };
}
