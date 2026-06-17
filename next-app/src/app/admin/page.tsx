export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: "Total Beatmaps", value: "--", color: "text-pink-400" },
          { label: "Total Votes", value: "--", color: "text-blue-400" },
          { label: "Unique Voters", value: "--", color: "text-green-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6"
          >
            <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <p className="text-gray-400 text-center py-8">
          Dashboard data will load once the backend is connected to Supabase.
        </p>
      </div>
    </div>
  );
}
