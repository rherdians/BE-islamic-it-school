const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Route login & admin auth
app.use('/api/auth', authRoutes);

// ✅ POST /api/log-click
app.post('/api/log-click', (req, res) => {
  const { book_title, referral_code, user_agent } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const sql = `
    INSERT INTO referral_logs (book_title, referral_code, user_agent, ip_address, status)
    VALUES (?, ?, ?, ?, 'belum beli')
  `;

  db.query(sql, [book_title, referral_code, user_agent, ip], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(200).json({ message: 'Click logged successfully' });
  });
});

// ✅ GET /api/logs
app.get('/api/logs', (req, res) => {
  const sql = `
    SELECT id, book_title, referral_code, user_agent, ip_address, whatsapp_click_time, status, created_at
    FROM referral_logs
    ORDER BY created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching logs:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.status(200).json(results);
  });
});

// ✅ PATCH /api/logs/:id → update status beli/belum
app.patch('/api/logs/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ['beli', 'belum beli'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  const sql = `UPDATE referral_logs SET status = ? WHERE id = ?`;

  db.query(sql, [status, id], (err, result) => {
    if (err) {
      console.error('Error updating status:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Log tidak ditemukan' });
    }

    res.status(200).json({ message: 'Status berhasil diperbarui' });
  });
});


// ✅ Start server
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
