import { SignJWT, jwtVerify } from "jose";

export interface JwtPayload {
  sub: number;        // internal user id
  osu_id: number;
  username: string;
  is_admin: boolean;
}

const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET environment variable");
  return new TextEncoder().encode(secret);
};

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({
    sub: String(payload.sub),
    osu_id: payload.osu_id,
    username: payload.username,
    is_admin: payload.is_admin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET());
    return {
      sub: Number(payload.sub),
      osu_id: Number(payload.osu_id),
      username: String(payload.username),
      is_admin: Boolean(payload.is_admin),
    };
  } catch {
    return null;
  }
}

// Extract JWT from Authorization header
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

// Get JWT from cookie (for admin pages)
export function extractCookieToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}
