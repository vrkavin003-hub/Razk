const mongoose = require("mongoose");

let warmupTimer = null;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing. Copy .env.example to .env and set MONGO_URI.");
  }

  mongoose.set("bufferCommands", true);
  mongoose.set("maxTimeMS", Number(process.env.MONGO_MAX_TIME_MS || 15000));

  const connection = await mongoose.connect(mongoUri, {
    autoIndex: process.env.NODE_ENV !== "production",
    maxPoolSize: Number(process.env.MONGO_POOL_SIZE || 25),
    minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 2),
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 3000),
    socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 30000),
    maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_TIME_MS || 60000),
    heartbeatFrequencyMS: Number(process.env.MONGO_HEARTBEAT_FREQUENCY_MS || 10000),
    family: 4
  });
  console.log(`MongoDB connected: ${connection.connection.host}`);
};

// Keep the connection pool warm so idle hosting platforms (e.g. Render free/low tiers)
// do not drop the pool between requests, reducing cold-start latency.
const startPoolWarmup = () => {
  if (warmupTimer || process.env.NODE_ENV !== "production") return;
  const intervalMs = Number(process.env.MONGO_WARMUP_INTERVAL_MS || 60000);
  warmupTimer = setInterval(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
      }
    } catch {
      // Best-effort keepalive; connection errors surface on the next real request.
    }
  }, intervalMs);
  warmupTimer.unref?.();
};

const stopPoolWarmup = () => {
  if (warmupTimer) {
    clearInterval(warmupTimer);
    warmupTimer = null;
  }
};

module.exports = { connectDB, startPoolWarmup, stopPoolWarmup };
