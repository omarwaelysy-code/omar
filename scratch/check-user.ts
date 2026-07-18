import pool from '../src/lib/postgres.js';

async function checkUser() {
  try {
    const { rows } = await pool.query(
      "SELECT u.id, u.email, u.role, u.company_id, c.name as company_name FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.email = $1",
      ['acc.wael2005@gmail.com']
    );
    console.log('User Memberships:', rows);
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    process.exit(0);
  }
}

checkUser();
