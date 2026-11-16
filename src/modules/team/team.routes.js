const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const teamController = require("./team.controller");

const router = express.Router();
const superAdmin = [requireAuth, requireRole("SUPER_ADMIN")];

router.get("/", ...superAdmin, asyncHandler(teamController.list));
router.post("/", ...superAdmin, asyncHandler(teamController.create));
router.post("/:id/make-admin", ...superAdmin, asyncHandler(teamController.makeAdmin));
router.post("/:id/make-specialist", ...superAdmin, asyncHandler(teamController.makeSpecialist));
router.post("/:id/deactivate", ...superAdmin, asyncHandler(teamController.deactivate));
router.delete("/:id", ...superAdmin, asyncHandler(teamController.remove));

module.exports = router;
