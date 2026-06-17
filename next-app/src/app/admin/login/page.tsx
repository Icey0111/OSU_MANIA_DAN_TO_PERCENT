import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import Link from "next/link";

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let username: string | null = null;
  let isLoggedIn = false;

  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      isLoggedIn = true;
      username = payload.username as string;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 rounded-xl p-8 max-w-md w-full text-center border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Login</h1>

        {isLoggedIn ? (
          <>
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6 text-left">
              <p className="text-yellow-400 font-semibold mb-1">
                Logged in as {username}
              </p>
              <p className="text-yellow-300/80 text-sm">
                Your account does not have admin privileges yet. Ask the
                site owner to run this SQL in Supabase:
              </p>
              <code className="block mt-2 bg-gray-800 text-yellow-300 p-2 rounded text-xs break-all">
                UPDATE users SET is_admin = TRUE WHERE osu_username = &apos;{username}&apos;;
              </code>
            </div>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-colors"
            >
              Back to Home
            </Link>
          </>
        ) : (
          <>
            <p className="text-gray-400 mb-8">
              Sign in with your osu! account to access the admin dashboard.
            </p>
            <a
              href="/api/auth/login?redirect=admin"
              className="inline-block px-8 py-3 bg-pink-600 hover:bg-pink-500 rounded-lg font-semibold text-white transition-colors"
            >
              Login with osu!
            </a>
            <p className="text-xs text-gray-600 mt-4">
              Only accounts with admin privileges can access this area.
            </p>
            <Link
              href="/"
              className="block mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Back to Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
