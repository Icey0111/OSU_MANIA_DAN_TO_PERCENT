import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, generatePKCE } from "@/lib/osu";
import { verifyToken, extractCookieToken } from "@/lib/auth";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import { getSupabaseAdmin } from "@/lib/db";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const { searchParams } = new URL(request.url);
    const redirect = searchParams.get("redirect") || "admin";

    // For overlay: if user already has a valid token cookie, skip OAuth entirely.
    // This enables seamless cross-origin auth sync — the popup opens and closes
    // instantly without showing any login UI.
    if (redirect === "overlay") {
      const cookieToken = extractCookieToken(request);
      if (cookieToken) {
        const payload = await verifyToken(cookieToken);
        if (payload) {
          // Fetch user from DB
          const db = getSupabaseAdmin();
          const { data: user } = await db
            .from("users")
            .select("id, osu_id, osu_username, avatar_url, is_admin")
            .eq("id", payload.sub)
            .single();

          if (user) {
            const token = cookieToken; // reuse the existing JWT
            const html = `<!DOCTYPE html>
<html>
<head><title>Login Complete</title></head>
<body>
<script>
  const data = ${JSON.stringify({
    token,
    user: {
      id: user.id,
      osu_id: user.osu_id,
      username: user.osu_username,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin,
    },
  })};
  if (window.opener) {
    window.opener.postMessage({ type: "osu_auth", ...data }, "*");
    window.close();
  } else if (window.parent !== window) {
    window.parent.postMessage({ type: "osu_auth", ...data }, "*");
  } else {
    document.body.innerHTML = "<p>Login complete. You can close this window.</p>";
  }
</script>
</body>
</html>`;
            return new Response(html, {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }
        }
      }
    }

    // Normal OAuth flow
    const { verifier, challenge } = await generatePKCE();
    const stateStr = crypto.randomBytes(32)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const state = `${stateStr}:${redirect}`;
    const authUrl = buildAuthUrl(challenge, state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("pkce_verifier", verifier, {
      path: "/api/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
    });
    response.cookies.set("oauth_redirect", redirect, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
    });

    return applyCorsHeaders(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return applyCorsHeaders(
      Response.json({ error: message }, { status: 500 })
    );
  }
}
