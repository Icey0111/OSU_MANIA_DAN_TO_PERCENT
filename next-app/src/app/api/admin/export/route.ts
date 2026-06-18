import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractCookieToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";

interface BeatmapJoined {
  osu_beatmap_id: number | null;
  beatmapset_id: number | null;
  source_type: "osu" | "local";
  file_checksum: string | null;
  artist: string;
  title: string;
  version: string;
  creator: string;
  total_votes: number;
}

interface UserJoined {
  osu_id: number;
  osu_username: string;
}

interface VoteRow {
  id: number;
  dan_level: string;
  tier: string;
  created_at: string;
  beatmaps: BeatmapJoined;
  users: UserJoined;
}

export async function GET(request: NextRequest) {
  // Authenticate via cookie
  const token = extractCookieToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getSupabaseAdmin();

  // Join votes with beatmaps and users
  const { data, error } = await db
    .from("votes")
    .select(`
      id,
      dan_level,
      tier,
      created_at,
      updated_at,
      beatmap_id,
      user_id,
      beatmaps!inner(osu_beatmap_id, beatmapset_id, source_type, file_checksum, artist, title, version, creator, total_votes),
      users!inner(osu_id, osu_username)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }

  // Build CSV
  const headers = [
    "Vote ID",
    "Source Type",
    "osu_beatmap_id",
    "beatmapset_id",
    "File Checksum",
    "Artist",
    "Title",
    "Version",
    "Creator",
    "Total Votes",
    "Dan Level",
    "Tier",
    "Voter osu_id",
    "Voter Username",
    "Voted At",
  ];

  const csvRows = [headers.join(",")];

  for (const row of (data || []) as unknown as VoteRow[]) {
    const beatmap = row.beatmaps;
    const user = row.users;
    const csvRow = [
      row.id,
      beatmap.source_type,
      beatmap.osu_beatmap_id ?? "",
      beatmap.beatmapset_id ?? "",
      beatmap.file_checksum ?? "",
      `"${beatmap.artist.replace(/"/g, '""')}"`,
      `"${beatmap.title.replace(/"/g, '""')}"`,
      `"${beatmap.version.replace(/"/g, '""')}"`,
      `"${beatmap.creator.replace(/"/g, '""')}"`,
      beatmap.total_votes,
      row.dan_level,
      row.tier,
      user.osu_id,
      `"${user.osu_username}"`,
      row.created_at,
    ];
    csvRows.push(csvRow.join(","));
  }

  const csv = csvRows.join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=dan-votes-export.csv",
    },
  });
}
