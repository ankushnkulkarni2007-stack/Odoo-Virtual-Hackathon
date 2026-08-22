import { useState, useEffect } from 'react';
import { getEmployeeById } from '../services/api';

export default function Profile() {
  const [employeeId, setEmployeeId] = useState('EMP-101');
  const [profile, setProfile] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@company.com',
    phone: '9876543210',
    address: 'Bengaluru, India',
    profilePicture: 'profile.jpg',
    department: 'Engineering',
    designation: 'Software Engineer',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Simulating PATCH /api/employees/:id/self update
      setTimeout(() => {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error('Profile Update Error:', err);
      setMessage({ type: 'error', text: 'Failed to update profile.' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] p-8 bg-slate-900 text-white">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-400">Employee Profile</h1>
          <p className="text-slate-400 mt-1">Manage your personal contact details and address.</p>
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

        <form onSubmit={handleUpdate} className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">First Name (Read-Only)</label>
              <input
                type="text"
                value={profile.firstName}
                disabled
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-3 text-slate-400 cursor-not-allowed text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Last Name (Read-Only)</label>
              <input
                type="text"
                value={profile.lastName}
                disabled
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-3 text-slate-400 cursor-not-allowed text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Department</label>
              <input
                type="text"
                value={profile.department}
                disabled
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-3 text-slate-400 cursor-not-allowed text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Designation</label>
              <input
                type="text"
                value={profile.designation}
                disabled
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-3 text-slate-400 cursor-not-allowed text-sm"
              />
            </div>
          </div>

          <hr className="border-slate-700 my-4" />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Phone Number (10 digits)</label>
            <input
              type="text"
              name="phone"
              value={profile.phone}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Address</label>
            <input
              type="text"
              name="address"
              value={profile.address}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Profile Picture Filename</label>
            <input
              type="text"
              name="profilePicture"
              value={profile.profilePicture}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition duration-200 shadow-md disabled:opacity-50"
          >
            {loading ? 'Saving Changes...' : 'Update Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}