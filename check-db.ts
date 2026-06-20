import pool from './src/lib/postgres';
async function test() {
  try {
    const { rows: cols } = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'journal_entry_lines'"
    );
    console.log("journal_entry_lines columns:", cols.map(c => `${c.column_name} (${c.data_type})`));
  } catch(e) { 
    console.error(e); 
  }
  process.exit();
}
test();