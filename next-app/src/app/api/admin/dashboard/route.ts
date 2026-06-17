import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractCookieToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";

export async function GET(request: NextRequest) {
  // Authenticate via cookie
  const token = extractCookieToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getSupabaseAdmin();

  // Total beatmaps
  const { count: totalBeatmaps } = await db
    .from("beatmaps")
    .select("*", { count: "exact", head: true });

  // Total votes
  const { count: totalVotes } = await db
    .from("votes")
    .select("*", { count: "exact", head: true });

  // Count distinct voters from votes table
  const { data: distinctVoters } = await db
    .from("votes")
    .select("user_id");

  const uniqueVoterCount = distinctVoters
    ? new Set(distinctVoters.map((v: { user_id: number }) => v.user_id)).size
    : 0;

  // Recent beatmaps (last 10 with votes)
  const { data: recentBeatmaps } = await db
    .from("beatmaps")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    total_beatmaps: totalBeatmaps || 0,
    total_votes: totalVotes || 0,
    total_voters: uniqueVoterCount,
    recent_beatmaps: recentBeatmaps || [],
  });
}
