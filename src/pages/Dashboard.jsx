export default function Dashboard() {
  return (
    <div className="min-h-[calc(100vh-60px)] p-8 bg-slate-900 text-white">
      {/* Welcome Banner */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-400">Dashboard</h1>
        <p className="text-slate-400 mt-1">Here is a quick overview of your employee status and activities.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-md">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Attendance Status</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">Checked In</p>
          <p className="text-xs text-slate-500 mt-1">Since 09:00 AM Today</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-md">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Leave Balance</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">12 Days</p>
          <p className="text-xs text-slate-500 mt-1">Available for this year</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-md">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Pending Tasks</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">3 Tasks</p>
          <p className="text-xs text-slate-500 mt-1">Due by end of week</p>
        </div>
      </div>

      {/* Quick Actions / Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-md">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
              Check Out
            </button>
            <button className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
              Apply for Leave
            </button>
            <button className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
              View Payslip
            </button>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-md">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Announcements</h3>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="border-b border-slate-700 pb-2">
              <span className="font-medium text-blue-400">System Update:</span> Dayflow v1.0 frontend scaffold deployed successfully.
            </li>
            <li>
              <span className="font-medium text-emerald-400">Reminder:</span> Monthly timesheet submission is due this Friday.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}