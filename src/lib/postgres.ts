import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cloud_erp_system',
  port: parseInt(process.env.DB_PORT || '5432'),
};

// Validate configuration
if (!dbConfig.host || dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1') {
  console.error('CRITICAL DATABASE ERROR: DB_HOST is not configured or set to localhost.');
  console.error('In this environment, you must provide a remote PostgreSQL host.');
  console.error('Please go to the "Settings" menu in AI Studio and set the following environment variables:');
  console.error('DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT');
}

const pool = new Pool({
  ...dbConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

// Debug connection info
console.log(`PostgreSQL Pool created for host: ${process.env.DB_HOST || 'localhost'} (port: ${process.env.DB_PORT || '5432'})`);

export default pool;

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res.rows;
}
