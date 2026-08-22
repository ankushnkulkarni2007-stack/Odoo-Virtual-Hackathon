const app = require('./src/app');

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║     Dayflow - HRMS Server Starting                  ║
╚══════════════════════════════════════════════════════╝
Environment: ${NODE_ENV}
Server Running on: http://localhost:${PORT}
Health Check: http://localhost:${PORT}/health
API Documentation: http://localhost:${PORT}/
  `);
});
