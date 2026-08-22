import { useState } from 'react';
import { applyLeave } from '../services/api';

export default function Leave() {
  const [formData, setFormData] = useState({
    employeeId: '',
    leaveType: 'sick',
    startDate: '',
    endDate: '',
    remarks: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await applyLeave(formData);
      setMessage({ type: 'success', text: response.data?.message || 'Leave application submitted successfully!' });
      setFormData({ employeeId: '', leaveType: 'sick', startDate: '', endDate: '', remarks: '' });
    } catch (err) {
      console.error('Leave Application Error:', err);
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to submit leave request.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] p-8 bg-slate-900 text-white">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-400">Apply for Leave</h1>
          <p className="text-slate-400 mt-1">Submit your paid, sick, or unpaid leave request.</p>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-sm border ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Employee ID
            </label>
            <input
              type="text"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              placeholder="EMP-101"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Leave Type
            </label>
            <select
              name="leaveType"
              value={formData.leaveType}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
            >
              <option value="sick">Sick Leave</option>
              <option value="paid">Paid Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                End Date
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Remarks (5 - 300 characters)
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows="3"
              placeholder="Provide reason for leave..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
              required
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition duration-200 shadow-md disabled:opacity-50"
          >
            {loading ? 'Submitting Application...' : 'Submit Leave Request'}
          </button>
        </form>
      </div>
    </div>
  );
}