import { v4 as uuidv4 } from 'uuid';
export async function syncCOGSForJournalEntry(client: any, companyId: string, journalEntryId: string, referenceId: string, referenceType: string) {
    if (!['invoice', 'sales_return'].includes(referenceType)) return;
    
    // 1. Fetch all items for this reference
    let itemsRes;
    if (referenceType === 'invoice') {
       itemsRes = await client.query('SELECT product_id, quantity, unit_cost as item_cost FROM invoice_items WHERE invoice_id = $1', [referenceId]);
    } else {
       itemsRes = await client.query('SELECT product_id, quantity, unit_cost as item_cost FROM return_items WHERE return_id = $1', [referenceId]);
    }

    if (itemsRes.rows.length === 0) return;

    // 2. Clear out any old COGS lines from the journal entry (to keep it idempotent)
    await client.query("DELETE FROM journal_entry_lines WHERE journal_entry_id = $1 AND (description LIKE '%تكلفة البضاعة%' OR description LIKE '%تخفيض المخزون%' OR description LIKE '%إرجاع المخزون%')", [journalEntryId]);

    const isInvoice = referenceType === 'invoice';
    
    let addedCOGS = false;

    // 3. Loop through items and generate specific lines based strictly on PRODUCT ACCOUNTS
    for (const item of itemsRes.rows) {
        if (!item.product_id) continue;
        
        // Fetch explicit true total cost from inventory_movements for THIS exact product and reference
        const movesRes = await client.query("SELECT SUM(ABS(total_cost)) as true_cogs FROM inventory_movements WHERE reference_id = $1 AND product_id = $2 AND movement_type IN ('sale', 'sales_return')", [referenceId, item.product_id]);
        
        const trueCost = parseFloat(movesRes.rows[0]?.true_cogs || '0');
        if (trueCost <= 0) continue;

        // Fetch product accounts
        const prodRes = await client.query('SELECT name, cost_account_id, cost_account_name, inventory_account_id, inventory_account_name, is_service, type FROM products WHERE id = $1', [item.product_id]);
        if (prodRes.rows.length === 0) continue;
        
        const prod = prodRes.rows[0];
        if (prod.type === 'service' || prod.is_service) continue;

        const costAccId = prod.cost_account_id;
        const costAccName = prod.cost_account_name;
        const invAccId = prod.inventory_account_id;
        const invAccName = prod.inventory_account_name;

        if (costAccId && invAccId) {
           addedCOGS = true;

           await client.query(
              "INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, account_name, description, debit, credit, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [
              uuidv4(), journalEntryId, costAccId, costAccName, 
              isInvoice ? 'تكلفة البضاعة المباعة - ' + prod.name : 'إلغاء تكلفة البضاعة المباعة - ' + prod.name,
              isInvoice ? trueCost : 0,
              isInvoice ? 0 : trueCost,
              companyId
           ]);

           await client.query(
              "INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, account_name, description, debit, credit, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [
              uuidv4(), journalEntryId, invAccId, invAccName, 
              isInvoice ? 'تخفيض المخزون - ' + prod.name : 'إرجاع المخزون - ' + prod.name,
              isInvoice ? 0 : trueCost,
              isInvoice ? trueCost : 0,
              companyId
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
