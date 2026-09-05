/**
 * ETA Item Mapping Service
 * 
 * Handles mapping between items/products extracted from ETA invoices (by itemCode)
 * and internal ERP products (products table).
 */

import crypto from 'crypto';
import pool from '../../lib/postgres';
import { EtaDocumentService } from './EtaDocumentService';

export interface EtaPortalItemDTO {
  itemCode: string;
  itemType: string;
  itemName: string;
  description: string;
  unitType: string;
  lastUnitPrice: number;
  docCount: number;
  totalQuantity: number;
  totalAmount: number;
  lastDocDate: string | null;
  supplierTaxNumber: string;
  supplierName: string;
  suppliers: Array<{
    taxNumber: string;
    name: string;
    docCount: number;
  }>;
  sampleDocument?: {
    uuid: string;
    internalId: string;
    issuerName: string;
    issuerId?: string;
    date: string;
  };
  isLinked: boolean;
  linkedProduct: {
    id: string;
    name: string;
    code: string;
    barcode?: string;
    taxItemCode?: string;
    taxCodeType?: string;
    unit?: string;
    salePrice?: number;
    costPrice?: number;
    stock?: number;
    linkedAt?: string;
  } | null;
  autoMatchedProduct: {
    id: string;
    name: string;
    code: string;
    taxItemCode?: string;
    taxCodeType?: string;
    barcode?: string;
    matchReason: 'tax_item_code' | 'code' | 'barcode' | 'exact_name';
  } | null;
}

export interface ItemMappingSummaryDTO {
  totalPortalItems: number;
  linkedItemsCount: number;
  unlinkedItemsCount: number;
  autoMatchCandidatesCount: number;
  totalDocumentsCount: number;
  totalInvoicedAmount: number;
}

export class EtaItemMappingService {
  /**
   * Normalize code for resilient matching (removes hyphens, spaces, lowercase)
   */
  private static normalizeCode(code: string | null | undefined): string {
    if (!code) return '';
    return String(code).trim().toLowerCase().replace(/[-\s]/g, '');
  }

