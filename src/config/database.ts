
import mysql from 'mysql2/promise'; 
import dotenv from 'dotenv';

dotenv.config(); 

const enableSsl = process.env.NODE_ENV === 'production' || process.env.DB_SSL_ENABLED === 'true';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '', 
  database: process.env.DB_NAME || 'three_function_daily_db',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10, 
  queueLimit: 0,
  namedPlaceholders: true,
  
  ...(enableSsl ? { ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } } : {})
  
};

console.log('[DB_CONFIG] Using SSL:', enableSsl);
if (enableSsl) {
    console.log('[DB_CONFIG] SSL rejectUnauthorized:', dbConfig.ssl?.rejectUnauthorized);
}

const pool = mysql.createPool(dbConfig);

export default pool;