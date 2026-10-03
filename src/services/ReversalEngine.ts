import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { InventoryMovementService } from './InventoryMovementService.js';

export interface ReversalRequest {
  companyId: string;
  userId: string;
  userName?: string;
  moduleName: string;
  docId: string;
  reversalDate: string;
  reason: string;
}

export interface ReversalResult {
  success: boolean;
  message: string;
  originalDocNumber: string;
  reversalDocId: string;
  reversalDocNumber: string;
  originalEntryNumber?: string;
  reversalEntryNumber?: string;
  reversalSettlementNumber?: string;
}

export class ReversalEngine {
  /**
   * Reverses a financial or operational document across any of the 9 supported modules.
   */
  static async reverseDocument(client: PoolClient | Pool, req: ReversalRequest): Promise<ReversalResult> {
    const { companyId, userId, userName, moduleName, docId, reversalDate, reason } = req;

    if (!docId) throw new Error('معرف المستند مطلوب');
    if (!reversalDate) throw new Error('تاريخ العكس مطلوب');

    // 1. Identify module configuration
    const config = this.getModuleConfig(moduleName);
    if (!config) {
      throw new Error(`نوع الحركة "${moduleName}" غير مدعوم في نظام العكس.`);
    }

    // 2. Fetch original document
    const { rows: docs } = await client.query(
      `SELECT * FROM "${config.tableName}" WHERE "id" = $1 AND "company_id" = $2`,
      [docId, companyId]
    );

    if (docs.length === 0) {
      throw new Error('المستند المطلوب غير موجود أو لا ينتمي لهذه الشركة.');
    }

    const originalDoc = docs[0];

    if (originalDoc.is_reversed) {
      throw new Error(`هذا المستند تم عكسه بالفعل مسبقاً بموجب المستند رقم (${originalDoc.reversed_by_doc_number || ''})`);
    }

    if (originalDoc.is_reversal_doc) {
      throw new Error('لا يمكن عكس مستند عكسي.');
    }

    const originalDocNumber = String(originalDoc[config.numberColumn] || originalDoc.id.slice(0, 8));
    const reversalDocId = uuidv4();
    const reversalDocNumber = `REV-${originalDocNumber}`;

    // 3. Find and Reverse Related Journal Entry
    let originalEntryNumber: string | undefined;
    let reversalEntryNumber: string | undefined;
    let reversalEntryId: string | undefined;

    // Search for original journal entry
    const { rows: jes } = await client.query(
      `SELECT * FROM "journal_entries" 
       WHERE "company_id" = $1 AND ("reference_id" = $2 OR "reference_number" = $3)
       ORDER BY "created_at" DESC LIMIT 1`,
      [companyId, docId, originalDocNumber]
    );

    if (jes.length > 0) {
      const origJE = jes[0];
      originalEntryNumber = origJE.entry_number || origJE.id.slice(0, 8);
      reversalEntryId = uuidv4();
      reversalEntryNumber = `REV-${originalEntryNumber}`;

      // Fetch original journal lines
      const { rows: origLines } = await client.query(
        `SELECT * FROM "journal_entry_lines" WHERE "journal_entry_id" = $1`,
        [origJE.id]
      );

      // Create reversing journal entry (swap debit and credit)
      const reversalDescription = `قيد عكسي للقيد رقم (${originalEntryNumber}) للمستند (${originalDocNumber})${reason ? ' - سبب العكس: ' + reason : ''}`;

      await client.query(
        `INSERT INTO "journal_entries" (
          "id", "company_id", "entry_number", "date", "reference_id", "reference_number",
          "reference_type", "description", "total_debit", "total_credit", "status",
          "is_reversal_entry", "original_entry_id", "original_entry_number", "reversal_reason",
          "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted',
          TRUE, $11, $12, $13, NOW(), NOW()
        )`,
        [
          reversalEntryId,
          companyId,
          reversalEntryNumber,
          reversalDate,
          reversalDocId,
          reversalDocNumber,
          origJE.reference_type || config.defaultRefType,
          reversalDescription,
          origJE.total_credit || 0, // Swapped
          origJE.total_debit || 0,  // Swapped
          origJE.id,
          originalEntryNumber,
          reason || ''
        ]
      );

      // Insert swapped journal entry lines
      for (const line of origLines) {
        const lineId = uuidv4();
        await client.query(
          `INSERT INTO "journal_entry_lines" (
            "id", "journal_entry_id", "account_id", "account_name", "description",
            "debit", "credit", "customer_id", "customer_name", "supplier_id", "supplier_name",
            "sub_account_id", "sub_account_type", "company_id", "product_name",
            "operation_id", "department_id", "cost_center_id", "currency", "exchange_rate", "foreign_amount",
            "created_at"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW()
          )`,
          [
            lineId,
            reversalEntryId,
            line.account_id,
            line.account_name,
            `عكس: ${line.description || ''}`,
            line.credit || 0, // Swapped
            line.debit || 0,  // Swapped
            line.customer_id,
            line.customer_name,
            line.supplier_id,
            line.supplier_name,
            line.sub_account_id,
            line.sub_account_type,
            companyId,
            line.product_name,
            line.operation_id,
            line.department_id,
            line.cost_center_id,
            line.currency,
            line.exchange_rate,
            line.foreign_amount
          ]
        );
      }

      // Mark original journal entry as reversed
      await client.query(
        `UPDATE "journal_entries" 
         SET "is_reversed" = TRUE, 
             "reversed_at" = NOW(), 
             "reversal_reason" = $1, 
             "reversed_by_entry_id" = $2, 
             "reversed_by_entry_number" = $3,
             "updated_at" = NOW()
         WHERE "id" = $4`,
        [reason || '', reversalEntryId, reversalEntryNumber, origJE.id]
      );
    }

    // 4. Reverse Inventory Movements if applicable
    if (config.inventoryDocType) {
      try {
        await InventoryMovementService.reverseMovement(config.inventoryDocType, docId, client);
      } catch (err: any) {
        console.warn(`[ReversalEngine] Inventory movement reversal warning:`, err.message);
      }
    }

    // 5. Generate Reversal Settlement for Customers or Suppliers
    let reversalSettlementNumber: string | undefined;
    if (config.hasSettlement) {
      const parts = reversalDate.slice(0, 10).split('-');
      const year = parts[0];
      const month = (parts[1] || '01').padStart(2, '0');
      const setPrefix = `SET-REV-${year}-${month}`;
      
      const { rows: setRows } = await client.query(
        `SELECT "reversal_settlement_number" FROM "${config.tableName}" 
         WHERE "company_id" = $1 AND "reversal_settlement_number" LIKE $2 
         ORDER BY length("reversal_settlement_number") DESC, "reversal_settlement_number" DESC LIMIT 1`,
        [companyId, `${setPrefix}-%`]
      );

      let nextSeq = 1;
      if (setRows.length > 0 && setRows[0].reversal_settlement_number) {
        const parts = setRows[0].reversal_settlement_number.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num)) nextSeq = num + 1;
      }
      reversalSettlementNumber = `${setPrefix}-${String(nextSeq).padStart(6, '0')}`;

