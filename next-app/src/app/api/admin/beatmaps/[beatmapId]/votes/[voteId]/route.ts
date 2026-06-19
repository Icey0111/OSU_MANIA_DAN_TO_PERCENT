import { NextRequest, NextResponse } from "next/server";
import { extractCookieToken } from "@/lib/auth";
import { verifyAdminToken } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ beatmapId: string; voteId: string }> }
) {
  const token = extractCookieToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const resolvedParams = await params;
  const beatmapId = Number(resolvedParams.beatmapId);
  const voteId = Number(resolvedParams.voteId);
  if (
    !Number.isSafeInteger(beatmapId) ||
    beatmapId <= 0 ||
    !Number.isSafeInteger(voteId) ||
    voteId <= 0
  ) {
    return NextResponse.json({ error: "Invalid beatmap or vote ID" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: beatmap, error: beatmapError } = await db
    .from("beatmaps")
    .select("id, source_type")
    .eq("id", beatmapId)
    .maybeSingle();
  if (beatmapError) {
    return NextResponse.json({ error: "Failed to look up beatmap" }, { status: 500 });
  }
  if (!beatmap) return NextResponse.json({ error: "Beatmap not found" }, { status: 404 });
  if (beatmap.source_type !== "local") {
    return NextResponse.json(
      { error: "Votes can only be removed here for local beatmaps" },
      { status: 409 }
    );
  }

  const { data: vote, error: voteError } = await db
    .from("votes")
    .select("id")
    .eq("id", voteId)
    .eq("beatmap_id", beatmapId)
    .maybeSingle();
  if (voteError) {
    return NextResponse.json({ error: "Failed to look up vote" }, { status: 500 });
  }
  if (!vote) return NextResponse.json({ error: "Vote not found" }, { status: 404 });

  const { error: deleteError } = await db
    .from("votes")
    .delete()
    .eq("id", voteId)
    .eq("beatmap_id", beatmapId);
  if (deleteError) {
    console.error("Admin vote delete failed:", deleteError);
    return NextResponse.json({ error: "Failed to delete vote" }, { status: 500 });
  }

  const { count } = await db
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("beatmap_id", beatmapId);
  await db
    .from("beatmaps")
    .update({ total_votes: count || 0, updated_at: new Date().toISOString() })
    .eq("id", beatmapId);

  return NextResponse.json({ success: true, total_votes: count || 0 });
}
