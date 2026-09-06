const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home" },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },

    // App-specific data that must only ever be readable/writable by its owner or an admin.
    addresses: [addressSchema],
    wishlist: [{ type: Number }], // product ids
    walletBalanceMinor: { type: Number, default: 0 }, // paise, avoids float issues

    failedLoginCount: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

// Never allow passwordHash (or lockout bookkeeping) to leak, even if a route forgets to .select().
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    addresses: this.addresses,
    wishlist: this.wishlist,
    walletBalance: (this.walletBalanceMinor || 0) / 100,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("User", userSchema);
