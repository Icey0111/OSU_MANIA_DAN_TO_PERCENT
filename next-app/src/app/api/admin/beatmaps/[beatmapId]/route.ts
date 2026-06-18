import { NextRequest, NextResponse } from "next/server";
import { extractCookieToken, verifyToken } from "@/lib/auth";
import { BEATMAP_SELECT, BeatmapRecord, buildVoteResults } from "@/lib/beatmaps";
import { getSupabaseAdmin } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { beatmapId: string } }
) {
  const token = extractCookieToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const internalId = Number(params.beatmapId);
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
    return NextResponse.json(await buildVoteResults(db, data as BeatmapRecord));
  } catch (error) {
    console.error("Admin beatmap results query failed:", error);
    return NextResponse.json({ error: "Failed to load beatmap" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { beatmapId: string } }
) {
  const token = extractCookieToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const internalId = Number(params.beatmapId);
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
