"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Beatmap {
  id: number;
  osu_beatmap_id: number;
  beatmapset_id: number;
  artist: string;
  title: string;
  version: string;
  creator: string;
  total_votes: number;
  updated_at: string;
}

export default function AdminBeatmapsPage() {
  const [beatmaps, setBeatmaps] = useState<Beatmap[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("total_votes");
  const [order, setOrder] = useState("desc");
  const [loading, setLoading] = useState(false);

  const fetchBeatmaps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        sort,
        order,
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/beatmaps?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBeatmaps(data.beatmaps);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch beatmaps:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, sort, order]);

  useEffect(() => {
    fetchBeatmaps();
  }, [fetchBeatmaps]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Beatmaps</h1>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by artist, title, version, or creator..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="p-4 text-sm text-gray-400">Beatmap</th>
              <th className="p-4 text-sm text-gray-400">Set ID</th>
              <th className="p-4 text-sm text-gray-400">Creator</th>
              <th className="p-4 text-sm text-gray-400">
                <button
                  onClick={() => {
                    setSort("total_votes");
                    setOrder(order === "desc" ? "asc" : "desc");
                  }}
                  className="hover:text-white"
                >
                  Votes {sort === "total_votes" ? (order === "desc" ? "↓" : "↑") : ""}
                </button>
              </th>
              <th className="p-4 text-sm text-gray-400">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : beatmaps.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No beatmaps found.
                </td>
              </tr>
            ) : (
              beatmaps.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="p-4">
                    <Link
                      href={`/admin/beatmaps/${b.osu_beatmap_id}`}
                      className="hover:text-pink-400 transition-colors"
                    >
                      <span className="font-medium">{b.artist} - {b.title}</span>
                      <span className="text-gray-500 ml-2">[{b.version}]</span>
                    </Link>
                  </td>
                  <td className="p-4 text-gray-400">{b.beatmapset_id}</td>
                  <td className="p-4 text-gray-400">{b.creator}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-pink-600/20 text-pink-400 rounded text-sm">
                      {b.total_votes}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {new Date(b.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-700 transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages} ({total} total)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
