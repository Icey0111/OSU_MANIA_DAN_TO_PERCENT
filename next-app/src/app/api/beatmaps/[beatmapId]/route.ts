import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import { getSupabase } from "@/lib/db";
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

  const db = getSupabase();

  // Lookup beatmap
  const { data: beatmap, error: beatmapError } = await db
    .from("beatmaps")
    .select("*")
    .eq("osu_beatmap_id", beatmapId)
    .single();

  if (beatmapError || !beatmap) {
    return applyCorsHeaders(
      NextResponse.json(
        { error: "Beatmap not found", not_voted: true },
        { status: 404 }
      ),
      request
    );
  }

  // Get vote distribution
  const { data: allVotes } = await db
    .from("votes")
    .select("dan_level, tier, user_id")
    .eq("beatmap_id", beatmap.id);

  const distribution: Record<string, { low: number; mid: number; high: number }> = {};
  if (allVotes) {
    for (const vote of allVotes) {
      if (!distribution[vote.dan_level]) {
        distribution[vote.dan_level] = { low: 0, mid: 0, high: 0 };
      }
      distribution[vote.dan_level][vote.tier as "low" | "mid" | "high"]++;
    }
  }

  // Sort by dan order
  const sortedDistribution: Record<string, { low: number; mid: number; high: number }> = {};
  const sortedKeys = Object.keys(distribution).sort(
    (a, b) => (DAN_ORDER[a as keyof typeof DAN_ORDER] || 99) - (DAN_ORDER[b as keyof typeof DAN_ORDER] || 99)
  );
  for (const key of sortedKeys) {
    sortedDistribution[key] = distribution[key];
  }

  // Get current user's vote if authenticated
  let userVote = null;
  const token = extractBearerToken(request);
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      const userVoteData = allVotes?.find((v) => v.user_id === payload.sub);
      if (userVoteData) {
        userVote = {
          dan_level: userVoteData.dan_level,
          tier: userVoteData.tier,
        };
      }
    }
  }

  return applyCorsHeaders(
    NextResponse.json({
      beatmap: {
        osu_beatmap_id: beatmap.osu_beatmap_id,
        beatmapset_id: beatmap.beatmapset_id,
        artist: beatmap.artist,
        title: beatmap.title,
        version: beatmap.version,
        creator: beatmap.creator,
        total_votes: beatmap.total_votes,
        url: `https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id}#mania/${beatmap.osu_beatmap_id}`,
      },
      distribution: sortedDistribution,
      user_vote: userVote,
    }),
    request
  );
}
