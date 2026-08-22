const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the values from .env
 * Call this from server.js before starting the HTTP listener.
 */
async function connectDB() {
  const uri =
    process.env.MONGO_URI ||
    `mongodb://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${
      process.env.DB_NAME || 'dayflow'
    }`;

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;
