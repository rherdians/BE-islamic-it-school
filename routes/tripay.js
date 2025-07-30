const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Validasi environment variables
const requiredEnvVars = ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Environment variable ${envVar} is required`);
    process.exit(1);
  }
});

// Midtrans configuration
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MIDTRANS_BASE_URL = IS_PRODUCTION 
  ? 'https://api.midtrans.com/v2' 
  : 'https://api.sandbox.midtrans.com/v2';

// Fungsi validasi email sederhana
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Fungsi validasi nomor telepon Indonesia
function isValidPhoneNumber(phone) {
  const phoneRegex = /^(\+62|62|0)[0-9]{8,13}$/;
  return phoneRegex.test(phone);
}

// Fungsi membuat Basic Auth header untuk Midtrans
function getMidtransAuthHeader() {
  const credentials = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');
  return `Basic ${credentials}`;
}

// Endpoint untuk membuat transaksi Snap Preference
router.post('/create-transaction', async (req, res) => {
  try {
    const { 
      nama, 
      nomor, 
      alamat, 
      amount, 
      item_name, 
      referral_code,
      customer_email,
      log_id
    } = req.body;

    const validationErrors = [];

    if (!nama || typeof nama !== 'string' || nama.trim().length < 2) {
      validationErrors.push('Nama minimal 2 karakter');
    }

    if (!nomor || !isValidPhoneNumber(nomor)) {
      validationErrors.push('Nomor telepon tidak valid');
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      validationErrors.push('Amount harus berupa angka positif');
    }

    if (!item_name || typeof item_name !== 'string' || item_name.trim().length < 1) {
      validationErrors.push('Nama item diperlukan');
    }

    if (customer_email && !isValidEmail(customer_email)) {
      validationErrors.push('Format email tidak valid');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Data tidak valid',
        errors: validationErrors
      });
    }

    const timestamp = Date.now();
    const orderId = log_id ? `ORDER-${timestamp}-${log_id}` : `ORDER-${timestamp}`;
    const finalCustomerEmail = customer_email || `customer_${timestamp}@temp.local`;

    // Format nomor telepon
    let formattedPhone = nomor;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+62' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('62')) {
      formattedPhone = '+' + formattedPhone;
    } else if (!formattedPhone.startsWith('+62')) {
      formattedPhone = '+62' + formattedPhone;
    }

    // Payload untuk Snap Preference (tanpa payment_type)
    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: parseInt(amount)
      },
      customer_details: {
        first_name: nama.trim(),
        email: finalCustomerEmail,
        phone: formattedPhone,
        billing_address: {
          first_name: nama.trim(),
          address: alamat,
          city: "Jakarta",
          postal_code: "12345",
          country_code: "IDN"
        },
        shipping_address: {
          first_name: nama.trim(),
          address: alamat,
          city: "Jakarta",
          postal_code: "12345",
          country_code: "IDN"
        }
      },
      item_details: [
        {
          id: `ITEM-${timestamp}`,
          price: parseInt(amount),
          quantity: 1,
          name: item_name.trim(),
          category: "book"
        }
      ],
      custom_field1: referral_code || '',
      custom_field2: log_id || '',
      enabled_payments: [
        "credit_card", 
        "mandiri_clickpay", 
        "cimb_clicks",
        "bca_klikbca", 
        "bca_klikpay", 
        "bri_epay", 
        "echannel", 
        "permata_va",
        "bca_va", 
        "bni_va", 
        "bri_va", 
        "other_va", 
        "gopay", 
        "shopeepay",
        "indomaret", 
        "danamon_online", 
        "akulaku",
        "qris"
      ],
      callbacks: {
        finish: process.env.RETURN_URL || 'https://your-website.com/payment-success'
      }
    };

    console.log('Creating Midtrans Snap transaction:', {
      order_id: orderId,
      amount,
      customer: nama
    });

    // Gunakan endpoint /snap/v1/transactions untuk Snap Preference
    const snapUrl = IS_PRODUCTION 
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    const midtransRes = await axios.post(snapUrl, payload, {
      headers: {
        'Authorization': getMidtransAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    if (midtransRes.data && midtransRes.data.token) {
      console.log('Snap transaction created successfully:', orderId);
      res.json({
        success: true,
        order_id: orderId,
        token: midtransRes.data.token,
        redirect_url: midtransRes.data.redirect_url,
        client_key: MIDTRANS_CLIENT_KEY,
        is_production: IS_PRODUCTION
      });
    } else {
      console.error('Midtrans Snap API error:', midtransRes.data);
      res.status(400).json({
        success: false,
        message: 'Gagal membuat transaksi',
        error: midtransRes.data.status_message || 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Create Snap transaction error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    let errorMessage = 'Gagal membuat transaksi Midtrans';
    let statusCode = 500;

    if (error.code === 'ENOTFOUND') {
      errorMessage = 'Tidak dapat terhubung ke server Midtrans';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Request timeout ke server Midtrans';
    } else if (error.response?.status === 400) {
      errorMessage = error.response.data?.status_message || 'Data tidak valid';
      statusCode = 400;
    } else if (error.response?.status === 401) {
      errorMessage = 'API Key tidak valid';
      statusCode = 401;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// === Midtrans Notification/Webhook Handler ===
// 1. Fix the webhook handler in tripayRoutes.js
router.post('/notification', async (req, res) => {
  try {
    const notification = req.body;
    console.log('Midtrans notification received:', notification);

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
      transaction_time
    } = notification;

    // Verifikasi signature
    const serverKey = MIDTRANS_SERVER_KEY;
    const expectedSignature = crypto
      .createHash('sha512')
      .update(order_id + status_code + gross_amount + serverKey)
      .digest('hex');

    if (expectedSignature !== signature_key) {
      console.error('Invalid signature from Midtrans');
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid signature' 
      });
    }

    console.log(`Payment status: ${transaction_status} for order_id: ${order_id}`);

    // Extract log_id from order_id format: ORDER-timestamp-log_id
    const logIdMatch = order_id.match(/ORDER-\d+-(\d+)$/);
    const logId = logIdMatch ? logIdMatch[1] : null;

    if (!logId) {
      console.error('Cannot extract log_id from order_id:', order_id);
      return res.status(200).json({ 
        success: false, 
        message: 'Invalid order_id format' 
      });
    }

    // Handle status pembayaran
    let newStatus = 'belum beli';
    let updateData = {
      order_id: order_id,
      payment_type: payment_type,
      updated_at: new Date()
    };

    if (transaction_status === 'capture') {
      if (fraud_status === 'challenge') {
        newStatus = 'challenge';
      } else if (fraud_status === 'accept') {
        newStatus = 'beli';
        updateData.paid_at = transaction_time;
      }
    } else if (transaction_status === 'settlement') {
      newStatus = 'beli';
      updateData.paid_at = transaction_time;
    } else if (transaction_status === 'cancel' || 
               transaction_status === 'deny' || 
               transaction_status === 'expire') {
      newStatus = 'gagal';
      updateData.failure_reason = transaction_status;
    } else if (transaction_status === 'pending') {
      newStatus = 'pending';
    }

    // Update database menggunakan log_id (bukan order_id)
    await updateLogStatus(logId, newStatus, updateData);

    // WAJIB: Selalu balas dengan 200 OK ke Midtrans
    res.status(200).json({ 
      success: true,
      message: 'Notification processed',
      log_id: logId,
      status: newStatus
    });

  } catch (error) {
    console.error('Notification processing error:', error.message);
    
    // Tetap balas 200 ke Midtrans untuk menghindari retry berlebihan
    res.status(200).json({ 
      success: false,
      message: 'Notification error but acknowledged'
    });
  }
});

// Helper function untuk update log status
async function updateLogStatus(logId, status, additionalData = {}) {
  return new Promise((resolve, reject) => {
    const db = require('../db'); // Adjust path as needed
    
    // Build dynamic SQL based on additional data
    let setClause = 'status = ?';
    let values = [status];
    
    Object.keys(additionalData).forEach(key => {
      if (key !== 'updated_at') {
        setClause += `, ${key} = ?`;
        values.push(additionalData[key]);
      }
    });
    
    setClause += ', updated_at = NOW()';
    values.push(parseInt(logId));
    
    const sql = `UPDATE referral_logs SET ${setClause} WHERE id = ?`;
    
    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('Database update error:', err);
        reject(err);
      } else if (result.affectedRows === 0) {
        console.warn('No rows updated for log_id:', logId);
        reject(new Error('Log not found'));
      } else {
        console.log('Log status updated successfully:', {
          log_id: logId,
          status: status,
          affected_rows: result.affectedRows
        });
        resolve(result);
      }
    });
  });
}


// Handle successful payment
async function handleSuccessfulPayment(orderId, logId, notification) {
  try {
    if (logId) {
      // Update status log di database
      const updateResponse = await axios.patch(
        `http://localhost:${process.env.PORT || 5000}/api/logs/${logId}`, 
        {
          status: 'beli',
          payment_reference: orderId,
          paid_at: notification.transaction_time,
          payment_type: notification.payment_type,
          gross_amount: notification.gross_amount
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Log updated successfully:', {
        log_id: logId,
        status: 'beli',
        payment_reference: orderId
      });

    } else {
      console.warn('No log_id found in order_id:', orderId);
    }

  } catch (updateError) {
    console.error('Failed to update log status:', {
      error: updateError.message,
      response: updateError.response?.data,
      order_id: orderId
    });
  }
}

