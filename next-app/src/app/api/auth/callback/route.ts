import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, getOsuUser } from "@/lib/osu";
import { signToken } from "@/lib/auth";
import { getSupabase } from "@/lib/db";
import { applyCorsHeaders, handleCors } from "@/lib/cors";

export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Missing authorization code" }, { status: 400 })
    );
  }

  // Extract redirect type from state (format: "random:redirect")
  const stateParts = state?.split(":") || [];
  const redirect = stateParts.length > 1 ? stateParts[1] : "admin";

  // Get PKCE verifier from cookie using Next.js cookies() API
  const cookieStore = await cookies();
  const verifier = cookieStore.get("pkce_verifier")?.value;

  if (!verifier) {
    const hasAnyCookies = cookieStore.getAll().length > 0;
    return applyCorsHeaders(
      NextResponse.json({
        error: "Missing PKCE verifier",
        debug: {
          hasCookie: hasAnyCookies,
          cookieCount: cookieStore.getAll().length,
          hasCode: !!code,
        },
      }, { status: 400 })
    );
  }

  try {
    // Exchange code for token
    let tokens;
    try {
      tokens = await exchangeCode(code, verifier);
    } catch (e) {
      return applyCorsHeaders(
        NextResponse.json({
          error: "Token exchange failed",
          detail: e instanceof Error ? e.message : String(e),
        }, { status: 500 })
      );
    }

    // Fetch osu! user
    let osuUser;
    try {
      osuUser = await getOsuUser(tokens.access_token);
    } catch (e) {
      return applyCorsHeaders(
        NextResponse.json({
          error: "Failed to fetch osu! user",
          detail: e instanceof Error ? e.message : String(e),
        }, { status: 500 })
      );
    }

    // Upsert user in database
    let user;
    try {
      const db = getSupabase();
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
    } catch (e) {
      return applyCorsHeaders(
        NextResponse.json({
          error: "Database upsert failed",
          detail: e instanceof Error ? e.message : String(e),
        }, { status: 500 })
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

    // Admin flow: set JWT token cookie and clear PKCE verifier
    cookieStore.set("token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    cookieStore.set("pkce_verifier", "", {
      path: "/api/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
    });

    const response = NextResponse.redirect(new URL("/admin", request.url));
    return applyCorsHeaders(response);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return applyCorsHeaders(
      NextResponse.json({ error: "Authentication failed" }, { status: 500 })
    );
  }
}
