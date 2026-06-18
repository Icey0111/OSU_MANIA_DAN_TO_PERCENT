import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  const expiredCookie = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    expires: new Date(0),
    maxAge: 0,
  };

  response.cookies.set("token", "", expiredCookie);
  response.cookies.set("pkce_verifier", "", {
    ...expiredCookie,
    path: "/api/auth/callback",
  });
  response.cookies.set("oauth_redirect", "", expiredCookie);

  response.headers.set("Cache-Control", "no-store");
  return response;
}
