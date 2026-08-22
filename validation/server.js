require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/database');

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

(async () => {
  // Connect to MongoDB before accepting traffic
  await connectDB();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║          Dayflow - HRMS Server Running               ║
╚══════════════════════════════════════════════════════╝
Environment : ${NODE_ENV}
Server      : http://localhost:${PORT}
Health      : http://localhost:${PORT}/health
    `);
  });
})();
