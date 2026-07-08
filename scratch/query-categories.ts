import pool from '../src/lib/postgres';
async function run() {
  try {
    const { rows: cats } = await pool.query("SELECT id, name, code, is_final FROM operation_categories");
    console.log("Operation Categories:", JSON.stringify(cats, null, 2));

    const { rows: fields } = await pool.query("SELECT id, name, code, category_id FROM operation_fields");
    console.log("Operation Fields:", JSON.stringify(fields, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
run();
