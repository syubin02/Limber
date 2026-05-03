const crypto = require('crypto');

function getAccessPassword() {
  return process.env.limber_password
    || process.env.LIMBER_PASSWORD
    || process.env.LIMBER_ACCESS_PASSWORD
    || '';
}

function sameSecret(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAccess(req, res) {
  const expected = getAccessPassword();
  if (!expected) {
    res.status(500).json({ error: 'Access password is not configured' });
    return false;
  }

  const provided = req.headers['x-limber-password'];
  if (!sameSecret(provided, expected)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

module.exports = { requireAccess };
