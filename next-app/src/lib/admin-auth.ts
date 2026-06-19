import { JwtPayload, verifyToken } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";

export async function verifyAdminToken(token: string): Promise<JwtPayload | null> {
  const payload = await verifyToken(token);
  if (!payload?.is_admin) return null;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select("id, osu_id, is_admin")
      .eq("id", payload.sub)
      .maybeSingle();
    if (error || !data?.is_admin || data.osu_id !== payload.osu_id) return null;
    return payload;
  } catch {
    return null;
  }
}
