const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const accessKeyController = require("./access-keys.controller");

const router = express.Router();
const readers = [requireAuth, requireRole("SUPER_ADMIN", "CLIENT", "TENANT_ADMIN")];
const writers = [requireAuth, requireRole("CLIENT", "TENANT_ADMIN")];

router.get("/", ...readers, asyncHandler(accessKeyController.list));
router.post("/", ...writers, asyncHandler(accessKeyController.create));
router.get("/:id", ...readers, asyncHandler(accessKeyController.show));
router.patch("/:id", ...writers, asyncHandler(accessKeyController.update));

module.exports = router;
