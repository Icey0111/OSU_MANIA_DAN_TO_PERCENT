import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { JwtPayload, verifyToken } from "@/lib/auth";

const CORS_ORIGINS = [
  "http://127.0.0.1:24050",
  "http://localhost:24050",
  "tosu://server",
  "null",
];

function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const allowOrigin = origin && CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

async function isCurrentAdmin(payload: JwtPayload): Promise<boolean> {
  if (!payload.is_admin) return false;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  try {
    const response = await fetch(
      `${url}/rest/v1/users?id=eq.${payload.sub}&select=osu_id,is_admin`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      }
    );
    if (!response.ok) return false;
    const users = (await response.json()) as Array<{ osu_id: number; is_admin: boolean }>;
    return users.length === 1 && users[0].is_admin && users[0].osu_id === payload.osu_id;
  } catch {
    return false;
  }
}

async function hasCurrentAdminAccess(token: string): Promise<boolean> {
  const payload = await verifyToken(token);
  return Boolean(payload && await isCurrentAdmin(payload));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("Origin");

  // Handle CORS preflight for overlay API routes
  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    return addCorsHeaders(new NextResponse(null, { status: 204 }), origin);
  }

  // Add CORS headers to all overlay API responses
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    addCorsHeaders(response, origin);

    // Also protect /api/admin routes (require cookie auth)
    if (pathname.startsWith("/api/admin")) {
      const token = request.cookies.get("token")?.value;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!(await hasCurrentAdminAccess(token))) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    return response;
  }

  // Protect /admin pages (excluding /admin/login)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get("token")?.value;

    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!(await hasCurrentAdminAccess(token))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};
