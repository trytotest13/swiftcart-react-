require("dotenv").config();
const argon2 = require("argon2");
const { connectDB } = require("../config/db");
const Product = require("../models/Product");
const User = require("../models/User");
const Coupon = require("../models/Coupon");

// Copied verbatim from the existing frontend's PRODUCTS array so ids line up.
const PRODUCTS = [
  { id: 1, title: "Wireless ANC Headphones", emoji: "🎧", img: "https://images.unsplash.com/photo-1599669454699-248893623440?w=400&q=80&auto=format&fit=crop", cat: "Electronics", price: 2499, old: 3999, rating: 4.6, flash: true, eta: "14 min" },
  { id: 2, title: "Organic Avocado (4 pk)", emoji: "🥑", img: "https://images.unsplash.com/photo-1557925922-dac32ff4429f?w=400&q=80&auto=format&fit=crop", cat: "Grocery", price: 199, old: null, rating: 4.4, flash: false, eta: "11 min" },
  { id: 3, title: "Smart Fitness Watch", emoji: "⌚", img: "https://images.unsplash.com/photo-1551816230-ef5deaed4a26?w=400&q=80&auto=format&fit=crop", cat: "Electronics", price: 3299, old: 4599, rating: 4.7, flash: true, eta: "18 min" },
  { id: 4, title: "Cold Brew Coffee Pack", emoji: "☕", img: "https://images.unsplash.com/photo-1536638455623-a35d0fa09ab9?w=400&q=80&auto=format&fit=crop", cat: "Grocery", price: 349, old: null, rating: 4.3, flash: false, eta: "9 min" },
  { id: 5, title: "Ceramic Table Lamp", emoji: "💡", img: "https://images.unsplash.com/photo-1570974802254-4b0ad1a755f5?w=400&q=80&auto=format&fit=crop", cat: "Home", price: 1199, old: 1699, rating: 4.5, flash: false, eta: "25 min" },
  { id: 6, title: "Everyday Cotton Tee", emoji: "👕", img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80&auto=format&fit=crop", cat: "Fashion", price: 449, old: 799, rating: 4.2, flash: true, eta: "20 min" },
  { id: 7, title: "Vitamin C Serum", emoji: "🧴", img: "https://images.unsplash.com/photo-1723951174326-2a97221d3b7f?w=400&q=80&auto=format&fit=crop", cat: "Beauty", price: 599, old: 899, rating: 4.6, flash: false, eta: "13 min" },
  { id: 8, title: "Mechanical Keyboard", emoji: "⌨️", img: "https://images.unsplash.com/photo-1669884210062-e3055c8c8f5d?w=400&q=80&auto=format&fit=crop", cat: "Electronics", price: 3999, old: 5499, rating: 4.8, flash: false, eta: "22 min" },
  { id: 9, title: "Sourdough Loaf", emoji: "🍞", img: "https://images.unsplash.com/photo-1620921586333-b7566c34550a?w=400&q=80&auto=format&fit=crop", cat: "Grocery", price: 129, old: null, rating: 4.5, flash: false, eta: "10 min" },
  { id: 10, title: "Bluetooth Speaker", emoji: "🔊", img: "https://images.unsplash.com/photo-1589003077984-894e133dabab?w=400&q=80&auto=format&fit=crop", cat: "Electronics", price: 1799, old: 2299, rating: 4.4, flash: true, eta: "16 min" },
  { id: 11, title: "Scented Soy Candle", emoji: "🕯️", img: "https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?w=400&q=80&auto=format&fit=crop", cat: "Home", price: 349, old: null, rating: 4.3, flash: false, eta: "19 min" },
  { id: 12, title: "Running Sneakers", emoji: "👟", img: "https://images.unsplash.com/photo-1562183241-b937e95585b6?w=400&q=80&auto=format&fit=crop", cat: "Fashion", price: 2299, old: 2999, rating: 4.6, flash: false, eta: "24 min" },
];

async function seed() {
  await connectDB();

  for (const p of PRODUCTS) {
    await Product.updateOne(
      { legacyId: p.id },
      { $set: { legacyId: p.id, ...p, id: undefined, stock: 100, active: true } },
      { upsert: true }
    );
  }
  console.log(`[seed] upserted ${PRODUCTS.length} products`);

  const DEFAULT_COUPONS = [
    { code: "WELCOME10", type: "percent", value: 10, minSubtotal: 0, maxDiscount: null },
    { code: "FLAT50", type: "flat", value: 50, minSubtotal: 300, maxDiscount: null },
    { code: "SWIFT20", type: "percent", value: 20, minSubtotal: 500, maxDiscount: 150 },
  ];
  for (const c of DEFAULT_COUPONS) {
    await Coupon.updateOne({ code: c.code }, { $setOnInsert: { ...c, active: true } }, { upsert: true });
  }
  console.log(`[seed] ensured ${DEFAULT_COUPONS.length} default coupons`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@swiftcart.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin12345!";
  const existing = await User.findOne({ email: adminEmail.toLowerCase() });
  if (!existing) {
    const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
    await User.create({ name: "Admin", email: adminEmail, passwordHash, role: "admin" });
    console.log(`[seed] created admin account: ${adminEmail}`);
  } else {
    console.log(`[seed] admin account already exists: ${adminEmail}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
