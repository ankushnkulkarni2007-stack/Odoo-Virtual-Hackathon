import { useState } from 'react';
import { getPayroll } from '../services/api';

export default function Payroll() {
  const [employeeId, setEmployeeId] = useState('EMP-101');
  const [payrollData, setPayrollData] = useState({
    employeeId: 'EMP-101',
    basicSalary: 30000,
    allowances: 2000,
    deductions: 500,
    grossSalary: 32000,
    netSalary: 31500,
  });

  const [loading, setLoading] = useState(false);

  const handleFetchPayroll = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Calls GET /api/payroll/:employeeId or falls back to mock structure
      const response = await getPayroll();
      // If fetching list, we simulate specific employee view
      setLoading(false);
    } catch (err) {
      console.error('Payroll fetch error:', err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] p-8 bg-slate-900 text-white">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-400">Payroll & Salary Slip</h1>
          <p className="text-slate-400 mt-1">Review your monthly breakdown, basic salary, allowances, and net pay.</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Employee ID</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <button
              onClick={handleFetchPayroll}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg transition text-sm"
            >
              Search
            </button>
          </div>

          <hr className="border-slate-700 my-4" />

          <div className="grid grid-cols-2 gap-6 bg-slate-900/50 p-6 rounded-xl border border-slate-700/50">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Basic Salary</p>
              <p className="text-2xl font-bold text-white mt-1">₹{payrollData.basicSalary}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Allowances</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">+ ₹{payrollData.allowances}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Deductions</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">- ₹{payrollData.deductions}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Gross Salary</p>
              <p className="text-2xl font-bold text-blue-300 mt-1">₹{payrollData.grossSalary}</p>
            </div>
          </div>

          <div className="bg-blue-600/10 border border-blue-500/30 p-6 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-blue-400 font-semibold">Net Take-Home Salary</p>
              <p className="text-xs text-slate-400 mt-0.5">Calculated as Gross Salary - Deductions</p>
            </div>
            <p className="text-3xl font-extrabold text-blue-400">₹{payrollData.netSalary}</p>
          </div>
        </div>
      </div>
    </div>
  );
}