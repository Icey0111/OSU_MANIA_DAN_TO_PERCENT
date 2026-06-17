export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 rounded-xl p-8 max-w-md w-full text-center border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Login</h1>
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
      </div>
    </div>
  );
}
