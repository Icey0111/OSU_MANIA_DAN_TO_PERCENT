import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, generatePKCE } from "@/lib/osu";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import crypto from "crypto";

const OVERLAY_ORIGINS = new Set([
  "http://127.0.0.1:24050",
  "http://localhost:24050",
]);
const secureCookie = process.env.NODE_ENV === "production";

export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // Determine redirect type from query param
    const { searchParams } = new URL(request.url);
    const redirect = searchParams.get("redirect") || "admin";
    if (redirect !== "admin" && redirect !== "overlay") {
      return applyCorsHeaders(
        NextResponse.json({ error: "Invalid login redirect" }, { status: 400 }),
        request
      );
    }
    const openerOrigin = searchParams.get("opener_origin") || "";
    if (redirect === "overlay" && !OVERLAY_ORIGINS.has(openerOrigin)) {
      return applyCorsHeaders(
        NextResponse.json({ error: "Invalid overlay origin" }, { status: 400 }),
        request
      );
    }

    // Generate PKCE and state (Node.js native crypto)
    const { verifier, challenge } = await generatePKCE();
    const stateStr = crypto.randomBytes(32)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Build osu! OAuth URL
    const authUrl = buildAuthUrl(challenge, stateStr);

    // Redirect to osu! OAuth, set cookies directly on response
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("pkce_verifier", verifier, {
      path: "/api/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 600,
    });
    response.cookies.set("oauth_state", stateStr, {
      path: "/api/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 600,
    });
    response.cookies.set("oauth_redirect", redirect, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 600,
    });
    if (redirect === "overlay") {
      response.cookies.set("oauth_opener_origin", openerOrigin, {
        path: "/api/auth/callback",
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        maxAge: 600,
      });
    }

    return applyCorsHeaders(response);
  } catch (error) {
    console.error("OAuth login initialization failed:", error);
    return applyCorsHeaders(
      Response.json({ error: "Failed to initialize osu! login" }, { status: 500 })
    );
  }
}
