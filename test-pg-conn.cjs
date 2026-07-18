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
  const configs = [
    { host: 'localhost', port: 5432, user: 'postgres', password: 'erp_password', database: 'cloud_erp_system' },
    { host: 'localhost', port: 5432, user: 'postgres', password: '', database: 'cloud_erp_system' },
    { host: '127.0.0.1', port: 5432, user: 'postgres', password: 'erp_password', database: 'cloud_erp_system' },
    { host: '127.0.0.1', port: 5432, user: 'postgres', password: '', database: 'cloud_erp_system' }
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
