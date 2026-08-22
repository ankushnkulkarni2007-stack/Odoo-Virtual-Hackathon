import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Profile from './pages/Profile';
import Payroll from './pages/Payroll';

export default function App() {
  return (
    <Router>
      <nav className="bg-slate-800 text-white p-4 flex flex-wrap items-center gap-6 border-b border-slate-700 text-sm font-medium">
        <span className="font-bold text-blue-400 text-base">Dayflow</span>
        <Link to="/" className="hover:text-blue-300 transition">Login</Link>
        <Link to="/register" className="hover:text-blue-300 transition">Register</Link>
        <Link to="/dashboard" className="hover:text-blue-300 transition">Dashboard</Link>
        <Link to="/attendance" className="hover:text-blue-300 transition">Attendance</Link>
        <Link to="/leave" className="hover:text-blue-300 transition">Leave</Link>
        <Link to="/profile" className="hover:text-blue-300 transition">Profile</Link>
        <Link to="/payroll" className="hover:text-blue-300 transition">Payroll</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/leave" element={<Leave />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/payroll" element={<Payroll />} />
      </Routes>
    </Router>
  );
}