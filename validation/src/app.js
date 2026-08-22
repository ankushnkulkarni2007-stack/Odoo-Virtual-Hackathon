const path = require('path');
const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const payrollRoutes = require('./routes/payroll');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (optional)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Dayflow HRMS server is running' });
});

app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Dayflow - Human Resource Management System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      employees: '/api/employees',
      attendance: '/api/attendance',
      leave: '/api/leave',
      payroll: '/api/payroll',
    },
  });
});

// The web UI. Served from the same origin as the API so the browser never
// makes a cross-origin request and no CORS configuration is needed.
app.use(express.static(path.join(__dirname, '..', 'public')));

// 404 handler — must come after all routes.
// Note: Express 5 removed the '*' path syntax, so this is a bare middleware.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

/**
 * Central error handler.
 *
 * Translates the three kinds of failure into ONE response shape, so the
 * frontend has a single format to render — the same { field, message } list
 * that express-validator produces:
 *   - ApiError            → the status the controller chose
 *   - Mongoose validation → 400 with per-field messages
 *   - duplicate key (11000) → 409 naming the field that clashed
 */
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || null;

  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    message = 'Duplicate value';
    errors = [{ field, message: `This ${field} is already in use` }];
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Only log genuine bugs — expected 4xx responses are noise in the console
  if (statusCode >= 500) console.error('Error:', err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
});

module.exports = app;
