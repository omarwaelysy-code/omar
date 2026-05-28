import pool from './src/lib/postgres';
async function test() {
  const {rows} = await pool.query("SELECT id, date::text, created_at, movement_type, reference_number, quantity, unit_cost, total_cost, product_id FROM inventory_movements WHERE reference_number LIKE '%0027%'");
  if (rows.length === 0) { console.log('No movement for 0027'); process.exit(0); }
  const pid = rows[0].product_id;
  const allMoves = await pool.query("SELECT id, date::text as date, created_at, movement_type, reference_number, quantity, unit_cost, total_cost FROM inventory_movements WHERE product_id = $1 ORDER BY date ASC, created_at ASC", [pid]);
  console.table(allMoves.rows);
  process.exit(0);
}
test();
