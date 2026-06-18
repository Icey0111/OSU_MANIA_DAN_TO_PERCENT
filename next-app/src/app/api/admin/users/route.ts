import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractCookieToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";

interface VoteRow {
  user_id: number;
  created_at: string;
  users: {
    osu_id: number;
    osu_username: string;
    avatar_url: string | null;
    is_admin: boolean;
    last_login_at: string | null;
  };
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

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const search = (searchParams.get("search") || "").trim();
  const sort = searchParams.get("sort") || "vote_count";
  const order = searchParams.get("order") || "desc";

  const db = getSupabaseAdmin();

  // Query all votes with user info joined
  const { data: votes, error } = await db
    .from("votes")
    .select(`
      user_id,
      created_at,
      users!inner(osu_id, osu_username, avatar_url, is_admin, last_login_at)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  // Aggregate per user
  const userMap = new Map<number, {
    user_id: number;
    osu_id: number;
    osu_username: string;
    avatar_url: string | null;
    is_admin: boolean;
    vote_count: number;
    last_vote_at: string;
  }>();

  for (const v of (votes || []) as unknown as VoteRow[]) {
    if (!v.users) continue;
    const existing = userMap.get(v.user_id);
    if (existing) {
      existing.vote_count++;
      if (new Date(v.created_at) > new Date(existing.last_vote_at)) {
        existing.last_vote_at = v.created_at;
      }
    } else {
      userMap.set(v.user_id, {
        user_id: v.user_id,
        osu_id: v.users.osu_id,
        osu_username: v.users.osu_username,
        avatar_url: v.users.avatar_url,
        is_admin: v.users.is_admin,
        vote_count: 1,
        last_vote_at: v.created_at,
      });
    }
  }

  let userList = Array.from(userMap.values());

  // Search filter
  if (search) {
    const lower = search.toLowerCase();
    userList = userList.filter((u) =>
      u.osu_username.toLowerCase().includes(lower)
    );
  }

  // Sort
  const allowedSorts = ["vote_count", "osu_username", "last_vote_at"];
  const sortColumn = allowedSorts.includes(sort) ? sort : "vote_count";
  const ascending = order === "asc";
  userList.sort((a, b) => {
    let cmp = 0;
    if (sortColumn === "vote_count") {
      cmp = a.vote_count - b.vote_count;
    } else if (sortColumn === "osu_username") {
      cmp = a.osu_username.localeCompare(b.osu_username);
    } else if (sortColumn === "last_vote_at") {
      cmp = new Date(a.last_vote_at).getTime() - new Date(b.last_vote_at).getTime();
    }
    return ascending ? cmp : -cmp;
  });

  // Paginate
  const total = userList.length;
  const offset = (page - 1) * limit;
  const paged = userList.slice(offset, offset + limit);

  return NextResponse.json({
    users: paged,
    total,
    page,
    limit,
  });
}
