import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, getOsuUser } from "@/lib/osu";
import { signToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";
import { applyCorsHeaders, handleCors } from "@/lib/cors";
import crypto from "crypto";

const OVERLAY_ORIGINS = new Set([
  "http://127.0.0.1:24050",
  "http://localhost:24050",
]);
const secureCookie = process.env.NODE_ENV === "production";

function statesMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Missing authorization code" }, { status: 400 })
    );
  }

  // Get PKCE verifier from cookie using Next.js cookies() API
  const cookieStore = await cookies();
  const verifier = cookieStore.get("pkce_verifier")?.value;
  const expectedState = cookieStore.get("oauth_state")?.value;
  const redirectCookie = cookieStore.get("oauth_redirect")?.value;
  const redirect = redirectCookie === "overlay" ? "overlay" : "admin";
  const openerOrigin = cookieStore.get("oauth_opener_origin")?.value || "";

  if (!verifier || !expectedState || !statesMatch(state, expectedState)) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 })
    );
  }
  if (redirect === "overlay" && !OVERLAY_ORIGINS.has(openerOrigin)) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid overlay origin" }, { status: 400 })
    );
  }

  try {
    // Exchange code for token
    let tokens;
    try {
      tokens = await exchangeCode(code, verifier);
    } catch {
      return applyCorsHeaders(
        NextResponse.json({ error: "Token exchange failed" }, { status: 502 })
      );
    }

    // Fetch osu! user
    let osuUser;
    try {
      osuUser = await getOsuUser(tokens.access_token);
    } catch {
      return applyCorsHeaders(
        NextResponse.json({ error: "Failed to fetch osu! user" }, { status: 502 })
      );
    }

    // Upsert user in database
    let user;
    try {
      const db = getSupabaseAdmin();
      const result = await db
        .from("users")
        .upsert(
          {
            osu_id: osuUser.id,
            osu_username: osuUser.username,
            avatar_url: osuUser.avatar_url,
            last_login_at: new Date().toISOString(),
          },
          { onConflict: "osu_id" }
        )
        .select("id, osu_id, osu_username, avatar_url, is_admin")
        .single();

      user = result.data;
      if (!user) {
        throw new Error("No user data returned: " + JSON.stringify(result.error));
      }
    } catch {
      return applyCorsHeaders(
        NextResponse.json({ error: "Database upsert failed" }, { status: 500 })
      );
    }

    // Sign JWT
    const token = await signToken({
      sub: user.id,
      osu_id: user.osu_id,
      username: user.osu_username,
      is_admin: user.is_admin || false,
    });

    if (redirect === "overlay") {
      // Return HTML that posts message to opener and closes
      const serializedData = JSON.stringify({
        token,
        user: {
          id: user.id,
          osu_id: user.osu_id,
          username: user.osu_username,
          avatar_url: user.avatar_url,
          is_admin: user.is_admin,
        },
      }).replace(/</g, "\\u003c");
      const html = `<!DOCTYPE html>
<html>
<head><title>Login Complete</title></head>
<body>
<script>
  const data = ${serializedData};
  if (window.opener) {
    window.opener.postMessage({ type: "osu_auth", ...data }, ${JSON.stringify(openerOrigin)});
    window.close();
  } else {
    document.body.innerHTML = "<p>Login complete. You can close this window.</p>";
  }
</script>
</body>
</html>`;

      const response = new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      for (const name of ["pkce_verifier", "oauth_state", "oauth_opener_origin"]) {
        response.cookies.set(name, "", {
          path: "/api/auth/callback",
          httpOnly: true,
          sameSite: "lax",
          secure: secureCookie,
          maxAge: 0,
        });
      }
      response.cookies.set("oauth_redirect", "", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        maxAge: 0,
      });
      return response;
    }

    // Admin flow: set JWT token cookie and clear PKCE verifier
    const response = NextResponse.redirect(new URL("/admin", request.url));
    response.cookies.set("token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set("pkce_verifier", "", {
      path: "/api/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 0,
    });
    response.cookies.set("oauth_state", "", {
      path: "/api/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 0,
    });
    response.cookies.set("oauth_redirect", "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 0,
    });
    response.cookies.set("oauth_opener_origin", "", {
      path: "/api/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 0,
    });

    return applyCorsHeaders(response);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return applyCorsHeaders(
      NextResponse.json({ error: "Authentication failed" }, { status: 500 })
    );
  }
}