      // Update settlements array on original doc to close its open amount if settlements column exists
      const { rows: origTableCols } = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [config.tableName]
      );
      const origValidCols = new Set(origTableCols.map((r: any) => r.column_name));

      if (origValidCols.has('settlements')) {
        const amount = Number(originalDoc.total_amount || originalDoc.amount || 0);
        const originalSettlements = Array.isArray(originalDoc.settlements) ? [...originalDoc.settlements] : [];
        originalSettlements.push({
          settlement_number: reversalSettlementNumber,
          target_id: reversalDocId,
          target_number: reversalDocNumber,
          settled_amount: amount,
          date: reversalDate,
          type: 'reversal_settlement',
          notes: `تسوية عكس للمستند رقم (${originalDocNumber})`
        });

        await client.query(
          `UPDATE "${config.tableName}" 
           SET "settlements" = $1::jsonb 
           WHERE "id" = $2`,
          [JSON.stringify(originalSettlements), docId]
        );
      }
    }

    // 6. Create the Reversal Document in the corresponding table
    await this.insertReversalDocument(client, config, {
      originalDoc,
      reversalDocId,
      reversalDocNumber,
      reversalDate,
      reason,
      companyId,
      userId,
      originalEntryNumber,
      reversalEntryId,
      reversalEntryNumber,
      reversalSettlementNumber
    });

    // 7. Update original document tracking columns dynamically based on existing columns
    const { rows: docCols } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [config.tableName]
    );
    const validDocCols = new Set(docCols.map((r: any) => r.column_name));

    const setClauses: string[] = [
      `"is_reversed" = TRUE`,
      `"reversed_at" = NOW()`,
      `"reversal_reason" = $1`,
      `"reversed_by_doc_id" = $2`,
      `"reversed_by_doc_number" = $3`
    ];
    const updateParams: any[] = [
      reason || '',
      reversalDocId,
      reversalDocNumber
    ];

    if (validDocCols.has('reversed_by_entry_id')) {
      updateParams.push(reversalEntryId || null);
      setClauses.push(`"reversed_by_entry_id" = $${updateParams.length}`);
    }
    if (validDocCols.has('reversed_by_entry_number')) {
      updateParams.push(reversalEntryNumber || null);
      setClauses.push(`"reversed_by_entry_number" = $${updateParams.length}`);
    }
    if (validDocCols.has('reversal_settlement_number')) {
      updateParams.push(reversalSettlementNumber || null);
      setClauses.push(`"reversal_settlement_number" = $${updateParams.length}`);
    }
    if (validDocCols.has('updated_at')) {
      setClauses.push(`"updated_at" = NOW()`);
    }

    updateParams.push(docId);
    await client.query(
      `UPDATE "${config.tableName}" 
       SET ${setClauses.join(', ')} 
       WHERE "id" = $${updateParams.length}`,
      updateParams
    );

    return {
      success: true,
      message: `تم عكس المستند بنجاح بموجب المستند رقم (${reversalDocNumber})`,
      originalDocNumber,
      reversalDocId,
      reversalDocNumber,
      originalEntryNumber,
      reversalEntryNumber,
      reversalSettlementNumber
    };
  }

  /**
   * Inserts the matching counter/reversal document with reversed properties.
   */
  private static async insertReversalDocument(
    client: PoolClient | Pool,
    config: any,
    ctx: {
      originalDoc: any;
      reversalDocId: string;
      reversalDocNumber: string;
      reversalDate: string;
      reason: string;
      companyId: string;
      userId: string;
      originalEntryNumber?: string;
      reversalEntryId?: string;
      reversalEntryNumber?: string;
      reversalSettlementNumber?: string;
    }
  ) {
    const { originalDoc, reversalDocId, reversalDocNumber, reversalDate, reason, companyId, reversalSettlementNumber } = ctx;

    const amount = Number(originalDoc.total_amount || originalDoc.amount || 0);
    const reversalSettlements = ctx.reversalSettlementNumber ? [
      {
        settlement_number: ctx.reversalSettlementNumber,
        target_id: originalDoc.id,
        target_number: String(originalDoc[config.numberColumn]),
        settled_amount: amount,
        date: reversalDate,
        type: 'reversal_settlement',
        notes: `تسوية عكس مقابلة للمستند الأصلي رقم (${originalDoc[config.numberColumn]})`
      }
    ] : [];

    // Query valid columns for the table to ensure we NEVER insert non-existent columns
    const { rows: colRows } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [config.tableName]
    );
    const validColumns = new Set(colRows.map((r: any) => r.column_name));

    // Clone original row filtering strictly by existing columns
    const reversalDoc: any = {};
    for (const key of Object.keys(originalDoc)) {
      if (validColumns.has(key)) {
        reversalDoc[key] = originalDoc[key];
      }
    }
    delete reversalDoc.id;

    reversalDoc.id = reversalDocId;
    if (validColumns.has(config.numberColumn)) {
      reversalDoc[config.numberColumn] = reversalDocNumber;
    }
    if (validColumns.has('date')) {
      reversalDoc.date = reversalDate;
    }
    if (validColumns.has('is_reversal_doc')) {
      reversalDoc.is_reversal_doc = true;
    }
    if (validColumns.has('is_reversed')) {
      reversalDoc.is_reversed = false;
    }
    if (validColumns.has('original_doc_id')) {
      reversalDoc.original_doc_id = originalDoc.id;
    }
    if (validColumns.has('original_doc_number')) {
      reversalDoc.original_doc_number = String(originalDoc[config.numberColumn] || originalDoc.id || '');
    }
    if (validColumns.has('original_entry_id')) {
      reversalDoc.original_entry_id = ctx.originalEntryNumber ? originalDoc.id : null;
    }
    if (validColumns.has('original_entry_number')) {
      reversalDoc.original_entry_number = ctx.originalEntryNumber || null;
    }
    if (validColumns.has('reversed_by_doc_id')) {
      reversalDoc.reversed_by_doc_id = null;
    }
    if (validColumns.has('reversed_by_doc_number')) {
      reversalDoc.reversed_by_doc_number = null;
    }
    if (validColumns.has('reversed_by_entry_id')) {
      reversalDoc.reversed_by_entry_id = null;
    }
    if (validColumns.has('reversed_by_entry_number')) {
      reversalDoc.reversed_by_entry_number = null;
    }
    if (validColumns.has('reversal_settlement_number')) {
      reversalDoc.reversal_settlement_number = reversalSettlementNumber || null;
    }
    if (validColumns.has('reversal_reason')) {
      reversalDoc.reversal_reason = reason || '';
    }

    const noteText = `مستند عكسي للمستند رقم (${originalDoc[config.numberColumn] || originalDoc.id || ''})${reason ? ' - سبب: ' + reason : ''}. ${originalDoc.notes || originalDoc.description || ''}`;
    if (validColumns.has('notes')) {
      reversalDoc.notes = noteText;
    }
    if (validColumns.has('description')) {
      reversalDoc.description = noteText;
    }

    if (config.hasSettlement && validColumns.has('settlements')) {
      reversalDoc.settlements = JSON.stringify(reversalSettlements);
    }

    // Build dynamic INSERT query based strictly on validColumns
    const keys = Object.keys(reversalDoc).filter(k => reversalDoc[k] !== undefined && validColumns.has(k));
    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => {
      const v = reversalDoc[k];
      if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
        return JSON.stringify(v);
      }
      return v;
    });

    await client.query(
      `INSERT INTO "${config.tableName}" (${columns}) VALUES (${placeholders})`,
      values
    );

    // Duplicate child items if this table has a dedicated items table
    if (config.itemsTable && config.itemFkColumn) {
      const { rows: itemColRows } = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [config.itemsTable]
      );
      const validItemColumns = new Set(itemColRows.map((r: any) => r.column_name));

      const { rows: origItems } = await client.query(
        `SELECT * FROM "${config.itemsTable}" WHERE "${config.itemFkColumn}" = $1`,
        [originalDoc.id]
      );

      for (const item of origItems) {
        const itemCopy: any = {};
        for (const k of Object.keys(item)) {
          if (validItemColumns.has(k)) {
            itemCopy[k] = item[k];
          }
        }
        itemCopy.id = uuidv4();
        itemCopy[config.itemFkColumn] = reversalDocId;

        const itemKeys = Object.keys(itemCopy).filter(k => itemCopy[k] !== undefined && validItemColumns.has(k));
        const itemCols = itemKeys.map(k => `"${k}"`).join(', ');
        const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
        const itemValues = itemKeys.map(k => {
          const v = itemCopy[k];
          if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
            return JSON.stringify(v);
          }
          return v;
        });

        await client.query(
          `INSERT INTO "${config.itemsTable}" (${itemCols}) VALUES (${itemPlaceholders})`,
          itemValues
        );
      }
    }
  }

  /**
   * Module Metadata Configuration
   */
  private static getModuleConfig(moduleName: string) {
    switch (moduleName) {
      case 'invoices':
      case 'sales_invoices':
        return {
          moduleName: 'invoices',
          tableName: 'invoices',
          numberColumn: 'invoice_number',
          itemsTable: 'invoice_items',
          itemFkColumn: 'invoice_id',
          inventoryDocType: 'sales_invoice',
          hasSettlement: true,
          defaultRefType: 'invoice',
          labelAr: 'فاتورة مبيعات'
        };

      case 'purchase_invoices':
        return {
          moduleName: 'purchase_invoices',
          tableName: 'purchase_invoices',
          numberColumn: 'invoice_number',
          itemsTable: 'purchase_invoice_items',
          itemFkColumn: 'invoice_id',
          inventoryDocType: 'purchase_invoice',
          hasSettlement: true,
          defaultRefType: 'purchase_invoice',
          labelAr: 'فاتورة مشتريات'
        };

      case 'returns':
      case 'sales_returns':
        return {
          moduleName: 'returns',
          tableName: 'returns',
          numberColumn: 'return_number',
          itemsTable: 'return_items',
          itemFkColumn: 'return_id',
          inventoryDocType: 'sales_return',
          hasSettlement: true,
          defaultRefType: 'return',
          labelAr: 'مرتجع مبيعات'
        };

      case 'purchase_returns':
        return {
          moduleName: 'purchase_returns',
          tableName: 'purchase_returns',
          numberColumn: 'return_number',
          itemsTable: 'purchase_return_items',
          itemFkColumn: 'return_id',
          inventoryDocType: 'purchase_return',
          hasSettlement: true,
          defaultRefType: 'purchase_return',
          labelAr: 'مرتجع مشتريات'
        };

      case 'receipt_vouchers':
      case 'receipts':
        return {
          moduleName: 'receipt_vouchers',
          tableName: 'receipt_vouchers',
          numberColumn: 'voucher_number',
          itemsTable: null,
          itemFkColumn: null,
          inventoryDocType: null,
          hasSettlement: true,
          defaultRefType: 'receipt',
          labelAr: 'سند قبض'
        };

      case 'payment_vouchers':
      case 'payments':
        return {
          moduleName: 'payment_vouchers',
          tableName: 'payment_vouchers',
          numberColumn: 'voucher_number',
          itemsTable: null,
          itemFkColumn: null,
          inventoryDocType: null,
          hasSettlement: true,
          defaultRefType: 'payment',
          labelAr: 'سند صرف'
        };

      case 'cash_transfers':
        return {
          moduleName: 'cash_transfers',
          tableName: 'cash_transfers',
          numberColumn: 'transfer_number',
          itemsTable: null,
          itemFkColumn: null,
          inventoryDocType: null,
          hasSettlement: false,
          defaultRefType: 'transfer',
          labelAr: 'تحويل نقدي / خزائن'
        };

      case 'customer_discounts':
        return {
          moduleName: 'customer_discounts',
          tableName: 'customer_discounts',
          numberColumn: 'number',
          itemsTable: null,
          itemFkColumn: null,
          inventoryDocType: null,
          hasSettlement: true,
          defaultRefType: 'customer_discount',
          labelAr: 'خصم مسموح به للعميل'
        };

      case 'opening_stock_balances':
        return {
          moduleName: 'opening_stock_balances',
          tableName: 'opening_stock_balances',
          numberColumn: 'document_number',
          itemsTable: 'opening_stock_items',
          itemFkColumn: 'opening_stock_id',
          inventoryDocType: 'opening_stock_balance',
          hasSettlement: false,
          defaultRefType: 'opening_stock_balance',
          labelAr: 'رصيد افتتاحي للمخزون'
        };

      default:
        return null;
    }
  }
}
