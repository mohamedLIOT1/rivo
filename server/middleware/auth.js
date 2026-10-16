const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ [FATAL] JWT_SECRET is missing from environment variables. Server cannot start securely.');
  process.exit(1);
}

// In-memory token blacklist for instant O(1) rejection
const revokedTokens = new Set();

const verifyJwt = (t) => {
  if (revokedTokens.has(t)) {
    throw new Error('Token has been revoked. Please login again.');
  }
  return jwt.verify(t, JWT_SECRET);
};

// Admin emails strictly sourced from environment variables with no hardcoded fallback
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .toLowerCase()
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

function isAdminUser(userOrObj) {
  if (!userOrObj) return false;
  if (typeof userOrObj === 'string') {
    return ADMIN_EMAILS.includes(userOrObj.trim().toLowerCase());
  }
  if (userOrObj.role === 'admin' || userOrObj.isAdmin === true) {
    return true;
  }
  const email = (userOrObj.email || '').trim().toLowerCase();
  if (email && ADMIN_EMAILS.includes(email)) return true;
  return false;
}

function isVerifiedUser(userOrObj) {
  if (!userOrObj) return false;
  if (isAdminUser(userOrObj)) return true;
  if (typeof userOrObj === 'object' && userOrObj.isVerified === true) return true;
  return false;
}

function makeToken(u) {
  const isAdmin = isAdminUser(u);
  return jwt.sign({
    id: u._id,
    email: u.email,
    name: u.name,
    role: isAdmin ? 'admin' : (u.role || 'user'),
    isAdmin
  }, JWT_SECRET, { expiresIn: '90d' });
}

// Extract token strictly from Authorization: Bearer <token>
function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return parts[1].trim();
  }
  return null;
}

async function auth(req, res, next) {
  const t = extractBearerToken(req);
  if (!t) return res.status(401).json({ error: 'Authorization header required with Bearer token' });
  if (revokedTokens.has(t)) {
    return res.status(401).json({ error: 'Token has been revoked. Please login again.' });
  }
  try {
    const decoded = verifyJwt(t);
    // Verify against DB tokenInvalidBefore to ensure persistence across server restarts
    const { User } = require('../models');
    const dbUser = await User.findById(decoded.id).select('tokenInvalidBefore role isAdmin email isVerified').lean();
    if (!dbUser) return res.status(401).json({ error: 'User does not exist' });
    if (dbUser.tokenInvalidBefore && decoded.iat) {
      const invalidBeforeTime = new Date(dbUser.tokenInvalidBefore).getTime();
      if ((decoded.iat * 1000) < invalidBeforeTime) {
        revokedTokens.add(t);
        return res.status(401).json({ error: 'Session expired due to logout. Please login again.' });
      }
    }

    req.user = {
      ...decoded,
      role: dbUser.role || decoded.role,
      isAdmin: Boolean(dbUser.isAdmin || isAdminUser(dbUser)),
      isVerified: Boolean(dbUser.isVerified)
    };
    req.token = t;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

async function adminAuth(req, res, next) {
  const t = extractBearerToken(req);
  if (!t) return res.status(401).json({ error: 'Authorization header required with Bearer token' });
  if (revokedTokens.has(t)) {
    return res.status(401).json({ error: 'Token has been revoked. Please login again.' });
  }
  try {
    const decoded = verifyJwt(t);
    const { User } = require('../models');
    const dbUser = await User.findById(decoded.id).select('tokenInvalidBefore role isAdmin email isVerified').lean();
    if (!dbUser) return res.status(401).json({ error: 'User does not exist' });
    if (dbUser.tokenInvalidBefore && decoded.iat) {
      const invalidBeforeTime = new Date(dbUser.tokenInvalidBefore).getTime();
      if ((decoded.iat * 1000) < invalidBeforeTime) {
        revokedTokens.add(t);
        return res.status(401).json({ error: 'Session expired. Please login again.' });
      }
    }

    if (!isAdminUser(dbUser) && !isAdminUser(decoded)) {
      return res.status(403).json({ error: 'Permission denied. Administrator access required.' });
    }

    req.user = {
      ...decoded,
      role: 'admin',
      isAdmin: true,
      isVerified: true
    };
    req.token = t;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const t = extractBearerToken(req);
  if (t && !revokedTokens.has(t)) {
    try { req.user = verifyJwt(t); } catch {}
  }
  next();
}

module.exports = {
  JWT_SECRET,
  revokedTokens,
  verifyJwt,
  isAdminUser,
  isVerifiedUser,
  makeToken,
  auth,
  adminAuth,
  optionalAuth,
  ADMIN_EMAILS
};
