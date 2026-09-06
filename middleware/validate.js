const { validationResult } = require("express-validator");

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: "Validation failed.", details: errors.array().map((e) => e.msg) });
    return true;
  }
  return false;
}

function normCode(s) {
  return String(s).toUpperCase().trim();
}

module.exports = { checkValidation, normCode };
