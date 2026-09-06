import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { X, Printer, Download, FileText, Settings, Sliders } from 'lucide-react';
import { TemplateRenderer, normalizeDocumentData, parseTemplateLayout } from './TemplateRenderer';
import { useNotification } from '../contexts/NotificationContext';
import { PaperSize, Template, PrintProfile } from '../types';

const DEFAULT_TEMPLATE_LAYOUT = {
  headerHeight: 75,
  footerHeight: 45,
  watermarkOpacity: 0.15,
  watermarkRotation: -45,
  header: [
    {
      id: 'logo-default',
      type: 'logo',
      x: 10,
      y: 6,
      width: 40,
      height: 20,
      properties: { align: 'center' }
    },
    {
      id: 'title-default',
      type: 'text',
      x: 110,
      y: 6,
      width: 80,
      height: 10,
      properties: {
        text: 'فاتورة مبيعات',
        fontSize: 20,
        bold: true,
        align: 'right',
        color: '#0f172a',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'inv-num-date-val',
      type: 'variable',
      x: 100,
      y: 17,
      width: 90,
      height: 6,
      properties: {
        fontSize: 10,
        bold: true,
        align: 'right',
        color: '#1e293b',
        fontFamily: 'Cairo'
      },
      binding: 'invoice_number'
    },
    {
      id: 'line-div-top',
      type: 'line',
      x: 10,
      y: 26,
      width: 190,
      height: 1,
      properties: {
        borderWidth: 0.8,
        borderColor: '#e2e8f0'
      }
    },
    {
      id: 'summary-rect',
      type: 'rectangle',
      x: 10,
      y: 30,
      width: 75,
      height: 38,
      properties: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 6
      }
    },
    {
      id: 'summary-title',
      type: 'text',
      x: 14,
      y: 33,
      width: 67,
      height: 5,
      properties: {
        text: 'ملخص الفاتورة',
        fontSize: 10,
        bold: true,
        align: 'right',
        color: '#059669',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'nettotal-row',
      type: 'variable',
      x: 14,
      y: 54,
      width: 67,
      height: 6,
      properties: {
        text: 'الصافي النهائي:',
        fontSize: 10,
        bold: true,
        align: 'right',
        color: '#059669',
        fontFamily: 'Cairo'
      },
      binding: 'net_total'
    },
    {
      id: 'customer-row',
      type: 'variable',
      x: 95,
      y: 31,
      width: 95,
      height: 6,
      properties: {
        text: 'العميل:',
        fontSize: 11,
        bold: true,
        align: 'right',
        color: '#0f172a',
        fontFamily: 'Cairo'
      },
      binding: 'customer_name'
    },
    {
      id: 'tax-row',
      type: 'variable',
      x: 95,
      y: 39,
      width: 95,
      height: 5,
      properties: {
        text: 'الرقم الضريبي:',
        fontSize: 9.5,
        bold: true,
        align: 'right',
        color: '#334155',
        fontFamily: 'Cairo'
      },
      binding: 'customer_tax_number'
    },
    {
      id: 'payment-row',
      type: 'variable',
      x: 95,
      y: 46,
      width: 95,
      height: 5,
      properties: {
        text: 'طريقة الدفع:',
        fontSize: 9,
        align: 'right',
        color: '#334155',
        fontFamily: 'Cairo'
      },
      binding: 'payment_method'
    },
    {
      id: 'due-row',
      type: 'variable',
      x: 95,
      y: 53,
      width: 95,
      height: 5,
      properties: {
        text: 'تاريخ الاستحقاق:',
        fontSize: 9,
        align: 'right',
        color: '#334155',
        fontFamily: 'Cairo'
      },
      binding: 'due_date'
    },
    {
      id: 'branch-row',
      type: 'variable',
      x: 95,
      y: 60,
      width: 95,
      height: 5,
      properties: {
        text: 'الفرع:',
        fontSize: 9,
        align: 'right',
        color: '#64748b',
        fontFamily: 'Cairo'
      },
      binding: 'branch_name'
    },
    {
      id: 'line-div-bottom',
      type: 'line',
      x: 10,
      y: 71,
      width: 190,
      height: 1,
      properties: {
        borderWidth: 0.8,
        borderColor: '#cbd5e1'
      }
    }
  ],
  details: {
    columns: [
      { id: 'product_code', label: 'كود الصنف', field: 'product_code', width: 14 },
      { id: 'product_name', label: 'الصنف', field: 'product_name', width: 38 },
      { id: 'quantity', label: 'الكمية', field: 'quantity', width: 10 },
      { id: 'unit_price', label: 'السعر', field: 'unit_price', width: 12 },
      { id: 'vat_rate', label: 'نسبة الضريبة', field: 'vat_rate', width: 13 },
      { id: 'vat_amount', label: 'الضريبة', field: 'vat_amount', width: 10 },
      { id: 'total', label: 'الإجمالي', field: 'total', width: 14 }
    ],
    properties: {
      fontSize: 9.5,
      borderColor: '#cbd5e1',
      boldHeader: true,
      headerBgColor: '#f8fafc',
      bodyBgColor: '#ffffff',
      borderWidth: 1,
      paddingX: 2,
      paddingY: 2,
      rowHeight: 8,
      fontFamily: 'Cairo'
    }
  },
  footer: [
    {
      id: 'cust-sig-line',
      type: 'line',
      x: 120,
      y: 10,
      width: 60,
      height: 1,
      properties: {
        borderWidth: 0.8,
        borderColor: '#cbd5e1'
      }
    },
    {
      id: 'cust-sig-text',
      type: 'text',
      x: 120,
      y: 13,
      width: 60,
      height: 6,
      properties: {
        text: 'توقيع العميل',
        fontSize: 10,
        bold: true,
        align: 'center',
        color: '#0f172a',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'acc-sig-line',
      type: 'line',
      x: 20,
      y: 10,
      width: 60,
      height: 1,
      properties: {
        borderWidth: 0.8,
        borderColor: '#cbd5e1'
      }
    },
    {
      id: 'acc-sig-text',
      type: 'text',
      x: 20,
      y: 13,
      width: 60,
      height: 6,
      properties: {
        text: 'توقيع المحاسب',
        fontSize: 10,
        bold: true,
        align: 'center',
        color: '#0f172a',
        fontFamily: 'Cairo'
      }
    }
  ]
};

export function UnifiedPrintEngine() {
  const { dir, language } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const toast = {
    success: (msg: string) => showNotification(msg, 'success'),
    error: (msg: string) => showNotification(msg, 'error'),
    info: (msg: string) => showNotification(msg, 'info')
  };

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [operationType, setOperationType] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [documentData, setDocumentData] = useState<any>(null);
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [printProfiles, setPrintProfiles] = useState<PrintProfile[]>([]);
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([]);
  const [company, setCompany] = useState<any>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<PrintProfile | null>(null);

  useEffect(() => {
    const handlePrintEvent = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { operationType: opType, documentId: docId, templateId, profileId } = customEvent.detail;
      
      setOperationType(opType);
      setDocumentId(docId);
      setIsOpen(true);
      setLoading(true);

      try {
        // Fetch core data
        const [docVal, allTemplates, allProfiles, allSizes, companyData] = await Promise.all([
          dbService.get<any>(opType, docId),
          dbService.list<Template>('templates', user?.company_id || ''),
          dbService.list<PrintProfile>('print_profiles', user?.company_id || ''),
          dbService.list<PaperSize>('paper_sizes', user?.company_id || ''),
          user?.company_id ? dbService.get<any>('companies', user.company_id) : Promise.resolve(null)
        ]);

        setDocumentData(docVal);
        setPaperSizes(allSizes);
        setCompany(companyData);

        // Strict document_type matching function to prevent mixing sales vs purchase templates
        const isSameDocumentType = (op: string, tDoc: string) => {
          if (!op || !tDoc) return false;
          if (op === tDoc) return true;
          
          const norm = (s: string) => (s || '').toLowerCase().replace(/s$/, '').replace(/_s$/, '');
          const nOp = norm(op);
          const nT = norm(tDoc);
          if (nOp === nT) return true;

          const isSalesInv = (s: string) => s === 'invoices' || s === 'invoice' || s === 'sales_invoices' || s === 'sales_invoice';
          const isPurchInv = (s: string) => s === 'purchase_invoices' || s === 'purchase_invoice';
          const isSalesOrd = (s: string) => s === 'sales_orders' || s === 'sales_order';
          const isPurchOrd = (s: string) => s === 'purchase_orders' || s === 'purchase_order';
          const isSalesRet = (s: string) => s === 'returns' || s === 'return' || s === 'sales_returns' || s === 'sales_return';
          const isPurchRet = (s: string) => s === 'purchase_returns' || s === 'purchase_return';

          if (isSalesInv(op) && isSalesInv(tDoc)) return true;
          if (isPurchInv(op) && isPurchInv(tDoc)) return true;
          if (isSalesOrd(op) && isSalesOrd(tDoc)) return true;
          if (isPurchOrd(op) && isPurchOrd(tDoc)) return true;
          if (isSalesRet(op) && isSalesRet(tDoc)) return true;
          if (isPurchRet(op) && isPurchRet(tDoc)) return true;

          return false;
        };

        // Filter templates by strict document type & status
        const matchedTemplates = allTemplates.filter(t => {
          if (!t.is_active) return false;
          return isSameDocumentType(opType, t.document_type);
        });
        setTemplates(matchedTemplates);
        setPrintProfiles(allProfiles);

        // 1. Resolve Template (Always force pristine System Default Template)
        let activeTemplate: Template | null = null;
        if (templateId && templateId !== 'default' && templateId !== 'system') {
          activeTemplate = matchedTemplates.find(t => t.id === templateId && !t.is_system) || null;
        }

        if (!activeTemplate) {
          activeTemplate = matchedTemplates.find(t => t.is_system) || {
            id: 'default-system-invoice',
            company_id: user?.company_id || '',
            name: language === 'ar' ? 'قالب النظام الافتراضي' : 'Default System Template',
            description: 'Pristine original system invoice layout',
            paper_size_id: 'a4',
            orientation: 'portrait',
            margin_top: 10,
            margin_bottom: 10,
            margin_left: 10,
            margin_right: 10,
            is_default: true,
            is_system: true,
            is_active: true,
            document_type: opType,
            layout: DEFAULT_TEMPLATE_LAYOUT,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        setSelectedTemplate(activeTemplate);

        // Fallback Template if none exists
        if (!activeTemplate) {
          activeTemplate = {
            id: 'fallback',
            company_id: user?.company_id || '',
            name: language === 'ar' ? 'قالب النظام الافتراضي' : 'Default System Template',
            description: 'Fallback print layout',
            paper_size_id: 'a4',
            orientation: 'portrait',
            margin_top: 10,
            margin_bottom: 10,
            margin_left: 10,
            margin_right: 10,
            is_active: true,
            layout: DEFAULT_TEMPLATE_LAYOUT
          };
        }
        setSelectedTemplate(activeTemplate);

        // 2. Resolve Print Profile
        let activeProfile: PrintProfile | null = null;
        if (profileId) {
          activeProfile = allProfiles.find(p => p.id === profileId) || null;
        }
        if (!activeProfile && activeTemplate.print_profile_id) {
          activeProfile = allProfiles.find(p => p.id === activeTemplate!.print_profile_id) || null;
        }
        setSelectedProfile(activeProfile);

      } catch (err) {
        console.error('UnifiedPrintEngine failed to load document:', err);
        showNotification(language === 'ar' ? 'فشل تحميل بيانات الطباعة' : 'Failed to load printing records', 'error');
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener('erp-print-document', handlePrintEvent);
    return () => window.removeEventListener('erp-print-document', handlePrintEvent);
  }, [user, language]);

  // When selected template changes, auto-resolve profile
  useEffect(() => {
    if (selectedTemplate) {
      const profile = printProfiles.find(p => p.id === selectedTemplate.print_profile_id) || null;
      setSelectedProfile(profile);
    }
  }, [selectedTemplate, printProfiles]);

  if (!isOpen) return null;

  // Resolve layout dimensions (either from Profile or Template)
  const activePaperSizeId = selectedProfile ? selectedProfile.paper_size_id : (selectedTemplate?.paper_size_id || 'a4');
  const activeOrientation = selectedProfile ? selectedProfile.orientation : (selectedTemplate?.orientation || 'portrait');
  const activeMargins = selectedProfile 
    ? {
        top: Number(selectedProfile.margin_top),
        bottom: Number(selectedProfile.margin_bottom),
        left: Number(selectedProfile.margin_left),
        right: Number(selectedProfile.margin_right)
      }
    : {
        top: Number(selectedTemplate?.margin_top ?? 10),
        bottom: Number(selectedTemplate?.margin_bottom ?? 10),
        left: Number(selectedTemplate?.margin_left ?? 10),
        right: Number(selectedTemplate?.margin_right ?? 10)
      };

  const getDimensionMm = () => {
    if (activePaperSizeId === 'custom') {
      const w = selectedProfile ? Number(selectedProfile.custom_width || 210) : Number((selectedTemplate as any)?.customWidth || 210);
      const h = selectedProfile ? Number(selectedProfile.custom_height || 297) : Number((selectedTemplate as any)?.customHeight || 297);
      return { width: w, height: h };
    }
    
    // Find preset size
    const preset = paperSizes.find(p => p.id === activePaperSizeId);
    if (preset) {
      return { width: Number(preset.width), height: Number(preset.height) };
    }

    // Default presets map
    const defaultSizes: { [key: string]: { width: number, height: number } } = {
      a3: { width: 297, height: 420 },
      a4: { width: 210, height: 297 },
      a5: { width: 148, height: 210 },
      a6: { width: 105, height: 148 },
      letter: { width: 215.9, height: 279.4 },
      legal: { width: 215.9, height: 355.6 },
      thermal_80: { width: 80, height: 297 },
      thermal_58: { width: 58, height: 297 }
    };

    return defaultSizes[activePaperSizeId] || { width: 210, height: 297 };
  };

  const { width: paperWidthMm, height: paperHeightMm } = getDimensionMm();

  // Swap width and height if landscape
  const actualWidthMm = activeOrientation === 'landscape' ? paperHeightMm : paperWidthMm;
  const actualHeightMm = activeOrientation === 'landscape' ? paperWidthMm : paperHeightMm;

  const titleText = documentData 
    ? `${language === 'ar' ? 'طباعة مستند' : 'Print Document'} - ${documentData.invoice_number || documentData.voucher_number || documentData.entry_number || documentData.order_number || documentData.document_number || documentId}`
    : '';

  const handleGeneratePDFBlob = async (): Promise<Blob | null> => {
    if (!documentData) {
      showNotification(language === 'ar' ? 'بيانات المستند غير متوفرة' : 'No document data available', 'error');
      return null;
    }

    const normalized = normalizeDocumentData(operationType, documentData, company, user);
    if (!normalized) {
      showNotification(language === 'ar' ? 'فشل معالجة البيانات' : 'Could not normalize document data', 'error');
      return null;
    }

    // ── Fetch customer/supplier tax number & products from DB if not present in invoice ──
    let resolvedCustomerTaxNumber = normalized.customer_tax_number || documentData?.customer_tax_number || documentData?.tax_number || '';
    let resolvedSupplierTaxNumber = normalized.supplier_tax_number || documentData?.supplier_tax_number || '';

    if (!resolvedCustomerTaxNumber && documentData?.customer_id) {
      try {
        const cust = await dbService.get<any>('customers', documentData.customer_id);
        resolvedCustomerTaxNumber = cust?.tax_number || cust?.vat_number || '';
      } catch (_) {}
    }
    if (!resolvedSupplierTaxNumber && documentData?.supplier_id) {
      try {
        const supp = await dbService.get<any>('suppliers', documentData.supplier_id);
        resolvedSupplierTaxNumber = supp?.tax_number || supp?.vat_number || '';
      } catch (_) {}
    }

    let dbProducts: any[] = [];
    try {
      dbProducts = await dbService.listAll<any>('products');
      if (typeof window !== 'undefined') {
        (window as any).__PRODUCTS_CACHE__ = dbProducts;
      }
    } catch (_) {}

    const resolveItemCode = (itm: any): string => {
      const candidates = [(itm as any).product_code, (itm as any).code, (itm as any).sku, (itm as any).item_code, (itm as any).barcode, (itm as any).product_sku];
      for (const c of candidates) {
        if (c !== undefined && c !== null) {
          const str = String(c).trim();
          if (str !== '' && str !== '-') {
            return str;
          }
        }
      }
      if (dbProducts && dbProducts.length > 0) {
        const matched = dbProducts.find((p: any) =>
          (p.id && (itm as any).product_id && String(p.id) === String((itm as any).product_id)) ||
          (p.name && itm.product_name && String(p.name).trim() === String(itm.product_name).trim()) ||
          (p.title && itm.product_name && String(p.title).trim() === String(itm.product_name).trim())
        );
        if (matched) {
          const matchedCode = matched.code || matched.barcode || matched.sku || matched.product_code;
          if (matchedCode !== undefined && matchedCode !== null && String(matchedCode).trim() !== '') {
            return String(matchedCode).trim();
          }
        }
      }
      return '-';
    };

    const companyDto = {
      name: normalized.company_name || '',
      logoUrl: normalized.company_logo || '',
      taxNumber: normalized.company_tax_number || '',
      phone: normalized.company_phone || ''
    };

    const itemsDto = (normalized.items || []).map(itm => ({
      product_code: resolveItemCode(itm),
      product_name: String(itm.product_name || '-'),
      quantity: String(itm.quantity || '0'),
      unit: String(itm.unit || 'حبة'),
      unit_price: String(itm.unit_price || '0'),
      discount: String(itm.discount || '0'),
      vat_rate: String((itm as any).vat_rate || '0'),
      vat_amount: String(itm.vat_amount || '0'),
      total: String(itm.total || '0')
    }));

    let templateName = 'ReportTemplate';
    let dto: any = {};

    const cleanDateVal = (d: any) => {
      if (!d) return '';
      const str = String(d).trim();
      const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const [, y, m, day] = isoMatch;
        return `${parseInt(day, 10)}/${parseInt(m, 10)}/${y}`;
      }
      return str.split('T')[0].split(' ')[0];
    };

    if (operationType === 'invoices' || operationType === 'returns' || operationType === 'sales_orders') {
      templateName = 'SalesInvoicePdf';
      dto = {
        company: companyDto,
        invoice_number: normalized.document_number || '',
        date: cleanDateVal(normalized.date),
        due_date: cleanDateVal(documentData?.due_date || documentData?.payment_terms_date),
        payment_method: normalized.payment_method || '',
        customer_name: normalized.customer_name || '',
        customer_tax_number: resolvedCustomerTaxNumber,
        customer_phone: normalized.customer_phone,
        items: itemsDto,
        products: dbProducts,
        subtotal: String(normalized.subtotal || '0'),
        discount_amount: String(normalized.discount_amount || '0'),
        vat_amount: String(normalized.vat_amount || '0'),
        net_total: String(normalized.net_total || '0'),
        currency_code: normalized.currency_code || (companyDto as any).currency || 'AED',
        userName: normalized.user_name,
        branchName: normalized.branch_name,
        operation_type: operationType,
        language: language
      };
    } else if (operationType === 'purchase_invoices' || operationType === 'purchase_returns' || operationType === 'purchase_orders') {
      templateName = 'PurchaseInvoicePdf';
      dto = {
        company: companyDto,
        invoice_number: normalized.document_number || '',
        date: cleanDateVal(normalized.date),
        due_date: cleanDateVal(documentData?.due_date || documentData?.payment_terms_date),
        payment_method: normalized.payment_method || '',
        supplier_name: normalized.supplier_name || '',
        supplier_tax_number: resolvedSupplierTaxNumber,
        supplier_phone: normalized.supplier_phone,
        items: itemsDto,
        products: dbProducts,
        subtotal: String(normalized.subtotal || '0'),
        discount_amount: String(normalized.discount_amount || '0'),
        vat_amount: String(normalized.vat_amount || '0'),
        net_total: String(normalized.net_total || '0'),
        currency_code: normalized.currency_code || (companyDto as any).currency || 'AED',
        userName: normalized.user_name,
        branchName: normalized.branch_name,
        operation_type: operationType,
        language: language
      };
    } else if (operationType === 'receipt_vouchers' || operationType === 'payment_vouchers') {
      templateName = 'VoucherPdf';
      dto = {
        company: companyDto,
        voucher_number: normalized.document_number || '',
        date: normalized.date || '',
        payment_method: normalized.payment_method || '',
        party_name: normalized.customer_name || normalized.supplier_name || '',
        amount: String(normalized.net_total || '0'),
        description: documentData?.description || '',
        items: itemsDto.map(itm => ({
          account_code: itm.product_code,
          account_name: itm.product_name,
          description: itm.product_name,
          amount: itm.total
        })),
        userName: normalized.user_name,
        branchName: normalized.branch_name,
        isReceipt: operationType === 'receipt_vouchers'
      };
    } else if (operationType === 'journal_entries') {
      templateName = 'LedgerPdf';
      dto = {
        company: companyDto,
        date_from: normalized.date || '',
        date_to: normalized.date || '',
        rows: itemsDto.map(itm => ({
          date: normalized.date || '',
          entry_num: normalized.document_number || '',
          account_code: itm.product_code,
          account_name: itm.product_name,
          description: itm.product_name,
          debit: documentData?.journal_entry_lines?.find((l: any) => l.account_id === itm.product_code)?.debit || '0',
          credit: documentData?.journal_entry_lines?.find((l: any) => l.account_id === itm.product_code)?.credit || '0'
        })),
        total_debit: String(normalized.subtotal || '0'),
        total_credit: String(normalized.subtotal || '0'),
        userName: normalized.user_name,
        branchName: normalized.branch_name
      };
    }

    if (selectedTemplate && !selectedTemplate.is_system && !selectedTemplate.is_default && selectedTemplate.id !== 'fallback' && !selectedTemplate.id.startsWith('default-')) {
      dto.isCustomTemplate = true;
      const effectiveMarginTop = selectedProfile?.margin_top ?? selectedTemplate.margin_top ?? 10;
      const effectiveMarginBottom = selectedProfile?.margin_bottom ?? selectedTemplate.margin_bottom ?? 10;
      const effectiveMarginLeft = selectedProfile?.margin_left ?? selectedTemplate.margin_left ?? 10;
      const effectiveMarginRight = selectedProfile?.margin_right ?? selectedTemplate.margin_right ?? 10;

      dto.margin_top = effectiveMarginTop;
      dto.margin_bottom = effectiveMarginBottom;
      dto.margin_left = effectiveMarginLeft;
      dto.margin_right = effectiveMarginRight;

      const parsedLayout = parseTemplateLayout(selectedTemplate.layout);
      dto.customLayout = {
        ...parsedLayout,
        margins: {
          top: Number(effectiveMarginTop),
          bottom: Number(effectiveMarginBottom),
          left: Number(effectiveMarginLeft),
          right: Number(effectiveMarginRight)
        }
      };
      dto.templateId = selectedTemplate.id;
      dto.templateName = selectedTemplate.name;
      dto.paperSize = selectedProfile?.paper_size_id || selectedTemplate.paper_size_id || 'a4';
      dto.orientation = selectedProfile?.orientation || selectedTemplate.orientation || 'portrait';
    }

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch('/api/erp/print/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          templateName,
          dto
        })
      });

      if (!response.ok) {
        let serverErrorMsg = 'Failed to generate PDF';
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) serverErrorMsg = errJson.error;
        } catch (_) {}
        throw new Error(serverErrorMsg);
      }

      return await response.blob();
    } catch (e: any) {
      console.error('PDF Generation Error:', e);
      showNotification(e.message || 'Error generating PDF', 'error');
      return null;
    }
  };

  const handlePrint = async () => {
    showNotification(language === 'ar' ? 'جاري تحضير المستند للطباعة...' : 'Preparing document for print...', 'info');
    const pdfBlob = await handleGeneratePDFBlob();
    if (!pdfBlob) return;

    const blobUrl = URL.createObjectURL(pdfBlob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 300);
    };
  };

  const handleDownloadPDF = async () => {
    showNotification(language === 'ar' ? 'جاري تحضير ملف PDF...' : 'Preparing PDF file...', 'info');
    const pdfBlob = await handleGeneratePDFBlob();
    if (!pdfBlob) return;

    const normalized = normalizeDocumentData(operationType, documentData, company, user);
    const titleText = normalized?.document_number || 'document';
    const url = window.URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titleText}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showNotification(language === 'ar' ? 'تم تحضير ملف PDF بنجاح' : 'PDF generated successfully', 'success');
  };

  const normalized = selectedTemplate && documentData
    ? normalizeDocumentData(operationType, documentData, company, user)
    : null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-[1250px] h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-zinc-200" dir={dir}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Printer className="text-emerald-600 animate-pulse" size={22} />
              <span>{language === 'ar' ? 'الطباعة الموحدة للعمليات' : 'Unified Document Print Engine'}</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">{titleText}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-zinc-200/50 text-zinc-400 hover:text-zinc-700 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Options Sidebar */}
          <div className="w-80 border-r border-zinc-100 p-5 overflow-y-auto space-y-6 bg-zinc-50/30">
            {/* Template Selection */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} />
                <span>{language === 'ar' ? 'اختر القالب' : 'Print Template'}</span>
              </h3>
              
              {loading ? (
                <p className="text-xs text-zinc-400 text-center py-4">{language === 'ar' ? 'جاري تحميل القوالب...' : 'Loading templates...'}</p>
              ) : templates.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-[10px] text-amber-700 font-bold">
                    {language === 'ar' ? 'لا توجد قوالب مخصصة، تم تفعيل القالب الافتراضي.' : 'No custom templates, using default.'}
                  </p>
                </div>
              ) : (
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => {
                    const temp = templates.find(t => t.id === e.target.value) || null;
                    if (temp) setSelectedTemplate(temp);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-emerald-600/30 hover:border-emerald-600 rounded-xl text-xs font-bold text-zinc-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
                >
                  {templates.map(temp => (
                    <option key={temp.id} value={temp.id}>
                      {temp.name} {temp.is_default ? (language === 'ar' ? '(الافتراضي)' : '(Default)') : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Print Profile Info / Override */}
            <div className="space-y-3 pt-4 border-t border-zinc-100">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={14} />
                <span>{language === 'ar' ? 'ملف تعريف الطباعة' : 'Print Profile'}</span>
              </h3>

              <div className="space-y-2">
                <select
                  value={selectedProfile?.id || ''}
                  onChange={(e) => {
                    const prof = printProfiles.find(p => p.id === e.target.value) || null;
                    setSelectedProfile(prof);
                  }}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="">{language === 'ar' ? 'الافتراضي للقالب (لا يوجد ملف)' : 'Default from Template (None)'}</option>
                  {printProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                {/* Profile Details Card */}
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 text-[11px] space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{language === 'ar' ? 'حجم الورق:' : 'Paper size:'}</span>
                    <span className="font-bold text-zinc-700 capitalize">{activePaperSizeId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{language === 'ar' ? 'الاتجاه:' : 'Orientation:'}</span>
                    <span className="font-bold text-zinc-700 capitalize">
                      {activeOrientation === 'portrait' ? (language === 'ar' ? 'طولي / Portrait' : 'Portrait') : (language === 'ar' ? 'عرضي / Landscape' : 'Landscape')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{language === 'ar' ? 'الهوامش:' : 'Margins:'}</span>
                    <span className="font-bold text-zinc-700">
                      {activeMargins.top} - {activeMargins.right} - {activeMargins.bottom} - {activeMargins.left} مم
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{language === 'ar' ? 'دقة الطباعة (DPI):' : 'Print Resolution:'}</span>
                    <span className="font-bold text-zinc-700">{selectedProfile?.dpi || 300} DPI</span>
                  </div>
                  {selectedProfile?.print_settings && (
                    <div className="pt-1.5 border-t border-zinc-200/50">
                      <span className="text-[10px] text-zinc-400 font-extrabold">{language === 'ar' ? 'إعدادات إضافية:' : 'Additional settings:'}</span>
                      <pre className="text-[9px] text-zinc-500 overflow-x-auto mt-1 p-1 bg-white border border-zinc-100 rounded">
                        {JSON.stringify(selectedProfile.print_settings, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Center Area: Preview Sheet */}
          <div className="flex-1 bg-zinc-100 overflow-auto p-8 flex items-start justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-24 space-y-4">
                <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-zinc-500 text-sm font-semibold">{language === 'ar' ? 'جاري تجهيز مستند المعاينة...' : 'Preparing preview document...'}</span>
              </div>
            ) : selectedTemplate && normalized ? (
              <div id="unified-print-capture-area" className="bg-white shadow-xl">
                <TemplateRenderer
                  layout={(selectedTemplate.is_default || selectedTemplate.is_system) ? DEFAULT_TEMPLATE_LAYOUT : (selectedTemplate.layout || DEFAULT_TEMPLATE_LAYOUT)}
                  data={normalized}
                  scale={2.2} // Stable preview scale
                  margin={activeMargins}
                  width={actualWidthMm}
                  height={actualHeightMm}
                  dir={dir}
                />
              </div>
            ) : (
              <p className="text-sm text-zinc-400 py-12">{language === 'ar' ? 'لا توجد بيانات للمعاينة.' : 'No data available for preview.'}</p>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-all"
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-800 text-white px-5 py-2.5 rounded-xl hover:bg-zinc-950 transition-all font-bold text-sm shadow-md disabled:opacity-50"
          >
            <Download size={16} />
            <span>{language === 'ar' ? 'تحميل PDF' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-md disabled:opacity-50"
          >
            <Printer size={16} />
            <span>{language === 'ar' ? 'طباعة مباشرة' : 'Print Now'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
