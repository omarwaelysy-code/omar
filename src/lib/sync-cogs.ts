import { v4 as uuidv4 } from 'uuid';
export async function syncCOGSForJournalEntry(client: any, companyId: string, journalEntryId: string, referenceId: string, referenceType: string) {
    if (!['invoice', 'return', 'sales_return'].includes(referenceType)) return;
    
    // 1. Fetch all items for this reference
    let itemsRes;
    if (referenceType === 'invoice') {
       itemsRes = await client.query('SELECT product_id, quantity, unit_cost as item_cost FROM invoice_items WHERE invoice_id = $1', [referenceId]);
    } else {
       itemsRes = await client.query('SELECT product_id, quantity, unit_cost as item_cost FROM return_items WHERE return_id = $1', [referenceId]);
    }

    if (itemsRes.rows.length === 0) return;

    // 2. Clear out any old COGS lines from the journal entry (to keep it idempotent)
    await client.query("DELETE FROM journal_entry_lines WHERE journal_entry_id = $1 AND (description LIKE '%تكلفة%' OR description LIKE '%تخفيض%' OR description LIKE '%إرجاع%' OR description LIKE '%محدث%')", [journalEntryId]);

    const isInvoice = referenceType === 'invoice';
    
    let addedCOGS = false;

    // 3. Loop through items and generate specific lines based strictly on PRODUCT ACCOUNTS
    for (const item of itemsRes.rows) {
        if (!item.product_id) continue;
        
        // Fetch explicit true total cost from inventory_movements for THIS exact product and reference
        const movesRes = await client.query("SELECT SUM(ABS(total_cost)) as true_cogs FROM inventory_movements WHERE reference_id = $1 AND product_id = $2 AND movement_type IN ('sale', 'sales_return')", [referenceId, item.product_id]);
        
        // Fetch product details
        const prodRes = await client.query('SELECT name, cost_account_id, cost_account_name, inventory_account_id, inventory_account_name, is_service, type, cost_price FROM products WHERE id = $1', [item.product_id]);
        if (prodRes.rows.length === 0) continue;
        
        const prod = prodRes.rows[0];
        if (prod.type === 'service' || prod.is_service) continue;

        let trueCost = parseFloat(movesRes.rows[0]?.true_cogs || '0');
        if (trueCost <= 0) {
            // Fall back to estimated cost using invoice item unit_cost if available
            trueCost = parseFloat(item.quantity || '0') * parseFloat(item.item_cost || '0');
        }
        if (trueCost <= 0) {
            // Fall back to estimated cost using product.cost_price
            trueCost = parseFloat(item.quantity || '0') * parseFloat(prod.cost_price || '0');
        }
        if (trueCost <= 0) continue;

        let costAccId = prod.cost_account_id;
        let costAccName = prod.cost_account_name;

        if (costAccId) {
            const accRes = await client.query('SELECT name FROM accounts WHERE id = $1', [costAccId]);
            if (accRes.rows.length > 0) {
                costAccName = accRes.rows[0].name || costAccName;
            }
        } else {
            const fallbackRes = await client.query(
                "SELECT id, name FROM accounts WHERE company_id = $1 AND (name LIKE '%تكلفة المبيعات%' OR name LIKE '%تكلفة مبيعات%' OR name LIKE '%تكلفة البضاعة المباعة%') LIMIT 1",
                [companyId]
            );
            if (fallbackRes.rows.length > 0) {
                costAccId = fallbackRes.rows[0].id;
                costAccName = fallbackRes.rows[0].name;
            }
        }

        let invAccId = prod.inventory_account_id;
        let invAccName = prod.inventory_account_name;

        if (invAccId) {
            const accRes = await client.query('SELECT name FROM accounts WHERE id = $1', [invAccId]);
            if (accRes.rows.length > 0) {
                invAccName = accRes.rows[0].name || invAccName;
            }
        } else {
            const fallbackRes = await client.query(
                "SELECT id, name FROM accounts WHERE company_id = $1 AND (name LIKE '%مخزون%' OR name LIKE '%مخازن%') LIMIT 1",
                [companyId]
            );
            if (fallbackRes.rows.length > 0) {
                invAccId = fallbackRes.rows[0].id;
                invAccName = fallbackRes.rows[0].name;
            }
        }

        if (costAccId && invAccId) {
           addedCOGS = true;

           await client.query(
              "INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, account_name, description, debit, credit, company_id, product_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
              uuidv4(), journalEntryId, costAccId, costAccName, 
              isInvoice ? 'تكلفة البضاعة المباعة - ' + prod.name : 'إلغاء تكلفة البضاعة المباعة - ' + prod.name,
              isInvoice ? trueCost : 0,
              isInvoice ? 0 : trueCost,
              companyId,
              prod.name
           ]);

           await client.query(
              "INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, account_name, description, debit, credit, company_id, product_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
              uuidv4(), journalEntryId, invAccId, invAccName, 
              isInvoice ? 'تخفيض المخزون - ' + prod.name : 'إرجاع المخزون - ' + prod.name,
              isInvoice ? 0 : trueCost,
              isInvoice ? trueCost : 0,
              companyId,
              prod.name
           ]);
        }
    }

    if (addedCOGS) {
       const updatedLines = await client.query('SELECT SUM(debit) as d, SUM(credit) as c FROM journal_entry_lines WHERE journal_entry_id = $1', [journalEntryId]);
       if (updatedLines.rows.length > 0) {
           await client.query('UPDATE journal_entries SET total_debit = $1, total_credit = $2 WHERE id = $3', 
             [parseFloat(updatedLines.rows[0].d || '0'), parseFloat(updatedLines.rows[0].c || '0'), journalEntryId]);
       }
    }
}