  /**
   * Get all ETA portal items, their link status, and auto-match candidates
   */
  public static async getItemMappings(
    companyId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<{
    success: boolean;
    items: EtaPortalItemDTO[];
    summary: ItemMappingSummaryDTO;
  }> {
    // If forceRefresh requested, sync documents from ETA portal
    if (options.forceRefresh) {
      await EtaDocumentService.fetchAllDocuments(companyId, { forceRefresh: true }).catch(err => {
        console.warn('[ETA Item Mapping] forceRefresh fetch warning:', err.message || err);
      });
    }

    // 1. Fetch received documents with raw_data to extract item lines
    const docsRes = await pool.query(`
      SELECT 
        id, uuid, internal_id, date_time_issued, issuer_id, issuer_name, total_amount, raw_data
      FROM eta_documents
      WHERE company_id = $1 
        AND direction = 'Received'
      ORDER BY date_time_issued DESC
    `, [companyId]);

    // Aggregate unique item lines from raw_data
    const aggregatedItems = new Map<string, {
      itemCode: string;
      itemType: string;
      itemName: string;
      description: string;
      unitType: string;
      lastUnitPrice: number;
      docUuids: Set<string>;
      totalQuantity: number;
      totalAmount: number;
      lastDocDate: string | null;
      supplierTaxNumber: string;
      supplierName: string;
      suppliersMap: Map<string, { taxNumber: string; name: string; docCount: number }>;
      sampleDocument?: {
        uuid: string;
        internalId: string;
        issuerName: string;
        issuerId?: string;
        date: string;
      };
    }>();

    let totalDocsInvoiced = docsRes.rows.length;
    let totalInvoicedAmount = 0;

    for (const row of docsRes.rows) {
      totalInvoicedAmount += Number(row.total_amount || 0);

      const rawDataObj = row.raw_data;
      if (!rawDataObj) continue;

      const docIssuerId = (row.issuer_id || rawDataObj?.issuer?.id || '').trim();
      const docIssuerName = (row.issuer_name || rawDataObj?.issuer?.name || '').trim();

      const rawLines: any[] = Array.isArray(rawDataObj?.invoiceLines)
        ? rawDataObj.invoiceLines
        : (Array.isArray(rawDataObj?.details?.invoiceLines)
            ? rawDataObj.details.invoiceLines
            : (Array.isArray(rawDataObj?.rawDocument?.invoiceLines) ? rawDataObj.rawDocument.invoiceLines : []));

      for (const line of rawLines) {
        const itemCodeRaw = (line.itemCode || '').trim();
        if (!itemCodeRaw || itemCodeRaw === '---') continue;

        const itemType = (line.itemType || 'EGS').trim().toUpperCase();
        const itemName = (line.itemCodeName || line.itemPrimaryName || line.itemSecondaryName || line.description || itemCodeRaw).trim();
        const description = (line.description || '').trim();
        const unitType = (line.unitType || '').trim();
        const unitPrice = Number(line.unitPrice ?? (line.unitValue?.amountEGP || line.unitValue?.amountSold || 0));
        const quantity = Number(line.quantity ?? 1);
        const salesTotal = Number(line.salesTotal ?? (quantity * unitPrice));
        const discountAmount = Number(line.discountAmount ?? (line.itemsDiscount || line.discount?.amount || 0));
        const taxAmount = Number(line.taxAmount ?? (Array.isArray(line.taxesList) ? line.taxesList.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0) : 0));
        const lineTotal = Number(line.lineTotal ?? line.total ?? (salesTotal - discountAmount + taxAmount));

        const existing = aggregatedItems.get(itemCodeRaw);
        if (!existing) {
          const suppliersMap = new Map<string, { taxNumber: string; name: string; docCount: number }>();
          if (docIssuerId || docIssuerName) {
            const key = docIssuerId || docIssuerName;
            suppliersMap.set(key, {
              taxNumber: docIssuerId,
              name: docIssuerName,
              docCount: 1
            });
          }

          aggregatedItems.set(itemCodeRaw, {
            itemCode: itemCodeRaw,
            itemType,
            itemName,
            description,
            unitType,
            lastUnitPrice: unitPrice,
            docUuids: new Set([row.uuid]),
            totalQuantity: quantity,
            totalAmount: lineTotal,
            lastDocDate: row.date_time_issued ? new Date(row.date_time_issued).toISOString() : null,
            supplierTaxNumber: docIssuerId,
            supplierName: docIssuerName,
            suppliersMap,
            sampleDocument: {
              uuid: row.uuid,
              internalId: row.internal_id || '',
              issuerName: row.issuer_name || '',
              issuerId: row.issuer_id || '',
              date: row.date_time_issued ? new Date(row.date_time_issued).toISOString() : ''
            }
          });
        } else {
          existing.docUuids.add(row.uuid);
          existing.totalQuantity += quantity;
          existing.totalAmount += lineTotal;
          if (!existing.itemName && itemName) existing.itemName = itemName;
          if (!existing.description && description) existing.description = description;
          if (!existing.unitType && unitType) existing.unitType = unitType;
          if (unitPrice > 0) existing.lastUnitPrice = unitPrice;

          if (docIssuerId || docIssuerName) {
            const key = docIssuerId || docIssuerName;
            const sEntry = existing.suppliersMap.get(key);
            if (sEntry) {
              sEntry.docCount++;
              if (!sEntry.name && docIssuerName) sEntry.name = docIssuerName;
            } else {
              existing.suppliersMap.set(key, {
                taxNumber: docIssuerId,
                name: docIssuerName,
                docCount: 1
              });
            }
          }

          if (row.date_time_issued) {
            const rowDate = new Date(row.date_time_issued).toISOString();
            if (!existing.lastDocDate || rowDate > existing.lastDocDate) {
              existing.lastDocDate = rowDate;
              if (docIssuerId) existing.supplierTaxNumber = docIssuerId;
              if (docIssuerName) existing.supplierName = docIssuerName;
            }
          }
        }
      }
    }

    // 2. Fetch existing mappings from eta_item_mappings
    const mappingsRes = await pool.query(`
      SELECT 
        m.eta_item_code,
        m.eta_item_name,
        m.eta_item_type,
        m.notes,
        m.created_at,
        p.id as product_id,
        p.name as product_name,
        p.code as product_code,
        p.barcode as product_barcode,
        p.tax_item_code as product_tax_item_code,
        p.tax_code_type as product_tax_code_type,
        p.unit as product_unit,
        p.sale_price as product_sale_price,
        p.cost_price as product_cost_price,
        p.stock as product_stock
      FROM eta_item_mappings m
      JOIN products p ON m.product_id = p.id
      WHERE m.company_id = $1
    `, [companyId]);

    const mappingsByCode = new Map<string, any>();
    for (const row of mappingsRes.rows) {
      mappingsByCode.set(row.eta_item_code.trim(), row);
      mappingsByCode.set(this.normalizeCode(row.eta_item_code), row);
    }

    // 3. Fetch all ERP products to detect automatic matches
    const erpProductsRes = await pool.query(`
      SELECT id, name, code, barcode, tax_item_code, tax_code_type, unit, sale_price, cost_price, stock
      FROM products
      WHERE company_id = $1
    `, [companyId]);

    const erpProductsByTaxCode = new Map<string, any>();
    const erpProductsByInternalCode = new Map<string, any>();
    const erpProductsByBarcode = new Map<string, any>();
    const erpProductsByName = new Map<string, any>();

    for (const p of erpProductsRes.rows) {
      if (p.tax_item_code && p.tax_item_code.trim()) {
        erpProductsByTaxCode.set(p.tax_item_code.trim(), p);
        erpProductsByTaxCode.set(this.normalizeCode(p.tax_item_code), p);
      }
      if (p.code && p.code.trim()) {
        erpProductsByInternalCode.set(p.code.trim(), p);
        erpProductsByInternalCode.set(this.normalizeCode(p.code), p);
      }
      if (p.barcode && p.barcode.trim()) {
        erpProductsByBarcode.set(p.barcode.trim(), p);
        erpProductsByBarcode.set(this.normalizeCode(p.barcode), p);
      }
      if (p.name && p.name.trim()) {
        erpProductsByName.set(p.name.trim().toLowerCase(), p);
      }
    }

    // 4. Build complete list of items
    const items: EtaPortalItemDTO[] = [];
    const processedCodes = new Set<string>();

    let linkedCount = 0;
    let unlinkedCount = 0;
    let autoMatchCount = 0;

    // Process all aggregated items from eta_documents
    for (const [itemCode, agg] of aggregatedItems.entries()) {
      processedCodes.add(itemCode);

      const mapping = mappingsByCode.get(itemCode) || mappingsByCode.get(this.normalizeCode(itemCode));
      const isLinked = !!mapping;

      let linkedProduct = null;
      let autoMatchedProduct = null;

      if (isLinked) {
        linkedCount++;
        linkedProduct = {
          id: mapping.product_id,
          name: mapping.product_name,
          code: mapping.product_code,
          barcode: mapping.product_barcode,
          taxItemCode: mapping.product_tax_item_code,
          taxCodeType: mapping.product_tax_code_type,
          unit: mapping.product_unit,
          salePrice: Number(mapping.product_sale_price || 0),
          costPrice: Number(mapping.product_cost_price || 0),
          stock: Number(mapping.product_stock || 0),
          linkedAt: mapping.created_at ? new Date(mapping.created_at).toISOString() : undefined
        };
      } else {
        unlinkedCount++;
        // Auto-match attempt:
        // Priority 1: tax_item_code match
        const norm = this.normalizeCode(itemCode);
        const matchByTax = erpProductsByTaxCode.get(itemCode) || erpProductsByTaxCode.get(norm);
        if (matchByTax) {
          autoMatchedProduct = {
            id: matchByTax.id,
            name: matchByTax.name,
            code: matchByTax.code,
            taxItemCode: matchByTax.tax_item_code,
            taxCodeType: matchByTax.tax_code_type,
            barcode: matchByTax.barcode,
            matchReason: 'tax_item_code' as const
          };
          autoMatchCount++;
        } else {
          // Priority 2: internal product code match
          const matchByCode = erpProductsByInternalCode.get(itemCode) || erpProductsByInternalCode.get(norm);
          if (matchByCode) {
            autoMatchedProduct = {
              id: matchByCode.id,
              name: matchByCode.name,
              code: matchByCode.code,
              taxItemCode: matchByCode.tax_item_code,
              taxCodeType: matchByCode.tax_code_type,
              barcode: matchByCode.barcode,
              matchReason: 'code' as const
            };
            autoMatchCount++;
          } else {
            // Priority 3: barcode match
            const matchByBarcode = erpProductsByBarcode.get(itemCode) || erpProductsByBarcode.get(norm);
            if (matchByBarcode) {
              autoMatchedProduct = {
                id: matchByBarcode.id,
                name: matchByBarcode.name,
                code: matchByBarcode.code,
                taxItemCode: matchByBarcode.tax_item_code,
                taxCodeType: matchByBarcode.tax_code_type,
                barcode: matchByBarcode.barcode,
                matchReason: 'barcode' as const
              };
              autoMatchCount++;
            } else if (agg.itemName && erpProductsByName.get(agg.itemName.toLowerCase())) {
              // Priority 4: Exact name match
              const matchByName = erpProductsByName.get(agg.itemName.toLowerCase());
              autoMatchedProduct = {
                id: matchByName.id,
                name: matchByName.name,
                code: matchByName.code,
                taxItemCode: matchByName.tax_item_code,
                taxCodeType: matchByName.tax_code_type,
                barcode: matchByName.barcode,
                matchReason: 'exact_name' as const
              };
              autoMatchCount++;
            }
          }
        }
      }

      items.push({
        itemCode: agg.itemCode,
        itemType: agg.itemType,
        itemName: agg.itemName,
        description: agg.description,
        unitType: agg.unitType,
        lastUnitPrice: agg.lastUnitPrice,
        docCount: agg.docUuids.size,
        totalQuantity: agg.totalQuantity,
        totalAmount: agg.totalAmount,
        lastDocDate: agg.lastDocDate,
        supplierTaxNumber: agg.supplierTaxNumber || '',
        supplierName: agg.supplierName || '',
        suppliers: Array.from(agg.suppliersMap.values()),
        sampleDocument: agg.sampleDocument,
        isLinked,
        linkedProduct,
        autoMatchedProduct
      });
    }

    // Also include mapped items that may not be in current eta_documents
    for (const row of mappingsRes.rows) {
      const code = row.eta_item_code.trim();
      if (!processedCodes.has(code)) {
        processedCodes.add(code);
        linkedCount++;
        items.push({
          itemCode: code,
          itemType: row.eta_item_type || 'EGS',
          itemName: row.eta_item_name || row.product_name || code,
          description: '',
          unitType: row.product_unit || '',
          lastUnitPrice: Number(row.product_cost_price || 0),
          docCount: 0,
          totalQuantity: 0,
          totalAmount: 0,
          lastDocDate: null,
          supplierTaxNumber: '',
          supplierName: '',
          suppliers: [],
          isLinked: true,
          linkedProduct: {
            id: row.product_id,
            name: row.product_name,
            code: row.product_code,
            barcode: row.product_barcode,
            taxItemCode: row.product_tax_item_code,
            taxCodeType: row.product_tax_code_type,
            unit: row.product_unit,
            salePrice: Number(row.product_sale_price || 0),
            costPrice: Number(row.product_cost_price || 0),
            stock: Number(row.product_stock || 0),
            linkedAt: row.created_at ? new Date(row.created_at).toISOString() : undefined
          },
          autoMatchedProduct: null
        });
      }
    }

    // Sort items by totalAmount DESC, docCount DESC
    items.sort((a, b) => b.totalAmount - a.totalAmount || b.docCount - a.docCount);

    const summary: ItemMappingSummaryDTO = {
      totalPortalItems: items.length,
      linkedItemsCount: linkedCount,
      unlinkedItemsCount: unlinkedCount,
      autoMatchCandidatesCount: autoMatchCount,
      totalDocumentsCount: totalDocsInvoiced,
      totalInvoicedAmount
    };

    return {
      success: true,
      items,
      summary
    };
  }

