import { verifyToken, extractCookieToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";
import { handleCors } from "@/lib/cors";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  // Always return HTML, never redirect — safe for hidden iframe use
  const cookieToken = extractCookieToken(request);
  if (!cookieToken) {
    const html = `<!DOCTYPE html><html><body><script>
window.parent.postMessage({ type: "osu_auth", error: "not_logged_in" }, "*");
</script></body></html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const payload = await verifyToken(cookieToken);
  if (!payload) {
    const html = `<!DOCTYPE html><html><body><script>
window.parent.postMessage({ type: "osu_auth", error: "invalid_token" }, "*");
</script></body></html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const db = getSupabaseAdmin();
  const { data: user } = await db
    .from("users")
    .select("id, osu_id, osu_username, avatar_url, is_admin")
    .eq("id", payload.sub)
    .single();

  if (!user) {
    const html = `<!DOCTYPE html><html><body><script>
window.parent.postMessage({ type: "osu_auth", error: "user_not_found" }, "*");
</script></body></html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const html = `<!DOCTYPE html>
<html>
<head><title>Auth Check</title></head>
<body>
<script>
window.parent.postMessage({
  type: "osu_auth",
  token: ${JSON.stringify(cookieToken)},
  user: ${JSON.stringify({
    id: user.id,
    osu_id: user.osu_id,
    username: user.osu_username,
    avatar_url: user.avatar_url,
    is_admin: user.is_admin,
  })},
}, "*");
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
