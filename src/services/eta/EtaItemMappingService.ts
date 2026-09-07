/**
 * ETA Item Mapping Service
 * 
 * Handles mapping between items/products extracted from ETA invoices (by itemCode)
 * and internal ERP products (products table).
 */

import crypto from 'crypto';
import pool from '../../lib/postgres';
import { EtaDocumentService } from './EtaDocumentService';
import { EtaAuthService } from './EtaAuthService';

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
  status?: string;
  activeFrom?: string | null;
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
    etaItemCode?: string;
    etaCodeType?: string;
    barcode?: string;
    matchReason: 'tax_item_code' | 'eta_item_code' | 'code' | 'barcode' | 'exact_name';
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
   * Sync registered item codes from ETA portal (Codes Usage Requests)
   */
  public static async syncRegisteredCodesFromEta(companyId: string): Promise<{
    success: boolean;
    count: number;
    message?: string;
  }> {
    try {
      const settings = await EtaDocumentService.getCompanySettings(companyId);
      if (!settings || !settings.clientId || !settings.clientSecret) {
        return { success: false, count: 0, message: 'بيانات الاعتماد للضرائب غير متوفرة.' };
      }

      const token = await EtaAuthService.getValidAccessToken({
        companyId,
        environment: settings.environment,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret
      });

      const baseUrl = EtaDocumentService.getApiBaseUrl(settings.environment);

      // Fetch first page using ETA parameters Ps=100 & Pn=1
      const firstUrl = `${baseUrl}/api/v1.0/codetypes/requests/my?Ps=100&Pn=1`;
      const firstRes = await fetch(firstUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!firstRes.ok) {
        const errText = await firstRes.text().catch(() => '');
        console.warn('[ETA Registered Codes] Fetch failed:', firstRes.status, errText);
        return { success: false, count: 0, message: `تعذر جلب الأكواد من المنظومة (${firstRes.status}).` };
      }

      const firstData = await firstRes.json();
      const allCodeRequests: any[] = Array.isArray(firstData.result) ? [...firstData.result] : [];
      const totalPages = Number(firstData.metadata?.totalPages || 1);

      for (let p = 2; p <= totalPages; p++) {
        await new Promise(r => setTimeout(r, 550));
        const pUrl = `${baseUrl}/api/v1.0/codetypes/requests/my?Ps=100&Pn=${p}`;
        const pRes = await fetch(pUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData.result)) {
            allCodeRequests.push(...pData.result);
          }
        }
      }

      let insertedCount = 0;
      for (const item of allCodeRequests) {
        const itemCode = (item.itemCode || '').trim();
        if (!itemCode) continue;

        const codeType = (item.codeTypeName || 'EGS').trim().toUpperCase();
        const codeNameAr = (item.codeNameSecondaryLang || item.codeNamePrimaryLang || item.descriptionSecondaryLang || itemCode).trim();
        const codeNameEn = (item.codeNamePrimaryLang || item.codeNameSecondaryLang || item.descriptionPrimaryLang || itemCode).trim();
        const descriptionAr = (item.descriptionSecondaryLang || item.descriptionPrimaryLang || '').trim();
        const descriptionEn = (item.descriptionPrimaryLang || item.descriptionSecondaryLang || '').trim();
        const parentItemCode = (item.parentItemCode || '').trim();
        const parentCodeName = (item.parentCodeNameSecondaryLang || item.parentCodeNamePrimaryLang || '').trim();
        const status = (item.status || 'Approved').trim();
        const activeFrom = item.activeFrom ? new Date(item.activeFrom) : null;
        const activeTo = item.activeTo ? new Date(item.activeTo) : null;
        const active = item.active !== false;

        const id = crypto.randomUUID();
        await pool.query(`
          INSERT INTO eta_registered_codes (
            id, company_id, item_code, code_type, code_name_ar, code_name_en,
            description_ar, description_en, parent_item_code, parent_code_name,
            status, active_from, active_to, active, raw_data, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
          ON CONFLICT (company_id, item_code)
          DO UPDATE SET
            code_name_ar = EXCLUDED.code_name_ar,
            code_name_en = EXCLUDED.code_name_en,
            description_ar = EXCLUDED.description_ar,
            description_en = EXCLUDED.description_en,
            parent_item_code = EXCLUDED.parent_item_code,
            parent_code_name = EXCLUDED.parent_code_name,
            status = EXCLUDED.status,
            active_from = EXCLUDED.active_from,
            active_to = EXCLUDED.active_to,
            active = EXCLUDED.active,
            raw_data = EXCLUDED.raw_data,
            updated_at = CURRENT_TIMESTAMP
        `, [
          id, companyId, itemCode, codeType, codeNameAr, codeNameEn,
          descriptionAr, descriptionEn, parentItemCode, parentCodeName,
          status, activeFrom, activeTo, active, JSON.stringify(item)
        ]);
        insertedCount++;
      }

      return { success: true, count: insertedCount };
    } catch (err: any) {
      console.error('[ETA Registered Codes] Error syncing from ETA:', err.message || err);
      return { success: false, count: 0, message: err.message };
    }
  }

  /**
   * Get all ETA portal items, their link status, and auto-match candidates
   */
  public static async getItemMappings(
    companyId: string,
    options: { forceRefresh?: boolean; direction?: 'Received' | 'Sent' } = {}
  ): Promise<{
    success: boolean;
    items: EtaPortalItemDTO[];
    summary: ItemMappingSummaryDTO;
  }> {
    const direction = options.direction === 'Sent' ? 'Sent' : 'Received';
    const isSent = direction === 'Sent';

    // If Sent: sync registered EGS codes from portal
    if (isSent) {
      const regCountRes = await pool.query(
        'SELECT count(*) FROM eta_registered_codes WHERE company_id = $1',
        [companyId]
      ).catch(() => ({ rows: [{ count: '0' }] }));
      const hasNoRegisteredCodes = Number(regCountRes.rows[0]?.count || 0) === 0;

      if (options.forceRefresh || hasNoRegisteredCodes) {
        await this.syncRegisteredCodesFromEta(companyId).catch(err => {
          console.warn('[ETA Item Mapping] syncRegisteredCodes warning:', err.message || err);
        });
      }
    } else {
      // If Received and forceRefresh requested, sync documents from ETA portal
      if (options.forceRefresh) {
        await EtaDocumentService.fetchAllDocuments(companyId, { forceRefresh: true }).catch(err => {
          console.warn('[ETA Item Mapping] forceRefresh fetch warning:', err.message || err);
        });
      }
    }

    // 1. Fetch documents with raw_data to extract item lines / usage stats
    const docsRes = await pool.query(`
      SELECT 
        id, uuid, internal_id, date_time_issued, 
        issuer_id, issuer_name, receiver_id, receiver_name, 
        total_amount, raw_data
      FROM eta_documents
      WHERE company_id = $1 
        AND direction = $2
      ORDER BY date_time_issued DESC
    `, [companyId, direction]);

    // Aggregate unique item lines
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
      status?: string;
      activeFrom?: string | null;
    }>();

    let totalDocsInvoiced = docsRes.rows.length;
    let totalInvoicedAmount = 0;

    // IF isSent: load all registered codes from portal first so all 39/40 codes appear!
    if (isSent) {
      const regRes = await pool.query(`
        SELECT 
          item_code, code_type, code_name_ar, code_name_en,
          description_ar, description_en, parent_item_code, parent_code_name,
          status, active_from, raw_data
        FROM eta_registered_codes
        WHERE company_id = $1
        ORDER BY active_from DESC NULLS LAST, item_code ASC
      `, [companyId]);

      for (const row of regRes.rows) {
        const itemCode = row.item_code.trim();
        const itemName = (row.code_name_en || row.code_name_ar || itemCode).trim();
        const description = (row.description_en || row.description_ar || row.parent_code_name || '').trim();
        const itemType = (row.code_type || 'EGS').trim().toUpperCase();
        const status = (row.status || 'Approved').trim();
        const activeFrom = row.active_from ? new Date(row.active_from).toISOString() : null;

        aggregatedItems.set(itemCode, {
          itemCode,
          itemType,
          itemName,
          description,
          unitType: 'قطعة',
          lastUnitPrice: 0,
          docUuids: new Set<string>(),
          totalQuantity: 0,
          totalAmount: 0,
          lastDocDate: activeFrom,
          supplierTaxNumber: row.raw_data?.ownerTaxpayer?.rin || '',
          supplierName: status === 'Approved' ? 'كود معتمد بالمنظومة (EGS)' : `كود ${status} بالمنظومة`,
          suppliersMap: new Map(),
          status,
          activeFrom
        });
      }
    }

    for (const row of docsRes.rows) {
      totalInvoicedAmount += Number(row.total_amount || 0);

      const rawDataObj = row.raw_data;
      if (!rawDataObj) continue;

      const docPartnerId = (isSent 
        ? (row.receiver_id || rawDataObj?.receiver?.id || '')
        : (row.issuer_id || rawDataObj?.issuer?.id || '')).trim();
      const docPartnerName = (isSent
        ? (row.receiver_name || rawDataObj?.receiver?.name || '')
        : (row.issuer_name || rawDataObj?.issuer?.name || '')).trim();

      const docIssuerId = docPartnerId;
      const docIssuerName = docPartnerName;

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
          if (unitType) existing.unitType = unitType;
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

          if (!existing.sampleDocument) {
            existing.sampleDocument = {
              uuid: row.uuid,
              internalId: row.internal_id || '',
              issuerName: row.issuer_name || '',
              issuerId: row.issuer_id || '',
              date: row.date_time_issued ? new Date(row.date_time_issued).toISOString() : ''
            };
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
      SELECT id, name, code, barcode, tax_item_code, tax_code_type, eta_item_code, eta_code_type, unit, sale_price, cost_price, stock
      FROM products
      WHERE company_id = $1
    `, [companyId]);

    const erpProductsByTaxCode = new Map<string, any>(); // Received mapping code
    const erpProductsByEtaCode = new Map<string, any>(); // Upload/sales code
    const erpProductsByInternalCode = new Map<string, any>();
    const erpProductsByBarcode = new Map<string, any>();
    const erpProductsByName = new Map<string, any>();

    for (const p of erpProductsRes.rows) {
      if (p.tax_item_code && p.tax_item_code.trim()) {
        erpProductsByTaxCode.set(p.tax_item_code.trim(), p);
        erpProductsByTaxCode.set(this.normalizeCode(p.tax_item_code), p);
      }
      if (p.eta_item_code && p.eta_item_code.trim()) {
        erpProductsByEtaCode.set(p.eta_item_code.trim(), p);
        erpProductsByEtaCode.set(this.normalizeCode(p.eta_item_code), p);
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
        const norm = this.normalizeCode(itemCode);
        const matchByTax = erpProductsByTaxCode.get(itemCode) || erpProductsByTaxCode.get(norm);
        const matchByEta = erpProductsByEtaCode.get(itemCode) || erpProductsByEtaCode.get(norm);

        const firstMatch = isSent ? matchByEta : matchByTax;
        const firstReason = isSent ? ('eta_item_code' as const) : ('tax_item_code' as const);

        const secondMatch = isSent ? matchByTax : matchByEta;
        const secondReason = isSent ? ('tax_item_code' as const) : ('eta_item_code' as const);

        if (firstMatch) {
          autoMatchedProduct = {
            id: firstMatch.id,
            name: firstMatch.name,
            code: firstMatch.code,
            taxItemCode: firstMatch.tax_item_code,
            taxCodeType: firstMatch.tax_code_type,
            etaItemCode: firstMatch.eta_item_code,
            etaCodeType: firstMatch.eta_code_type,
            barcode: firstMatch.barcode,
            matchReason: firstReason
          };
          autoMatchCount++;
        } else if (secondMatch) {
          autoMatchedProduct = {
            id: secondMatch.id,
            name: secondMatch.name,
            code: secondMatch.code,
            taxItemCode: secondMatch.tax_item_code,
            taxCodeType: secondMatch.tax_code_type,
            etaItemCode: secondMatch.eta_item_code,
            etaCodeType: secondMatch.eta_code_type,
            barcode: secondMatch.barcode,
            matchReason: secondReason
          };
          autoMatchCount++;
        } else {
          // Priority 3: internal product code match
          let suffix = '';
          if (itemCode.startsWith('EG-')) {
            const parts = itemCode.split('-');
            if (parts.length >= 3) {
              suffix = parts.slice(2).join('-');
            }
          }

          const matchByCode = erpProductsByInternalCode.get(itemCode) || 
            erpProductsByInternalCode.get(norm) ||
            (suffix ? (erpProductsByInternalCode.get(suffix) || erpProductsByInternalCode.get(this.normalizeCode(suffix))) : null);

          if (matchByCode) {
            autoMatchedProduct = {
              id: matchByCode.id,
              name: matchByCode.name,
              code: matchByCode.code,
              taxItemCode: matchByCode.tax_item_code,
              taxCodeType: matchByCode.tax_code_type,
              etaItemCode: matchByCode.eta_item_code,
              etaCodeType: matchByCode.eta_code_type,
              barcode: matchByCode.barcode,
              matchReason: 'code' as const
            };
            autoMatchCount++;
          } else {
            // Priority 4: barcode match
            const matchByBarcode = erpProductsByBarcode.get(itemCode) || 
              erpProductsByBarcode.get(norm) ||
              (suffix ? (erpProductsByBarcode.get(suffix) || erpProductsByBarcode.get(this.normalizeCode(suffix))) : null);

            if (matchByBarcode) {
              autoMatchedProduct = {
                id: matchByBarcode.id,
                name: matchByBarcode.name,
                code: matchByBarcode.code,
                taxItemCode: matchByBarcode.tax_item_code,
                taxCodeType: matchByBarcode.tax_code_type,
                etaItemCode: matchByBarcode.eta_item_code,
                etaCodeType: matchByBarcode.eta_code_type,
                barcode: matchByBarcode.barcode,
                matchReason: 'barcode' as const
              };
              autoMatchCount++;
            } else if (agg.itemName && erpProductsByName.get(agg.itemName.toLowerCase())) {
              // Priority 5: Exact name match
              const matchByName = erpProductsByName.get(agg.itemName.toLowerCase());
              autoMatchedProduct = {
                id: matchByName.id,
                name: matchByName.name,
                code: matchByName.code,
                taxItemCode: matchByName.tax_item_code,
                taxCodeType: matchByName.tax_code_type,
                etaItemCode: matchByName.eta_item_code,
                etaCodeType: matchByName.eta_code_type,
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
        autoMatchedProduct,
        status: agg.status,
        activeFrom: agg.activeFrom
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
          description: row.notes || '',
          unitType: row.product_unit || 'قطعة',
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
    notes?: string,
    direction: 'Received' | 'Sent' = 'Received'
  ): Promise<{ success: boolean; message: string }> {
    if (!companyId || !etaItemCode || !productId) {
      throw new Error('بيانات الربط غير مكتملة (كود الصنف ومعرف المنتج مطلوبان).');
    }

    const cleanItemCode = etaItemCode.trim();
    const cleanItemType = (etaItemType || 'EGS').trim().toUpperCase();
    const cleanItemName = (etaItemName || '').trim() || null;
    const isSent = direction === 'Sent';
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

    // 2. Update product based on direction
    if (isSent) {
      await pool.query(`
        UPDATE products
        SET 
          eta_item_code = $1,
          eta_code_type = $2,
          tax_item_code = COALESCE(NULLIF(tax_item_code, ''), $1),
          tax_code_type = COALESCE(NULLIF(tax_code_type, ''), $2)
        WHERE id = $3 AND company_id = $4
      `, [cleanItemCode, cleanItemType, productId, companyId]);
    } else {
      await pool.query(`
        UPDATE products
        SET 
          tax_item_code = $1,
          tax_code_type = $2,
          eta_item_code = COALESCE(NULLIF(eta_item_code, ''), $1),
          eta_code_type = COALESCE(NULLIF(eta_code_type, ''), $2)
        WHERE id = $3 AND company_id = $4
      `, [cleanItemCode, cleanItemType, productId, companyId]);
    }

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
  public static async bulkLinkAutoMatched(
    companyId: string,
    direction: 'Received' | 'Sent' = 'Received'
  ): Promise<{
    success: boolean;
    linkedCount: number;
    message: string;
  }> {
    const { items } = await this.getItemMappings(companyId, { direction });

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
          `ربط تلقائي مطابق لـ ${item.autoMatchedProduct.matchReason}`,
          direction
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
