import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mock Interceptor: Allows UI testing while backend is offline
API.interceptors.response.use(
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
export const checkIn = (data) =>
  cachedMutation('cached_attendance', 'post', '/attendance/check-in', data, () =>
    API.post('/attendance/check-in', data)
  );
export const checkOut = (data) =>
  cachedMutation('cached_attendance', 'post', '/attendance/check-out', data, () =>
    API.post('/attendance/check-out', data)
  );
export const getAttendance = () =>
  cachedGet('cached_attendance', () => API.get('/attendance'));

// Leave Endpoints
export const applyLeave = (leaveData) =>
  cachedMutation('cached_leaves', 'post', '/leave/apply', leaveData, () =>
    API.post('/leave/apply', leaveData)
  );
export const getLeaves = () =>
  cachedGet('cached_leaves', () => API.get('/leave'));

// Employee Endpoints
export const getEmployees = () =>
  cachedGet('cached_employees', () => API.get('/employees'));
export const getEmployeeById = (id) =>
  cachedGet(`cached_employee_${id}`, () => API.get(`/employees/${id}`));
export const updateSelfProfile = (id, data) =>
  cachedMutation(`cached_employee_${id}`, 'patch', `/employees/${id}/self`, data, () =>
    API.patch(`/employees/${id}/self`, data)
  );

// Payroll Endpoints
export const getPayroll = () =>
  cachedGet('cached_payroll', () => API.get('/payroll'));
export const getPayrollByEmployeeId = (employeeId) =>
  cachedGet(`cached_payroll_${employeeId}`, () => API.get(`/payroll/${employeeId}`));


// --- Offline LocalStorage fallback helpers ---
const readCache = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('LocalStorage write failed:', err);
  }
};

const isNetworkError = (err) => {
  return !err.response || err.code === 'ERR_NETWORK' || navigator.onLine === false;
};

const cachedGet = async (cacheKey, requestFn) => {
  try {
    const response = await requestFn();

    if (response && response.data !== undefined) {
      writeCache(cacheKey, response.data);
    }

    return response;
  } catch (err) {
    const cachedData = readCache(cacheKey);

    if (cachedData !== null && isNetworkError(err)) {
      return {
        data: cachedData,
        offline: true,
        fromLocalStorage: true,
        status: 200,
      };
    }

    throw err;
  }
};

const queueOfflineMutation = (cacheKey, method, url, data) => {
  const pending = readCache('pending_offline_requests', []);

  const offlineItem = {
    id: `offline-${Date.now()}`,
    method,
    url,
    data,
    createdAt: new Date().toISOString(),
  };

  pending.push(offlineItem);
  writeCache('pending_offline_requests', pending);

  if (cacheKey) {
    const existing = readCache(cacheKey, []);

    const offlineData = {
      ...data,
      id: offlineItem.id,
      _offline: true,
      _pendingSync: true,
    };

    if (Array.isArray(existing)) {
      writeCache(cacheKey, [offlineData, ...existing]);
    } else if (existing && typeof existing === 'object') {
      writeCache(cacheKey, { ...existing, ...offlineData });
    } else {
      writeCache(cacheKey, offlineData);
    }
  }

  return {
    data: {
      ...data,
      id: offlineItem.id,
      _offline: true,
      _pendingSync: true,
    },
    offline: true,
    queued: true,
    status: 202,
  };
};

const cachedMutation = async (cacheKey, method, url, data, requestFn) => {
  try {
    return await requestFn();
  } catch (err) {
    if (isNetworkError(err)) {
      return queueOfflineMutation(cacheKey, method, url, data);
    }

    throw err;
  }
};

export const syncPendingOfflineRequests = async () => {
  const pending = readCache('pending_offline_requests', []);

  if (!pending.length || navigator.onLine === false) {
    return;
  }

  const remaining = [];

  for (const item of pending) {
    try {
      await API({
        method: item.method,
        url: item.url,
        data: item.data,
      });
    } catch (err) {
      remaining.push(item);
    }
  }

  writeCache('pending_offline_requests', remaining);
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', syncPendingOfflineRequests);
}
// --- End offline helpers ---


export default API;// Offline fallback
const withCache = (key, fetchFn) => async (...args) => {
  try {
    const res = await fetchFn(...args);
    const data = await res.json();
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  } catch (e) {
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);
    throw e;
  }
};
