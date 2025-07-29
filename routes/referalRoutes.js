const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Buat koneksi pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// GET semua referral codes
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM referral_codes ORDER BY created_at DESC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('GET referral_codes error:', error);
    res.status(500).json({ message: 'Gagal mengambil data referral codes' });
  }
});

// POST referral code baru
router.post('/', async (req, res) => {
  const { kode_referal, username } = req.body;

  if (!kode_referal || !username) {
    return res.status(400).json({ message: 'kode_referal dan username wajib diisi' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id FROM referral_codes WHERE kode_referal = ?',
      [kode_referal]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Kode referal sudah digunakan' });
    }

    // Menambahkan usage = 0 secara eksplisit
    await pool.query(
      'INSERT INTO referral_codes (kode_referal, username, `usage`) VALUES (?, ?, ?)',
      [kode_referal, username, 0]
    );

    res.status(201).json({ message: 'Kode referal berhasil ditambahkan' });
  } catch (error) {
    console.error('POST referral_codes error:', error);
    res.status(500).json({ message: 'Gagal menyimpan kode referal' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM referral_codes WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    res.status(200).json({ message: 'Kode referal berhasil dihapus' });
  } catch (error) {
    console.error('DELETE referral_codes error:', error);
    res.status(500).json({ message: 'Gagal menghapus kode referal' });
  }
});

router.put('/use/:kode_referal', async (req, res) => {
  const { kode_referal } = req.params;

  try {
    // Cek apakah kode referal ada
    const [result] = await pool.query(
      'SELECT id FROM referral_codes WHERE kode_referal = ?',
      [kode_referal]
    );

    if (result.length === 0) {
      return res.status(404).json({ message: 'Kode referal tidak ditemukan' });
    }

    // Tambah usage +1
    await pool.query(
      'UPDATE referral_codes SET `usage` = `usage` + 1 WHERE kode_referal = ?',
      [kode_referal]
    );

    res.status(200).json({ message: 'Usage berhasil ditambahkan' });
  } catch (error) {
    console.error('PUT /use/:kode_referal error:', error);
    res.status(500).json({ message: 'Gagal menambah usage' });
  }
});


module.exports = router;
