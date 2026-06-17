import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
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
    const stateStr = crypto.randomBytes(32)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Store redirect info in state
    const state = `${stateStr}:${redirect}`;

    // Build osu! OAuth URL
    const authUrl = buildAuthUrl(challenge, state);

    // Set cookies using Next.js cookies() API
    const cookieStore = await cookies();
    cookieStore.set("pkce_verifier", verifier, {
      path: "/api/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
    });
    cookieStore.set("oauth_redirect", redirect, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
    });

    // Redirect to osu! OAuth
    const response = NextResponse.redirect(authUrl);
    return applyCorsHeaders(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return applyCorsHeaders(
      Response.json({ error: message }, { status: 500 })
    );
  }
}
