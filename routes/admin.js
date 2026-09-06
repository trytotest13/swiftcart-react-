const express = require("express");
const { body } = require("express-validator");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const { requireAdmin } = require("../middleware/auth");
const { checkValidation, normCode } = require("../middleware/validate");

const router = express.Router();

// Every route in this file requires the admin role (requireAdmin already 401s when unauthenticated).
router.use(requireAdmin);

// ---- ORDERS ----
router.get("/orders", async (req, res, next) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).populate("user", "name email").lean();
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/orders/:id/status",
  [body("orderStatus").isIn(["placed", "packing", "out_for_delivery", "delivered", "cancelled"])],
  async (req, res, next) => {
    try {
      if (checkValidation(req, res)) return;
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found." });
      order.orderStatus = req.body.orderStatus;
      await order.save();
      res.json({ order });
    } catch (err) {
      next(err);
    }
  }
);

// ---- PRODUCTS ----
// Admins see the FULL catalog (including inactive/out-of-stock), unlike the public /api/products.
router.get("/products", async (req, res, next) => {
  try {
    const products = await Product.find({}).sort({ legacyId: 1 }).lean();
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/products",
  [
    body("legacyId").isInt(),
    body("title").trim().notEmpty(),
    body("cat").trim().notEmpty(),
    body("price").isFloat({ min: 0 }),
    body("stock").isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    try {
      if (checkValidation(req, res)) return;
      const product = await Product.create(req.body);
      res.status(201).json({ product });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: "A product with that id already exists." });
      next(err);
    }
  }
);

router.patch("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

router.delete("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- CUSTOMERS ----
// Includes real order-count / lifetime-spend per customer, computed from actual Orders
// (only counting paid-or-COD orders, i.e. not cancelled/failed ones) rather than invented numbers.
router.get("/customers", async (req, res, next) => {
  try {
    const customers = await User.find({ role: "customer" }).select("name email createdAt").lean();
    const stats = await Order.aggregate([
      { $match: { orderStatus: { $ne: "cancelled" }, paymentStatus: { $ne: "failed" } } },
      { $group: { _id: "$user", orders: { $sum: 1 }, spent: { $sum: "$total" } } },
    ]);
    const statsByUser = new Map(stats.map((s) => [String(s._id), s]));
    res.json({
      customers: customers.map((c) => ({
        ...c,
        orders: statsByUser.get(String(c._id))?.orders || 0,
        spent: statsByUser.get(String(c._id))?.spent || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---- COUPONS ----
router.get("/coupons", async (req, res, next) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
    res.json({ coupons });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/coupons",
  [
    body("code").trim().notEmpty(),
    body("type").isIn(["percent", "flat"]),
    body("value").isFloat({ min: 0 }),
    body("minSubtotal").optional().isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    try {
      if (checkValidation(req, res)) return;
      const { code, type, value, minSubtotal, maxDiscount, active } = req.body;
      const coupon = await Coupon.create({
        code: normCode(code),
        type,
        value,
        minSubtotal: minSubtotal || 0,
        maxDiscount: maxDiscount || null,
        active: active !== false,
      });
      res.status(201).json({ coupon });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: "A coupon with that code already exists." });
      next(err);
    }
  }
);

router.patch("/coupons/:code", async (req, res, next) => {
  try {
    const { type, value, minSubtotal, maxDiscount, active } = req.body;
    const update = {};
    if (type !== undefined) update.type = type;
    if (value !== undefined) update.value = value;
    if (minSubtotal !== undefined) update.minSubtotal = minSubtotal;
    if (maxDiscount !== undefined) update.maxDiscount = maxDiscount;
    if (active !== undefined) update.active = active;
    const coupon = await Coupon.findOneAndUpdate(
      { code: normCode(req.params.code) },
      update,
      { new: true, runValidators: true }
    );
    if (!coupon) return res.status(404).json({ error: "Coupon not found." });
    res.json({ coupon });
  } catch (err) {
    next(err);
  }
});

router.delete("/coupons/:code", async (req, res, next) => {
  try {
    const coupon = await Coupon.findOneAndDelete({ code: normCode(req.params.code) });
    if (!coupon) return res.status(404).json({ error: "Coupon not found." });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
