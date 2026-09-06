const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

// Public catalog — no auth required, matches the existing storefront's PRODUCTS array shape.
router.get("/", async (req, res, next) => {
  try {
    const products = await Product.find({ active: true }).lean();
    res.json({
      products: products.map((p) => ({
        id: p.legacyId,
        title: p.title,
        emoji: p.emoji,
        img: p.img,
        cat: p.cat,
        price: p.price,
        old: p.old,
        rating: p.rating,
        flash: p.flash,
        eta: p.eta,
        inStock: p.stock > 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
