require("dotenv").config();

// Prevent unhandled MongoDB connection rejections from crashing the process.
// connectDB() re-throws when the connection fails so callers can react, but the
// mongoose driver also emits an unhandled rejection on its internal promise.
process.on("unhandledRejection", (err) => {
  if (err?.message?.includes("ECONNREFUSED") || err?.message?.includes("MongoServerSelectionError")) {
    console.warn("[server] unhandled DB rejection (will retry on next request):", err.message.split("\n")[0]);
    return;
  }
  console.error("[server] unhandled rejection:", err);
});
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");

const { connectDB } = require("../config/db");
const { attachUser } = require("../middleware/auth");

const authRoutes = require("../routes/auth");
const productRoutes = require("../routes/products");
const orderRoutes = require("../routes/orders");
const userRoutes = require("../routes/users");
const adminRoutes = require("../routes/admin");
const paymentRoutes = require("../routes/payments");

const app = express();
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1); // Vercel sits in front as a proxy — needed for correct Secure-cookie behavior

app.use(helmet());
app.use(morgan(isProd ? "combined" : "dev"));

app.use(
  cors({
    // Same-origin requests (frontend served from the same Vercel deployment) don't need
    // CORS at all. FRONTEND_ORIGIN only matters if you serve the HTML files elsewhere.
    origin: process.env.FRONTEND_ORIGIN || true,
    credentials: true,
  })
);

// Ensure the DB connection is established (or reused from a warm container) before any
// route runs. connectDB() is cached — this is cheap on a warm invocation.
// Fire-and-forget: don't await or the server crashes when MongoDB is offline.
app.use((req, res, next) => {
  connectDB()
    .then(() => next())
    .catch((err) => {
      console.warn("[db] not available:", err.message);
      next(); // let requests through — they'll fail at the model layer if DB is needed
    });
});

// Razorpay webhook needs the RAW body to verify its HMAC signature, so it must be
// mounted BEFORE express.json() strips/parses the body, and as its own router.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), paymentRoutes.webhookRouter);

app.use(express.json({ limit: "100kb" }));
app.use(mongoSanitize());

const sessionSecret = process.env.SESSION_SECRET || "swiftcart-secret-key-change-in-prod";
const mongoUri = process.env.MONGODB_URI;

app.use(
  session({
    name: "swiftcart.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: mongoUri ? MongoStore.create({ mongoUrl: mongoUri, collectionName: "sessions" }) : undefined,
    cookie: {
      httpOnly: true,
      secure: isProd, // Vercel serves HTTPS, so this is true in production
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use(attachUser);

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes); // /create/:orderId and /verify (webhook mounted separately above)

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

app.use((err, req, res, next) => {
  console.error("[error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error." });
});

// Vercel's Node.js runtime calls the exported Express app directly as a request handler —
// no app.listen() needed (or wanted) there. app.listen() only runs for local dev, e.g.
// `node api/index.js` or `vercel dev`, which also goes through this file.
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
  // Try to connect to DB in the background — the /api/health endpoint will report
  // { ok: false, db: false } until the connection succeeds.  This avoids a cold-start
  // crash when MongoDB is temporarily unavailable.
  connectDB().catch((err) => console.warn("[server] DB not available yet:", err.message));
}

module.exports = app;
