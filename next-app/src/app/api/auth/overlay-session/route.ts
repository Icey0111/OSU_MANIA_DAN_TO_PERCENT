import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { applyCorsHeaders, handleCors } from "@/lib/cors";
import { getSupabaseAdmin } from "@/lib/db";

const INSTALLATION_ID_PATTERN = /^[a-f0-9]{64}$/;
const SESSION_LIFETIME_MS = 10 * 60 * 1000;

function hashInstallationId(installationId: string): string {
  return createHash("sha256").update(installationId).digest("hex");
}

function json(request: Request, body: unknown, status = 200): Response {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return applyCorsHeaders(response, request);
}

export async function OPTIONS(request: NextRequest) {
  return handleCors(request) || new Response(null, { status: 204 });
}

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request);
  if (!token || !(await verifyToken(token))) {
    return json(request, { error: "Unauthorized" }, 401);
  }

  let installationId = "";
  try {
    const body = await request.json();
    installationId = String(body.installation_id || "");
  } catch {
    return json(request, { error: "Invalid JSON body" }, 400);
  }

  if (!INSTALLATION_ID_PATTERN.test(installationId)) {
    return json(request, { error: "Invalid installation ID" }, 400);
  }

  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
  const { error } = await getSupabaseAdmin()
    .from("overlay_auth_sessions")
    .upsert(
      {
        installation_hash: hashInstallationId(installationId),
        token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "installation_hash" }
    );

  if (error) {
    console.error("Overlay auth publish failed:", error);
    return json(request, { error: "Failed to publish overlay login" }, 500);
  }

  return json(request, { success: true, expires_at: expiresAt });
}

export async function GET(request: NextRequest) {
  const installationId = request.nextUrl.searchParams.get("installation_id") || "";
  if (!INSTALLATION_ID_PATTERN.test(installationId)) {
    return json(request, { error: "Invalid installation ID" }, 400);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("overlay_auth_sessions")
    .select("token, expires_at")
    .eq("installation_hash", hashInstallationId(installationId))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Overlay auth claim failed:", error);
    return json(request, { error: "Failed to check overlay login" }, 500);
  }
  if (!data) {
    return json(request, { token: null });
  }
  if (!(await verifyToken(data.token))) {
    return json(request, { token: null });
  }

  const { error: deleteError } = await getSupabaseAdmin()
    .from("overlay_auth_sessions")
    .delete()
    .eq("installation_hash", hashInstallationId(installationId));
  if (deleteError) {
    console.error("Overlay auth consume failed:", deleteError);
    return json(request, { error: "Failed to consume overlay login" }, 500);
  }

  return json(request, { token: data.token, expires_at: data.expires_at });
}
