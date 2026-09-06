const express = require("express");
const argon2 = require("argon2");
const rateLimit = require("express-rate-limit");
const { body } = require("express-validator");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { checkValidation } = require("../middleware/validate");

const router = express.Router();

// ---- Brute-force protection ----
// Keyed per-IP by default. Deliberately generous enough not to lock out shared
// office/campus IPs on normal typos, tight enough to blunt scripted guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many accounts created from this location. Try again later." },
});

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB, OWASP-recommended minimum for argon2id
  timeCost: 2,
  parallelism: 1,
};

// ---- REGISTER ----
router.post(
  "/register",
  registerLimiter,
  [
    body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Name is required."),
    body("email").trim().isEmail().withMessage("A valid email is required.").normalizeEmail(),
    body("password")
      .isLength({ min: 8, max: 128 })
      .withMessage("Password must be at least 8 characters."),
  ],
  async (req, res, next) => {
    try {
      if (checkValidation(req, res)) return;
      const { name, email, password } = req.body;

      const existing = await User.findOne({ email });
      if (existing) {
        // 409: resource conflict. Deliberately doesn't say "email taken" vs anything
        // more specific — this one is safe to be explicit about, unlike login errors,
        // because register-time enumeration risk is much lower and UX needs it.
        return res.status(409).json({ error: "An account with this email already exists." });
      }

      const passwordHash = await argon2.hash(password, ARGON2_OPTS);
      const user = await User.create({ name, email, passwordHash, role: "customer" });

      // Log the user in immediately (create authenticated session).
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.userId = user._id.toString();
        res.status(201).json({ user: user.toSafeJSON() });
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }
      next(err);
    }
  }
);

// ---- LOGIN ----
router.post(
  "/login",
  loginLimiter,
  [
    body("email").trim().isEmail().withMessage("Invalid email or password.").normalizeEmail(),
    body("password").notEmpty().withMessage("Invalid email or password."),
  ],
  async (req, res, next) => {
    try {
      if (checkValidation(req, res)) return;
      const { email, password } = req.body;

      const GENERIC_FAIL = { error: "Invalid email or password." };

      const user = await User.findOne({ email }).select("+passwordHash +failedLoginCount +lockedUntil");
      if (!user) {
        // Same generic message + similar timing whether or not the account exists,
        // to avoid leaking account existence (enumeration).
        await argon2.hash(password, ARGON2_OPTS).catch(() => {});
        return res.status(401).json(GENERIC_FAIL);
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(429).json({ error: "Account temporarily locked. Try again later." });
      }

      const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
      if (!valid) {
        user.failedLoginCount = (user.failedLoginCount || 0) + 1;
        if (user.failedLoginCount >= 8) {
          user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          user.failedLoginCount = 0;
        }
        await user.save();
        return res.status(401).json(GENERIC_FAIL);
      }

      user.failedLoginCount = 0;
      user.lockedUntil = null;
      await user.save();

      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.userId = user._id.toString();
        res.json({ user: user.toSafeJSON() });
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---- CURRENT USER ----
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

// ---- LOGOUT ----
router.post("/logout", (req, res, next) => {
  if (!req.session) return res.status(200).json({ ok: true });
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("swiftcart.sid");
    res.status(200).json({ ok: true });
  });
});

module.exports = router;
