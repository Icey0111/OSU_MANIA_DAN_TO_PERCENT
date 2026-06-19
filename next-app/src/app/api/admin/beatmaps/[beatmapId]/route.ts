import { NextRequest, NextResponse } from "next/server";
import { extractCookieToken } from "@/lib/auth";
import { verifyAdminToken } from "@/lib/admin-auth";
import { BEATMAP_SELECT, BeatmapRecord, buildVoteResults } from "@/lib/beatmaps";
import { getSupabaseAdmin } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ beatmapId: string }> }
) {
  const token = extractCookieToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { beatmapId } = await params;
  const internalId = Number(beatmapId);
  if (!Number.isSafeInteger(internalId) || internalId <= 0) {
    return NextResponse.json({ error: "Invalid beatmap ID" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data } = await db
    .from("beatmaps")
    .select(BEATMAP_SELECT)
    .eq("id", internalId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Beatmap not found" }, { status: 404 });

  try {
    const results = await buildVoteResults(db, data as BeatmapRecord);
    const { data: promotionHistory, error: historyError } = await db
      .from("beatmap_promotion_audits")
      .select("id, local_beatmap_id, official_beatmap_id, local_file_checksum, official_file_checksum, match_method, moved_votes, duplicate_votes, created_at")
      .eq("target_beatmap_id", internalId)
      .order("created_at", { ascending: false });
    if (historyError) throw historyError;
    return NextResponse.json({ ...results, promotion_history: promotionHistory || [] });
  } catch (error) {
    console.error("Admin beatmap results query failed:", error);
    return NextResponse.json({ error: "Failed to load beatmap" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ beatmapId: string }> }
) {
  const token = extractCookieToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { beatmapId } = await params;
  const internalId = Number(beatmapId);
  if (!Number.isSafeInteger(internalId) || internalId <= 0) {
    return NextResponse.json({ error: "Invalid beatmap ID" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: beatmap, error: lookupError } = await db
    .from("beatmaps")
    .select("id, source_type")
    .eq("id", internalId)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json({ error: "Failed to look up beatmap" }, { status: 500 });
  }
  if (!beatmap) return NextResponse.json({ error: "Beatmap not found" }, { status: 404 });
  if (beatmap.source_type !== "local") {
    return NextResponse.json(
      { error: "Official beatmaps cannot be deleted from the local-map module" },
      { status: 409 }
    );
  }

  const { count: deletedVotes } = await db
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("beatmap_id", internalId);
  const { error: deleteError } = await db
    .from("beatmaps")
    .delete()
    .eq("id", internalId)
    .eq("source_type", "local");
  if (deleteError) {
    console.error("Local beatmap delete failed:", deleteError);
    return NextResponse.json({ error: "Failed to delete local beatmap" }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_votes: deletedVotes || 0 });
}