  /**
   * Link an ETA item code to an internal ERP product
   */
  public static async linkItem(
    companyId: string,
    etaItemCode: string,
    productId: string,
    etaItemName?: string,
    etaItemType: string = 'EGS',
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    if (!companyId || !etaItemCode || !productId) {
      throw new Error('بيانات الربط غير مكتملة (كود الصنف ومعرف المنتج مطلوبان).');
    }

    const cleanItemCode = etaItemCode.trim();
    const cleanItemType = (etaItemType || 'EGS').trim().toUpperCase();
    const cleanItemName = (etaItemName || '').trim() || null;
    const id = crypto.randomUUID();

    // 1. Insert or update in eta_item_mappings
    await pool.query(`
      INSERT INTO eta_item_mappings (
        id, company_id, eta_item_code, eta_item_name, eta_item_type, product_id, notes, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (company_id, eta_item_code)
      DO UPDATE SET
        product_id = EXCLUDED.product_id,
        eta_item_name = COALESCE(EXCLUDED.eta_item_name, eta_item_mappings.eta_item_name),
        eta_item_type = COALESCE(EXCLUDED.eta_item_type, eta_item_mappings.eta_item_type),
        notes = COALESCE(EXCLUDED.notes, eta_item_mappings.notes),
        updated_at = CURRENT_TIMESTAMP
    `, [id, companyId, cleanItemCode, cleanItemName, cleanItemType, productId, notes || null]);

    // 2. Sync tax_item_code and tax_code_type onto the product if not set
    await pool.query(`
      UPDATE products
      SET 
        tax_item_code = COALESCE(NULLIF(tax_item_code, ''), $1),
        tax_code_type = COALESCE(NULLIF(tax_code_type, ''), $2),
        eta_item_code = COALESCE(NULLIF(eta_item_code, ''), $1),
        eta_code_type = COALESCE(NULLIF(eta_code_type, ''), $2)
      WHERE id = $3 AND company_id = $4
    `, [cleanItemCode, cleanItemType, productId, companyId]);

    return {
      success: true,
      message: 'تم ربط الصنف بنجاح'
    };
  }

