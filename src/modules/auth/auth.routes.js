const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth } = require("../../shared/auth");
const authController = require("./auth.controller");

const router = express.Router();

router.post("/register", asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));
router.post("/logout", authController.logout);
router.post("/forgot-password", asyncHandler(authController.forgotPassword));
router.post("/verify-otp", asyncHandler(authController.verifyOtp));
router.post("/reset-password", asyncHandler(authController.resetPassword));
router.post("/change-password", requireAuth, asyncHandler(authController.changePassword));
router.get("/me", requireAuth, asyncHandler(authController.me));
router.patch("/me", requireAuth, asyncHandler(authController.updateMe));

module.exports = router;
