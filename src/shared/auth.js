const jwt = require("jsonwebtoken");
const env = require("../config/env");
const prisma = require("./prisma");
const { HttpError } = require("./http");

const COOKIE_NAME = "access_token";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function tokenMaxAgeMs(expiresIn) {
  const match = /^(\d+)([dhms])$/.exec(expiresIn);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return amount * unitMs[match[2]];
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: tokenMaxAgeMs(env.JWT_EXPIRES_IN),
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

function readToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  return null;
}

async function authenticate(req) {
  const token = readToken(req);
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      organization: {
        select: { id: true, name: true, subscriptionStatus: true },
      },
    },
  });

  if (!user || user.status === "DISABLED") {
    throw new HttpError(401, "Authentication required");
  }

  return user;
}

async function requireAuth(req, res, next) {
  try {
    const user = await authenticate(req);
    if (!user) {
      throw new HttpError(401, "Authentication required");
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const user = await authenticate(req);
    if (user) req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, "You do not have access to this"));
      return;
    }
    next();
  };
}

module.exports = {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  optionalAuth,
  requireRole,
};
