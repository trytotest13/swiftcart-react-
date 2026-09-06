const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // Keep numeric ids to match the existing frontend catalog (PRODUCTS array) 1:1.
    legacyId: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    emoji: { type: String, default: "" },
    img: { type: String, default: "" },
    cat: { type: String, required: true, index: true },
    price: { type: Number, required: true, min: 0 }, // rupees, integer
    old: { type: Number, default: null },
    rating: { type: Number, default: 4.5 },
    flash: { type: Boolean, default: false },
    eta: { type: String, default: "15 min" },
    stock: { type: Number, required: true, default: 100, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
