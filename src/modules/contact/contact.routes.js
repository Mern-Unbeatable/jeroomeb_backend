const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ module: "contact" });
});

module.exports = router;
