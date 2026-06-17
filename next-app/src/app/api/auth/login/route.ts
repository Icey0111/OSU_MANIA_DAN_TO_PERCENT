import { NextRequest } from "next/server";
import { buildAuthUrl, generatePKCE } from "@/lib/osu";
import { handleCors, applyCorsHeaders } from "@/lib/cors";

export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  // Determine redirect type from query param
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get("redirect") || "admin";

  // Generate PKCE and state
  const { verifier, challenge } = await generatePKCE();
  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  let stateBinary = "";
  for (let i = 0; i < stateBytes.length; i++) {
    stateBinary += String.fromCharCode(stateBytes[i]);
  }
  const stateStr = btoa(stateBinary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // Store redirect info in state
  const state = `${stateStr}:${redirect}`;

  // Build osu! OAuth URL
  const authUrl = buildAuthUrl(challenge, state);

  // Set PKCE verifier in a short-lived cookie (used in callback)
  const response = Response.redirect(authUrl);
  response.headers.set(
    "Set-Cookie",
    `pkce_verifier=${verifier}; Path=/api/auth/callback; HttpOnly; SameSite=Lax; Max-Age=600`
  );
  response.headers.set(
    "Set-Cookie",
    `oauth_redirect=${redirect}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
  );

  return applyCorsHeaders(response);
}
