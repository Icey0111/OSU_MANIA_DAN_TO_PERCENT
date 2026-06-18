"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DAN_LABELS, DAN_LEVELS } from "@/lib/validation";

interface BeatmapData {
  beatmap: {
    osu_beatmap_id: number | null;
    beatmapset_id: number | null;
    source_type: "osu" | "local";
    file_checksum: string | null;
    artist: string;
    title: string;
    version: string;
    creator: string;
    total_votes: number;
    url: string | null;
  };
  distribution: Record<string, { low: number; mid: number; high: number }>;
  promotion_history: Array<{
    id: number;
    local_beatmap_id: number;
    official_beatmap_id: number;
    local_file_checksum: string;
    official_file_checksum: string | null;
    match_method: "exact_checksum" | "admin_confirmed";
    moved_votes: number;
    duplicate_votes: number;
    created_at: string;
  }>;
}

interface Voter {
  vote_id: number;
  user_id: number;
  osu_id: number;
  osu_username: string;
  avatar_url: string | null;
  dan_level: string;
  dan_label: string;
  tier: string;
  voted_at: string;
}

interface PromotionPreview {
  local: {
    file_checksum: string;
    artist: string;
    title: string;
    version: string;
    creator: string;
    total_votes: number;
  };
  official: {
    osu_beatmap_id: number;
    beatmapset_id: number;
    official_file_checksum: string | null;
    artist: string;
    title: string;
    version: string;
    creator: string;
  };
  existing_official: { id: number; total_votes: number } | null;
  evidence: {
    exact_checksum: boolean;
    metadata_differences: string[];
    requires_manual_confirmation: boolean;
  };
}

const COLORS = {
  low: "#f97316",  // orange
  mid: "#eab308",  // yellow
  high: "#ef4444", // red
};

