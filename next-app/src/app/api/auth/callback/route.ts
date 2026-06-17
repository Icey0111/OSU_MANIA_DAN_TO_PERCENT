import { NextRequest, NextResponse } from "next/server";
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

  // Get PKCE verifier from cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const verifierMatch = cookieHeader.match(/pkce_verifier=([^;]+)/);
  const verifier = verifierMatch ? verifierMatch[1] : null;

  if (!verifier) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Missing PKCE verifier" }, { status: 400 })
    );
  }

  try {
    // Exchange code for token
    const tokens = await exchangeCode(code, verifier);

    // Fetch osu! user
    const osuUser = await getOsuUser(tokens.access_token);

    // Upsert user in database
    const db = getSupabase();
    const { data: user } = await db
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

    if (!user) {
      throw new Error("Failed to upsert user");
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

    // Admin flow: set cookie and redirect to admin
    const response = NextResponse.redirect(new URL("/admin", request.url));
    response.headers.set(
      "Set-Cookie",
      `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
    );
    // Clear PKCE verifier
    response.headers.append(
      "Set-Cookie",
      "pkce_verifier=; Path=/api/auth/callback; HttpOnly; SameSite=Lax; Max-Age=0"
    );

    return applyCorsHeaders(response);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return applyCorsHeaders(
      NextResponse.json({ error: "Authentication failed" }, { status: 500 })
    );
  }
}
