/**
 * Linear OAuth 2.0 handlers and stateless session utilities.
 *
 * Session cookie format:  linear_session=<base64url(JSON)>.<hmac-sha256>
 * The payload is signed with SESSION_SECRET so it cannot be forged.
 * The access_token is stored inside the (signed) cookie — no server-side
 * session store is required.
 *
 * Required env vars:
 *   LINEAR_CLIENT_ID      — from Linear OAuth app settings
 *   LINEAR_CLIENT_SECRET  — from Linear OAuth app settings
 *   LINEAR_REDIRECT_URI   — e.g. http://localhost:5173/auth/callback
 *   SESSION_SECRET        — 32+ random chars for HMAC signing
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LINEAR_AUTH_URL = "https://linear.app/oauth/authorize";
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

const CLIENT_ID = process.env.LINEAR_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.LINEAR_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.LINEAR_REDIRECT_URI ?? "";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";
const COOKIE_NAME = "linear_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function assertConfig(): void {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error(
      "Missing OAuth config. Set LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, and LINEAR_REDIRECT_URI."
    );
  }
  if (!SESSION_SECRET || SESSION_SECRET.length < 16) {
    throw new Error(
      "SESSION_SECRET must be at least 16 characters. Set it in your environment."
    );
  }
}

// ---------------------------------------------------------------------------
// Session payload
// ---------------------------------------------------------------------------

export interface SessionPayload {
  userId: string;
  name: string;
  email: string;
  accessToken: string;
  /** Expiry: Unix timestamp in seconds */
  exp: number;
}

// ---------------------------------------------------------------------------
// Cookie signing (HMAC-SHA256, constant-time comparison)
// ---------------------------------------------------------------------------

function b64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function fromB64url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

export function encodeSession(payload: SessionPayload): string {
  const encoded = b64url(JSON.stringify(payload));
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

export function decodeSession(cookieValue: string): SessionPayload | null {
  if (!SESSION_SECRET) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  // Constant-time comparison
  const expected = sign(encoded);
  try {
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(encoded)) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie header helpers
// ---------------------------------------------------------------------------

function cookieHeader(value: string, maxAge: number): string {
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const eq = part.indexOf("=");
      return eq === -1
        ? [part.trim(), ""]
        : [part.slice(0, eq).trim(), part.slice(eq + 1).trim()];
    })
  );
}

/** Extract and validate the session from a request. Returns null if absent or invalid. */
export function getSession(req: Request): SessionPayload | null {
  if (!SESSION_SECRET) return null;
  const cookies = parseCookies(req.headers.get("Cookie"));
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  return decodeSession(raw);
}

// ---------------------------------------------------------------------------
// Linear API helpers
// ---------------------------------------------------------------------------

async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access_token in token response");
  return data.access_token;
}

async function fetchViewer(accessToken: string): Promise<{ id: string; name: string; email: string }> {
  const res = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "{ viewer { id name email } }" }),
  });
  if (!res.ok) throw new Error(`Failed to fetch viewer (${res.status})`);
  const data = (await res.json()) as { data?: { viewer?: { id: string; name: string; email: string } } };
  const viewer = data.data?.viewer;
  if (!viewer) throw new Error("Could not read viewer from Linear response");
  return viewer;
}

// ---------------------------------------------------------------------------
// Route handlers — called by report-api.ts
// ---------------------------------------------------------------------------

/** GET /auth/login — redirect user to Linear OAuth consent screen */
export function handleLogin(req: Request): Response {
  assertConfig();
  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "read",
    state,
    actor: "user",
  });
  const url = `${LINEAR_AUTH_URL}?${params}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      // State is kept client-side only here; for production add a signed state cookie.
      "Set-Cookie": `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=600`,
    },
  });
}

/** GET /auth/callback — exchange code, create session, redirect to app root */
export async function handleCallback(req: Request): Promise<Response> {
  assertConfig();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }
  if (!code) {
    return new Response("Missing code parameter", { status: 400 });
  }

  try {
    const accessToken = await exchangeCode(code);
    const viewer = await fetchViewer(accessToken);

    const payload: SessionPayload = {
      userId: viewer.id,
      name: viewer.name,
      email: viewer.email,
      accessToken,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    };

    const sessionValue = encodeSession(payload);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": cookieHeader(sessionValue, SESSION_TTL_SECONDS),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth callback failed";
    console.error("[auth/callback]", msg);
    return new Response(`Authentication failed: ${msg}`, { status: 500 });
  }
}

/** POST /auth/logout — clear the session cookie */
export function handleLogout(_req: Request): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookieHeader(),
    },
  });
}

/** GET /auth/me — return session info or 401 */
export function handleMe(req: Request): Response {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(
    JSON.stringify({ userId: session.userId, name: session.name, email: session.email }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
