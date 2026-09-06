require("dotenv").config();
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
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Razorpay webhook needs the RAW body to verify its HMAC signature, so it must be
// mounted BEFORE express.json() strips/parses the body, and as its own router.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), paymentRoutes.webhookRouter);

app.use(express.json({ limit: "100kb" }));
app.use(mongoSanitize());

app.use(
  session({
    name: "swiftcart.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: "sessions" }),
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
  if (isProd) {
    res.status(err.status || 500).json({ error: err.status ? err.message : "Internal server error." });
  } else {
    res.status(err.status || 500).json({ error: err.message, stack: err.stack });
  }
});

// Vercel's Node.js runtime calls the exported Express app directly as a request handler —
// no app.listen() needed (or wanted) there. app.listen() only runs for local dev, e.g.
// `node api/index.js` or `vercel dev`, which also goes through this file.
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  connectDB()
    .then(() => app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`)))
    .catch((err) => {
      console.error("[server] failed to start:", err.message);
      process.exit(1);
    });
}

module.exports = app;
