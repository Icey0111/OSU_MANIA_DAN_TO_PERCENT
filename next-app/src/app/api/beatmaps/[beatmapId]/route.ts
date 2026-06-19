import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { BEATMAP_SELECT, BeatmapRecord, buildVoteResults } from "@/lib/beatmaps";
import { handleCors, applyCorsHeaders } from "@/lib/cors";
import { getSupabaseAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ beatmapId: string }> }
) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const { beatmapId: rawBeatmapId } = await params;
  const beatmapId = Number(rawBeatmapId);
  if (!Number.isSafeInteger(beatmapId) || beatmapId <= 0) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Invalid beatmap ID" }, { status: 400 }),
      request
    );
  }

  const db = getSupabaseAdmin();
  const { data } = await db
    .from("beatmaps")
    .select(BEATMAP_SELECT)
    .eq("source_type", "osu")
    .eq("osu_beatmap_id", beatmapId)
    .maybeSingle();
  const beatmap = data as BeatmapRecord | null;

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
