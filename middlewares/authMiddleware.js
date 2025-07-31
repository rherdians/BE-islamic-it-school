const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ PERBAIKAN: Pastikan JWT_SECRET ada
if (!JWT_SECRET) {
  console.error('JWT_SECRET is required in environment variables');
  process.exit(1);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token diperlukan' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification error:', err.message);
      
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Token sudah expired' });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ message: 'Token tidak valid' });
      } else {
        return res.status(403).json({ message: 'Token verification failed' });
      }
    }

    req.user = user;
    next();
  });
}

module.exports = authenticateToken;