  /**
   * Unlink an ETA item
   */
  public static async unlinkItem(
    companyId: string,
    etaItemCode: string
  ): Promise<{ success: boolean; message: string }> {
    if (!companyId || !etaItemCode) {
      throw new Error('كود الصنف مطلوب لفك الربط.');
    }

    await pool.query(`
      DELETE FROM eta_item_mappings
      WHERE company_id = $1 AND eta_item_code = $2
    `, [companyId, etaItemCode.trim()]);

    return {
      success: true,
      message: 'تم فك ارتباط الصنف بنجاح'
    };
  }

  /**
   * Bulk quick-link all unlinked ETA items that have an auto-matched product
   */
  public static async bulkLinkAutoMatched(companyId: string): Promise<{
    success: boolean;
    linkedCount: number;
    message: string;
  }> {
    const { items } = await this.getItemMappings(companyId);

    const candidates = items.filter(i => !i.isLinked && i.autoMatchedProduct);
    if (candidates.length === 0) {
      return {
        success: true,
        linkedCount: 0,
        message: 'لا توجد أصناف مؤهلة للربط التلقائي حالياً'
      };
    }

    let linkedCount = 0;
    for (const item of candidates) {
      if (!item.autoMatchedProduct) continue;
      try {
        await this.linkItem(
          companyId,
          item.itemCode,
          item.autoMatchedProduct.id,
          item.itemName,
          item.itemType,
          `ربط تلقائي مطابق لـ ${item.autoMatchedProduct.matchReason}`
        );
        linkedCount++;
      } catch (err) {
        console.warn(`[ETA Item Mapping] Failed to auto-link ${item.itemCode}:`, err);
      }
    }

    return {
      success: true,
      linkedCount,
      message: `تم ربط ${linkedCount} صنف بنجاح وتحديث بيانات الضرائب`
    };
  }
}
