const express = require("express");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const DELIVERY_FEE = 40;
const FREE_DELIVERY_THRESHOLD = 200;

async function computeDiscount(code, subtotal) {
  if (!code) return { discount: 0, code: null };
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), active: true });
  if (!coupon || subtotal < coupon.minSubtotal) return { discount: 0, code: null };
  let discount = coupon.type === "flat" ? coupon.value : Math.round((subtotal * coupon.value) / 100);
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  return { discount: Math.min(discount, subtotal), code: coupon.code };
}

/**
 * Recomputes an order's pricing from the database. Shared by order creation
 * and by the payments route (which needs the same authoritative total to open
 * a payment-provider order for the correct amount).
 */
async function priceCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("Cart is empty.");
    err.status = 400;
    throw err;
  }

  const legacyIds = items.map((i) => Number(i.id));
  const products = await Product.find({ legacyId: { $in: legacyIds }, active: true });
  const byLegacyId = new Map(products.map((p) => [p.legacyId, p]));

  let subtotal = 0;
  let itemCount = 0;
  const priced = [];

  for (const line of items) {
    const product = byLegacyId.get(Number(line.id));
    const qty = Math.max(1, Math.min(99, Number(line.qty) || 1));
    if (!product) {
      const err = new Error(`Product ${line.id} is not available.`);
      err.status = 400;
      throw err;
    }
    if (product.stock < qty) {
      const err = new Error(`${product.title} only has ${product.stock} left in stock.`);
      err.status = 409;
      throw err;
    }
    subtotal += product.price * qty;
    itemCount += qty;
    priced.push({
      product: product._id,
      legacyId: product.legacyId,
      title: product.title,
      emoji: product.emoji,
      qty,
      price: product.price,
    });
  }

  return { priced, subtotal, itemCount, products: byLegacyId };
}

// ---- CREATE ORDER ----
router.post(
  "/",
  requireAuth,
  [
    body("items").isArray({ min: 1 }).withMessage("Cart is empty."),
    body("addressId").optional().isString(),
    body("address").optional().isObject(),
    body("paymentMethod").isIn(["cod", "upi", "card", "wallet"]).withMessage("Invalid payment method."),
    body("couponCode").optional({ nullable: true }).isString(),
  ],
  async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ error: "Validation failed.", details: errors.array().map((e) => e.msg) });
      }

      const { items, paymentMethod, couponCode, addressId } = req.body;
      let address = req.body.address;

      // Resolve address: prefer a saved address the user actually owns; the frontend
      // must not be able to submit an arbitrary addressId belonging to someone else.
      if (addressId) {
        const saved = req.user.addresses.id(addressId);
        if (!saved) return res.status(400).json({ error: "Address not found." });
        address = { name: saved.name, phone: saved.phone, line: saved.line };
      }
      if (!address || !address.name || !address.phone || !address.line) {
        return res.status(400).json({ error: "A valid delivery address is required." });
      }

      let order;
      await session.withTransaction(async () => {
        const { priced, subtotal, itemCount } = await priceCart(items);

        const { discount, code } = await computeDiscount(couponCode, subtotal);
        const afterDiscount = subtotal - discount;
        const deliveryFee = afterDiscount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
        const total = afterDiscount + deliveryFee;

        // Decrement stock atomically and only if enough remains (guards against a
        // race between two simultaneous checkouts of the last unit).
        for (const line of priced) {
          const result = await Product.updateOne(
            { _id: line.product, stock: { $gte: line.qty } },
            { $inc: { stock: -line.qty } },
            { session }
          );
          if (result.modifiedCount === 0) {
            const err = new Error("One or more items went out of stock. Please review your cart.");
            err.status = 409;
            throw err;
          }
        }

        let paymentStatus = "pending"; // upi/card start pending until /api/payments/verify runs

        // Wallet is our own real internal ledger (not a simulated external gateway) —
        // deduct atomically and mark paid immediately, same as any in-house balance debit.
        if (paymentMethod === "wallet") {
          const User = require("../models/User");
          const debited = await User.updateOne(
            { _id: req.user._id, walletBalanceMinor: { $gte: Math.round(total * 100) } },
            { $inc: { walletBalanceMinor: -Math.round(total * 100) } },
            { session }
          );
          if (debited.modifiedCount === 0) {
            const err = new Error("Insufficient wallet balance.");
            err.status = 402;
            throw err;
          }
          paymentStatus = "paid";
        }

        const [created] = await Order.create(
          [
            {
              user: req.user._id,
              items: priced,
              itemCount,
              address,
              couponCode: code,
              subtotal,
              discount,
              deliveryFee,
              total,
              paymentMethod,
              paymentStatus,
              orderStatus: "placed",
            },
          ],
          { session }
        );
        order = created;
      });

      res.status(201).json({ order });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    } finally {
      session.endSession();
    }
  }
);

module.exports = router;
module.exports.priceCart = priceCart;
module.exports.computeDiscount = computeDiscount;
module.exports.DELIVERY_FEE = DELIVERY_FEE;
module.exports.FREE_DELIVERY_THRESHOLD = FREE_DELIVERY_THRESHOLD;
