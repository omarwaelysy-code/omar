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
    const invoices = await activePool.query('SELECT id, invoice_number, customer_id, payment_type, total_amount, date FROM invoices LIMIT 5');
    console.log('\n--- Invoices ---');
    console.table(invoices.rows);

    const customers = await activePool.query('SELECT id, name, account_id, opening_balance FROM customers LIMIT 5');
    console.log('\n--- Customers ---');
    console.table(customers.rows);

  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await activePool.end();
  }
}

run();
