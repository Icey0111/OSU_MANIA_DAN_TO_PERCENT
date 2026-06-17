// CORS helper for API routes

const ALLOWED_ORIGINS = [
  "http://127.0.0.1:24050",
  "http://localhost:24050",
];

function resolveOrigin(request?: Request): string {
  const origin = request?.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

export function handleCors(request: Request): Response | null {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": resolveOrigin(request),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  return null;
}

// request is optional: if omitted, falls back to 127.0.0.1 (for admin/server-side flows)
export function applyCorsHeaders(response: Response, request?: Request): Response {
  response.headers.set("Access-Control-Allow-Origin", resolveOrigin(request));
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}
