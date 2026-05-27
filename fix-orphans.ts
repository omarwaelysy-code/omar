import pool from './src/lib/postgres';
import { recalculateProductStock, recordSale, recordPurchase, recordSalesReturn, recordPurchaseReturn } from './src/lib/cost-engine';

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Delete fully orphaned movements
    const tables = [
      { type: 'invoice', table: 'invoices' },
      { type: 'purchase_invoice', table: 'purchase_invoices' },
      { type: 'returns', table: 'returns' },
      { type: 'purchase_returns', table: 'purchase_returns' }
    ];
    for (const { type, table } of tables) {
      const res = await client.query(`DELETE FROM inventory_movements WHERE reference_type = $1 AND reference_id NOT IN (SELECT id FROM "${table}")`, [type]);
      console.log(`Deleted ${res.rowCount} orphaned movements for ${type}`);
    }

    // 2. Find mismatches
    const itemTypes = [
       { type: 'invoice', itemTable: 'invoice_items', fkey: 'invoice_id' },
       { type: 'purchase_invoice', itemTable: 'purchase_invoice_items', fkey: 'invoice_id' },
       { type: 'returns', itemTable: 'return_items', fkey: 'return_id' }, 
       { type: 'purchase_returns', itemTable: 'purchase_return_items', fkey: 'return_id' }
    ];

    let badReferenceIds = new Set<string>();

    for (const { type, itemTable, fkey } of itemTypes) {
      // Missing product in items
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

      // Mismatched quantity
      const mismatches = await client.query(`
         SELECT m.reference_id 
         FROM inventory_movements m
         JOIN "${itemTable}" i ON i."${fkey}" = m.reference_id AND i.product_id = m.product_id
         WHERE m.reference_type = $1 AND ABS(m.quantity) != i.quantity
      `, [type]);
      mismatches.rows.forEach(r => badReferenceIds.add(r.reference_id));

      // Duplicate products for same reference
      const duplicates = await client.query(`
         SELECT reference_id FROM inventory_movements
         WHERE reference_type = $1
         GROUP BY reference_id, product_id
         HAVING COUNT(*) > 1
      `, [type]);
      duplicates.rows.forEach(r => badReferenceIds.add(r.reference_id));
    }

    console.log(`Found ${badReferenceIds.size} bad references. Fixing...`);

    for (const refId of badReferenceIds) {
      const typeRes = await client.query(`SELECT reference_type, company_id FROM inventory_movements WHERE reference_id = $1 LIMIT 1`, [refId]);
      if (typeRes.rows.length === 0) continue;
      const refType = typeRes.rows[0].reference_type;
      const companyId = typeRes.rows[0].company_id;

      let parentTable = '';
      let itemTable = '';
      let fkey = '';

      if (refType === 'invoice') { parentTable = 'invoices'; itemTable = 'invoice_items'; fkey = 'invoice_id'; }
      if (refType === 'purchase_invoice') { parentTable = 'purchase_invoices'; itemTable = 'purchase_invoice_items'; fkey = 'invoice_id'; }
      if (refType === 'returns') { parentTable = 'returns'; itemTable = 'return_items'; fkey = 'return_id'; }
      if (refType === 'purchase_returns') { parentTable = 'purchase_returns'; itemTable = 'purchase_return_items'; fkey = 'return_id'; }

      const parentRes = await client.query(`SELECT * FROM "${parentTable}" WHERE id = $1`, [refId]);
      if (parentRes.rows.length === 0) {
         await client.query('DELETE FROM inventory_movements WHERE reference_id = $1', [refId]);
         continue;
      }
      const parentDoc = parentRes.rows[0];

      await client.query('DELETE FROM inventory_movements WHERE reference_id = $1', [refId]);
      await client.query('DELETE FROM inventory_layers WHERE reference_id = $1', [refId]);
      
      const itemsRes = await client.query(`SELECT * FROM "${itemTable}" WHERE "${fkey}" = $1`, [refId]);

      for (const item of itemsRes.rows) {
          const qty = parseFloat(item.quantity || '0');
          if (qty <= 0) continue;

          if (refType === 'invoice') {
             await recordSale(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, refId, parentDoc.invoice_number, parentDoc.date);
          } else if (refType === 'purchase_invoice') {
             await recordPurchase(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.cost_price || '0'), refId, parentDoc.invoice_number, parentDoc.date);
          } else if (refType === 'returns') {
             await recordSalesReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.unit_cost || item.cost_price || '0'), refId, parentDoc.return_number, parentDoc.date);
          } else if (refType === 'purchase_returns') {
             await recordPurchaseReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.unit_cost || item.cost_price || '0'), refId, parentDoc.return_number, parentDoc.date);
          }
      }
    }

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