export default function BeatmapDetailPage() {
  const params = useParams();
  const beatmapId = params.id as string;
  const [data, setData] = useState<BeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [votersLoading, setVotersLoading] = useState(true);
  const [deletingVoteId, setDeletingVoteId] = useState<number | null>(null);
  const [deletingBeatmap, setDeletingBeatmap] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [officialId, setOfficialId] = useState("");
  const [promotionPreview, setPromotionPreview] = useState<PromotionPreview | null>(null);
  const [previewingPromotion, setPreviewingPromotion] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/beatmaps/${beatmapId}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Failed to load beatmap:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [beatmapId]);

  async function deleteVote(voter: Voter) {
    if (!window.confirm(`Remove ${voter.osu_username}'s vote from this local beatmap?`)) return;
    setDeletingVoteId(voter.vote_id);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/admin/beatmaps/${beatmapId}/votes/${voter.vote_id}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to remove vote");
      window.location.reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : String(reason));
      setDeletingVoteId(null);
    }
  }

  async function deleteLocalBeatmap() {
    if (!data?.beatmap || data.beatmap.source_type !== "local") return;
    const confirmed = window.confirm(
      `Delete this local beatmap revision and all ${data.beatmap.total_votes} vote(s)?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingBeatmap(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/beatmaps/${beatmapId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete beatmap");
      window.location.href = "/admin/local-beatmaps";
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : String(reason));
      setDeletingBeatmap(false);
    }
  }

  async function previewPromotion() {
    setPreviewingPromotion(true);
    setPromotionPreview(null);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/beatmaps/${beatmapId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ osu_beatmap_id: officialId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to verify official beatmap");
      setPromotionPreview(result);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPreviewingPromotion(false);
    }
  }

  async function confirmPromotion() {
    if (!promotionPreview) return;
    const message = promotionPreview.existing_official
      ? `Merge this local revision into the existing official record? The newest vote from each user will be kept.`
      : `Promote this local revision to official beatmap #${promotionPreview.official.osu_beatmap_id}?`;
    if (!window.confirm(`${message}\n\nThis operation is audited and cannot be automatically undone.`)) return;

    setPromoting(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/beatmaps/${beatmapId}/promote`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ osu_beatmap_id: promotionPreview.official.osu_beatmap_id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to promote beatmap");
      window.location.href = `/admin/beatmaps/${result.target_beatmap_id}`;
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : String(reason));
      setPromoting(false);
    }
  }

  useEffect(() => {
    async function loadVoters() {
      setVotersLoading(true);
      try {
        const res = await fetch(`/api/admin/beatmaps/${beatmapId}/voters`);
        if (res.ok) {
          const d = await res.json();
          setVoters(d.voters || []);
        }
      } catch (err) {
        console.error("Failed to load voters:", err);
      } finally {
        setVotersLoading(false);
      }
    }
    loadVoters();
  }, [beatmapId]);

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  if (!data) {
    return <div className="text-gray-400">Beatmap not found.</div>;
  }

  const { beatmap, distribution } = data;

  // Build chart data
  const chartData = DAN_LEVELS
    .filter((dl) => distribution[dl])
    .map((dl) => ({
      name: DAN_LABELS[dl],
      low: distribution[dl].low,
      mid: distribution[dl].mid,
      high: distribution[dl].high,
      total: distribution[dl].low + distribution[dl].mid + distribution[dl].high,
    }));

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {beatmap.artist} - {beatmap.title}
        </h1>
        <div className="flex items-center gap-3 mt-2 text-gray-400">
          <span className="text-pink-400">[{beatmap.version}]</span>
          <span>•</span>
          <span>
            {beatmap.source_type === "local"
              ? `Local checksum ${beatmap.file_checksum?.slice(0, 8)}`
              : `Beatmapset #${beatmap.beatmapset_id}`}
          </span>
          <span>•</span>
          <span>mapped by {beatmap.creator}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <span className="px-3 py-1 bg-pink-600/20 text-pink-400 rounded-lg text-sm">
            {beatmap.total_votes} votes
          </span>
          {beatmap.url ? (
            <a
              href={beatmap.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline text-sm"
            >
              View on osu.ppy.sh →
            </a>
          ) : (
            <span className="text-yellow-400 text-sm">Local / Unsubmitted</span>
          )}
          {beatmap.source_type === "local" && (
            <button
              onClick={deleteLocalBeatmap}
              disabled={deletingBeatmap}
              className="rounded-lg border border-red-800 px-3 py-1 text-sm text-red-400 hover:bg-red-900/30 disabled:opacity-50"
            >
              {deletingBeatmap ? "Deleting..." : "Delete local revision"}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {beatmap.source_type === "local" && (
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">Promote to Official</h2>
          <p className="mt-2 text-sm text-gray-400">
            Enter the official difficulty ID. osu! metadata is verified server-side; names are evidence only and may legitimately differ.
          </p>
          <div className="mt-4 flex gap-3">
            <input
              value={officialId}
              onChange={(event) => {
                setOfficialId(event.target.value.replace(/\D/g, ""));
                setPromotionPreview(null);
              }}
              placeholder="Official beatmap ID"
              inputMode="numeric"
              className="w-64 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-pink-500"
            />
            <button
              onClick={previewPromotion}
              disabled={!officialId || previewingPromotion}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              {previewingPromotion ? "Verifying..." : "Compare records"}
            </button>
          </div>

          {promotionPreview && (
            <div className="mt-6 space-y-4">
              <div className={`rounded-lg border p-4 text-sm ${promotionPreview.evidence.exact_checksum ? "border-green-800 bg-green-900/20" : "border-yellow-800 bg-yellow-900/20"}`}>
                <div className="font-medium">
                  {promotionPreview.evidence.exact_checksum
                    ? "Exact file checksum match"
                    : "Checksum does not match; manual identity confirmation required"}
                </div>
                {!promotionPreview.official.official_file_checksum && (
                  <div className="mt-1 text-yellow-300">osu! did not provide a checksum for this difficulty.</div>
                )}
                {promotionPreview.evidence.metadata_differences.length > 0 && (
                  <div className="mt-1 text-yellow-300">
                    Different metadata: {promotionPreview.evidence.metadata_differences.join(", ")}. Renaming is allowed, but verify the gameplay identity yourself.
                  </div>
                )}
                {promotionPreview.existing_official && (
                  <div className="mt-1 text-blue-300">
                    An official record already exists with {promotionPreview.existing_official.total_votes} vote(s). Votes will be merged, keeping each user&apos;s newest vote.
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: "Local record", value: promotionPreview.local },
                  { label: `Official #${promotionPreview.official.osu_beatmap_id}`, value: promotionPreview.official },
                ].map((record) => (
                  <div key={record.label} className="rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm">
                    <h3 className="mb-3 font-semibold text-pink-400">{record.label}</h3>
                    <div>{record.value.artist} - {record.value.title}</div>
                    <div className="text-gray-400">[{record.value.version}] mapped by {record.value.creator}</div>
                    <div className="mt-2 break-all font-mono text-xs text-gray-500">
                      {"file_checksum" in record.value
                        ? record.value.file_checksum
                        : record.value.official_file_checksum || "No official checksum returned"}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={confirmPromotion}
                disabled={promoting}
                className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold hover:bg-pink-500 disabled:opacity-50"
              >
                {promoting ? "Promoting..." : "Confirm identity and promote"}
              </button>
            </div>
          )}
        </div>
      )}

      {data.promotion_history?.length > 0 && (
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">Promotion History</h2>
          <div className="mt-4 space-y-3">
            {data.promotion_history.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-pink-400">
                    {entry.match_method === "exact_checksum" ? "Exact checksum" : "Admin confirmed"}
                  </span>
                  <span className="text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
                  <span>{entry.moved_votes} local vote(s) processed</span>
                  <span>{entry.duplicate_votes} duplicate(s) resolved</span>
                </div>
                <div className="mt-2 break-all font-mono text-xs text-gray-500">
                  Local MD5: {entry.local_file_checksum}
                  {entry.official_file_checksum && ` | Official MD5: ${entry.official_file_checksum}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vote Distribution Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Vote Distribution</h2>
        {chartData.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">No votes yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartData.length * 60 + 40}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis type="category" dataKey="name" stroke="#6b7280" width={90} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="low" stackId="a" fill={COLORS.low} name="Low" />
              <Bar dataKey="mid" stackId="a" fill={COLORS.mid} name="Mid" />
              <Bar dataKey="high" stackId="a" fill={COLORS.high} name="High" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 justify-center">
          {(["low", "mid", "high"] as const).map((tier) => (
            <div key={tier} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: COLORS[tier] }}
              />
              <span className="text-sm text-gray-400 capitalize">{tier}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-dan detail table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <h2 className="text-xl font-semibold p-6 pb-4">Detailed Breakdown</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="p-4 text-sm text-gray-400">Dan Level</th>
              <th className="p-4 text-sm text-gray-400 text-right">Low</th>
              <th className="p-4 text-sm text-gray-400 text-right">Mid</th>
              <th className="p-4 text-sm text-gray-400 text-right">High</th>
              <th className="p-4 text-sm text-gray-400 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.name} className="border-b border-gray-800/50">
                <td className="p-4 font-medium">{row.name}</td>
                <td className="p-4 text-right text-orange-400">{row.low}</td>
                <td className="p-4 text-right text-yellow-400">{row.mid}</td>
                <td className="p-4 text-right text-red-400">{row.high}</td>
                <td className="p-4 text-right text-gray-400">{row.total}</td>
              </tr>
            ))}
            {chartData.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No votes recorded for this beatmap.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Voters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-8">
        <h2 className="text-xl font-semibold p-6 pb-4">
          Voters {!votersLoading && `(${voters.length})`}
        </h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="p-4 text-sm text-gray-400">User</th>
              <th className="p-4 text-sm text-gray-400">Dan Level</th>
              <th className="p-4 text-sm text-gray-400">Tier</th>
              <th className="p-4 text-sm text-gray-400">Voted At</th>
              {beatmap.source_type === "local" && (
                <th className="p-4 text-sm text-gray-400 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {votersLoading ? (
              <tr>
                <td colSpan={beatmap.source_type === "local" ? 5 : 4} className="p-8 text-center text-gray-500">
                  Loading voters...
                </td>
              </tr>
            ) : voters.length === 0 ? (
              <tr>
                <td colSpan={beatmap.source_type === "local" ? 5 : 4} className="p-8 text-center text-gray-500">
                  No votes recorded for this beatmap.
                </td>
              </tr>
            ) : (
              voters.map((v) => (
                <tr
                  key={v.user_id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="p-4">
                    <a
                      href={`https://osu.ppy.sh/users/${v.osu_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 hover:text-pink-400 transition-colors"
                    >
                      {v.avatar_url ? (
                        <img
                          src={v.avatar_url}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-700" />
                      )}
                      <span className="font-medium">{v.osu_username}</span>
                    </a>
                  </td>
                  <td className="p-4">{v.dan_label}</td>
                  <td className="p-4">
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: COLORS[v.tier as keyof typeof COLORS] + "20",
                        color: COLORS[v.tier as keyof typeof COLORS],
                      }}
                    >
                      {v.tier}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {new Date(v.voted_at).toLocaleString()}
                  </td>
                  {beatmap.source_type === "local" && (
                    <td className="p-4 text-right">
                      <button
                        onClick={() => deleteVote(v)}
                        disabled={deletingVoteId === v.vote_id}
                        className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingVoteId === v.vote_id ? "Removing..." : "Remove vote"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
