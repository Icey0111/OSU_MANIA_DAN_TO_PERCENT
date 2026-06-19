import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  const secure = process.env.NODE_ENV === "production";
  const expiredCookie = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    expires: new Date(0),
    maxAge: 0,
    secure,
  };

  response.cookies.set("token", "", expiredCookie);
  response.cookies.set("pkce_verifier", "", {
    ...expiredCookie,
    path: "/api/auth/callback",
  });
  response.cookies.set("oauth_redirect", "", expiredCookie);
  response.cookies.set("oauth_state", "", {
    ...expiredCookie,
    path: "/api/auth/callback",
  });
  response.cookies.set("oauth_opener_origin", "", {
    ...expiredCookie,
    path: "/api/auth/callback",
  });

  response.headers.set("Cache-Control", "no-store");
  return response;
}