// Handle failed payment
async function handleFailedPayment(orderId, logId, status) {
  try {
    if (logId) {
      await axios.patch(
        `http://localhost:${process.env.PORT || 5000}/api/logs/${logId}`, 
        {
          status: 'failed',
          payment_reference: orderId,
          failure_reason: status
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Log updated for failed payment:', {
        log_id: logId,
        status: 'failed',
        order_id: orderId
      });
    }
  } catch (error) {
    console.error('Failed to update failed payment status:', error.message);
  }
}

// Handle pending payment
async function handlePendingPayment(orderId, logId, notification) {
  try {
    if (logId) {
      await axios.patch(
        `http://localhost:${process.env.PORT || 5000}/api/logs/${logId}`, 
        {
          status: 'pending',
          payment_reference: orderId,
          payment_type: notification.payment_type
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Log updated for pending payment:', {
        log_id: logId,
        status: 'pending',
        order_id: orderId
      });
    }
  } catch (error) {
    console.error('Failed to update pending payment status:', error.message);
  }
}

// Endpoint untuk cek status transaksi (opsional)
router.get('/transaction-status/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    
    const midtransRes = await axios.get(
      `${MIDTRANS_BASE_URL}/${order_id}/status`,
      {
        headers: {
          'Authorization': getMidtransAuthHeader(),
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );

    res.json({
      success: true,
      data: midtransRes.data
    });

  } catch (error) {
    console.error('Check status error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Gagal mengecek status transaksi',
      error: error.response?.data || error.message
    });
  }
});

