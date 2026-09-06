const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function getClient() {
  if (!process.env.PAYMENT_KEY_ID || !process.env.PAYMENT_KEY_SECRET) {
    const err = new Error(
      "Payment provider is not configured. Set PAYMENT_KEY_ID / PAYMENT_KEY_SECRET in .env (Razorpay TEST keys)."
    );
    err.status = 500;
    throw err;
  }
  return new Razorpay({
    key_id: process.env.PAYMENT_KEY_ID,
    key_secret: process.env.PAYMENT_KEY_SECRET,
  });
}

/**
 * Step 1 of the payment flow: the SwiftCart order already exists (created via
 * POST /api/orders, pending payment). Now open a Razorpay order for the SAME
 * server-computed total, and hand the client just enough to open Razorpay's
 * own checkout widget. The client never sees the key secret.
 */
router.post("/create/:orderId", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (order.paymentMethod === "cod") {
      return res.status(400).json({ error: "This order is Cash on Delivery and does not need online payment." });
    }
    if (order.paymentStatus === "paid") {
      return res.status(409).json({ error: "This order is already paid." });
    }

    const client = getClient();
    const rzpOrder = await client.orders.create({
      amount: Math.round(order.total * 100), // paise
      currency: order.currency || "INR",
      receipt: order._id.toString(),
      notes: { swiftcartOrderId: order._id.toString(), userId: req.user._id.toString() },
    });

    order.paymentProvider = "razorpay";
    order.paymentOrderId = rzpOrder.id;
    await order.save();

    res.json({
      keyId: process.env.PAYMENT_KEY_ID, // publishable, safe to expose
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      orderId: order._id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Step 2: after Razorpay's checkout widget completes, the frontend calls this
 * with the three values Razorpay's client SDK returns. We NEVER trust that
 * callback by itself — we recompute the HMAC signature server-side with our
 * secret key and only mark the order paid if it matches.
 */
router.post("/verify", requireAuth, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification fields." });
    }

    const order = await Order.findOne({
      paymentOrderId: razorpay_order_id,
      user: req.user._id, // ownership check — can't verify someone else's order
    });
    if (!order) return res.status(404).json({ error: "Order not found." });

    const expected = crypto
      .createHmac("sha256", process.env.PAYMENT_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const valid =
      expected.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

    if (!valid) {
      order.paymentStatus = "failed";
      await order.save();
      return res.status(400).json({ error: "Payment verification failed." });
    }

    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      order.paymentId = razorpay_payment_id;
      order.orderStatus = order.orderStatus === "placed" ? "packing" : order.orderStatus;
      await order.save();
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
});

/**
 * Wallet top-up: same real Razorpay test-mode flow as checkout, but the money
 * lands in the user's own in-app wallet balance instead of paying an order.
 */
router.post("/wallet/topup/create", requireAuth, async (req, res, next) => {
  try {
    const amount = Math.round(Number(req.body.amount));
    if (!amount || amount <= 0 || amount > 100000) {
      return res.status(400).json({ error: "Enter a valid amount (up to ₹1,00,000)." });
    }
    const client = getClient();
    const rzpOrder = await client.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `topup_${req.user._id}_${Date.now()}`,
      notes: { type: "wallet_topup", userId: req.user._id.toString(), amount: String(amount) },
    });
    res.json({ keyId: process.env.PAYMENT_KEY_ID, razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency });
  } catch (err) {
    next(err);
  }
});

router.post("/wallet/topup/verify", requireAuth, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
      return res.status(400).json({ error: "Missing payment verification fields." });
    }
    const expected = crypto
      .createHmac("sha256", process.env.PAYMENT_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    const valid =
      expected.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
    if (!valid) return res.status(400).json({ error: "Payment verification failed." });

    const User = require("../models/User");
    const user = await User.findById(req.user._id);
    user.walletBalanceMinor = (user.walletBalanceMinor || 0) + Math.round(Number(amount) * 100);
    await user.save();

    res.json({ walletBalance: user.walletBalanceMinor / 100 });
  } catch (err) {
    next(err);
  }
});

// ---- Webhook (separate router: mounted BEFORE express.json(), with a raw body parser) ----
const webhookRouter = express.Router();

/**
 * Razorpay webhook — the authoritative, server-to-server confirmation, useful
 * even if the customer closes the tab before the browser-side /verify call runs.
 * Must be mounted with the RAW body parser (see server.js) since the signature
 * is computed over the exact raw bytes.
 */
webhookRouter.post("/", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ error: "Webhook secret not configured." });
    if (!signature) return res.status(400).json({ error: "Missing signature." });

    const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
    const valid =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!valid) return res.status(400).json({ error: "Invalid webhook signature." });

    const payload = JSON.parse(req.body.toString("utf8"));
    const event = payload.event;
    const entity = payload.payload?.payment?.entity;
    if (!entity) return res.status(200).json({ ok: true }); // nothing actionable, ack anyway

    const order = await Order.findOne({ paymentOrderId: entity.order_id });
    if (!order) return res.status(200).json({ ok: true }); // unknown order, ack to stop retries

    // Idempotent: re-delivered webhooks for an already-paid order are a no-op.
    if (event === "payment.captured" && order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      order.paymentId = entity.id;
      order.orderStatus = order.orderStatus === "placed" ? "packing" : order.orderStatus;
      await order.save();
    } else if (event === "payment.failed" && order.paymentStatus === "pending") {
      order.paymentStatus = "failed";
      await order.save();
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[webhook] error:", err.message);
    res.status(200).json({ ok: true }); // ack so Razorpay doesn't hammer retries on our bug
  }
});

module.exports = router;
module.exports.webhookRouter = webhookRouter;
