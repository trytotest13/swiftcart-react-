require("dotenv").config();
const app = require("./api/index.js");
console.log("require succeeded, app type:", typeof app);
setTimeout(() => process.exit(0), 2000);
