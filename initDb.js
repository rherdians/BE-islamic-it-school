const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

connection.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL server!");

  // 1. CREATE DATABASE jika belum ada
  connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``, (err) => {
    if (err) throw err;
    console.log("Database checked/created.");

    // 2. Use database
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      connection.query(createReferralTable, (err) => {
        if (err) throw err;
        console.log("Table 'referral_logs' checked/created.");
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
        console.log("Table 'admin_users' checked/created.");
      });

      // 5. CREATE TABLE referral_codes
      const createReferralCodeTable = `
        CREATE TABLE IF NOT EXISTS referral_codes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          kode_referal VARCHAR(100) NOT NULL UNIQUE,
          username VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      connection.query(createReferralCodeTable, (err) => {
        if (err) throw err;
        console.log("Table 'referral_codes' checked/created.");
        connection.end();
      });
    });
  });
});
