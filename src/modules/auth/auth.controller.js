const { HttpError } = require("../../shared/http");
const { setAuthCookie, clearAuthCookie } = require("../../shared/auth");
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileSchema,
  parseBody,
} = require("./auth.validation");
const authService = require("./auth.service");

async function register(req, res) {
  const input = parseBody(registerSchema, req.body);
  const result = await authService.register(input);
  setAuthCookie(res, result.token);
  res.status(201).json(result);
}

async function login(req, res) {
  const input = parseBody(loginSchema, req.body);
  const result = await authService.login(input);
  setAuthCookie(res, result.token);
  res.json(result);
}

function logout(req, res) {
  clearAuthCookie(res);
  res.json({ message: "Logged out" });
}

async function forgotPassword(req, res) {
  const input = parseBody(forgotPasswordSchema, req.body);
  const result = await authService.forgotPassword(input);
  res.json(result);
}

async function verifyOtp(req, res) {
  const input = parseBody(verifyOtpSchema, req.body);
  const result = await authService.verifyOtp(input);
  res.json(result);
}

async function resetPassword(req, res) {
  const input = parseBody(resetPasswordSchema, req.body);
  const result = await authService.resetPassword(input);
  res.json(result);
}

async function changePassword(req, res) {
  const input = parseBody(changePasswordSchema, req.body);
  const result = await authService.changePassword(req.user.id, input);
  res.json(result);
}

async function me(req, res) {
  if (!req.user) {
    throw new HttpError(401, "Authentication required");
  }
  res.json({ user: await authService.currentUser(req.user) });
}

async function updateMe(req, res) {
  const input = parseBody(profileSchema, req.body);
  res.json({ user: await authService.updateMe(req.user, input) });
}

module.exports = {
  register,
  login,
  logout,
  forgotPassword,
  verifyOtp,
  resetPassword,
  changePassword,
  me,
  updateMe,
};
