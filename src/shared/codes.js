const crypto = require("crypto");

function createCode(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[crypto.randomInt(alphabet.length)];
  }
  return `${prefix}-${suffix}`;
}

function isUniqueConflict(error, field) {
  const target = error && error.meta && error.meta.target;
  const fields = Array.isArray(target) ? target.map(String) : target ? [String(target)] : [];
  return error && error.code === "P2002" && fields.some((item) => item.includes(field));
}

module.exports = { createCode, isUniqueConflict };
