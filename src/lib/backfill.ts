import crypto from 'crypto';
import { generateNextSequence } from './erp-api';

export async function backfillMissingJournalEntries(pool: any) {

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

      for (const entry of legacyEntries.rows) {
        const nextNum = await generateNextSequence(client, entry.company_id, 'journal_entries', entry.date);
        await client.query(`
          UPDATE journal_entries 
          SET entry_number = $1 
          WHERE id = $2
        `, [nextNum, entry.id]);

      }
    }

    // 1. Find all purchase invoices that don't have journal entries
    const missingInvoicesRes = await client.query(`
      SELECT pi.* 
      FROM purchase_invoices pi
      LEFT JOIN journal_entries je ON je.reference_id = pi.id AND je.reference_type = 'purchase_invoice'
      WHERE je.id IS NULL
    `);

    for (const invoice of missingInvoicesRes.rows) {

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
      let supplierAccountId = supplier?.account_id || '';
      let supplierAccountName = supplier?.account_name || 'حساب الموردين';
 
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
          account_id: discountAccount?.id || '',
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
            debitAccountName = product?.inventory_account_name || product?.cost_account_name || 'حساب المشتريات/المخزون';
          } else {
            debitAccountId = product?.cost_account_id || '';
            debitAccountName = product?.cost_account_name || 'حساب المشتريات';
          }
        } else {
          const categoryAccount = accounts.find((a: any) => a.name.includes('مصروف') || a.name.toLowerCase().includes('expense'));
          debitAccountId = categoryAccount?.id || '';
          debitAccountName = categoryAccount?.name || 'حساب المصروف';
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
        let cashAccountId = pm?.account_id || '';
        let cashAccountName = pm?.account_name || 'حساب النقدية';
        
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

    }

    // 2. Find all sales invoices that don't have journal entries
    const missingSalesInvoicesRes = await client.query(`
      SELECT i.* 
      FROM invoices i
      LEFT JOIN journal_entries je ON je.reference_id = i.id AND je.reference_type = 'invoice'
      WHERE je.id IS NULL
    `);

    for (const invoice of missingSalesInvoicesRes.rows) {
      try {

        const invoiceId = invoice.id;
        const companyId = invoice.company_id;
        const invoiceNumber = invoice.invoice_number;
        const totalAmount = parseFloat(invoice.total_amount || '0');
        const discount = parseFloat(invoice.discount_amount || invoice.discount || '0');
        const paymentType = invoice.payment_type || 'credit';
        const paymentMethodId = invoice.payment_method_id;
        
        // Fetch customer
        const customerRes = await client.query('SELECT * FROM customers WHERE id = $1', [invoice.customer_id]);
        const customer = customerRes.rows[0];
        
        // Fetch invoice items
        const itemsRes = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
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
        
        // Determine Customer Account
        let customerAccountId = customer?.account_id || '';
        let customerAccountName = customer?.account_name || 'حساب العملاء';

        // Generate standard sequence journal entry number
        const entryNumber = await generateNextSequence(client, companyId, 'journal_entries', invoice.date);

        const journalItems: any[] = [];
        
        // 1. Customer Debit Line (Accounts Receivable)
        journalItems.push({
          id: crypto.randomUUID(),
          account_id: customerAccountId,
          account_name: customerAccountName,
          debit: totalAmount,
          credit: 0,
          description: `فاتورة مبيعات رقم ${invoiceNumber} - ${customer?.name || ''}`,
          customer_id: invoice.customer_id,
          customer_name: customer?.name,
          sub_account_id: invoice.customer_id,
          sub_account_type: 'customer'
        });

        // 2. Discount Line (if any)
        if (discount > 0) {
          const discountAccount = accounts.find((a: any) => 
            a.name.includes('خصم مسموح به') || a.name.includes('خصم مبيعات') ||
            a.name.toLowerCase().includes('discount allowed') || a.name.toLowerCase().includes('sales discount')
          );
          journalItems.push({
            id: crypto.randomUUID(),
            account_id: discountAccount?.id || '',
            account_name: discountAccount?.name || 'حساب الخصم المسموح به',
            debit: discount,
            credit: 0,
            description: `خصم فاتورة مبيعات رقم ${invoiceNumber}`
          });
        }

        // 3. Items Credit Lines (Sales Revenue)
        for (const item of items) {
          const product = products.find((p: any) => p.id === item.product_id);
          let creditAccountId = product?.revenue_account_id || '';
          let creditAccountName = product?.revenue_account_name || 'حساب المبيعات';

          journalItems.push({
            id: crypto.randomUUID(),
            account_id: creditAccountId,
            account_name: creditAccountName,
            debit: 0,
            credit: parseFloat(item.total || '0'),
            description: `مبيعات صنف: ${item.product_name || ''} - فاتورة ${invoiceNumber}`
          });
        }

        // 4. VAT Line (if any)
        const vatTotal = items.reduce((sum, item) => sum + parseFloat(item.vat_amount || '0'), 0);
        if (vatTotal > 0) {
          const vatAccount = accounts.find((a: any) => 
            a.name.includes('ضريبة القيمة المضافة') || a.name.includes('قيمة مضافة') || a.name.includes('ضريبة مبيعات') ||
            a.name.toLowerCase().includes('vat') || a.name.toLowerCase().includes('tax')
          );
          const vatAccountId = vatAccount?.id || '';
          const vatAccountName = vatAccount?.name || 'حساب ضريبة القيمة المضافة';
          
          journalItems.push({
            id: crypto.randomUUID(),
            account_id: vatAccountId,
            account_name: vatAccountName,
            debit: 0,
            credit: vatTotal,
            description: `ضريبة القيمة المضافة - فاتورة رقم ${invoiceNumber}`
          });
        }

        // 5. Cash Payment Lines (if cash sale)
        if (paymentType === 'cash') {
          const pm = paymentMethods.find((p: any) => p.id === paymentMethodId);
          let cashAccountId = pm?.account_id || '';
          let cashAccountName = pm?.account_name || 'حساب النقدية';
          
          // Debit Cash
          journalItems.push({
            id: crypto.randomUUID(),
            account_id: cashAccountId,
            account_name: cashAccountName,
            debit: totalAmount,
            credit: 0,
            description: `تحصيل فاتورة مبيعات رقم ${invoiceNumber} - ${customer?.name || ''}`,
            sub_account_id: paymentMethodId,
            sub_account_type: 'payment_method'
          });

          // Credit Customer
          journalItems.push({
            id: crypto.randomUUID(),
            account_id: customerAccountId,
            account_name: customerAccountName,
            debit: 0,
            credit: totalAmount,
            description: `سداد فاتورة مبيعات رقم ${invoiceNumber} - ${customer?.name || ''}`,
            customer_id: invoice.customer_id,
            customer_name: customer?.name,
            sub_account_id: invoice.customer_id,
            sub_account_type: 'customer'
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
            `قيد فاتورة مبيعات رقم: ${invoiceNumber}`,
            invoiceId,
            'invoice',
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
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, NULL, $11, $12, NOW())`,
            [
              line.id,
              companyId,
              entryId,
              line.account_id,
              line.account_name,
              line.debit,
              line.credit,
              line.description,
              line.customer_id || null,
              line.customer_name || null,
              line.sub_account_id || null,
              line.sub_account_type || null
            ]
          );
        }

        await client.query('COMMIT');

      } catch (invErr: any) {
        if (client) await client.query('ROLLBACK');
        console.error(`❌ [BACKFILL] Failed backfilling JE for Sales Invoice ${invoice.invoice_number}:`, invErr.message);
      }
    }

  } catch (err: any) {
    console.error("❌ [BACKFILL] Failed during backfilling missing journal entries:", err.message);
  } finally {
    client.release();
  }
}
