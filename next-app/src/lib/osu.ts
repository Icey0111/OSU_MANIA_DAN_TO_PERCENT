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

export interface OsuBeatmapMetadata {
  osu_beatmap_id: number;
  beatmapset_id: number;
  artist: string;
  title: string;
  version: string;
  creator: string;
}

export class OsuApiError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "not_mania" | "unavailable"
  ) {
    super(message);
    this.name = "OsuApiError";
  }
}

interface ClientCredentialsToken {
  accessToken: string;
  expiresAt: number;
}

interface CachedBeatmap {
  metadata: OsuBeatmapMetadata;
  expiresAt: number;
}

const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const BEATMAP_CACHE_TTL_MS = 10 * 60_000;
const MAX_BEATMAP_CACHE_ENTRIES = 500;
let clientCredentialsToken: ClientCredentialsToken | null = null;
let clientCredentialsRequest: Promise<ClientCredentialsToken> | null = null;
const beatmapCache = new Map<number, CachedBeatmap>();

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

// === PKCE Helpers ===

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function generatePKCE(): Promise<{
  verifier: string;
  challenge: string;
}> {
  // 43 bytes → ~58 base64 chars, meets PKCE minimum of 43
  const verifier = toBase64Url(crypto.randomBytes(43));

  const hash = crypto.createHash("sha256").update(verifier).digest();
  const challenge = toBase64Url(hash);

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

async function requestClientCredentialsToken(): Promise<ClientCredentialsToken> {
  const res = await fetch("https://osu.ppy.sh/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: Number(getClientId()),
      client_secret: getClientSecret(),
      grant_type: "client_credentials",
      scope: "public",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new OsuApiError(
      `osu! client credentials request failed with status ${res.status}`,
      "unavailable"
    );
  }

  const data = (await res.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof data.access_token !== "string" || typeof data.expires_in !== "number") {
    throw new OsuApiError("osu! returned an invalid token response", "unavailable");
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1_000,
  };
}

async function getClientCredentialsToken(): Promise<string> {
  if (
    clientCredentialsToken &&
    clientCredentialsToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()
  ) {
    return clientCredentialsToken.accessToken;
  }

  if (!clientCredentialsRequest) {
    clientCredentialsRequest = requestClientCredentialsToken().finally(() => {
      clientCredentialsRequest = null;
    });
  }

  clientCredentialsToken = await clientCredentialsRequest;
  return clientCredentialsToken.accessToken;
}

function cacheBeatmap(metadata: OsuBeatmapMetadata): void {
  if (beatmapCache.size >= MAX_BEATMAP_CACHE_ENTRIES) {
    const oldestKey = beatmapCache.keys().next().value;
    if (oldestKey !== undefined) beatmapCache.delete(oldestKey);
  }
  beatmapCache.set(metadata.osu_beatmap_id, {
    metadata,
    expiresAt: Date.now() + BEATMAP_CACHE_TTL_MS,
  });
}

async function requestOsuBeatmap(
  beatmapId: number,
  retryUnauthorized = true
): Promise<OsuBeatmapMetadata> {
  const accessToken = await getClientCredentialsToken();
  const res = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (res.status === 401 && retryUnauthorized) {
    clientCredentialsToken = null;
    return requestOsuBeatmap(beatmapId, false);
  }
  if (res.status === 404) {
    throw new OsuApiError("Beatmap not found on osu!", "not_found");
  }
  if (!res.ok) {
    throw new OsuApiError(
      `osu! beatmap request failed with status ${res.status}`,
      "unavailable"
    );
  }

  const data = (await res.json()) as {
    id?: unknown;
    beatmapset_id?: unknown;
    mode?: unknown;
    mode_int?: unknown;
    version?: unknown;
    beatmapset?: {
      artist?: unknown;
      title?: unknown;
      creator?: unknown;
    };
  };

  if (data.mode_int !== 3 && data.mode !== "mania") {
    throw new OsuApiError("Only osu!mania beatmaps can be voted on", "not_mania");
  }

  const set = data.beatmapset;
  if (
    data.id !== beatmapId ||
    typeof data.beatmapset_id !== "number" ||
    typeof data.version !== "string" ||
    typeof set?.artist !== "string" ||
    typeof set.title !== "string" ||
    typeof set.creator !== "string"
  ) {
    throw new OsuApiError("osu! returned incomplete beatmap metadata", "unavailable");
  }

  const metadata: OsuBeatmapMetadata = {
    osu_beatmap_id: data.id,
    beatmapset_id: data.beatmapset_id,
    artist: set.artist,
    title: set.title,
    version: data.version,
    creator: set.creator,
  };
  cacheBeatmap(metadata);
  return metadata;
}

export async function getOsuBeatmap(beatmapId: number): Promise<OsuBeatmapMetadata> {
  const cached = beatmapCache.get(beatmapId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.metadata;
  }
  if (cached) beatmapCache.delete(beatmapId);

  try {
    return await requestOsuBeatmap(beatmapId);
  } catch (error) {
    if (error instanceof OsuApiError) throw error;
    console.error("osu! beatmap verification failed:", error);
    throw new OsuApiError("Unable to verify beatmap with osu!", "unavailable");
  }
}
