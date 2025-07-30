const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

connection.connect(async (err) => {
  if (err) throw err;
  console.log("✅ Connected to MySQL server.");

  // 1. CREATE DATABASE jika belum ada
  connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``, (err) => {
    if (err) throw err;
    console.log("✅ Database checked/created.");

    // 2. Gunakan database
    connection.changeUser({ database: process.env.DB_NAME }, (err) => {
      if (err) throw err;

      // 3. CREATE TABLE referral_logs
      const createReferralTable = `
        CREATE TABLE IF NOT EXISTS referral_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          book_title VARCHAR(255),
          referral_code VARCHAR(100),
          user_agent TEXT,
          ip_address VARCHAR(100),
          whatsapp_click_time DATETIME DEFAULT NULL,
          status ENUM('belum beli', 'beli') DEFAULT 'belum beli',
          nama_pembeli VARCHAR(255),
          alamat TEXT,
          nomor_pembeli VARCHAR(20),
          order_id VARCHAR(64),
          harga_asli DECIMAL(10,2),
          diskon_amount DECIMAL(10,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
        )
      `;

      connection.query(createReferralTable, (err) => {
        if (err) throw err;
        console.log("✅ Table 'referral_logs' checked/created.");

        // Cek dan tambahkan kolom yang belum ada
        const requiredColumns = [
          { name: 'harga_asli', type: 'DECIMAL(10,2)' },
          { name: 'diskon_amount', type: 'DECIMAL(10,2)' },
          { name: 'updated_at', type: 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP' }
        ];

        requiredColumns.forEach(col => {
          const checkColumnQuery = `
            SELECT COUNT(*) AS count 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'referral_logs' AND COLUMN_NAME = ?
          `;
          connection.query(checkColumnQuery, [process.env.DB_NAME, col.name], (err, results) => {
            if (err) throw err;

            if (results[0].count === 0) {
              const alterQuery = `ALTER TABLE referral_logs ADD COLUMN ${col.name} ${col.type}`;
              connection.query(alterQuery, (err) => {
                if (err) {
                  console.error(`❌ Failed adding column '${col.name}':`, err.message);
                } else {
                  console.log(`✅ Column '${col.name}' added to 'referral_logs'.`);
                }
              });
            } else {
              console.log(`ℹ️  Column '${col.name}' already exists in 'referral_logs'.`);
            }
          });
        });
      });

      // 4. CREATE TABLE admin_users
      const createAdminTable = `
        CREATE TABLE IF NOT EXISTS admin_users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      connection.query(createAdminTable, (err) => {
        if (err) throw err;
        console.log("✅ Table 'admin_users' checked/created.");
      });

      // 5. CREATE TABLE referral_codes
      const createReferralCodeTable = `
        CREATE TABLE IF NOT EXISTS referral_codes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          kode_referal VARCHAR(100) NOT NULL UNIQUE,
          username VARCHAR(100) NOT NULL,
          \`usage\` INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      connection.query(createReferralCodeTable, (err) => {
        if (err) throw err;
        console.log("✅ Table 'referral_codes' checked/created.");

        // Selesai semua, tutup koneksi
        setTimeout(() => connection.end(), 1000); // kasih waktu untuk ALTER selesai
      });
    });
  });
});
