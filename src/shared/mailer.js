const nodemailer = require("nodemailer");
const env = require("../config/env");

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

function fromAddress() {
  return env.SMTP_FROM || env.SMTP_USER;
}

async function sendPasswordResetEmail({ to, otp, expiresAt }) {
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Your AmenityOps password reset code",
    text: [
      "You asked to reset your AmenityOps password.",
      "",
      `Your code is ${otp}`,
      "",
      "Enter this code, then choose a new password and confirm it.",
      `It expires at ${expiresAt.toISOString()}.`,
      "",
      "If you did not ask for this, you can ignore this email.",
    ].join("\n"),
  });
}

module.exports = { sendPasswordResetEmail };
