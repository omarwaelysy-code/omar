import pool from '../src/lib/postgres';

async function run() {
  try {
    const res = await pool.query('SELECT * FROM period_closings');
    console.log('--- period_closings ---');
    console.log(JSON.stringify(res.rows, null, 2));
    
    const res2 = await pool.query("SELECT * FROM purchase_invoices ORDER BY created_at DESC LIMIT 1");
    console.log('--- last purchase invoice ---');
    console.log(JSON.stringify(res2.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
