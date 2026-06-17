import { NextRequest } from "next/server";
import { buildAuthUrl, generatePKCE } from "@/lib/osu";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // Determine redirect type from query param
    const { searchParams } = new URL(request.url);
    const redirect = searchParams.get("redirect") || "admin";

    // Generate PKCE and state (Node.js native crypto)
    const { verifier, challenge } = await generatePKCE();
    const stateStr = crypto.randomBytes(32).toString("base64url");

    // Store redirect info in state
    const state = `${stateStr}:${redirect}`;

    // Build osu! OAuth URL
    const authUrl = buildAuthUrl(challenge, state);

    // Use new Response() instead of Response.redirect() to allow setting cookies
    const response = new Response(null, {
      status: 302,
      headers: { Location: authUrl },
    });
    response.headers.set(
      "Set-Cookie",
      `pkce_verifier=${verifier}; Path=/api/auth/callback; HttpOnly; SameSite=Lax; Max-Age=600`
    );
    response.headers.append(
      "Set-Cookie",
      `oauth_redirect=${redirect}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    );

    return applyCorsHeaders(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return applyCorsHeaders(
      Response.json({ error: message }, { status: 500 })
    );
  }
}
