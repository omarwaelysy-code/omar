
export async function syncCOGSForJournalEntry(client: any, companyId: string, journalEntryId: string, referenceId: string, referenceType: string) {
    if (!['invoice', 'sales_return'].includes(referenceType)) return;
    
    const allMovesCogsRes = await client.query(`
      SELECT SUM(ABS(total_cost)) as full_cogs
      FROM inventory_movements
      WHERE movement_type IN ('sale', 'sales_return') AND reference_id = $1
    `, [referenceId]);
    
    let trueTotalCogs = parseFloat(allMovesCogsRes.rows[0]?.full_cogs || '0');
    if (trueTotalCogs === 0) return;

    const linesRes = await client.query(`SELECT * FROM journal_entry_lines WHERE journal_entry_id = $1`, [journalEntryId]);
    
    let costAccId = null;
    let costAccName = null;
    let invAccId = null;
    let invAccName = null;

    for (const line of linesRes.rows) {
       if (line.description.includes('تكلفة') && !costAccId) {
           costAccId = line.account_id;
           costAccName = line.account_name;
       }
       if ((line.description.includes('تخفيض') || line.description.includes('إرجاع') || line.description.includes('مخزون')) && !invAccId && !line.description.includes('تكلفة')) {
           invAccId = line.account_id;
           invAccName = line.account_name;
       }
    }

    if (!costAccId || !invAccId) {
       const accountsRes = await client.query('SELECT * FROM accounts WHERE company_id = $1', [companyId]);
       const accounts = accountsRes.rows;
       if (!costAccId) {
         const fallbackCostAcc = accounts.find((a: any) => a.name.includes('تكلفة المبيعات') || a.name.includes('تكلفة مبيعات') || a.name.includes('تكلفة البضاعة المباعة'));
         if (fallbackCostAcc) {
           costAccId = fallbackCostAcc.id;
           costAccName = fallbackCostAcc.name;
         }
       }
       if (!invAccId) {
         const fallbackInvAcc = accounts.find((a: any) => a.name.includes('مخزون') || a.name.includes('مخازن'));
         if (fallbackInvAcc) {
           invAccId = fallbackInvAcc.id;
           invAccName = fallbackInvAcc.name;
         }
       }
    }

    if (costAccId && invAccId) {
       await client.query(`DELETE FROM journal_entry_lines WHERE journal_entry_id = $1 AND (description LIKE '%تكلفة%' OR description LIKE '%تخفيض%' OR description LIKE '%إرجاع%')`, [journalEntryId]);

       const isInvoice = referenceType === 'invoice';
       const uuidv4 = require('uuid').v4;

       await client.query(`
          INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, account_name, description, debit, credit)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
       `, [
          uuidv4(), journalEntryId, costAccId, costAccName, 
          isInvoice ? 'تكلفة البضاعة المباعة (محدث التكلفة التلقائي)' : 'إلغاء تكلفة البضاعة المباعة (محدث التكلفة التلقائي)',
          isInvoice ? trueTotalCogs : 0,
          isInvoice ? 0 : trueTotalCogs
       ]);

       await client.query(`
          INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, account_name, description, debit, credit)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
       `, [
          uuidv4(), journalEntryId, invAccId, invAccName, 
          isInvoice ? 'تخفيض المخزون (محدث التكلفة التلقائي)' : 'إرجاع المخزون (محدث التكلفة التلقائي)',
          isInvoice ? 0 : trueTotalCogs,
          isInvoice ? trueTotalCogs : 0
       ]);
       
       const updatedLines = await client.query(`SELECT SUM(debit) as d, SUM(credit) as c FROM journal_entry_lines WHERE journal_entry_id = $1`, [journalEntryId]);
       if (updatedLines.rows.length > 0) {
           await client.query('UPDATE journal_entries SET total_debit = $1, total_credit = $2 WHERE id = $3', 
             [updatedLines.rows[0].d, updatedLines.rows[0].c, journalEntryId]);
       }
    }
}
