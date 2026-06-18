import type { SupabaseClient } from "@supabase/supabase-js";
import { DAN_ORDER } from "@/lib/validation";

export interface BeatmapRecord {
  id: number;
  osu_beatmap_id: number | null;
  beatmapset_id: number | null;
  source_type: "osu" | "local";
  file_checksum: string | null;
  checksum_algorithm: string | null;
  mode: number;
  artist: string;
  title: string;
  version: string;
  creator: string;
  total_votes: number;
}

export interface LocalBeatmapInput {
  checksum: string;
  artist: string;
  title: string;
  version: string;
  creator: string;
  mode: number;
}

const LOCAL_METADATA_LIMITS = {
  artist: 256,
  title: 256,
  version: 256,
  creator: 64,
} as const;

export function normalizeChecksum(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const checksum = value.trim().toLowerCase();
  return /^[0-9a-f]{32}$/.test(checksum) ? checksum : null;
}

function normalizeMetadataField(
  value: unknown,
  field: keyof typeof LOCAL_METADATA_LIMITS
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f]/g, " ");
  if (!normalized || normalized.length > LOCAL_METADATA_LIMITS[field]) return null;
  return normalized;
}

export function validateLocalBeatmap(input: {
  checksum?: unknown;
  artist?: unknown;
  title?: unknown;
  version?: unknown;
  creator?: unknown;
  mapper?: unknown;
  mode?: unknown;
}): LocalBeatmapInput | null {
  const checksum = normalizeChecksum(input.checksum);
  const artist = normalizeMetadataField(input.artist, "artist");
  const title = normalizeMetadataField(input.title, "title");
  const version = normalizeMetadataField(input.version, "version");
  const creator = normalizeMetadataField(input.mapper ?? input.creator, "creator");
  const mode = typeof input.mode === "number" ? input.mode : Number(input.mode);

  if (!checksum || !artist || !title || !version || !creator || mode !== 3) {
    return null;
  }

  return { checksum, artist, title, version, creator, mode };
}

export function serializeBeatmap(beatmap: BeatmapRecord, totalVotes: number) {
  const isOfficial = beatmap.source_type === "osu";
  return {
    id: beatmap.id,
    source_type: beatmap.source_type,
    osu_beatmap_id: beatmap.osu_beatmap_id,
    beatmapset_id: beatmap.beatmapset_id,
    file_checksum: beatmap.file_checksum,
    checksum_algorithm: beatmap.checksum_algorithm,
    artist: beatmap.artist,
    title: beatmap.title,
    version: beatmap.version,
    creator: beatmap.creator,
    total_votes: totalVotes,
    url:
      isOfficial && beatmap.beatmapset_id && beatmap.osu_beatmap_id
        ? `https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id}#mania/${beatmap.osu_beatmap_id}`
        : null,
  };
}

export async function buildVoteResults(
  db: SupabaseClient,
  beatmap: BeatmapRecord,
  userId?: number
) {
  const { data: allVotes, error } = await db
    .from("votes")
    .select("dan_level, tier, user_id, created_at")
    .eq("beatmap_id", beatmap.id)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const dedupedVotes: Record<
    string,
    { dan_level: string; tier: string; created_at: string }
  > = {};
  for (const vote of allVotes || []) {
    dedupedVotes[String(vote.user_id)] = {
      dan_level: vote.dan_level,
      tier: vote.tier,
      created_at: vote.created_at,
    };
  }

  const distribution: Record<string, { low: number; mid: number; high: number }> = {};
  for (const vote of Object.values(dedupedVotes)) {
    if (!distribution[vote.dan_level]) {
      distribution[vote.dan_level] = { low: 0, mid: 0, high: 0 };
    }
    distribution[vote.dan_level][vote.tier as "low" | "mid" | "high"]++;
  }

  const sortedDistribution: typeof distribution = {};
  for (const key of Object.keys(distribution).sort(
    (a, b) =>
      (DAN_ORDER[a as keyof typeof DAN_ORDER] || 99) -
      (DAN_ORDER[b as keyof typeof DAN_ORDER] || 99)
  )) {
    sortedDistribution[key] = distribution[key];
  }

  const totalVotes = Object.keys(dedupedVotes).length;
  const ownVote = userId === undefined ? undefined : dedupedVotes[String(userId)];

  return {
    beatmap: serializeBeatmap(beatmap, totalVotes),
    distribution: sortedDistribution,
    user_vote: ownVote
      ? { dan_level: ownVote.dan_level, tier: ownVote.tier }
      : null,
  };
}

export const BEATMAP_SELECT =
  "id, osu_beatmap_id, beatmapset_id, source_type, file_checksum, checksum_algorithm, mode, artist, title, version, creator, total_votes";

