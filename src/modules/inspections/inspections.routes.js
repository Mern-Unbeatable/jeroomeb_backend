const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ module: "inspections" });
});

module.exports = router;
