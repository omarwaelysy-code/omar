/**
 * ETA Supplier Mapping Service
 * 
 * Handles mapping between suppliers extracted from ETA invoices (by Tax Number / issuer_id)
 * and internal ERP suppliers (suppliers table).
 */

import crypto from 'crypto';
import pool from '../../lib/postgres';
import { cleanDuplicatedPartnerName } from '../../utils/formatUtils';

export interface EtaPortalSupplierDTO {
  taxNumber: string;
  name: string;
  address: string;
  docCount: number;
  totalAmount: number;
  lastDocDate: string | null;
  isLinked: boolean;
  linkedSupplier: {
    id: string;
    name: string;
    code: string;
    taxNumber: string;
    mobile?: string;
    email?: string;
    linkedAt?: string;
  } | null;
  autoMatchedSupplier: {
    id: string;
    name: string;
    code: string;
    taxNumber: string;
  } | null;
}

export interface SupplierMappingSummaryDTO {
  totalPortalSuppliers: number;
  linkedSuppliersCount: number;
  unlinkedSuppliersCount: number;
  autoMatchCandidatesCount: number;
  totalDocumentsCount: number;
  totalInvoicedAmount: number;
}

export class EtaSupplierMappingService {
  /**
   * Normalize tax number for resilient matching (removes hyphens, spaces, leading/trailing whitespace)
   */
  private static normalizeTaxNumber(taxNum: string | null | undefined): string {
    if (!taxNum) return '';
    return String(taxNum).trim().replace(/[-\s]/g, '');
  }

  /**
   * Get all ETA portal suppliers, their link status, and auto-match candidates
   */
  public static async getSupplierMappings(companyId: string): Promise<{
    success: boolean;
    suppliers: EtaPortalSupplierDTO[];
    summary: SupplierMappingSummaryDTO;
  }> {
    // 1. Fetch unique suppliers from eta_documents (direction = 'Received')
    const portalSuppliersRes = await pool.query(`
      SELECT 
        issuer_id as tax_number,
        COALESCE(NULLIF(MAX(issuer_name), ''), 'مورد غير محدد') as name,
        COALESCE(NULLIF(MAX(issuer_address), ''), '') as address,
        count(*)::int as doc_count,
        COALESCE(sum(total_amount), 0)::numeric as total_amount,
        max(date_time_issued) as last_doc_date
      FROM eta_documents
      WHERE company_id = $1 
        AND direction = 'Received' 
        AND issuer_id IS NOT NULL 
        AND TRIM(issuer_id) != ''
      GROUP BY issuer_id
      ORDER BY total_amount DESC, doc_count DESC
    `, [companyId]);

    // 2. Fetch existing mappings from eta_supplier_mappings
    const mappingsRes = await pool.query(`
      SELECT 
        m.eta_tax_number,
        m.eta_supplier_name,
        m.created_at,
        s.id as supplier_id,
        s.name as supplier_name,
        s.code as supplier_code,
        s.tax_number as supplier_tax_number,
        s.mobile as supplier_mobile,
        s.email as supplier_email
      FROM eta_supplier_mappings m
      JOIN suppliers s ON m.supplier_id = s.id
      WHERE m.company_id = $1
    `, [companyId]);

    const mappingsByTaxNumber = new Map<string, any>();
    for (const row of mappingsRes.rows) {
      mappingsByTaxNumber.set(this.normalizeTaxNumber(row.eta_tax_number), row);
    }

    // 3. Fetch all ERP suppliers to detect automatic tax_number matches
    const erpSuppliersRes = await pool.query(`
      SELECT id, name, code, tax_number, mobile, email, address
      FROM suppliers
      WHERE company_id = $1
    `, [companyId]);

    const erpSuppliersByTaxNumber = new Map<string, any>();
    for (const sup of erpSuppliersRes.rows) {
      const norm = this.normalizeTaxNumber(sup.tax_number);
      if (norm) {
        erpSuppliersByTaxNumber.set(norm, sup);
      }
    }

    // 4. Build composite supplier list
    const suppliers: EtaPortalSupplierDTO[] = [];
    let linkedCount = 0;
    let unlinkedCount = 0;
    let autoMatchCount = 0;
    let totalDocs = 0;
    let totalAmt = 0;

    for (const row of portalSuppliersRes.rows) {
      const rawTax = String(row.tax_number).trim();
      const normTax = this.normalizeTaxNumber(rawTax);
      const totalAmountNum = parseFloat(row.total_amount) || 0;
      const docCountNum = parseInt(row.doc_count, 10) || 0;

      totalDocs += docCountNum;
      totalAmt += totalAmountNum;

      const mapping = mappingsByTaxNumber.get(normTax);
      const isLinked = !!mapping;

      let linkedSupplier: EtaPortalSupplierDTO['linkedSupplier'] = null;
      let autoMatchedSupplier: EtaPortalSupplierDTO['autoMatchedSupplier'] = null;

      if (isLinked) {
        linkedCount++;
        linkedSupplier = {
          id: mapping.supplier_id,
          name: mapping.supplier_name,
          code: mapping.supplier_code,
          taxNumber: mapping.supplier_tax_number || rawTax,
          mobile: mapping.supplier_mobile || undefined,
          email: mapping.supplier_email || undefined,
          linkedAt: mapping.created_at ? new Date(mapping.created_at).toISOString() : undefined
        };
      } else {
        unlinkedCount++;
        // Check for auto-match candidate in ERP suppliers
        const candidate = erpSuppliersByTaxNumber.get(normTax);
        if (candidate) {
          autoMatchCount++;
          autoMatchedSupplier = {
            id: candidate.id,
            name: candidate.name,
            code: candidate.code,
            taxNumber: candidate.tax_number || rawTax
          };
        }
      }

      suppliers.push({
        taxNumber: rawTax,
        name: cleanDuplicatedPartnerName(row.name),
        address: row.address,
        docCount: docCountNum,
        totalAmount: totalAmountNum,
        lastDocDate: row.last_doc_date ? new Date(row.last_doc_date).toISOString() : null,
        isLinked,
        linkedSupplier,
        autoMatchedSupplier
      });
    }

    const summary: SupplierMappingSummaryDTO = {
      totalPortalSuppliers: suppliers.length,
      linkedSuppliersCount: linkedCount,
      unlinkedSuppliersCount: unlinkedCount,
      autoMatchCandidatesCount: autoMatchCount,
      totalDocumentsCount: totalDocs,
      totalInvoicedAmount: totalAmt
    };

    return {
      success: true,
      suppliers,
      summary
    };
  }

