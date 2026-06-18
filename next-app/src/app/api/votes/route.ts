import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import {
  BEATMAP_SELECT,
  BeatmapRecord,
  buildVoteResults,
  validateLocalBeatmap,
} from "@/lib/beatmaps";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import { getSupabaseAdmin } from "@/lib/db";
import { getOsuBeatmap, OsuApiError } from "@/lib/osu";
import { isValidDanLevel, isValidTier } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface VoteRequestBody {
  osu_beatmap_id?: unknown;
  beatmap?: {
    osu_beatmap_id?: unknown;
    checksum?: unknown;
    artist?: unknown;
    title?: unknown;
    version?: unknown;
    creator?: unknown;
    mapper?: unknown;
    mode?: unknown;
  };
  dan_level?: unknown;
  tier?: unknown;
}
export async function POST(request: NextRequest) {
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

  let body: VoteRequestBody;
  try {
    body = await request.json();
  } catch {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
      request
    );
  }

  if (typeof body.dan_level !== "string" || !isValidDanLevel(body.dan_level)) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid dan_level" }, { status: 400 }),
      request
    );
  }
  if (typeof body.tier !== "string" || !isValidTier(body.tier)) {
    return applyCorsHeaders(
      NextResponse.json(
        { error: "Invalid tier. Must be 'low', 'mid', or 'high'" },
        { status: 400 }
      ),
      request
    );
  }

  // body.osu_beatmap_id keeps old overlay releases compatible.
  const input = body.beatmap || { osu_beatmap_id: body.osu_beatmap_id };
  const rawId = input.osu_beatmap_id ?? body.osu_beatmap_id;
  const parsedId = typeof rawId === "number" ? rawId : Number(rawId);
  const osuBeatmapId =
    Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const localBeatmap = validateLocalBeatmap(input);

  if (!osuBeatmapId && !localBeatmap) {
    return applyCorsHeaders(
      NextResponse.json(
        { error: "A valid official beatmap ID or local beatmap checksum is required" },
        { status: 400 }
      ),
      request
    );
  }

  let db;
  try {
    db = getSupabaseAdmin();
  } catch (error) {
    console.error("getSupabaseAdmin failed:", error);
    return applyCorsHeaders(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      request
    );
  }

  let beatmap: BeatmapRecord | null = null;
  let officialNotFound = false;

  if (osuBeatmapId) {
    try {
      const verified = await getOsuBeatmap(osuBeatmapId);
      const { data, error } = await db
        .from("beatmaps")
        .upsert(
          {
            ...verified,
            source_type: "osu",
            file_checksum: null,
            checksum_algorithm: null,
            mode: 3,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "osu_beatmap_id" }
        )
        .select(BEATMAP_SELECT)
        .single();

      if (error || !data) {
        console.error("Official beatmap upsert error:", error);
        return applyCorsHeaders(
          NextResponse.json({ error: "Failed to save beatmap" }, { status: 500 }),
          request
        );
      }
      beatmap = data as BeatmapRecord;
    } catch (error) {
      if (!(error instanceof OsuApiError)) throw error;
      if (error.code === "not_found") {
        officialNotFound = true;
      } else {
        const status = error.code === "not_mania" ? 422 : 503;
        return applyCorsHeaders(
          NextResponse.json({ error: error.message }, { status }),
          request
        );
      }
    }
  }

  if (!beatmap) {
    if (!localBeatmap) {
      return applyCorsHeaders(
        NextResponse.json(
          {
            error: officialNotFound
              ? "Beatmap is unavailable on osu! and no valid local checksum was provided"
              : "Invalid local beatmap metadata",
          },
          { status: officialNotFound ? 404 : 400 }
        ),
        request
      );
    }

    // Metadata is first-write-stable for a checksum. Later clients may locate
    // the same exact file, but cannot rename its database record.
    const { data: existing, error: lookupError } = await db
      .from("beatmaps")
      .select(BEATMAP_SELECT)
      .eq("source_type", "local")
      .eq("file_checksum", localBeatmap.checksum)
      .maybeSingle();

    if (lookupError) {
      console.error("Local beatmap lookup error:", lookupError);
      return applyCorsHeaders(
        NextResponse.json({ error: "Failed to look up local beatmap" }, { status: 500 }),
        request
      );
    }

    beatmap = existing as BeatmapRecord | null;
    if (!beatmap) {
      const { data: inserted, error: insertError } = await db
        .from("beatmaps")
        .insert({
          osu_beatmap_id: null,
          beatmapset_id: null,
          source_type: "local",
          file_checksum: localBeatmap.checksum,
          checksum_algorithm: "md5",
          mode: localBeatmap.mode,
          artist: localBeatmap.artist,
          title: localBeatmap.title,
          version: localBeatmap.version,
          creator: localBeatmap.creator,
          updated_at: new Date().toISOString(),
        })
        .select(BEATMAP_SELECT)
        .single();

      if (insertError || !inserted) {
        // A concurrent first vote may have inserted the same checksum. Resolve
        // that row instead of returning a spurious failure.
        const { data: raced } = await db
          .from("beatmaps")
          .select(BEATMAP_SELECT)
          .eq("source_type", "local")
          .eq("file_checksum", localBeatmap.checksum)
          .maybeSingle();
        if (!raced) {
          console.error("Local beatmap insert error:", insertError);
          return applyCorsHeaders(
            NextResponse.json({ error: "Failed to save local beatmap" }, { status: 500 }),
            request
          );
        }
        beatmap = raced as BeatmapRecord;
      } else {
        beatmap = inserted as BeatmapRecord;
      }
    }
  }

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

  const { error: voteError } = await db.from("votes").insert({
    user_id: payload.sub,
    beatmap_id: beatmap.id,
    dan_level: body.dan_level,
    tier: body.tier,
  });
  if (voteError) {
    console.error("Vote insert error:", voteError);
    return applyCorsHeaders(
      NextResponse.json({ error: "Failed to save vote" }, { status: 500 }),
      request
    );
  }

  try {
    const results = await buildVoteResults(db, beatmap, payload.sub);
    await db
      .from("beatmaps")
      .update({
        total_votes: results.beatmap.total_votes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", beatmap.id);

    return applyCorsHeaders(
      NextResponse.json({
        success: true,
        vote: { dan_level: body.dan_level, tier: body.tier },
        results,
      }),
      request
    );
  } catch (error) {
    console.error("Vote results query failed:", error);
    return applyCorsHeaders(
      NextResponse.json({ error: "Vote saved but results could not be loaded" }, { status: 500 }),
      request
    );
  }
}
