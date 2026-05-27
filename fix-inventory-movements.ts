import pool from './src/lib/postgres';
import { recalculateProductStock, recordSale, recordPurchase, recordSalesReturn, recordPurchaseReturn } from './src/lib/cost-engine';

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Delete fully orphaned movements (where parent transaction doesn't exist at all)
    const tables = [
      { type: 'invoice', table: 'invoices' },
      { type: 'purchase_invoice', table: 'purchase_invoices' },
      { type: 'returns', table: 'returns' },
      { type: 'purchase_returns', table: 'purchase_returns' }
    ];
    for (const { type, table } of tables) {
      await client.query(`DELETE FROM inventory_movements WHERE reference_type = $1 AND reference_id NOT IN (SELECT id FROM "${table}")`, [type]);
      await client.query(`DELETE FROM journal_entries WHERE reference_id NOT IN (SELECT id FROM "${table}") AND description LIKE $2`, [`%${type}%`]);
    }

    // 2. We need to find references that have duplicates or quantity mismatches
    const itemTypes = [
       { type: 'invoice', itemTable: 'invoice_items', fkey: 'invoice_id', isNegative: true },
       { type: 'purchase_invoice', itemTable: 'purchase_invoice_items', fkey: 'invoice_id', isNegative: false },
       { type: 'returns', itemTable: 'return_items', fkey: 'return_id', isNegative: false }, 
       { type: 'purchase_returns', itemTable: 'purchase_return_items', fkey: 'return_id', isNegative: true }
    ];

    let badReferenceIds = new Set<string>();

    for (const { type, itemTable, fkey, isNegative } of itemTypes) {
      // Find movements where product is totally missing from items
      const missingProd = await client.query(`
         SELECT m.reference_id FROM inventory_movements m
         WHERE m.reference_type = $1
         AND NOT EXISTS (
            SELECT 1 FROM "${itemTable}" i 
            WHERE i."${fkey}" = m.reference_id 
            AND i.product_id = m.product_id
         )
      `, [type]);
      missingProd.rows.forEach(r => badReferenceIds.add(r.reference_id));

      // Find movements where quantity mismatches or there are multiple movements
      const mismatches = await client.query(`
         SELECT m.reference_id 
         FROM inventory_movements m
         JOIN "${itemTable}" i ON i."${fkey}" = m.reference_id AND i.product_id = m.product_id
         WHERE m.reference_type = $1 AND ABS(m.quantity) != i.quantity
      `, [type]);
      mismatches.rows.forEach(r => badReferenceIds.add(r.reference_id));

      // Find duplicates
      const duplicates = await client.query(`
         SELECT reference_id FROM inventory_movements
         WHERE reference_type = $1
         GROUP BY reference_id, product_id
         HAVING COUNT(*) > 1
      `, [type]);
      duplicates.rows.forEach(r => badReferenceIds.add(r.reference_id));
    }

    console.log(`Found ${badReferenceIds.size} bad references. Fixing...`);

    // For each bad reference, delete its movements and re-insert by calling the appropriate record function
    for (const refId of badReferenceIds) {
      const typeRes = await client.query(`SELECT reference_type FROM inventory_movements WHERE reference_id = $1 LIMIT 1`, [refId]);
      if (typeRes.rows.length === 0) continue;
      const refType = typeRes.rows[0].reference_type;
      
      const companyIdRes = await client.query(`SELECT company_id FROM inventory_movements WHERE reference_id = $1 LIMIT 1`, [refId]);
      const companyId = companyIdRes.rows[0].company_id;

      let parentTable = '';
      let itemTable = '';
      let fkey = '';

      if (refType === 'invoice') { parentTable = 'invoices'; itemTable = 'invoice_items'; fkey = 'invoice_id'; }
      if (refType === 'purchase_invoice') { parentTable = 'purchase_invoices'; itemTable = 'purchase_invoice_items'; fkey = 'invoice_id'; }
      if (refType === 'returns') { parentTable = 'returns'; itemTable = 'return_items'; fkey = 'return_id'; }
      if (refType === 'purchase_returns') { parentTable = 'purchase_returns'; itemTable = 'purchase_return_items'; fkey = 'return_id'; }

      // Get parent data
      const parentRes = await client.query(`SELECT * FROM "${parentTable}" WHERE id = $1`, [refId]);
      if (parentRes.rows.length === 0) {
         // Should have been caught by step 1, but just in case
         await client.query('DELETE FROM inventory_movements WHERE reference_id = $1', [refId]);
         continue;
      }
      const parentDoc = parentRes.rows[0];

      // Delete all old impacts
      await client.query('DELETE FROM inventory_movements WHERE reference_id = $1', [refId]);
      await client.query('DELETE FROM inventory_layers WHERE reference_id = $1', [refId]);
      
      // Get items
      const itemsRes = await client.query(`SELECT * FROM "${itemTable}" WHERE "${fkey}" = $1`, [refId]);

      for (const item of itemsRes.rows) {
          const qty = parseFloat(item.quantity || '0');
          if (qty <= 0) continue;

          if (refType === 'invoice') {
             await recordSale(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, refId, parentDoc.invoice_number, parentDoc.date);
          } else if (refType === 'purchase_invoice') {
             await recordPurchase(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.cost_price || '0'), refId, parentDoc.invoice_number, parentDoc.date);
          } else if (refType === 'returns') {
             await recordSalesReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, refId, parentDoc.return_number, parentDoc.date);
          } else if (refType === 'purchase_returns') {
             await recordPurchaseReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, refId, parentDoc.return_number, parentDoc.date);
          }
      }
    }

    // Now recalculate stock for ALL products to ensure WAC is correct everywhere
    console.log('Recalculating WAC for all products...');
    const allProducts = await client.query(`SELECT id, company_id FROM products WHERE COALESCE(is_service, false) = false AND type != 'service'`);
    for (const p of allProducts.rows) {
        await recalculateProductStock(client, p.company_id, p.id);
    }

    await client.query('COMMIT');
    console.log('Done fixing inventory!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
fix();
