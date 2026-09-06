// smoke-test.cjs — quick server boot test
require("dotenv").config({ override: true });

// Override MongoDB to a dummy URI to skip network delay
process.env.MONGODB_URI = "mongodb://localhost:99999/swiftcart";

const { connectDB } = require("./config/db");
const express = require("express");

const app = express();
app.get("/test", (req, res) => res.json({ ok: true }));

// Test 1: connectDB failure handling
console.log("\n=== TEST 1: connectDB throws on bad URI ===");
connectDB()
  .then(() => console.log("UNEXPECTED: connectDB succeeded"))
  .catch((err) => console.log("EXPECTED ERROR:", err.message.split("\n")[0]));

// Test 2: app.listen is called even if connectDB rejects?
// It IS called inside the .then() so it won't fire on rejection.
// Check the api/index.js logic:
console.log("\n=== TEST 2: api/index.js boot logic ===");
const isMain = require.main === module;
console.log("require.main === module:", isMain);
console.log("If 'true' and connectDB rejects, server exits via .catch() — this is the bug.");
console.log("Fix: handle rejection so app.listen still tries (or wrap differently)");
