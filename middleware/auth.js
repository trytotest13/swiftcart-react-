const User = require("../models/User");

/**
 * Populates req.user from the session if a valid session exists.
 * Does NOT reject the request if there's no session — use requireAuth for that.
 * Always re-fetches the user from the DB so role changes / deletions take effect immediately
 * (never trust a role cached in the session payload itself).
 */
async function attachUser(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.user = user;
      } else {
        // User was deleted but session survived — kill the stale session.
        req.session.destroy(() => {});
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Rejects unauthenticated requests. Mount after attachUser. */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  next();
}

/**
 * Rejects requests from authenticated users who are not admins.
 * Covers unauthenticated requests too (401), so mount this alone.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden." });
  }
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
