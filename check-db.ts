import pool from './src/lib/postgres';
async function test() {
  try {
    const { rows } = await pool.query("SELECT id, product_id, reference_id, date::text, created_at, movement_type, reference_number, quantity, unit_cost, total_cost FROM inventory_movements WHERE reference_number LIKE '%0027%' ORDER BY date ASC, created_at ASC");
    console.log(JSON.stringify(rows, null, 2));
  } catch(e) { console.error(e); }
  process.exit();
}
test();