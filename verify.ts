import pool from './src/lib/postgres';

async function verify() {
  const { rows } = await pool.query('SELECT reference_type, count(*) FROM inventory_movements GROUP BY reference_type');
  console.log('Movements:', rows);

  const testBad = await pool.query(`SELECT id FROM inventory_movements WHERE reference_number LIKE '%0027%'`);
  console.log('Bad ref:', testBad.rows);
  
  process.exit(0);
}
verify();
