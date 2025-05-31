import mysql from 'mysql2/promise'; 
import dotenv from 'dotenv';

dotenv.config(); 

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
};

const pool = mysql.createPool(dbConfig);

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Successfully connected to the database.');
    
    const [rows] = await connection.query('SELECT 1 + 1 AS solution');
    
    connection.release(); 
  } catch (error) {
    console.error('Error connecting to the database:', error);
    
    
    process.exit(1); 
  }
};






export default pool;
