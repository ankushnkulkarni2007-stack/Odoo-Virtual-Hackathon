/*import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mock Interceptor: Allows UI testing while backend is offline
/*API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response || error.code === 'ERR_NETWORK') {
      console.warn('Backend offline. Returning mock response.');
      const url = error.config?.url || '';

      if (url.includes('/auth/login')) {
        return Promise.resolve({ data: { success: true, message: 'Mock login successful!', token: 'mock-token' } });
      }
      if (url.includes('/auth/register')) {
        return Promise.resolve({ data: { success: true, message: 'Mock registration successful!' } });
      }
      if (url.includes('/leave/apply')) {
        return Promise.resolve({ data: { success: true, message: 'Mock leave request submitted successfully!' } });
      }
      if (url.includes('/attendance')) {
        return Promise.resolve({ data: { success: true, message: 'Mock attendance action recorded successfully!' } });
      }
      if (url.includes('/employees')) {
        return Promise.resolve({ data: { success: true, message: 'Mock employee operation successful!' } });
      }
      if (url.includes('/payroll')) {
        return Promise.resolve({ data: { success: true, message: 'Mock payroll operation successful!' } });
      }

      return Promise.resolve({ data: { success: true, message: 'Mock operation completed successfully!' } });
    }
    return Promise.reject(error);
  }
);

// Auth Endpoints
export const loginUser = (credentials) => API.post('/auth/login', credentials);
export const registerUser = (userData) => API.post('/auth/register', userData);

// Attendance Endpoints
export const checkIn = (data) => API.post('/attendance/check-in', data);
export const checkOut = (data) => API.post('/attendance/check-out', data);
export const getAttendance = () => API.get('/attendance');

// Leave Endpoints
export const applyLeave = (leaveData) => API.post('/leave/apply', leaveData);
export const getLeaves = () => API.get('/leave');

// Employee Endpoints
export const getEmployees = () => API.get('/employees');
export const getEmployeeById = (id) => API.get(`/employees/${id}`);
export const updateSelfProfile = (id, data) => API.patch(`/employees/${id}/self`, data);

// Payroll Endpoints
export const getPayroll = () => API.get('/payroll');
export const getPayrollByEmployeeId = (employeeId) => API.get(`/payroll/${employeeId}`);

export default API;*/
import axios from 'axios';

const API = axios.create({
  baseURL: 'https://factory-avon-thompson-wanna.trycloudflare.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default API;