import { NextRequest, NextResponse } from "next/server";
import { extractCookieToken, verifyToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";
import { getOsuBeatmap, OsuApiError } from "@/lib/osu";

interface PromotionBody {
  osu_beatmap_id?: unknown;
}

async function authorize(request: NextRequest) {
  const token = extractCookieToken(request);
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.is_admin ? payload : null;
}

function parseIds(beatmapId: string, body: PromotionBody) {
  const localId = Number(beatmapId);
  const officialId = Number(body.osu_beatmap_id);
  if (
    !Number.isSafeInteger(localId) ||
    localId <= 0 ||
    !Number.isSafeInteger(officialId) ||
    officialId <= 0
  ) {
    return null;
  }
  return { localId, officialId };
}

async function loadEvidence(localId: number, officialId: number) {
  const db = getSupabaseAdmin();
  const { data: local, error: localError } = await db
    .from("beatmaps")
    .select("id, source_type, file_checksum, artist, title, version, creator, total_votes")
    .eq("id", localId)
    .maybeSingle();
  if (localError) throw localError;
  if (!local || local.source_type !== "local") return { error: "Local beatmap not found", status: 404 } as const;

  const official = await getOsuBeatmap(officialId);
  const { data: existing, error: existingError } = await db
    .from("beatmaps")
    .select("id, total_votes")
    .eq("osu_beatmap_id", officialId)
    .maybeSingle();
  if (existingError) throw existingError;

  const exactChecksum = Boolean(
    official.official_file_checksum &&
      local.file_checksum === official.official_file_checksum
  );
  const fields = ["artist", "title", "version", "creator"] as const;
  const differences = fields.filter(
    (field) => local[field].trim().toLocaleLowerCase() !== official[field].trim().toLocaleLowerCase()
  );

  return {
    local,
    official,
    existing_official: existing,
    evidence: {
      exact_checksum: exactChecksum,
      metadata_differences: differences,
      requires_manual_confirmation: !exactChecksum,
    },
  };
}

function osuErrorResponse(error: unknown) {
  if (error instanceof OsuApiError) {
    const status = error.code === "not_found" ? 404 : error.code === "not_mania" ? 422 : 503;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("Beatmap promotion failed:", error);
  return NextResponse.json({ error: "Failed to verify beatmap promotion" }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { beatmapId: string } }
) {
  const admin = await authorize(request);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  let body: PromotionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const ids = parseIds(params.beatmapId, body);
  if (!ids) return NextResponse.json({ error: "Invalid beatmap ID" }, { status: 400 });

  try {
    const evidence = await loadEvidence(ids.localId, ids.officialId);
    if ("error" in evidence) {
      return NextResponse.json({ error: evidence.error }, { status: evidence.status });
    }
    return NextResponse.json(evidence);
  } catch (error) {
    return osuErrorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { beatmapId: string } }
) {
  const admin = await authorize(request);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  let body: PromotionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const ids = parseIds(params.beatmapId, body);
  if (!ids) return NextResponse.json({ error: "Invalid beatmap ID" }, { status: 400 });

  try {
    // Re-fetch all evidence during confirmation to prevent a stale preview
    // from promoting an ID whose official metadata changed.
    const evidence = await loadEvidence(ids.localId, ids.officialId);
    if ("error" in evidence) {
      return NextResponse.json({ error: evidence.error }, { status: evidence.status });
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc("promote_local_beatmap", {
      p_local_beatmap_id: ids.localId,
      p_official_beatmap_id: ids.officialId,
      p_beatmapset_id: evidence.official.beatmapset_id,
      p_artist: evidence.official.artist,
      p_title: evidence.official.title,
      p_version: evidence.official.version,
      p_creator: evidence.official.creator,
      p_official_file_checksum: evidence.official.official_file_checksum,
      p_promoted_by: Number(admin.sub),
      p_match_method: evidence.evidence.exact_checksum ? "exact_checksum" : "admin_confirmed",
    });
    if (error) throw error;
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return osuErrorResponse(error);
  }
}
