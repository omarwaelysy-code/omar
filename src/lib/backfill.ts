import crypto from 'crypto';
import { generateNextSequence } from './erp-api';

export async function backfillMissingJournalEntries(pool: any) {
  console.log("🔄 [BACKFILL] STARTING BACKFILL OF MISSING JOURNAL ENTRIES...");
  const client = await pool.connect();
  try {
    // 0. Rename any legacy JE-BF- journal entries to match the standard format
    const legacyEntries = await client.query(`
      SELECT id, company_id, date, entry_number 
      FROM journal_entries 
      WHERE entry_number LIKE 'JE-BF-%'
      ORDER BY date ASC, entry_number ASC
    `);
    
    if (legacyEntries.rows.length > 0) {
      console.log(`🔄 [BACKFILL] Found ${legacyEntries.rows.length} legacy JE-BF- entries. Renaming to standard sequence...`);
      for (const entry of legacyEntries.rows) {
        const nextNum = await generateNextSequence(client, entry.company_id, 'journal_entries', entry.date);
        await client.query(`
          UPDATE journal_entries 
          SET entry_number = $1 
          WHERE id = $2
        `, [nextNum, entry.id]);
        console.log(`   [BACKFILL] Renamed legacy entry: ${entry.entry_number} -> ${nextNum}`);
      }
    }

    // 1. Find all purchase invoices that don't have journal entries
    const missingInvoicesRes = await client.query(`
      SELECT pi.* 
      FROM purchase_invoices pi
      LEFT JOIN journal_entries je ON je.reference_id = pi.id AND je.reference_type = 'purchase_invoice'
      WHERE je.id IS NULL
    `);
    
    console.log(`🔎 [BACKFILL] Found ${missingInvoicesRes.rows.length} purchase invoices missing journal entries.`);
    
    for (const invoice of missingInvoicesRes.rows) {
      console.log(`⚙️ [BACKFILL] Backfilling JE for Purchase Invoice ${invoice.invoice_number} (ID: ${invoice.id})...`);
      
      const invoiceId = invoice.id;
      const companyId = invoice.company_id;
      const invoiceNumber = invoice.invoice_number;
      const totalAmount = parseFloat(invoice.total_amount || '0');
      const discount = parseFloat(invoice.discount || '0');
      
      // Fetch supplier
      const supplierRes = await client.query('SELECT * FROM suppliers WHERE id = $1', [invoice.supplier_id]);
      const supplier = supplierRes.rows[0];
      
      // Fetch invoice items
      const itemsRes = await client.query('SELECT * FROM purchase_invoice_items WHERE invoice_id = $1', [invoiceId]);
      const items = itemsRes.rows;
      
      // Fetch accounts
      const accountsRes = await client.query('SELECT * FROM accounts WHERE company_id = $1', [companyId]);
      const accounts = accountsRes.rows;
      
      // Fetch products
      const productsRes = await client.query('SELECT * FROM products WHERE company_id = $1', [companyId]);
      const products = productsRes.rows;
      
      // Fetch payment methods
      const pmRes = await client.query('SELECT * FROM payment_methods WHERE company_id = $1', [companyId]);
      const paymentMethods = pmRes.rows;

      await client.query('BEGIN');
      
      // Determine Supplier Account
      let supplierAccountId = supplier?.account_id;
      let supplierAccountName = supplier?.account_name;
      if (!supplierAccountId) {
        const fallback = accounts.find((a: any) => a.name.includes('موردين') || a.name.toLowerCase().includes('supplier'));
        supplierAccountId = fallback?.id || 'suppliers_account_default';
        supplierAccountName = fallback?.name || 'حساب الموردين';
      }
 
      // Generate standard sequence journal entry number
      const entryNumber = await generateNextSequence(client, companyId, 'journal_entries', invoice.date);

      const journalItems: any[] = [];
      
      // 1. Supplier Credit Line (Accounts Payable)
      journalItems.push({
        id: crypto.randomUUID(),
        account_id: supplierAccountId,
        account_name: supplierAccountName,
        debit: 0,
        credit: totalAmount,
        description: `فاتورة مشتريات رقم ${invoiceNumber} - ${supplier?.name || ''}`,
        supplier_id: invoice.supplier_id,
        supplier_name: supplier?.name,
        sub_account_id: invoice.supplier_id,
        sub_account_type: 'supplier'
      });

      // 2. Discount Line (if any)
      if (discount > 0) {
        const discountAccount = accounts.find((a: any) => 
          a.name.includes('خصم مكتسب') || a.name.includes('خصم مشتريات') ||
          a.name.toLowerCase().includes('discount earned') || a.name.toLowerCase().includes('purchase discount')
        );
        journalItems.push({
          id: crypto.randomUUID(),
          account_id: discountAccount?.id || 'purchase_discount_default',
          account_name: discountAccount?.name || 'حساب الخصم المكتسب',
          debit: 0,
          credit: discount,
          description: `خصم فاتورة مشتريات رقم ${invoiceNumber}`
        });
      }

      // 3. Items Debit Lines
      for (const item of items) {
        let debitAccountId = '';
        let debitAccountName = '';
        
        if (invoice.purchase_type === 'items') {
          const product = products.find((p: any) => p.id === item.product_id);
          if (product?.type !== 'service' && !product?.is_service) {
            debitAccountId = product?.inventory_account_id || product?.cost_account_id || '';
            debitAccountName = product?.inventory_account_name || product?.cost_account_name || '';
          } else {
            debitAccountId = product?.cost_account_id || '';
            debitAccountName = product?.cost_account_name || '';
          }
          if (!debitAccountId) {
            const fallback = accounts.find((a: any) => a.name.includes('مخزون') || a.name.includes('مشتريات') || a.name.includes('تكلفة') || a.name.toLowerCase().includes('inventory') || a.name.toLowerCase().includes('purchase'));
            debitAccountId = fallback?.id || 'purchase_account_default';
            debitAccountName = fallback?.name || 'حساب المشتريات';
          }
        } else {
          const fallback = accounts.find((a: any) => a.name.includes('مصروفات') || a.name.toLowerCase().includes('expense'));
          debitAccountId = fallback?.id || 'expense_account_default';
          debitAccountName = fallback?.name || 'حساب المصروفات';
        }

        journalItems.push({
          id: crypto.randomUUID(),
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: parseFloat(item.total || '0'),
          credit: 0,
          description: `مشتريات: ${item.product_name || item.category_name || ''} - فاتورة ${invoiceNumber}`
        });
      }

      // 4. Cash Payment Lines (if cash purchase)
      if (invoice.payment_type === 'cash') {
        const pm = paymentMethods.find((p: any) => p.id === invoice.payment_method_id);
        let cashAccountId = pm?.account_id;
        let cashAccountName = pm?.account_name;
        if (!cashAccountId) {
          const fallback = accounts.find((a: any) => 
            a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق') ||
            a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('safe') || a.name.toLowerCase().includes('fund')
          );
          cashAccountId = fallback?.id || 'cash_account_default';
          cashAccountName = fallback?.name || 'حساب النقدية';
        }
        
        // Credit Cash
        journalItems.push({
          id: crypto.randomUUID(),
          account_id: cashAccountId,
          account_name: cashAccountName,
          debit: 0,
          credit: totalAmount,
          description: `سداد نقدي فاتورة مشتريات رقم ${invoiceNumber} - ${supplier?.name || ''}`,
          sub_account_id: invoice.payment_method_id,
          sub_account_type: 'payment_method'
        });

        // Debit Supplier
        journalItems.push({
          id: crypto.randomUUID(),
          account_id: supplierAccountId,
          account_name: supplierAccountName,
          debit: totalAmount,
          credit: 0,
          description: `تسوية فاتورة مشتريات رقم ${invoiceNumber} - ${supplier?.name || ''}`,
          supplier_id: invoice.supplier_id,
          supplier_name: supplier?.name,
          sub_account_id: invoice.supplier_id,
          sub_account_type: 'supplier'
        });
      }

      const totalDebit = journalItems.reduce((sum, item) => sum + item.debit, 0);
      const totalCredit = journalItems.reduce((sum, item) => sum + item.credit, 0);
      
      const entryId = crypto.randomUUID();
      
      // Insert Journal Entry
      await client.query(
        `INSERT INTO "journal_entries" (id, company_id, entry_number, date, description, reference_id, reference_type, reference_number, total_debit, total_credit, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'system')`,
        [
          entryId,
          companyId,
          entryNumber,
          invoice.date,
          `قيد فاتورة مشتريات رقم: ${invoiceNumber}`,
          invoiceId,
          'purchase_invoice',
          invoiceNumber,
          totalDebit,
          totalCredit
        ]
      );

      // Insert Journal Entry Lines
      for (const line of journalItems) {
        await client.query(
          `INSERT INTO "journal_entry_lines" 
            (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, customer_id, supplier_id, customer_name, supplier_name, sub_account_id, sub_account_type, created_at)
           VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, NULL, $10, $11, $12, NOW())`,
          [
            line.id,
            companyId,
            entryId,
            line.account_id,
            line.account_name,
            line.debit,
            line.credit,
            line.description,
            line.supplier_id || null,
            line.supplier_name || null,
            line.sub_account_id || null,
            line.sub_account_type || null
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`✅ [BACKFILL] Backfilled JE for Purchase Invoice ${invoiceNumber} successfully.`);
    }
  } catch (err: any) {
    if (client) await client.query('ROLLBACK');
    console.error("❌ [BACKFILL] Failed during backfilling missing journal entries:", err.message);
  } finally {
    client.release();
  }
}
