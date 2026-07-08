import pool from './src/lib/postgres';

async function main() {
  try {
    console.log('--- Checking purchase_orders table definition ---');
    const res = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'purchase_orders';
    `);
    console.log(JSON.stringify(res.rows, null, 2));

    console.log('--- Querying purchase_orders with id = company ---');
    const testRes = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', ['company']);
    console.log('Success! Rows returned:', testRes.rows.length);
  } catch (err: any) {
    console.error('Error occurred:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

main();
