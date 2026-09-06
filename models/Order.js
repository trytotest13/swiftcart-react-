const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    legacyId: { type: Number, required: true },
    title: { type: String, required: true },
    emoji: { type: String, default: "" },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // unit price AT TIME OF ORDER, from DB
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    itemCount: { type: Number, required: true },

    address: {
      name: String,
      phone: String,
      line: String,
    },

    couponCode: { type: String, default: null },
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    deliveryFee: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },

    // orderStatus and paymentStatus are DELIBERATELY separate concepts.
    orderStatus: {
      type: String,
      enum: ["placed", "packing", "out_for_delivery", "delivered", "cancelled"],
      default: "placed",
    },

    paymentMethod: { type: String, enum: ["cod", "upi", "card", "wallet"], required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded"],
      default: "pending",
    },
    paymentProvider: { type: String, default: null }, // e.g. "razorpay"
    paymentOrderId: { type: String, default: null, index: true }, // provider's order id
    paymentId: { type: String, default: null }, // provider's payment id, set on verified success
    currency: { type: String, default: "INR" },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
