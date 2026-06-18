"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DAN_LABELS, DAN_LEVELS } from "@/lib/validation";

interface BeatmapData {
  beatmap: {
    osu_beatmap_id: number;
    beatmapset_id: number;
    artist: string;
    title: string;
    version: string;
    creator: string;
    total_votes: number;
    url: string;
  };
  distribution: Record<string, { low: number; mid: number; high: number }>;
}

interface Voter {
  user_id: number;
  osu_id: number;
  osu_username: string;
  avatar_url: string | null;
  dan_level: string;
  dan_label: string;
  tier: string;
  voted_at: string;
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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/beatmaps/${beatmapId}`);
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
          <span>Beatmapset #{beatmap.beatmapset_id}</span>
          <span>•</span>
          <span>mapped by {beatmap.creator}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <span className="px-3 py-1 bg-pink-600/20 text-pink-400 rounded-lg text-sm">
            {beatmap.total_votes} votes
          </span>
          <a
            href={beatmap.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline text-sm"
          >
            View on osu.ppy.sh →
          </a>
        </div>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {votersLoading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  Loading voters...
                </td>
              </tr>
            ) : voters.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
