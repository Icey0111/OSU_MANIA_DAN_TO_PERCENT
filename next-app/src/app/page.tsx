import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
      <h1 className="text-4xl font-bold mb-4">osu!mania Dan Voting</h1>
      <p className="text-gray-400 mb-8">
        Beatmap difficulty voting system for osu!mania
      </p>
      <div className="flex gap-4">
        <Link
          href="/admin"
          className="px-6 py-3 bg-pink-600 hover:bg-pink-500 rounded-lg font-semibold transition-colors"
        >
          Admin Dashboard
        </Link>
        <a
          href="/api/auth/login"
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
        >
          Login with osu!
        </a>
      </div>
    </div>
  );
}
