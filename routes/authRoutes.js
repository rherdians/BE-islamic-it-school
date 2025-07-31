const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ PERBAIKAN: Pastikan JWT_SECRET ada
if (!JWT_SECRET) {
  console.error('JWT_SECRET is required in environment variables');
  process.exit(1);
}

// Endpoint hanya untuk admin (pakai token)
router.get('/admin-only', authenticateToken, (req, res) => {
  res.json({ message: `Selamat datang admin ${req.user.username}` });
});

// Login Admin
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username dan password wajib diisi' });
  }
  
  console.log("Request login:", username);
  
  const sql = 'SELECT * FROM admin_users WHERE username = ?';
  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    if (results.length === 0) {
      console.warn("User tidak ditemukan");
      return res.status(401).json({ message: 'User tidak ditemukan' });
    }
    
    const user = results[0];
    
    try {
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        console.warn("Password tidak cocok");
        return res.status(401).json({ message: 'Password salah' });
      }
      
      const token = jwt.sign(
        { id: user.id, username: user.username }, 
        JWT_SECRET, 
        { expiresIn: '2h' }
      );
      
      res.json({ 
        token, 
        user: { id: user.id, username: user.username } 
      });
    } catch (bcryptError) {
      console.error('Bcrypt error:', bcryptError);
      return res.status(500).json({ message: 'Authentication error' });
    }
  });
});

// Register Admin
router.post('/register-admin', async (req, res) => {
  const { username, password } = req.body;
  
  // Validasi input
  if (!username || !password) {
    return res.status(400).json({ message: 'Username dan password wajib diisi' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password minimal 6 karakter' });
  }

  try {
    // Cek apakah user sudah ada
    const checkSql = 'SELECT * FROM admin_users WHERE username = ?';
    db.query(checkSql, [username], async (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      
      if (result.length > 0) {
        return res.status(409).json({ message: 'Username sudah digunakan' });
      }
      
      try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Simpan ke database
        const insertSql = 'INSERT INTO admin_users (username, password, created_at) VALUES (?, ?, NOW())';
        db.query(insertSql, [username, hashedPassword], (err2) => {
          if (err2) {
            console.error('Insert error:', err2);
            return res.status(500).json({ message: 'Gagal menyimpan admin' });
          }
          res.status(201).json({ message: 'Admin berhasil didaftarkan' });
        });
      } catch (hashError) {
        console.error('Hash error:', hashError);
        return res.status(500).json({ message: 'Password hashing error' });
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;