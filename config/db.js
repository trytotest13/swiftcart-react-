const mongoose = require("mongoose");

// Serverless functions can be invoked many times against the same warm container.
// Without caching, each invocation would open a brand new connection and quickly
// exhaust MongoDB's connection limit. `global` survives across invocations on a
// warm container (but not across cold starts, which is fine — a cold start just
// reconnects once).
let cached = global._swiftcartMongoose;
if (!cached) {
  cached = global._swiftcartMongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it in your Vercel project's Environment Variables.");
  }

  if (!cached.promise) {
    mongoose.set("strictQuery", true);
    mongoose.set("bufferCommands", false);
    cached.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    }).then((m) => {
      console.log(`[db] connected -> ${m.connection.name}`);
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // let the next invocation retry instead of caching a failure
    throw err;
  }

  return cached.conn;
}

module.exports = { connectDB };
