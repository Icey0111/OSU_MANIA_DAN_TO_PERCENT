"use client";

import { useState, useEffect, useCallback } from "react";

interface UserData {
  user_id: number;
  osu_id: number;
  osu_username: string;
  avatar_url: string | null;
  is_admin: boolean;
  vote_count: number;
  last_vote_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("vote_count");
  const [order, setOrder] = useState("desc");
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        sort,
        order,
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, sort, order]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Users</h1>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by username..."
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
              <th className="p-4 text-sm text-gray-400">User</th>
              <th className="p-4 text-sm text-gray-400">osu! ID</th>
              <th className="p-4 text-sm text-gray-400">Admin</th>
              <th className="p-4 text-sm text-gray-400">
                <button
                  onClick={() => {
                    setSort("vote_count");
                    setOrder(order === "desc" ? "asc" : "desc");
                  }}
                  className="hover:text-white"
                >
                  Votes {sort === "vote_count" ? (order === "desc" ? "↓" : "↑") : ""}
                </button>
              </th>
              <th className="p-4 text-sm text-gray-400">
                <button
                  onClick={() => {
                    setSort("last_vote_at");
                    setOrder(order === "desc" ? "asc" : "desc");
                  }}
                  className="hover:text-white"
                >
                  Last Vote {sort === "last_vote_at" ? (order === "desc" ? "↓" : "↑") : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.user_id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="p-4">
                    <a
                      href={`https://osu.ppy.sh/users/${u.osu_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 hover:text-pink-400 transition-colors"
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-700" />
                      )}
                      <span className="font-medium">{u.osu_username}</span>
                    </a>
                  </td>
                  <td className="p-4 text-gray-400">{u.osu_id}</td>
                  <td className="p-4">
                    {u.is_admin ? (
                      <span className="px-2 py-0.5 bg-pink-600/20 text-pink-400 rounded text-xs">
                        Admin
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">--</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-pink-600/20 text-pink-400 rounded text-sm">
                      {u.vote_count}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {new Date(u.last_vote_at).toLocaleDateString()}
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