// Endpoint untuk cancel transaksi
router.post('/cancel-transaction', async (req, res) => {
  try {
    const { order_id } = req.body;
    
    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID diperlukan'
      });
    }

    const midtransRes = await axios.post(
      `${MIDTRANS_BASE_URL}/${order_id}/cancel`,
      {},
      {
        headers: {
          'Authorization': getMidtransAuthHeader(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );

    res.json({
      success: true,
      message: 'Transaksi berhasil dibatalkan',
      data: midtransRes.data
    });

  } catch (error) {
    console.error('Cancel transaction error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Gagal membatalkan transaksi',
      error: error.response?.data || error.message
    });
  }
});

router.post('/midtrans/callback', express.json(), async (req, res) => {
  const body = req.body;

  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    payment_type,
    fraud_status
  } = body;

  // Signature validation
  const expectedSignature = crypto
    .createHash('sha512')
    .update(order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY)
    .digest('hex');

  if (expectedSignature !== signature_key) {
    return res.status(403).json({ message: 'Invalid signature' });
  }

  try {
    // Ubah status di DB berdasarkan status transaksi Midtrans
    let newStatus = 'pending';

    if (transaction_status === 'capture' && payment_type === 'credit_card') {
      if (fraud_status === 'challenge') newStatus = 'challenge';
      else newStatus = 'beli';
    } else if (transaction_status === 'settlement') {
      newStatus = 'beli';
    } else if (transaction_status === 'pending') {
      newStatus = 'pending';
    } else if (
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'
    ) {
      newStatus = 'gagal';
    }

    // Update ke database (asumsi order_id = ID log_pembelian)
    await pool.query(
      'UPDATE log_pembelian SET status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, order_id]
    );

    console.log(`Status order ${order_id} diperbarui menjadi ${newStatus}`);
    res.status(200).json({ message: 'Webhook processed' });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;