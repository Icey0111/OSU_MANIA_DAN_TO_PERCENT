import { NextRequest, NextResponse } from "next/server";
import { extractCookieToken } from "@/lib/auth";
import { verifyAdminToken } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/db";
import { DAN_ORDER, DAN_LABELS } from "@/lib/validation";

interface VoterRow {
  id: number;
  user_id: number;
  dan_level: string;
  tier: string;
  created_at: string;
  users: {
    osu_id: number;
    osu_username: string;
    avatar_url: string | null;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ beatmapId: string }> }
) {
  // Authenticate via cookie
  const token = extractCookieToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAdminToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { beatmapId: rawBeatmapId } = await params;
  const beatmapId = parseInt(rawBeatmapId, 10);
  if (isNaN(beatmapId)) {
    return NextResponse.json({ error: "Invalid beatmap ID" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // Admin routes use the stable internal primary key for both official and local maps.
  const { data: beatmap, error: beatmapError } = await db
    .from("beatmaps")
    .select("id, osu_beatmap_id, source_type, file_checksum, artist, title, version")
    .eq("id", beatmapId)
    .single();

  if (beatmapError || !beatmap) {
    return NextResponse.json({ error: "Beatmap not found" }, { status: 404 });
  }

  // Query votes with user info
  const { data: votes, error: votesError } = await db
    .from("votes")
    .select(`
      id,
      user_id,
      dan_level,
      tier,
      created_at,
      users!inner(osu_id, osu_username, avatar_url)
    `)
    .eq("beatmap_id", beatmap.id)
    .order("created_at", { ascending: true });

  if (votesError) {
    return NextResponse.json({ error: "Failed to fetch voters" }, { status: 500 });
  }

  // Deduplicate: keep last vote per user
  const deduped: Record<number, VoterRow> = {};
  if (votes) {
    for (const v of votes as unknown as VoterRow[]) {
      deduped[v.user_id] = v;
    }
  }

  // Build voter list sorted by dan level order, then by created_at
  const voters = Object.values(deduped)
    .sort((a, b) => {
      const orderA = DAN_ORDER[a.dan_level as keyof typeof DAN_ORDER] ?? 99;
      const orderB = DAN_ORDER[b.dan_level as keyof typeof DAN_ORDER] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .map((v) => ({
      vote_id: v.id,
      user_id: v.user_id,
      osu_id: v.users.osu_id,
      osu_username: v.users.osu_username,
      avatar_url: v.users.avatar_url,
      dan_level: v.dan_level,
      dan_label: DAN_LABELS[v.dan_level as keyof typeof DAN_LABELS] || v.dan_level,
      tier: v.tier,
      voted_at: v.created_at,
    }));

  return NextResponse.json({
    osu_beatmap_id: beatmap.osu_beatmap_id,
    source_type: beatmap.source_type,
    file_checksum: beatmap.file_checksum,
    beatmap: {
      artist: beatmap.artist,
      title: beatmap.title,
      version: beatmap.version,
    },
    voters,
    total: voters.length,
  });
}
