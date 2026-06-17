// osu! OAuth v2 helpers
import crypto from "crypto";

export interface OsuTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface OsuUser {
  id: number;
  username: string;
  avatar_url: string;
}

function getClientId(): string {
  const id = process.env.OSU_CLIENT_ID;
  if (!id) throw new Error("Missing OSU_CLIENT_ID");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.OSU_CLIENT_SECRET;
  if (!secret) throw new Error("Missing OSU_CLIENT_SECRET");
  return secret;
}

function getRedirectUri(): string {
  const uri = process.env.OSU_REDIRECT_URI;
  if (!uri) throw new Error("Missing OSU_REDIRECT_URI");
  return uri;
}

// === PKCE Helpers (Node.js native crypto) ===

export async function generatePKCE(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = crypto.randomBytes(64).toString("base64url");

  const hash = crypto.createHash("sha256").update(verifier).digest();
  const challenge = hash.toString("base64url");

  return { verifier, challenge };
}

// === OAuth URL Builder ===

export function buildAuthUrl(
  challenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "identify",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return `https://osu.ppy.sh/oauth/authorize?${params.toString()}`;
}

// === Token Exchange ===

export async function exchangeCode(
  code: string,
  verifier: string
): Promise<OsuTokens> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });

  const res = await fetch("https://osu.ppy.sh/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed: ${text}`);
  }

  return res.json();
}

// === Fetch osu! User ===

export async function getOsuUser(accessToken: string): Promise<OsuUser> {
  const res = await fetch("https://osu.ppy.sh/api/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch osu! user: ${res.status}`);
  }

  return res.json();
}
