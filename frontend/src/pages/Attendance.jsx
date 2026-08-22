import { useState } from 'react';

export default function Attendance() {
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [checkInTime, setCheckInTime] = useState('09:00 AM');

  const handleToggleCheckInOut = () => {
    if (isCheckedIn) {
      setIsCheckedIn(false);
      alert('Checked out successfully!');
    } else {
      setIsCheckedIn(true);
      setCheckInTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      alert('Checked in successfully!');
    }
  };

  // Mock attendance history data
  const attendanceHistory = [
    { id: 1, date: 'Aug 21, 2026', checkIn: '09:02 AM', checkOut: '05:30 PM', status: 'Present', hours: '8h 28m' },
    { id: 2, date: 'Aug 20, 2026', checkIn: '08:55 AM', checkOut: '05:15 PM', status: 'Present', hours: '8h 20m' },
    { id: 3, date: 'Aug 19, 2026', checkIn: '09:10 AM', checkOut: '05:00 PM', status: 'Late', hours: '7h 50m' },
    { id: 4, date: 'Aug 18, 2026', checkIn: '-', checkOut: '-', status: 'On Leave', hours: '-' },
  ];

  return (
    <div className="min-h-[calc(100vh-60px)] p-8 bg-slate-900 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-400">Attendance Tracker</h1>
          <p className="text-slate-400 mt-1">Manage your daily clock-ins and review past work history.</p>
        </div>

        {/* Live Clock-In Action Box */}
        <div className="bg-slate-800 border border-slate-700 px-6 py-4 rounded-2xl flex items-center gap-6 shadow-md">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Current Status</p>
            <p className={`text-lg font-bold ${isCheckedIn ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isCheckedIn ? `Checked In (${checkInTime})` : 'Checked Out'}
            </p>
          </div>
          <button
            onClick={handleToggleCheckInOut}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-md ${
              isCheckedIn
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            {isCheckedIn ? 'Check Out' : 'Check In'}
          </button>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Recent Attendance Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 uppercase tracking-wider text-xs border-b border-slate-700">
                <th className="p-4">Date</th>
                <th className="p-4">Check In</th>
                <th className="p-4">Check Out</th>
                <th className="p-4">Status</th>
                <th className="p-4">Total Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-slate-300">
              {attendanceHistory.map((row) => (
                <tr key={row.id} className="hover:bg-slate-700/20 transition">
                  <td className="p-4 font-medium text-white">{row.date}</td>
                  <td className="p-4">{row.checkIn}</td>
                  <td className="p-4">{row.checkOut}</td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        row.status === 'Present'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : row.status === 'Late'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="p-4 font-mono">{row.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}