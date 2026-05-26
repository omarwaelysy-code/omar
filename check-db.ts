import pool from './src/lib/postgres';
async function test() {
  const { rows } = await pool.query('SELECT id, date::text, created_at, movement_type, reference_number, quantity, unit_cost, total_cost FROM inventory_movements ORDER BY date ASC, created_at ASC');
  console.log(JSON.stringify(rows, null, 2));
  process.exit();
}
test();