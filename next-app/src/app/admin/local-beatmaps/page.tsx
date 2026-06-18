"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface LocalBeatmap {
  id: number;
  source_type: "local";
  file_checksum: string;
  checksum_algorithm: "md5";
  artist: string;
  title: string;
  version: string;
  creator: string;
  total_votes: number;
  created_at: string;
  updated_at: string;
}

export default function LocalBeatmapsPage() {
  const [beatmaps, setBeatmaps] = useState<LocalBeatmap[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBeatmaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        source: "local",
        page: String(page),
        limit: "50",
        sort: "updated_at",
        order: "desc",
      });
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/admin/beatmaps?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load local beatmaps");
      setBeatmaps(data.beatmaps || []);
      setTotal(data.total || 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchBeatmaps();
  }, [fetchBeatmaps]);

  async function deleteBeatmap(beatmap: LocalBeatmap) {
    const confirmed = window.confirm(
      `Delete "${beatmap.artist} - ${beatmap.title} [${beatmap.version}]" and its ${beatmap.total_votes} vote(s)?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(beatmap.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/beatmaps/${beatmap.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete local beatmap");
      await fetchBeatmaps();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Local / Unsubmitted Beatmaps</h1>
        <p className="mt-2 text-sm text-gray-400">
          Exact file revisions identified by tosu&apos;s MD5 checksum. Deleting a map also deletes all votes attached to that revision.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Local revisions</p>
          <p className="mt-1 text-3xl font-bold text-yellow-400">{loading ? "--" : total}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Votes on this page</p>
          <p className="mt-1 text-3xl font-bold text-pink-400">
            {loading ? "--" : beatmaps.reduce((sum, beatmap) => sum + beatmap.total_votes, 0)}
          </p>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search artist, title, difficulty, or mapper..."
        className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left text-sm text-gray-400">
              <th className="p-4">Beatmap revision</th>
              <th className="p-4">Checksum</th>
              <th className="p-4">Mapper</th>
              <th className="p-4">Votes</th>
              <th className="p-4">Last updated</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-10 text-center text-gray-500">Loading...</td></tr>
            ) : beatmaps.length === 0 ? (
              <tr><td colSpan={6} className="p-10 text-center text-gray-500">No local beatmaps found.</td></tr>
            ) : (
              beatmaps.map((beatmap) => (
                <tr key={beatmap.id} className="border-b border-gray-800/50 hover:bg-gray-800/40">
                  <td className="p-4">
                    <Link href={`/admin/beatmaps/${beatmap.id}`} className="hover:text-yellow-400">
                      <span className="font-medium">{beatmap.artist} - {beatmap.title}</span>
                      <span className="ml-2 text-gray-500">[{beatmap.version}]</span>
                    </Link>
                  </td>
                  <td className="p-4 font-mono text-xs text-gray-400" title={beatmap.file_checksum}>
                    {beatmap.file_checksum.slice(0, 12)}...
                  </td>
                  <td className="p-4 text-gray-400">{beatmap.creator}</td>
                  <td className="p-4"><span className="rounded bg-pink-600/20 px-2 py-1 text-sm text-pink-400">{beatmap.total_votes}</span></td>
                  <td className="p-4 text-sm text-gray-500">{new Date(beatmap.updated_at).toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <Link href={`/admin/beatmaps/${beatmap.id}`} className="mr-3 text-sm text-blue-400 hover:underline">Manage</Link>
                    <button
                      onClick={() => deleteBeatmap(beatmap)}
                      disabled={deletingId === beatmap.id}
                      className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {deletingId === beatmap.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded bg-gray-800 px-3 py-1 disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="rounded bg-gray-800 px-3 py-1 disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}

