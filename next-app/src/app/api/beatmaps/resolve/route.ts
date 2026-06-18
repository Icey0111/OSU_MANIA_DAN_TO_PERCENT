import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { BEATMAP_SELECT, BeatmapRecord, buildVoteResults, normalizeChecksum } from "@/lib/beatmaps";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import { getSupabaseAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("osu_beatmap_id");
  const osuBeatmapId = rawId ? Number(rawId) : null;
  const checksum = normalizeChecksum(searchParams.get("checksum"));

  if (
    (osuBeatmapId !== null && (!Number.isSafeInteger(osuBeatmapId) || osuBeatmapId <= 0)) ||
    (!osuBeatmapId && !checksum)
  ) {
    return applyCorsHeaders(
      NextResponse.json({ error: "A valid beatmap ID or checksum is required" }, { status: 400 }),
      request
    );
  }

  const db = getSupabaseAdmin();
  let beatmap: BeatmapRecord | null = null;

  if (osuBeatmapId) {
    const { data } = await db
      .from("beatmaps")
      .select(BEATMAP_SELECT)
      .eq("source_type", "osu")
      .eq("osu_beatmap_id", osuBeatmapId)
      .maybeSingle();
    beatmap = data as BeatmapRecord | null;
  }

  // A deleted or unsubmitted map may retain a positive stale ID locally. Its
  // checksum is therefore the authoritative fallback when no official row exists.
  if (!beatmap && checksum) {
    const { data } = await db
      .from("beatmaps")
      .select(BEATMAP_SELECT)
      .eq("source_type", "local")
      .eq("file_checksum", checksum)
      .maybeSingle();
    beatmap = data as BeatmapRecord | null;
  }

  if (!beatmap) {
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

  let userId: number | undefined;
  const token = extractBearerToken(request);
  if (token) {
    const payload = await verifyToken(token);
    if (payload) userId = payload.sub;
  }

  try {
    const results = await buildVoteResults(db, beatmap, userId);
    const response = applyCorsHeaders(NextResponse.json(results), request);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("Beatmap results query failed:", error);
    return applyCorsHeaders(
      NextResponse.json({ error: "Failed to load beatmap results" }, { status: 500 }),
      request
    );
  }
}