  /**
   * Link an ETA supplier (tax number) to an internal ERP supplier
   */
  public static async linkSupplier(
    companyId: string,
    etaTaxNumber: string,
    supplierId: string,
    etaSupplierName?: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    if (!companyId || !etaTaxNumber || !supplierId) {
      throw new Error('البيانات المطلوبة غير مكتملة للربط.');
    }

    const id = crypto.randomUUID();
    const cleanedSupplierName = cleanDuplicatedPartnerName(etaSupplierName) || null;
    await pool.query(`
      INSERT INTO eta_supplier_mappings (
        id, company_id, eta_tax_number, eta_supplier_name, supplier_id, notes, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (company_id, eta_tax_number)
      DO UPDATE SET
        supplier_id = EXCLUDED.supplier_id,
        eta_supplier_name = COALESCE(EXCLUDED.eta_supplier_name, eta_supplier_mappings.eta_supplier_name),
        notes = COALESCE(EXCLUDED.notes, eta_supplier_mappings.notes),
        updated_at = CURRENT_TIMESTAMP
    `, [id, companyId, etaTaxNumber.trim(), cleanedSupplierName, supplierId, notes || null]);

    return {
      success: true,
      message: 'تم ربط المورد بنجاح'
    };
  }

  /**
   * Unlink an ETA supplier
   */
  public static async unlinkSupplier(
    companyId: string,
    etaTaxNumber: string
  ): Promise<{ success: boolean; message: string }> {
    if (!companyId || !etaTaxNumber) {
      throw new Error('الرقم الضريبي مطلوب لفك الربط.');
    }

    await pool.query(`
      DELETE FROM eta_supplier_mappings
      WHERE company_id = $1 AND eta_tax_number = $2
    `, [companyId, etaTaxNumber.trim()]);

    return {
      success: true,
      message: 'تم فك ارتباط المورد بنجاح'
    };
  }

