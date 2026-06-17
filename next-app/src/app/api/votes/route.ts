import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import { getSupabaseAdmin } from "@/lib/db";
import { isValidDanLevel, isValidTier, DAN_ORDER } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  // Authenticate
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

  // Parse and validate body
  let body: {
    osu_beatmap_id: number;
    beatmapset_id: number;
    artist: string;
    title: string;
    version: string;
    creator: string;
    dan_level: string;
    tier: string;
  };

  try {
    body = await request.json();
  } catch {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
      request
    );
  }

  // Validate required fields
  if (
    !body.osu_beatmap_id ||
    !body.beatmapset_id ||
    !body.artist ||
    !body.title ||
    !body.version ||
    !body.creator
  ) {
    return applyCorsHeaders(
      NextResponse.json(
        { error: "Missing required fields: osu_beatmap_id, beatmapset_id, artist, title, version, creator" },
        { status: 400 }
      ),
      request
    );
  }

  if (!isValidDanLevel(body.dan_level)) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid dan_level" }, { status: 400 }),
      request
    );
  }

  if (!isValidTier(body.tier)) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid tier. Must be 'low', 'mid', or 'high'" }, { status: 400 }),
      request
    );
  }

  let db;
  try {
    db = getSupabaseAdmin();
  } catch (e) {
    console.error("getSupabaseAdmin failed:", e);
    return applyCorsHeaders(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      request
    );
  }

  // 1. Upsert beatmap record
  const { data: beatmap, error: beatmapError } = await db
    .from("beatmaps")
    .upsert(
      {
        osu_beatmap_id: body.osu_beatmap_id,
        beatmapset_id: body.beatmapset_id,
        artist: body.artist,
        title: body.title,
        version: body.version,
        creator: body.creator,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "osu_beatmap_id" }
    )
    .select("id, osu_beatmap_id, beatmapset_id, artist, title, version, creator, total_votes")
    .single();

  if (beatmapError || !beatmap) {
    console.error("Beatmap upsert error:", beatmapError);
    return applyCorsHeaders(
      NextResponse.json({ error: "Failed to upsert beatmap" }, { status: 500 }),
      request
    );
  }

  // 2. Delete any existing vote for this user+beatmap, then insert the new one.
  //    DELETE + INSERT is more reliable than upsert with composite onConflict keys,
  //    which can silently create duplicate rows in Supabase.
  const { error: deleteError } = await db
    .from("votes")
    .delete()
    .eq("user_id", payload.sub)
    .eq("beatmap_id", beatmap.id);

  if (deleteError) {
    console.error("Vote delete error:", deleteError);
    return applyCorsHeaders(
      NextResponse.json({ error: "Failed to update vote" }, { status: 500 }),
      request
    );
  }

  const { error: voteError } = await db
    .from("votes")
    .insert({
      user_id: payload.sub,
      beatmap_id: beatmap.id,
      dan_level: body.dan_level,
      tier: body.tier,
    });

  if (voteError) {
    console.error("Vote upsert error:", voteError);
    return applyCorsHeaders(
      NextResponse.json({ error: "Failed to save vote" }, { status: 500 }),
      request
    );
  }

  // 3. Get all votes for this beatmap (with user_id for dedup)
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

  const totalVotes = Object.keys(dedupedVotes).length;

  // Update the denormalized counter
  await db
    .from("beatmaps")
    .update({ total_votes: totalVotes, updated_at: new Date().toISOString() })
    .eq("id", beatmap.id);

  // 4. Build vote distribution from deduped votes
  const distribution: Record<string, { low: number; mid: number; high: number }> = {};
  for (const dv of Object.values(dedupedVotes)) {
    if (!distribution[dv.dan_level]) {
      distribution[dv.dan_level] = { low: 0, mid: 0, high: 0 };
    }
    distribution[dv.dan_level][dv.tier as "low" | "mid" | "high"]++;
  }

  // Sort distribution by dan order
  const sortedDistribution: Record<string, { low: number; mid: number; high: number }> = {};
  const sortedKeys = Object.keys(distribution).sort(
    (a, b) => (DAN_ORDER[a as keyof typeof DAN_ORDER] || 99) - (DAN_ORDER[b as keyof typeof DAN_ORDER] || 99)
  );
  for (const key of sortedKeys) {
    sortedDistribution[key] = distribution[key];
  }

  return applyCorsHeaders(
    NextResponse.json({
      success: true,
      vote: { dan_level: body.dan_level, tier: body.tier },
      results: {
        beatmap: {
          osu_beatmap_id: beatmap.osu_beatmap_id,
          beatmapset_id: beatmap.beatmapset_id,
          artist: beatmap.artist,
          title: beatmap.title,
          version: beatmap.version,
          creator: beatmap.creator,
          total_votes: totalVotes,
          url: `https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id}#mania/${beatmap.osu_beatmap_id}`,
        },
        total_votes: totalVotes,
        distribution: sortedDistribution,
        user_vote: { dan_level: body.dan_level, tier: body.tier },
      },
    }),
    request
  );
}
