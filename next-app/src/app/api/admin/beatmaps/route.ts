import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractCookieToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";

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
  const search = searchParams.get("search") || "";
  const source = searchParams.get("source") || "all";
  const sort = searchParams.get("sort") || "total_votes";
  const order = searchParams.get("order") || "desc";
  const offset = (page - 1) * limit;

  const db = getSupabaseAdmin();

  let query = db.from("beatmaps").select("*", { count: "exact" });

  if (source === "osu" || source === "local") {
    query = query.eq("source_type", source);
  }

  // Search filter
  if (search) {
    const searchPattern = `%${search}%`;
    query = query.or(
      `artist.ilike.${searchPattern},title.ilike.${searchPattern},version.ilike.${searchPattern},creator.ilike.${searchPattern}`
    );
  }

  // Sort (only allow specific columns to prevent SQL injection)
  const allowedSorts = ["total_votes", "updated_at", "created_at", "artist", "title", "version"];
  const sortColumn = allowedSorts.includes(sort) ? sort : "total_votes";
  const sortOrder = order === "asc" ? true : false;

  const { data, count, error } = await query
    .order(sortColumn, { ascending: sortOrder })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch beatmaps" }, { status: 500 });
  }

  return NextResponse.json({
    beatmaps: data || [],
    total: count || 0,
    page,
    limit,
  });
}
