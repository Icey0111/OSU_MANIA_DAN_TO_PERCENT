import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import { getSupabaseAdmin } from "@/lib/db";
import { DAN_ORDER } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: { beatmapId: string } }
) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const beatmapId = parseInt(params.beatmapId, 10);
  if (isNaN(beatmapId)) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid beatmap ID" }, { status: 400 }),
      request
    );
  }

  const db = getSupabaseAdmin();

  // Lookup beatmap
  const { data: beatmap, error: beatmapError } = await db
    .from("beatmaps")
    .select("*")
    .eq("osu_beatmap_id", beatmapId)
    .single();

  if (beatmapError || !beatmap) {
    return applyCorsHeaders(
      NextResponse.json({
        beatmap: null,
        distribution: {},
        user_vote: null,
        not_voted: true,
      }),
      request
    );
  }

  // Get vote distribution (deduplicated by user_id — keep last row)
  const { data: allVotes } = await db
    .from("votes")
    .select("dan_level, tier, user_id")
    .eq("beatmap_id", beatmap.id)
    .order("created_at", { ascending: true });

  // Deduplicate: keep only the last vote per user (handles legacy duplicate rows)
  const dedupedVotes: Record<string, { dan_level: string; tier: string }> = {};
  if (allVotes) {
    for (const v of allVotes) {
      dedupedVotes[v.user_id] = { dan_level: v.dan_level, tier: v.tier };
    }
  }

  // Build distribution map from deduped votes
  const distribution: Record<string, { low: number; mid: number; high: number }> = {};
  for (const dv of Object.values(dedupedVotes)) {
    if (!distribution[dv.dan_level]) {
      distribution[dv.dan_level] = { low: 0, mid: 0, high: 0 };
    }
    distribution[dv.dan_level][dv.tier as "low" | "mid" | "high"]++;
  }

  // Sort by dan order
  const sortedDistribution: Record<string, { low: number; mid: number; high: number }> = {};
  const sortedKeys = Object.keys(distribution).sort(
    (a, b) => (DAN_ORDER[a as keyof typeof DAN_ORDER] || 99) - (DAN_ORDER[b as keyof typeof DAN_ORDER] || 99)
  );
  for (const key of sortedKeys) {
    sortedDistribution[key] = distribution[key];
  }

  // Get current user's vote if authenticated.
  // Use filter().at(-1) instead of find() so that if duplicate rows exist
  // (e.g. left over from a broken upsert), we always pick the last row.
  let userVote = null;
  const token = extractBearerToken(request);
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      const userRows = allVotes?.filter((v) => v.user_id === payload.sub);
      if (userRows && userRows.length > 0) {
        const last = userRows[userRows.length - 1];
        userVote = {
          dan_level: last.dan_level,
          tier: last.tier,
        };
      }
    }
  }

  const dedupedCount = Object.keys(dedupedVotes).length;

  return applyCorsHeaders(
    NextResponse.json({
      beatmap: {
        osu_beatmap_id: beatmap.osu_beatmap_id,
        beatmapset_id: beatmap.beatmapset_id,
        artist: beatmap.artist,
        title: beatmap.title,
        version: beatmap.version,
        creator: beatmap.creator,
        total_votes: dedupedCount,
        url: `https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id}#mania/${beatmap.osu_beatmap_id}`,
      },
      distribution: sortedDistribution,
      user_vote: userVote,
    }),
    request
  );
}