  /**
   * Bulk quick-link all unlinked ETA suppliers that match an ERP supplier by Tax Number
   */
  public static async quickLinkAllMatched(companyId: string): Promise<{
    success: boolean;
    linkedCount: number;
    message: string;
  }> {
    const { suppliers } = await this.getSupplierMappings(companyId);
    const candidates = suppliers.filter(s => !s.isLinked && s.autoMatchedSupplier);

    if (candidates.length === 0) {
      return {
        success: true,
        linkedCount: 0,
        message: 'لا توجد موردين غير مربوطين متطابقين في الرقم الضريبي حالياً.'
      };
    }

    let linkedCount = 0;
    for (const c of candidates) {
      if (c.autoMatchedSupplier) {
        await this.linkSupplier(companyId, c.taxNumber, c.autoMatchedSupplier.id, c.name);
        linkedCount++;
      }
    }

    return {
      success: true,
      linkedCount,
      message: `تم الربط التلقائي بنجاح لعدد ${linkedCount} مورد متطابق بالرقم الضريبي.`
    };
  }

  /**
   * Create a new supplier in suppliers table and immediately link to ETA tax number
   */
  public static async createAndLinkSupplier(
    companyId: string,
    data: {
      name: string;
      taxNumber: string;
      address?: string;
      mobile?: string;
      email?: string;
      accountId?: string;
      accountName?: string;
    }
  ): Promise<{ success: boolean; supplierId: string; code: string; message: string }> {
    const { name, taxNumber, address, mobile, email } = data;
    if (!name || !taxNumber) {
      throw new Error('اسم المورد والرقم الضريبي مطلوبان لإنشاء المورد.');
    }

    let finalAccountId = data.accountId?.trim() || '';
    let finalAccountName = data.accountName?.trim() || '';

    // If accountId provided, verify it exists and get its official name
    if (finalAccountId) {
      const accCheck = await pool.query(`
        SELECT id, name, code, account_usage FROM accounts 
        WHERE id = $1 AND company_id = $2
      `, [finalAccountId, companyId]);

      if (accCheck.rows.length === 0) {
        throw new Error('الحساب المحاسبي المحدد غير موجود أو غير تابع لهذه الشركة.');
      }
      finalAccountName = accCheck.rows[0].name;
    } else {
      // Automatic fallback: find default supplier account in Chart of Accounts
      const defaultAccRes = await pool.query(`
        SELECT id, name, code, account_usage FROM accounts 
        WHERE company_id = $1 
          AND (
            account_usage = 'supplier' 
            OR account_usage = 'accounts_payable' 
            OR code = '210101' 
            OR code LIKE '2101%'
            OR name LIKE '%مورد%'
          )
          AND (is_active IS NULL OR is_active = true)
        ORDER BY 
          CASE 
            WHEN account_usage = 'supplier' THEN 1 
            WHEN account_usage = 'accounts_payable' THEN 2 
            WHEN code = '210101' THEN 3
            WHEN code LIKE '2101%' THEN 4
            ELSE 5 
          END,
          code ASC
        LIMIT 1
      `, [companyId]);

      if (defaultAccRes.rows.length === 0) {
        throw new Error('خطأ فادح: لا يمكن إنشاء المورد لعدم وجود حساب محاسبي للموردين بدليل الحسابات. يرجى تحديد الحساب المحاسبي أولاً.');
      }

      finalAccountId = defaultAccRes.rows[0].id;
      finalAccountName = defaultAccRes.rows[0].name;
    }

    if (!finalAccountId) {
      throw new Error('لا يمكن حفظ المورد بدون حساب محاسبي مربوط.');
    }

    // Generate next supplier code
    const existingCodesRes = await pool.query(`
      SELECT code FROM suppliers WHERE company_id = $1
    `, [companyId]);

    let maxNum = 0;
    for (const row of existingCodesRes.rows) {
      const match = String(row.code || '').match(/(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextNum = maxNum + 1;
    const code = `supp ${nextNum.toString().padStart(5, '0')}`;
    const supplierId = crypto.randomUUID();

    const cleanedName = cleanDuplicatedPartnerName(name);

    // Insert into suppliers WITH account_id and account_name
    await pool.query(`
      INSERT INTO suppliers (
        id, company_id, name, code, tax_number, address, mobile, email,
        account_id, account_name, payment_method, is_active, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'credit', true, CURRENT_TIMESTAMP)
    `, [
      supplierId,
      companyId,
      cleanedName,
      code,
      taxNumber.trim(),
      address || '',
      mobile || '',
      email || '',
      finalAccountId,
      finalAccountName
    ]);

    // Link immediately in eta_supplier_mappings
    await this.linkSupplier(companyId, taxNumber, supplierId, cleanedName);

    return {
      success: true,
      supplierId,
      code,
      message: `تم إنشاء المورد "${cleanedName}" بالكود (${code}) وربطه بالحساب المحاسبي (${finalAccountName}) بنجاح.`
    };
  }
}
