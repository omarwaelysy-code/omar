
import pool from './server/postgres';

async function checkLogs() {
  try {
    const { rows } = await pool.query('SELECT count(*) FROM activity_logs');
    console.log(`Activity logs count: ${rows[0].count}`);
    
    const { rows: sample } = await pool.query('SELECT * FROM activity_logs LIMIT 1');
    console.log('Sample log:', JSON.stringify(sample[0], null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('Error checking logs:', err);
    process.exit(1);
  }
}

checkLogs();
