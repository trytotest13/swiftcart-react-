const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const Order = require("../models/Order");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth); // every route below requires an authenticated session

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: "Validation failed.", details: errors.array().map((e) => e.msg) });
    return true;
  }
  return false;
}

// ---- PROFILE ----
router.get("/me", (req, res) => res.json({ user: req.user.toSafeJSON() }));

// ---- ADDRESSES ----
// Note: these live under the authenticated user's own document, so there is
// no address :id route that could be used to reach another user's address —
// ownership is implicit rather than something that has to be separately checked.
router.get("/me/addresses", (req, res) => res.json({ addresses: req.user.addresses }));

router.post(
  "/me/addresses",
  [
    body("name").trim().notEmpty(),
    body("phone").trim().notEmpty(),
    body("line").trim().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      if (checkValidation(req, res)) return;
      const { name, phone, line, label, isDefault } = req.body;
      if (isDefault) req.user.addresses.forEach((a) => (a.isDefault = false));
      req.user.addresses.push({ name, phone, line, label, isDefault: !!isDefault });
      await req.user.save();
      res.status(201).json({ addresses: req.user.addresses });
    } catch (err) {
      next(err);
    }
  }
);

router.patch("/me/addresses/:addrId", async (req, res, next) => {
  try {
    const addr = req.user.addresses.id(req.params.addrId);
    if (!addr) return res.status(404).json({ error: "Address not found." });
    const { name, phone, line, label, isDefault } = req.body;
    if (name) addr.name = name;
    if (phone) addr.phone = phone;
    if (line) addr.line = line;
    if (label) addr.label = label;
    if (isDefault) req.user.addresses.forEach((a) => (a.isDefault = false));
    if (typeof isDefault === "boolean") addr.isDefault = isDefault;
    await req.user.save();
    res.json({ addresses: req.user.addresses });
  } catch (err) {
    next(err);
  }
});

router.delete("/me/addresses/:addrId", async (req, res, next) => {
  try {
    const addr = req.user.addresses.id(req.params.addrId);
    if (!addr) return res.status(404).json({ error: "Address not found." });
    addr.deleteOne();
    await req.user.save();
    res.json({ addresses: req.user.addresses });
  } catch (err) {
    next(err);
  }
});

// ---- WISHLIST ----
router.get("/me/wishlist", (req, res) => res.json({ wishlist: req.user.wishlist }));

router.post("/me/wishlist/:productLegacyId", async (req, res, next) => {
  try {
    const id = Number(req.params.productLegacyId);
    if (!req.user.wishlist.includes(id)) req.user.wishlist.push(id);
    await req.user.save();
    res.json({ wishlist: req.user.wishlist });
  } catch (err) {
    next(err);
  }
});

router.delete("/me/wishlist/:productLegacyId", async (req, res, next) => {
  try {
    const id = Number(req.params.productLegacyId);
    req.user.wishlist = req.user.wishlist.filter((w) => w !== id);
    await req.user.save();
    res.json({ wishlist: req.user.wishlist });
  } catch (err) {
    next(err);
  }
});

// ---- ORDERS (own orders only) ----
router.get("/me/orders", async (req, res, next) => {
  try {
    // Scoped by req.user._id — a user can never pass in someone else's id here.
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

router.get("/me/orders/:orderId", async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id }).lean();
    // 404, not 403 — don't confirm to a probing user that the order id exists at all.
    if (!order) return res.status(404).json({ error: "Order not found." });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
