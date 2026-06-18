"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DashboardData {
  total_beatmaps: number;
  total_votes: number;
  total_voters: number;
  total_users: number;
  recent_beatmaps: {
    id: number;
    osu_beatmap_id: number | null;
    beatmapset_id: number | null;
    source_type: "osu" | "local";
    artist: string;
    title: string;
    version: string;
    creator: string;
    total_votes: number;
    updated_at: string;
  }[];
}

interface StatCard {
  label: string;
  value: string | number;
  color: string;
  loading?: boolean;
  href?: string;
}

function StatCard({ label, value, color }: StatCard) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-pink-800 transition-colors cursor-pointer">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const stats = [
    { label: "Total Beatmaps", value: data?.total_beatmaps ?? "--", color: "text-pink-400" },
    { label: "Total Votes", value: data?.total_votes ?? "--", color: "text-blue-400" },
    { label: "Unique Voters", value: data?.total_voters ?? "--", color: "text-green-400", href: "/admin/users" },
    { label: "Total Users", value: data?.total_users ?? "--", color: "text-purple-400" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {stats.map(({ href, ...cardProps }) => (
          <div key={cardProps.label}>
            {href ? (
              <Link href={href}>
                <StatCard {...cardProps} />
              </Link>
            ) : (
              <StatCard {...cardProps} />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 mb-8">
          <p className="text-red-400 font-medium mb-2">Failed to load dashboard</p>
          <p className="text-red-300 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-2">
            Make sure Supabase tables are created and RLS is disabled.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-center py-8">Loading dashboard data...</p>
        </div>
      )}

      {/* Recent Beatmaps */}
      {data && data.recent_beatmaps && data.recent_beatmaps.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Beatmaps</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left text-sm text-gray-400">
                <th className="pb-2 font-medium">Beatmap</th>
                <th className="pb-2 font-medium">Creator</th>
                <th className="pb-2 font-medium">Votes</th>
                <th className="pb-2 font-medium">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_beatmaps.map((b) => (
                <tr key={b.id} className="border-b border-gray-800/50 text-sm">
                  <td className="py-2">
                    <span className="font-medium">{b.artist} - {b.title}</span>
                    <span className="text-gray-500 ml-2">[{b.version}]</span>
                  </td>
                  <td className="py-2 text-gray-400">{b.creator}</td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 bg-pink-600/20 text-pink-400 rounded text-xs">
                      {b.total_votes}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">
                    {new Date(b.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (!data.recent_beatmaps || data.recent_beatmaps.length === 0) && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-center py-8">
            No beatmaps yet. Start playing osu!mania and submit your first vote!
          </p>
        </div>
      )}
    </div>
  );
}
