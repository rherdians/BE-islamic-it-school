const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();
require('./initDb');
const tripayRoutes = require('./routes/tripay');

const authRoutes = require('./routes/authRoutes');
const referralRoutes = require('./routes/referalRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Route login & admin auth
app.use('/api/auth', authRoutes);
app.use('/api/referal', referralRoutes);
app.use('/api/midtrans', tripayRoutes);

// ✅ POST /api/log-click - Create log awal
app.post('/api/log-click', (req, res) => {
  const { book_title, referral_code, user_agent, nama_pembeli, alamat, nomor_pembeli, harga, harga_asli, diskon_amount } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const sql = `
    INSERT INTO referral_logs (book_title, referral_code, user_agent, ip_address, status, nama_pembeli, alamat, nomor_pembeli, harga, harga_asli, diskon_amount, created_at)
    VALUES (?, ?, ?, ?, 'belum beli', ?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(sql, [book_title, referral_code, user_agent, ip, nama_pembeli, alamat, nomor_pembeli, harga, harga_asli, diskon_amount], (err, result) => {
    if (err) {
      console.error('Error inserting log:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(200).json({ 
      message: 'Click logged successfully',
      id: result.insertId
    });
  });
});

// ✅ PUT /api/log-click/:id/order-id - Update order_id setelah dapat dari Midtrans
app.put('/api/log-click/:id/order-id', (req, res) => {
  const logId = req.params.id;
  const { order_id } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  const sql = `UPDATE referral_logs SET order_id = ? WHERE id = ?`;

  db.query(sql, [order_id, logId], (err, result) => {
    if (err) {
      console.error('Error updating order_id:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.status(200).json({ 
      message: 'Order ID updated successfully',
      order_id: order_id 
    });
  });
});

// ✅ GET /api/logs - Get all logs
app.get('/api/logs', (req, res) => {
  const sql = `
    SELECT id, book_title, referral_code, order_id, user_agent, ip_address, whatsapp_click_time, status,
           nama_pembeli, alamat, nomor_pembeli, harga, harga_asli, diskon_amount, created_at
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

// ✅ PERBAIKAN: TARUH ENDPOINTS SPESIFIK SEBELUM ENDPOINT DENGAN PARAMETER DINAMIS
app.patch('/api/logs/:id', (req, res) => {
  const { id } = req.params;
  const { status, order_id, payment_type, paid_at, failure_reason } = req.body;

  // Validasi bahwa id adalah angka
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'ID must be numeric' });
  }

  const allowed = ['beli', 'belum beli', 'pending', 'gagal', 'challenge'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  console.log('Updating status by log ID:', id, 'to status:', status);
  
  // Build dynamic SQL
  let setClause = 'status = ?';
  let values = [status];
  
  if (order_id) {
    setClause += ', order_id = ?';
    values.push(order_id);
  }
  if (payment_type) {
    setClause += ', payment_type = ?';
    values.push(payment_type);
  }
  if (paid_at) {
    setClause += ', paid_at = ?';
    values.push(paid_at);
  }
  if (failure_reason) {
    setClause += ', failure_reason = ?';
    values.push(failure_reason);
  }
  
  setClause += ', updated_at = NOW()';
  values.push(parseInt(id));
  
  const sql = `UPDATE referral_logs SET ${setClause} WHERE id = ?`;

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error updating status by ID:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Log tidak ditemukan' });
    }

    console.log('Status updated successfully for log ID:', id);
    res.status(200).json({ 
      message: 'Status berhasil diperbarui',
      affected_rows: result.affectedRows 
    });
  });
});
// ✅ Start server
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});