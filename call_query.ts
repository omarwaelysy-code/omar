import http from 'http';

function runQuery(sql: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(sql);
    const url = `http://127.0.0.1:3000/api/erp/debug/run-query?q=${encoded}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Status ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log("=== 1. PAYMENT METHODS ===");
    const pms = await runQuery('SELECT id, code, name, account_id, type FROM payment_methods');
    console.log(JSON.stringify(pms, null, 2));

    console.log("\n=== 2. DEBITS BY REFERENCE TYPE AND ACCOUNT ===");
    const debits = await runQuery(`
      SELECT 
        pm.name AS payment_method_name,
        je.reference_type,
        COUNT(*) AS tx_count,
        SUM(jel.debit) AS total_debit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.journal_entry_id = je.id
      JOIN payment_methods pm ON jel.account_id = pm.account_id
      WHERE jel.debit > 0
      GROUP BY pm.name, je.reference_type
      ORDER BY pm.name, je.reference_type
    `);
    console.log(JSON.stringify(debits, null, 2));

    console.log("\n=== 3. DEBITS WITH SUB_ACCOUNT_ID ===");
    const subDebits = await runQuery(`
      SELECT 
        pm.name AS payment_method_name,
        je.reference_type,
        COUNT(*) AS tx_count,
        SUM(jel.debit) AS total_debit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.journal_entry_id = je.id
      JOIN payment_methods pm ON jel.sub_account_id = pm.id AND jel.sub_account_type = 'payment_method'
      WHERE jel.debit > 0
      GROUP BY pm.name, je.reference_type
      ORDER BY pm.name, je.reference_type
    `);
    console.log(JSON.stringify(subDebits, null, 2));

  } catch (err: any) {
    console.error("Failed to fetch query results:", err.message);
  }
}

main();
