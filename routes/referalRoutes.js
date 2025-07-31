const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// ✅ PERBAIKAN: Validasi environment variables
// const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
// requiredEnvVars.forEach(envVar => {
//   if (!process.env[envVar]) {
//     console.error(`Environment variable ${envVar} is required`);
//     process.exit(1);
//   }
// });

// Buat koneksi pool dengan error handling
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

// Test koneksi
pool.getConnection()
  .then(connection => {
    console.log('Database connected successfully for referral routes');
    connection.release();
  })
  .catch(err => {
    console.error('Database connection failed for referral routes:', err);
  });

// GET semua referral codes
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM referral_codes 
      ORDER BY created_at DESC
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error('GET referral_codes error:', error);
    res.status(500).json({ 
      message: 'Gagal mengambil data referral codes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST referral code baru
router.post('/', async (req, res) => {
  const { kode_referal, username } = req.body;
  
  if (!kode_referal || !username) {
    return res.status(400).json({ 
      message: 'kode_referal dan username wajib diisi' 
    });
  }

  try {
    // Cek duplikasi
    const [existing] = await pool.query(
      'SELECT id FROM referral_codes WHERE kode_referal = ?',
      [kode_referal]
    );
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        message: 'Kode referal sudah digunakan' 
      });
    }

    // Insert data baru
    await pool.query(
      'INSERT INTO referral_codes (kode_referal, username, `usage`, created_at) VALUES (?, ?, ?, NOW())',
      [kode_referal, username, 0]
    );
    
    res.status(201).json({ 
      message: 'Kode referal berhasil ditambahkan' 
    });
  } catch (error) {
    console.error('POST referral_codes error:', error);
    res.status(500).json({ 
      message: 'Gagal menyimpan kode referal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE referral code
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  // ✅ PERBAIKAN: Validasi parameter ID
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ 
      message: 'ID harus berupa angka yang valid' 
    });
  }

  try {
    const [result] = await pool.query(
      'DELETE FROM referral_codes WHERE id = ?', 
      [parseInt(id)]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        message: 'Data tidak ditemukan' 
      });
    }
    
    res.status(200).json({ 
      message: 'Kode referal berhasil dihapus' 
    });
  } catch (error) {
    console.error('DELETE referral_codes error:', error);
    res.status(500).json({ 
      message: 'Gagal menghapus kode referal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT update usage referral code
router.put('/use/:kode_referal', async (req, res) => {
  const { kode_referal } = req.params;
  
  if (!kode_referal || kode_referal.trim().length === 0) {
    return res.status(400).json({ 
      message: 'Kode referal tidak valid' 
    });
  }

  try {
    // Cek keberadaan kode
    const [result] = await pool.query(
      'SELECT id FROM referral_codes WHERE kode_referal = ?',
      [kode_referal]
    );
    
    if (result.length === 0) {
      return res.status(404).json({ 
        message: 'Kode referal tidak ditemukan' 
      });
    }

    // Update usage +1
    await pool.query(
      'UPDATE referral_codes SET `usage` = `usage` + 1, updated_at = NOW() WHERE kode_referal = ?',
      [kode_referal]
    );
    
    res.status(200).json({ 
      message: 'Usage berhasil ditambahkan' 
    });
  } catch (error) {
    console.error('PUT /use/:kode_referal error:', error);
    res.status(500).json({ 
      message: 'Gagal menambah usage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;