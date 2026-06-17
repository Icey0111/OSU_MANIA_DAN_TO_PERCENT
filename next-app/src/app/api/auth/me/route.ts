import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import { getSupabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const token = extractBearerToken(request);
  if (!token) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      request
    );
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }),
      request
    );
  }

  // Optionally refresh user data from DB
  const db = getSupabase();
  const { data: user } = await db
    .from("users")
    .select("id, osu_id, osu_username, avatar_url, is_admin")
    .eq("id", payload.sub)
    .single();

  return applyCorsHeaders(
    NextResponse.json({
      id: user?.id || payload.sub,
      osu_id: user?.osu_id || payload.osu_id,
      username: user?.osu_username || payload.username,
      avatar_url: user?.avatar_url || null,
      is_admin: user?.is_admin || payload.is_admin,
    }),
    request
  );
}
