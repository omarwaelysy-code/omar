const fs = require('fs');

let content = fs.readFileSync('src/lib/erp-api.ts', 'utf8');

const putPurchaseInvoicesRegex = /await client\.query\('DELETE FROM purchase_invoice_items WHERE invoice_id = \$1', \[invoiceId\]\);[\s\S]*?for \(const item of \(items \|\| \[\]\)\) \{[\s\S]*?await client\.query\(\s*`INSERT INTO purchase_invoice_items \(\$\{itemKeys\.join\(\', \'\)\}\) VALUES \(\$\{itemPlaceholders\}\)`,\s*Object\.values\(finalItemData\)\s*\);\s*\}/;

const invoiceItemsReplacement = `await client.query('DELETE FROM purchase_invoice_items WHERE invoice_id = $1', [invoiceId]);
    
    await reverseAndRecalculate(client, companyId || '', invoiceId);

    for (const item of (items || [])) {
      const { id: itemIdTrash, ...itemDataRaw } = item;
      const itemData = sanitizeData('purchase_invoice_items', itemDataRaw);
      const itemId = uuidv4();
      const finalItemData = { ...itemData, id: itemId, invoice_id: invoiceId };
      if (companyId) finalItemData.company_id = companyId;

      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
           const quantity = parseFloat(item.quantity || '0');
           if (quantity > 0) {
             const costInfo = await recordPurchase(
               client, companyId || '', invoiceData.warehouse_id || null,
               item.product_id, quantity, parseFloat(item.unit_price || item.cost_price || '0'), invoiceId,
               invoiceData.invoice_number, invoiceData.date
             );
             
             let invAccId = prod.inventory_account_id;
             if (!invAccId) {
                const defaultAsset = await client.query('SELECT id FROM accounts WHERE type = $1 AND company_id = $2 LIMIT 1', ['asset', companyId]);
                if (defaultAsset.rows[0]) invAccId = defaultAsset.rows[0].id;
             }
             if (invAccId && costInfo.totalCost > 0) {
                 const jeId = uuidv4();
                 await client.query(\`INSERT INTO journal_entries (id, company_id, date, description, reference_id) VALUES ($1, $2, $3, $4, $5)\`,
                   [jeId, companyId, invoiceData.date, \`إضافة مخزون - فاتورة شراء رقم \${invoiceData.invoice_number}\`, invoiceId]);
                 await client.query(\`INSERT INTO journal_entry_lines (id, entry_id, account_id, debit, credit) VALUES ($1, $2, $3, $4, $5)\`, [uuidv4(), jeId, invAccId, costInfo.totalCost, 0]);
                 const currLia = await client.query('SELECT id FROM accounts WHERE code LIKE $1 AND company_id = $2 LIMIT 1', ['2%', companyId]);
                 if(currLia.rows[0]) {
                   await client.query(\`INSERT INTO journal_entry_lines (id, entry_id, account_id, debit, credit) VALUES ($1, $2, $3, $4, $5)\`, [uuidv4(), jeId, currLia.rows[0].id, 0, costInfo.totalCost]);
                 }
             }
           }
        }
      }

      const itemKeys = Object.keys(finalItemData);
      const itemPlaceholders = itemKeys.map((_, i) => \`$\${i + 1}\`).join(', ');
      await client.query(
        \`INSERT INTO purchase_invoice_items (\${itemKeys.join(', ')}) VALUES (\${itemPlaceholders})\`,
        Object.values(finalItemData)
      );
    }`;

content = content.replace(putPurchaseInvoicesRegex, invoiceItemsReplacement);
fs.writeFileSync('src/lib/erp-api.ts', content);
console.log('Fixed PUT /purchase_invoices/:id');
