import { NextRequest, NextResponse } from "next/server";
import { extractCookieToken } from "@/lib/auth";
import { verifyAdminToken } from "@/lib/admin-auth";
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

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  // Authenticate via cookie
  const token = extractCookieToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAdminToken(token);
  if (!payload) {
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

  const csvRows = [headers.map(csvCell).join(",")];

  for (const row of (data || []) as unknown as VoteRow[]) {
    const beatmap = row.beatmaps;
    const user = row.users;
    const csvRow = [
      csvCell(row.id),
      csvCell(beatmap.source_type),
      csvCell(beatmap.osu_beatmap_id ?? ""),
      csvCell(beatmap.beatmapset_id ?? ""),
      csvCell(beatmap.file_checksum ?? ""),
      csvCell(beatmap.artist),
      csvCell(beatmap.title),
      csvCell(beatmap.version),
      csvCell(beatmap.creator),
      csvCell(beatmap.total_votes),
      csvCell(row.dan_level),
      csvCell(row.tier),
      csvCell(user.osu_id),
      csvCell(user.osu_username),
      csvCell(row.created_at),
    ];
    csvRows.push(csvRow.join(","));
  }

  const csv = `\uFEFF${csvRows.join("\r\n")}`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=dan-votes-export.csv",
    },
  });
}
