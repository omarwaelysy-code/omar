const { Pool } = require('pg');

async function tryConnect(config) {
  const pool = new Pool(config);
  try {
    const { rows } = await pool.query('SELECT NOW()');
    console.log(`Connected successfully to ${config.host}:${config.port}/${config.database}`);
    return pool;
  } catch (e) {
    console.log(`Connection failed to ${config.host}:${config.port}/${config.database} - ${e.message}`);
    await pool.end();
    return null;
  }
}

async function run() {
  const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const configs = [
    { host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT || '5432'), user: process.env.DB_USER || 'postgres', password: dbPassword, database: process.env.DB_NAME || 'cloud_erp_system' }
  ];

  let activePool = null;
  for (const config of configs) {
    activePool = await tryConnect(config);
    if (activePool) break;
  }

  if (!activePool) {
    console.log('Could not connect to database on any default configuration.');
    process.exit(1);
  }

  try {
    const companies = await activePool.query('SELECT id, name FROM companies');
    console.log('\n--- Companies ---');
    console.table(companies.rows);

    const returns = await activePool.query('SELECT id, return_number, date, company_id FROM returns ORDER BY date DESC, id DESC LIMIT 10');
    console.log('\n--- Returns ---');
    console.table(returns.rows);

    const journalEntries = await activePool.query('SELECT id, entry_number, date, company_id FROM journal_entries WHERE date = \'2026-07-18\' ORDER BY entry_number DESC LIMIT 10');
    console.log('\n--- Journal Entries ---');
    console.table(journalEntries.rows);

  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await activePool.end();
  }
}

run();
