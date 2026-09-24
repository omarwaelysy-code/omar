import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';
import { dbService, apiRequest } from '../services/dbService';
import { PostingService } from '../services/PostingService';
import { formatNumber, formatMoney } from '../utils/formatUtils';
import { Customer, Supplier, Product, Warehouse, PaymentMethod, Account } from '../types';
import { 
  FileSpreadsheet, UploadCloud, Download, CheckCircle2, AlertTriangle, 
  Trash2, Edit3, ChevronDown, ChevronUp, FileText, ArrowUpFromLine, 
  ArrowDownToLine, RotateCcw, Hash, Calendar, Layers, ShieldCheck, 
  X, Check, RefreshCw, Eye, Sparkles, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DocumentImportProps {
  type: 'sales' | 'purchases';
}

interface ParsedItem {
  id: string;
  rowIndex: number;
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  withholding_tax_rate: number;
  withholding_tax_amount: number;
  total: number;
  description?: string;
  is_service?: boolean;
}

interface ParsedDocument {
  ref: string;
  doc_type: string;
  date: string;
  party_id: string;
  party_name: string;
  party_code?: string;
  warehouse_id?: string | null;
  warehouse_name?: string;
  payment_type: 'cash' | 'credit';
  payment_method_id?: string;
  notes?: string;
  items: ParsedItem[];
  // Calculated totals
  gross_total: number;
  discount_amount: number;
  subtotal: number;
  tax_amount: number;
  withholding_tax_amount: number;
  total_amount: number;
  // Execution status
  status?: 'pending' | 'saved' | 'failed';
  created_document_id?: string;
  created_document_number?: string;
  created_journal_id?: string;
  created_journal_number?: string;
  error_message?: string;
  is_all_services?: boolean;
}

interface ValidationError {
  rowNumber: number;
  ref: string;
  field: string;
  message: string;
}

export const DocumentImport: React.FC<DocumentImportProps> = ({ type }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { language, dir } = useLanguage();
  const { openTab, setPendingViewDoc } = useNavigation();

  const isSales = type === 'sales';
  const entityLabel = isSales ? 'العميل' : 'المورد';
  const pageTitle = isSales ? 'استيراد مستندات بيع من إكسيل' : 'استيراد مستندات شراء من إكسيل';
  const sequenceModuleName = isSales ? 'sales_import_batches' : 'purchases_import_batches';

  // Master data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(true);

  // Batch header info
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [isGeneratingBatchNumber, setIsGeneratingBatchNumber] = useState(true);

  // Upload & parse state
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [documents, setDocuments] = useState<ParsedDocument[]>([]);
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});

  // Edit item modal state
  const [editingItem, setEditingItem] = useState<{ docRef: string; item: ParsedItem } | null>(null);

  // Save / Post state
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; statusText: string } | null>(null);
  const [isBatchSaved, setIsBatchSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Company Tax Settings
  const isVatEnabled = companySettings?.vat_enabled !== false;
  const isWhtEnabled = companySettings?.wht_enabled !== false && (isSales ? companySettings?.sales_wht_enabled !== false : companySettings?.purchase_wht_enabled !== false);

  // Load master data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!user?.company_id) return;
      setIsLoadingMasterData(true);
      try {
        const [
          custs,
          supps,
          prods,
          whs,
          pms,
          accs,
          compRes
        ] = await Promise.all([
          dbService.list<Customer>('customers', { company_id: user.company_id }),
          dbService.list<Supplier>('suppliers', { company_id: user.company_id }),
          dbService.list<Product>('products', { company_id: user.company_id }),
          dbService.list<Warehouse>('warehouses', { company_id: user.company_id }),
          dbService.list<PaymentMethod>('payment_methods', { company_id: user.company_id }),
          dbService.list<Account>('accounts', { company_id: user.company_id }),
          dbService.get<any>('companies', user.company_id).catch(() => null)
        ]);

        setCustomers(custs || []);
        setSuppliers(supps || []);
        setProducts(prods || []);
        setWarehouses(whs || []);
        setPaymentMethods(pms || []);
        setAccounts(accs || []);
        setCompanySettings(compRes?.settings || {});
      } catch (err: any) {
        console.error('Failed to load master data:', err);
        showNotification('فشل تحميل البيانات الأساسية للمطابقة: ' + err.message, 'error');
      } finally {
        setIsLoadingMasterData(false);
      }
    };

    loadData();
  }, [user?.company_id]);

  // Generate permanent Batch Number on initial mount
  useEffect(() => {
    let isMounted = true;
    const fetchBatchSequence = async () => {
      if (!user?.company_id) return;
      setIsGeneratingBatchNumber(true);
      try {
        const next = await dbService.getNextSequence(sequenceModuleName, batchDate);
        if (isMounted) {
          setBatchNumber(next);
        }
      } catch (err: any) {
        console.error('Failed to fetch batch sequence:', err);
        const fallbackPrefix = isSales ? 'Batch-sal' : 'Batch-pur';
        const parts = batchDate.split('-');
        if (isMounted) {
          setBatchNumber(`${fallbackPrefix}-${parts[0] || '2026'}-${parts[1] || '09'}-00001`);
        }
      } finally {
        if (isMounted) setIsGeneratingBatchNumber(false);
      }
    };

    fetchBatchSequence();
    return () => {
      isMounted = false;
    };
  }, [user?.company_id, sequenceModuleName]);

  // Navigation to created document
  const handleNavigateToDocument = (doc: ParsedDocument) => {
    const docIdOrNum = doc.created_document_number || doc.created_document_id;
    if (!docIdOrNum) return;

    if (doc.doc_type === 'فاتورة بيع') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: docIdOrNum });
      openTab('invoices', 'فواتير المبيعات');
    } else if (doc.doc_type === 'أمر بيع') {
      setPendingViewDoc({ type: 'sales_order', idOrNumber: docIdOrNum });
      openTab('sales_orders', 'أوامر البيع');
    } else if (doc.doc_type === 'مرتجع بيع') {
      setPendingViewDoc({ type: 'return', idOrNumber: docIdOrNum });
      openTab('returns', 'مرتجعات المبيعات');
    } else if (doc.doc_type === 'فاتورة شراء') {
      setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: docIdOrNum });
      openTab('purchase_invoices', 'فواتير المشتريات');
    } else if (doc.doc_type === 'أمر شراء') {
      setPendingViewDoc({ type: 'purchase_order', idOrNumber: docIdOrNum });
      openTab('purchase_orders', 'أوامر الشراء');
    } else if (doc.doc_type === 'مرتجع شراء') {
      setPendingViewDoc({ type: 'purchase_return', idOrNumber: docIdOrNum });
      openTab('purchase_returns', 'مرتجعات المشتريات');
    }
  };

  // Navigation to created journal entry
  const handleNavigateToJournal = (doc: ParsedDocument) => {
    const journalIdOrNum = doc.created_journal_number || doc.created_journal_id;
    if (!journalIdOrNum) return;

    setPendingViewDoc({ type: 'journal', idOrNumber: journalIdOrNum });
    openTab('journal_entries', 'قيود اليومية');
  };

  // Recalculate document totals
  const recalculateDocTotals = (items: ParsedItem[]) => {
    let gross_total = 0;
    let discount_amount = 0;
    let subtotal = 0;
    let tax_amount = 0;
    let withholding_tax_amount = 0;
    let total_amount = 0;

    items.forEach(item => {
      gross_total += Number(item.quantity || 0) * Number(item.unit_price || 0);
      discount_amount += Number(item.discount_amount || 0);
      subtotal += Number(item.subtotal || 0);
      tax_amount += Number(item.vat_amount || 0);
      withholding_tax_amount += Number(item.withholding_tax_amount || 0);
      total_amount += Number(item.total || 0);
    });

    return {
      gross_total: Number(gross_total.toFixed(2)),
      discount_amount: Number(discount_amount.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      tax_amount: Number(tax_amount.toFixed(2)),
      withholding_tax_amount: Number(withholding_tax_amount.toFixed(2)),
      total_amount: Number(total_amount.toFixed(2))
    };
  };

  // Three separate summaries for Invoices, Orders, and Returns
  const computeSummaryForType = (typeKeywords: string[]) => {
    const filteredDocs = documents.filter(d => 
      typeKeywords.some(kw => d.doc_type.includes(kw))
    );

    let gross = 0;
    let discount = 0;
    let subtotal = 0;
    let vat = 0;
    let wht = 0;
    let net = 0;
    let totalItems = 0;

    filteredDocs.forEach(d => {
      gross += d.gross_total;
      discount += d.discount_amount;
      subtotal += d.subtotal;
      vat += d.tax_amount;
      wht += d.withholding_tax_amount;
      net += d.total_amount;
      totalItems += d.items.length;
    });

    return {
      count: filteredDocs.length,
      totalItems,
      gross: Number(gross.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      vat: Number(vat.toFixed(2)),
      wht: Number(wht.toFixed(2)),
      net: Number(net.toFixed(2))
    };
  };

  const invoicesSummary = useMemo(() => computeSummaryForType(['فاتورة']), [documents]);
  const ordersSummary = useMemo(() => computeSummaryForType(['أمر']), [documents]);
  const returnsSummary = useMemo(() => computeSummaryForType(['مرتجع']), [documents]);

  // Download comprehensive explanation template with realistic examples
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const sampleVatRate = isVatEnabled ? 14 : 0;
    const sampleWhtRate = isWhtEnabled ? 1 : 0;

    // Sheet 1: Explanation & Guidelines
    const guideRows = [
      ['دليل واستراتيجية استيراد مستندات ' + (isSales ? 'المبيعات' : 'المشتريات') + ' من الإكسيل'],
      ['يرجى قراءة الإرشادات التالية بدقة لتجنب أي أخطاء أثناء رفع الملف:'],
      [''],
      ['1. رقم المرجع (Ref):', 'يمثل رقم المرجع (مثال: Ref-000001) المعرف الموحد للمستند. في حالة احتواء الفاتورة على أكثر من صنف، يتم تكرار نفس رقم المرجع في جميع صفوف تلك الفاتورة.'],
      ['2. نوع المستند:', isSales ? 'يجب أن يكون أحد الأنواع الثلاثة التالية تماماً: (فاتورة بيع / أمر بيع / مرتجع بيع).' : 'يجب أن يكون أحد الأنواع الثلاثة التالية تماماً: (فاتورة شراء / أمر شراء / مرتجع شراء).'],
      ['3. التاريخ:', 'تاريخ المستند بصيغة (YYYY-MM-DD) مثل 2026-09-24.'],
      ['4. كود أو اسم ' + entityLabel + ':', 'يجب إدخال كود ' + entityLabel + ' أو اسمه المسجل في النظام بدقة للمطابقة التلقائية.'],
      ['5. كود الصنف أو الباركود:', 'يجب إدخال كود الصنف أو الباركود أو اسم الصنف المسجل بالنظام.'],
      ['6. اسم الصنف:', 'حقل اختياري للاسترشاد، يقوم النظام بجلب بيانات الصنف الأساسية تلقائياً من الكود.'],
      ['7. المخزن والأصناف الخدمية:', 'المخزن إلزامي للأصناف المخزنية فقط. في حال كان الصنف خدمة (Service) فلا يلزم تحديد مخزن ولا يؤثر ذلك على حركة الأرصدة.'],
      ['8. الكمية والسعر والخصم:', 'الكمية يجب أن تكون رقماً موجباً أكبر من صفر. السعر هو سعر الوحدة قبل الضريبة والخصم. الخصم قيمة نقدية على مستوى البند (أو 0).'],
      ['9. ضريبة القيمة المضافة %:', isVatEnabled ? 'النسبة المئوية لضريبة القيمة المضافة مثل 14 أو 0 (النظام مفعل له ض.ق.م).' : 'ضريبة القيمة المضافة معطلة في إعدادات الشركة الحالية (تكون 0%).'],
      ['10. ضريبة الخصم والإضافة %:', isWhtEnabled ? 'النسبة المئوية لضريبة الخصم والإضافة مثل 1 أو 0 (النظام مفعل له ض.خ.أ).' : 'ضريبة الخصم والإضافة معطلة في إعدادات الشركة الحالية (تكون 0%).'],
      ['11. طريقة الدفع:', 'إما (آجل) أو (نقدي). إذا كانت نقدي، يمكن تحديد اسم الخزينة / طريقة الدفع.'],
      ['12. تكرار بيانات المستند:', 'يجب تكرار بيانات الفاتورة (رقم المرجع، النوع، التاريخ، ' + entityLabel + ') في كل سطر يحتوي على صنف لنفس الفاتورة.'],
      ['']
    ];

    const guideWs = XLSX.utils.aoa_to_sheet(guideRows);
    guideWs['!cols'] = [{ wch: 32 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(wb, guideWs, 'دليل التعليمات');

    // Sheet 2: Data Template with examples
    const sampleParty = isSales 
      ? (customers[0]?.name || customers[0]?.code || 'عميل نقدي تجريبي')
      : (suppliers[0]?.name || suppliers[0]?.code || 'شركة التوريدات العامة');
    const sampleProd1 = products[0]?.code || 'PRD-001';
    const sampleProdName1 = products[0]?.name || 'صنف تجريبي رقم 1';
    const sampleProd2 = products[1]?.code || 'PRD-002';
    const sampleProdName2 = products[1]?.name || 'صنف تجريبي رقم 2';
    const sampleWarehouse = warehouses[0]?.name || warehouses[0]?.code || 'المخزن الرئيسي';

    const headers = [
      'Ref',
      'نوع المستند',
      'التاريخ',
      'كود العميل / المورد',
      'كود الصنف / الباركود',
      'اسم الصنف',
      'المخزن',
      'الكمية',
      'السعر',
      'الخصم',
      'نسبة ضريبة القيمة المضافة %',
      'نسبة ضريبة الخصم والاضافة %',
      'طريقة الدفع',
      'ملاحظات'
    ];

    const exampleRows = isSales ? [
      ['Ref-000001', 'فاتورة بيع', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 10, 150, 0, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة مبيعات بضاعة - صنف أول'],
      ['Ref-000001', 'فاتورة بيع', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 5, 200, 20, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة مبيعات بضاعة - صنف ثانٍ لنفس الفاتورة'],
      ['Ref-000002', 'أمر بيع', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 25, 145, 50, sampleVatRate, 0, 'آجل', 'أمر بيع معتمد للعميل'],
      ['Ref-000003', 'مرتجع بيع', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 2, 200, 0, sampleVatRate, sampleWhtRate, 'نقدي', 'مرتجع مبيعات نقدي تالف']
    ] : [
      ['Ref-000001', 'فاتورة شراء', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 50, 120, 100, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة توريد خامات - بند أول'],
      ['Ref-000001', 'فاتورة شراء', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 30, 180, 0, sampleVatRate, sampleWhtRate, 'آجل', 'فاتورة توريد خامات - بند ثانٍ'],
      ['Ref-000002', 'أمر شراء', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 100, 115, 0, sampleVatRate, 0, 'آجل', 'أمر شراء معتمد للمورد'],
      ['Ref-000003', 'مرتجع شراء', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 5, 180, 0, sampleVatRate, sampleWhtRate, 'آجل', 'مرتجع مشتريات لعدم مطابقة المواصفات']
    ];

    const dataWs = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    dataWs['!cols'] = [
      { wch: 15 }, // Ref
      { wch: 16 }, // Document Type
      { wch: 14 }, // Date
      { wch: 25 }, // Party
      { wch: 20 }, // Product Code
      { wch: 25 }, // Product Name
      { wch: 18 }, // Warehouse
      { wch: 10 }, // Qty
      { wch: 12 }, // Price
      { wch: 10 }, // Discount
      { wch: 16 }, // VAT %
      { wch: 16 }, // WHT %
      { wch: 14 }, // Payment Type
      { wch: 30 }  // Notes
    ];

    XLSX.utils.book_append_sheet(wb, dataWs, 'بيانات المستندات');

    const downloadFileName = isSales 
      ? `نموذج_استيراد_مستندات_البيع_${batchDate}.xlsx`
      : `نموذج_استيراد_مستندات_الشراء_${batchDate}.xlsx`;

    XLSX.writeFile(wb, downloadFileName);
    showNotification('تم تنزيل نموذج الإكسيل التجريبي بنجاح', 'success');
  };

  // Parse uploaded file
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setIsParsing(true);
    setValidationErrors([]);
    setDocuments([]);
    setIsBatchSaved(false);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      
      // Look for data sheet
      let targetSheetName = wb.SheetNames[0];
      if (wb.SheetNames.includes('بيانات المستندات')) {
        targetSheetName = 'بيانات المستندات';
      } else if (wb.SheetNames.length > 1 && wb.SheetNames[0].includes('دليل')) {
        targetSheetName = wb.SheetNames[1];
      }

      const ws = wb.Sheets[targetSheetName];
      if (!ws) throw new Error('لم يتم العثور على ورقة عمل صالحة في ملف الإكسيل');

      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rawRows.length < 2) {
        throw new Error('ملف الإكسيل فارغ أو لا يحتوي على صفوف بيانات بعد الهيدر');
      }

      const errors: ValidationError[] = [];
      const groupedDocs: Record<string, {
        header: {
          ref: string;
          doc_type: string;
          date: string;
          party_id: string;
          party_name: string;
          party_code?: string;
          warehouse_id?: string | null;
          warehouse_name?: string;
          payment_type: 'cash' | 'credit';
          payment_method_id?: string;
          notes?: string;
        };
        items: ParsedItem[];
      }> = {};

      const validSalesTypes = ['فاتورة بيع', 'أمر بيع', 'مرتجع بيع'];
      const validPurchaseTypes = ['فاتورة شراء', 'أمر شراء', 'مرتجع شراء'];
      const expectedDocTypes = isSales ? validSalesTypes : validPurchaseTypes;

      const defaultWh = warehouses[0];

      // Parse data rows (row index 0 is header)
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNumber = i + 1; // 1-based index in Excel

        // Ignore empty lines
        if (!row || row.every(cell => cell === '' || cell === null || cell === undefined)) {
          continue;
        }

        const rawRef = String(row[0] || '').trim();
        const rawDocType = String(row[1] || '').trim();
        const rawDate = String(row[2] || '').trim();
        const rawParty = String(row[3] || '').trim();
        const rawProdCode = String(row[4] || '').trim();
        const rawProdName = String(row[5] || '').trim();
        const rawWarehouse = String(row[6] || '').trim();
        const rawQty = row[7];
        const rawPrice = row[8];
        const rawDiscount = row[9];
        const rawVatRate = row[10];
        const rawWhtRate = row[11];
        const rawPaymentType = String(row[12] || '').trim();
        const rawNotes = String(row[13] || '').trim();

        // 1. Validate Ref
        if (!rawRef) {
          errors.push({
            rowNumber,
            ref: rawRef || 'غير محدد',
            field: 'رقم المرجع (Ref)',
            message: 'رقم المرجع (Ref) إلزامي لربط بنود المستند'
          });
        }

        // 2. Validate Document Type
        if (!rawDocType) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'نوع المستند',
            message: 'نوع المستند إلزامي'
          });
        } else if (!expectedDocTypes.includes(rawDocType)) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'نوع المستند',
            message: `نوع المستند "${rawDocType}" غير صالح. الأنواع المقبولة هي: (${expectedDocTypes.join(' - ')})`
          });
        }

        // 3. Validate Date
        let parsedDate = batchDate;
        if (rawDate) {
          const d = new Date(rawDate);
          if (isNaN(d.getTime())) {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: 'التاريخ',
              message: `تاريخ المستند "${rawDate}" غير صالح. يرجى استخدام صيغة YYYY-MM-DD`
            });
          } else {
            parsedDate = rawDate.slice(0, 10);
          }
        }

        // 4. Validate Party (Customer / Supplier)
        let matchedParty: any = null;
        if (!rawParty) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: entityLabel,
            message: `كود أو اسم ${entityLabel} إلزامي`
          });
        } else {
          if (isSales) {
            matchedParty = customers.find(c => 
              (c.code && c.code.toLowerCase() === rawParty.toLowerCase()) ||
              (c.name && c.name.trim().toLowerCase() === rawParty.toLowerCase()) ||
              (c.tax_number && c.tax_number === rawParty)
            );
          } else {
            matchedParty = suppliers.find(s => 
              (s.code && s.code.toLowerCase() === rawParty.toLowerCase()) ||
              (s.name && s.name.trim().toLowerCase() === rawParty.toLowerCase()) ||
              (s.tax_number && s.tax_number === rawParty)
            );
          }

          if (!matchedParty) {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: entityLabel,
              message: `${entityLabel} "${rawParty}" غير مسجل في دليل ${entityLabel}ين للنظام`
            });
          }
        }

        // 5. Validate Product
        let matchedProduct: Product | undefined;
        if (!rawProdCode && !rawProdName) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'الصنف',
            message: 'كود الصنف أو الباركود أو اسم الصنف إلزامي'
          });
        } else {
          matchedProduct = products.find(p => 
            (rawProdCode && p.code && p.code.toLowerCase() === rawProdCode.toLowerCase()) ||
            (rawProdCode && p.barcode && p.barcode.toLowerCase() === rawProdCode.toLowerCase()) ||
            (rawProdName && p.name && p.name.trim().toLowerCase() === rawProdName.toLowerCase()) ||
            (rawProdCode && p.name && p.name.trim().toLowerCase() === rawProdCode.toLowerCase())
          );

          if (!matchedProduct) {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: 'الصنف',
              message: `الصنف كود: "${rawProdCode}" اسم: "${rawProdName}" غير مسجل في دليل الأصناف`
            });
          }
        }

        // Service check: Services do NOT require warehouse and never fail on inventory
        const isServiceItem = matchedProduct?.type === 'service' || matchedProduct?.is_service === true;

        // 6. Validate Warehouse (Only for physical products)
        let matchedWarehouse: Warehouse | undefined = undefined;
        if (rawWarehouse) {
          const foundWh = warehouses.find(w => 
            w.id === rawWarehouse ||
            (w.code && w.code.toLowerCase() === rawWarehouse.toLowerCase()) ||
            (w.name && w.name.trim().toLowerCase() === rawWarehouse.toLowerCase())
          );
          if (foundWh) {
            matchedWarehouse = foundWh;
          } else {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: 'المخزن',
              message: `المخزن "${rawWarehouse}" غير مسجل في دليل المستودعات`
            });
          }
        } else if (!isServiceItem) {
          // Physical product: default warehouse fallback
          matchedWarehouse = defaultWh;
          if (!matchedWarehouse) {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: 'المخزن',
              message: `المخزن إلزامي للصنف المخزني "${rawProdName || rawProdCode}"`
            });
          }
        }

        // 7. Validate Quantity, Price, Discount
        const qtyNum = parseFloat(String(rawQty).replace(/,/g, ''));
        if (isNaN(qtyNum) || qtyNum <= 0) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'الكمية',
            message: `الكمية "${rawQty}" غير صحيحة. يجب أن تكون رقماً موجباً أكبر من صفر`
          });
        }

        const priceNum = parseFloat(String(rawPrice !== '' && rawPrice !== undefined ? rawPrice : (matchedProduct?.sale_price || matchedProduct?.cost_price || 0)).replace(/,/g, ''));
        if (isNaN(priceNum) || priceNum < 0) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'السعر',
            message: `السعر "${rawPrice}" غير صحيح. يجب أن يكون رقماً أكبر من أو يساوي صفر`
          });
        }

        const discountNum = parseFloat(String(rawDiscount || 0).replace(/,/g, '')) || 0;
        if (discountNum < 0) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'الخصم',
            message: `قيمة الخصم "${rawDiscount}" لا يمكن أن تكون سالبة`
          });
        }

        // 8. Tax rates respecting company settings
        let vatRateNum = 0;
        if (isVatEnabled) {
          vatRateNum = rawVatRate !== '' && rawVatRate !== undefined 
            ? (parseFloat(String(rawVatRate)) || 0)
            : (parseFloat(String(isSales ? matchedProduct?.vat_rate : matchedProduct?.purchase_vat_rate)) || 14);
        }

        let whtRateNum = 0;
        if (isWhtEnabled) {
          whtRateNum = rawWhtRate !== '' && rawWhtRate !== undefined
            ? (parseFloat(String(rawWhtRate)) || 0)
            : (parseFloat(String(isSales ? matchedProduct?.sales_withholding_tax_rate : matchedProduct?.purchase_withholding_tax_rate)) || 0);
        }

        // Payment type parsing
        const paymentType: 'cash' | 'credit' = (rawPaymentType === 'نقدي' || rawPaymentType.toLowerCase() === 'cash') ? 'cash' : 'credit';

        // Calculation of line
        const lineGross = (qtyNum || 0) * (priceNum || 0);
        const lineSubtotal = Math.max(0, lineGross - discountNum);
        const lineVat = Number(((lineSubtotal * vatRateNum) / 100).toFixed(2));
        const lineWht = Number(((lineSubtotal * whtRateNum) / 100).toFixed(2));
        const lineTotal = Number((lineSubtotal + lineVat - lineWht).toFixed(2));

        // Group into documents by rawRef
        if (rawRef) {
          if (!groupedDocs[rawRef]) {
            groupedDocs[rawRef] = {
              header: {
                ref: rawRef,
                doc_type: rawDocType,
                date: parsedDate,
                party_id: matchedParty?.id || '',
                party_name: matchedParty?.name || rawParty,
                party_code: matchedParty?.code,
                warehouse_id: matchedWarehouse?.id || null,
                warehouse_name: matchedWarehouse?.name || '',
                payment_type: paymentType,
                payment_method_id: paymentMethods[0]?.id || '',
                notes: rawNotes
              },
              items: []
            };
          } else {
            // Keep warehouse from any row if not yet set
            if (matchedWarehouse && !groupedDocs[rawRef].header.warehouse_id) {
              groupedDocs[rawRef].header.warehouse_id = matchedWarehouse.id;
              groupedDocs[rawRef].header.warehouse_name = matchedWarehouse.name;
            }

            // Check cross-row consistency for the same Ref
            const existingHeader = groupedDocs[rawRef].header;
            if (rawDocType && existingHeader.doc_type !== rawDocType) {
              errors.push({
                rowNumber,
                ref: rawRef,
                field: 'نوع المستند',
                message: `تعارض في نوع المستند للمرجع "${rawRef}": تم تحديد "${existingHeader.doc_type}" في سطر سابق و "${rawDocType}" في هذا السطر`
              });
            }
            if (matchedParty && existingHeader.party_id && existingHeader.party_id !== matchedParty.id) {
              errors.push({
                rowNumber,
                ref: rawRef,
                field: entityLabel,
                message: `تعارض في اسم ${entityLabel} لنفس المرجع "${rawRef}": (${existingHeader.party_name} مقابل ${matchedParty.name})`
              });
            }
          }

          if (matchedProduct && qtyNum > 0) {
            groupedDocs[rawRef].items.push({
              id: 'temp-' + rowNumber + '-' + Math.random().toString(36).substr(2, 9),
              rowIndex: rowNumber,
              product_id: matchedProduct.id,
              product_code: matchedProduct.code || rawProdCode,
              product_name: matchedProduct.name || rawProdName,
              unit: matchedProduct.unit || 'قطعة',
              quantity: qtyNum,
              unit_price: priceNum,
              discount_amount: discountNum,
              subtotal: lineSubtotal,
              vat_rate: vatRateNum,
              vat_amount: lineVat,
              withholding_tax_rate: whtRateNum,
              withholding_tax_amount: lineWht,
              total: lineTotal,
              description: rawNotes,
              is_service: isServiceItem
            });
          }
        }
      }

      setValidationErrors(errors);

      // Convert grouped documents to list and calculate totals
      const docsList: ParsedDocument[] = Object.values(groupedDocs).map(g => {
        const totals = recalculateDocTotals(g.items);
        const allServices = g.items.length > 0 && g.items.every(it => it.is_service === true);

        return {
          ref: g.header.ref,
          doc_type: g.header.doc_type,
          date: g.header.date,
          party_id: g.header.party_id,
          party_name: g.header.party_name,
          party_code: g.header.party_code,
          warehouse_id: allServices ? null : (g.header.warehouse_id || defaultWh?.id || null),
          warehouse_name: allServices ? 'خدمات (بدون مخزن)' : (g.header.warehouse_name || defaultWh?.name || ''),
          payment_type: g.header.payment_type,
          payment_method_id: g.header.payment_method_id,
          notes: g.header.notes,
          items: g.items,
          is_all_services: allServices,
          ...totals,
          status: 'pending'
        };
      });

      setDocuments(docsList);

      // Expand all by default
      const initialExp: Record<string, boolean> = {};
      docsList.forEach(d => { initialExp[d.ref] = true; });
      setExpandedRefs(initialExp);

      if (errors.length > 0) {
        showNotification(`تم فحص الملف: تم العثور على ${errors.length} خطأ بحاجة لمراجعة`, 'error');
      } else {
        showNotification(`تم فحص ومطابقة الملف بنجاح! تم استخراج ${docsList.length} مستند صالح`, 'success');
      }

    } catch (err: any) {
      console.error('File parsing error:', err);
      showNotification('فشل تحليل ملف الإكسيل: ' + err.message, 'error');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Toggle expand
  const toggleDocExpand = (ref: string) => {
    setExpandedRefs(prev => ({
      ...prev,
      [ref]: !prev[ref]
    }));
  };

  // Delete single document
  const handleDeleteDocument = (ref: string) => {
    setDocuments(prev => prev.filter(d => d.ref !== ref));
    setValidationErrors(prev => prev.filter(e => e.ref !== ref));
    showNotification(`تم حذف المستند ${ref} من الدفعة`, 'info');
  };

  // Delete item from document
  const handleDeleteItem = (docRef: string, itemId: string) => {
    setDocuments(prev => {
      return prev.map(doc => {
        if (doc.ref !== docRef) return doc;
        const newItems = doc.items.filter(it => it.id !== itemId);
        const newTotals = recalculateDocTotals(newItems);
        return {
          ...doc,
          items: newItems,
          ...newTotals
        };
      }).filter(doc => doc.items.length > 0);
    });
    showNotification('تم حذف البند وإعادة احتساب الإجماليات', 'info');
  };

  // Update item in document
  const handleSaveItemEdit = (updatedItem: ParsedItem) => {
    if (!editingItem) return;
    const { docRef } = editingItem;

    const lineGross = (updatedItem.quantity || 0) * (updatedItem.unit_price || 0);
    const lineSubtotal = Math.max(0, lineGross - (updatedItem.discount_amount || 0));
    const effectiveVatRate = isVatEnabled ? updatedItem.vat_rate : 0;
    const effectiveWhtRate = isWhtEnabled ? updatedItem.withholding_tax_rate : 0;
    const lineVat = Number(((lineSubtotal * effectiveVatRate) / 100).toFixed(2));
    const lineWht = Number(((lineSubtotal * effectiveWhtRate) / 100).toFixed(2));
    const lineTotal = Number((lineSubtotal + lineVat - lineWht).toFixed(2));

    const finalItem: ParsedItem = {
      ...updatedItem,
      vat_rate: effectiveVatRate,
      withholding_tax_rate: effectiveWhtRate,
      subtotal: lineSubtotal,
      vat_amount: lineVat,
      withholding_tax_amount: lineWht,
      total: lineTotal
    };

    setDocuments(prev => {
      return prev.map(doc => {
        if (doc.ref !== docRef) return doc;
        const newItems = doc.items.map(it => it.id === finalItem.id ? finalItem : it);
        const newTotals = recalculateDocTotals(newItems);
        return {
          ...doc,
          items: newItems,
          ...newTotals
        };
      });
    });

    setEditingItem(null);
    showNotification('تم تحديث بيانات الصنف وإعادة احتساب الإجماليات بنجاح', 'success');
  };

  // Save & Post batch
  const handleSaveAndPostBatch = async () => {
    if (documents.length === 0) {
      showNotification('لا توجد مستندات صالحة للحفظ', 'error');
      return;
    }
    if (validationErrors.length > 0) {
      showNotification('يرجى معالجة الأخطاء الموضحة أدناه قبل الحفظ والترحيل', 'error');
      return;
    }

    if (!confirm(`هل أنت متأكد من حفظ وترحيل عدد ${documents.length} مستند بتشغيلة رقم ${batchNumber} إلى النظام المحاسبي؟`)) {
      return;
    }

    setIsSavingBatch(true);
    setSaveProgress({ current: 0, total: documents.length, statusText: 'بدء الترحيل المحاسبي للدفعة...' });

    const updatedDocuments = [...documents];
    let successCount = 0;
    let failedCount = 0;

    for (let idx = 0; idx < updatedDocuments.length; idx++) {
      const doc = updatedDocuments[idx];
      setSaveProgress({ 
        current: idx + 1, 
        total: updatedDocuments.length, 
        statusText: `جاري حفظ المستند (${doc.ref}) - ${doc.doc_type} [${idx + 1} من ${updatedDocuments.length}]...` 
      });

      try {
        let createdDocId = '';
        let createdDocNumber = '';
        let createdJournalId = '';
        let createdJournalNumber = '';

        // Prepare items payload
        const itemsPayload = doc.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount_amount,
          discount_amount: item.discount_amount,
          vat_rate: item.vat_rate,
          vat_amount: item.vat_amount,
          withholding_tax_rate: item.withholding_tax_rate,
          withholding_tax_amount: item.withholding_tax_amount,
          total: item.total,
          unit: item.unit,
          description: item.description || ''
        }));

        if (doc.doc_type === 'فاتورة بيع') {
          const invPayload = {
            customer_id: doc.party_id,
            customer_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount_amount: doc.discount_amount,
            tax_amount: doc.tax_amount,
            withholding_tax_amount: doc.withholding_tax_amount,
            total_amount: doc.total_amount,
            payment_type: doc.payment_type,
            payment_method_id: doc.payment_type === 'cash' ? doc.payment_method_id : null,
            notes: doc.notes || '',
            description: `استيراد مبيعات تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            items: itemsPayload
          };

          const invRes: any = await apiRequest('/invoices', 'POST', invPayload);
          createdDocId = invRes.id;
          createdDocNumber = invRes.invoice_number || `INV-${createdDocId.slice(-6)}`;

          // Generate Journal Entry via PostingService
          try {
            const fullInv = { ...invPayload, id: createdDocId, invoice_number: createdDocNumber };
            const journalData = PostingService.generateInvoiceJournal(
              fullInv as any,
              customers,
              products,
              accounts,
              paymentMethods,
              companySettings
            );

            const jeRes: any = await apiRequest('/journal_entries', 'POST', {
              ...journalData,
              reference_id: createdDocId,
              company_id: user?.company_id
            });
            createdJournalId = jeRes.id;
            createdJournalNumber = jeRes.entry_number || '';
          } catch (jeErr: any) {
            console.warn('Journal generation for invoice warning:', jeErr);
          }

        } else if (doc.doc_type === 'أمر بيع') {
          const soPayload = {
            customer_id: doc.party_id,
            customer_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount_amount: doc.discount_amount,
            tax_amount: doc.tax_amount,
            total_amount: doc.total_amount,
            notes: doc.notes || '',
            description: `استيراد أمر بيع تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            status: 'draft',
            items: itemsPayload
          };

          const soRes: any = await apiRequest('/sales_orders', 'POST', soPayload);
          createdDocId = soRes.id;
          createdDocNumber = soRes.order_number || `SO-${createdDocId.slice(-6)}`;

        } else if (doc.doc_type === 'مرتجع بيع') {
          // Note: returns table only stores total_amount and withholding_tax_amount
          const retPayload = {
            customer_id: doc.party_id,
            customer_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
            date: doc.date,
            withholding_tax_amount: doc.withholding_tax_amount,
            total_amount: doc.total_amount,
            payment_type: doc.payment_type,
            payment_method_id: doc.payment_type === 'cash' ? doc.payment_method_id : null,
            notes: doc.notes || '',
            description: `استيراد مرتجع بيع تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            items: itemsPayload
          };

          const retRes: any = await apiRequest('/returns', 'POST', retPayload);
          createdDocId = retRes.id;
          createdDocNumber = retRes.return_number || `RET-${createdDocId.slice(-6)}`;

          // Generate Journal Entry for Return
          try {
            const fullRet = { ...retPayload, id: createdDocId, return_number: createdDocNumber };
            const journalData = PostingService.generateReturnJournal(
              fullRet as any,
              customers,
              products,
              accounts,
              paymentMethods
            );

            const jeRes: any = await apiRequest('/journal_entries', 'POST', {
              ...journalData,
              reference_id: createdDocId,
              company_id: user?.company_id
            });
            createdJournalId = jeRes.id;
            createdJournalNumber = jeRes.entry_number || '';
          } catch (jeErr: any) {
            console.warn('Journal generation for return warning:', jeErr);
          }

        } else if (doc.doc_type === 'فاتورة شراء') {
          const pinvPayload = {
            supplier_id: doc.party_id,
            supplier_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount_amount: doc.discount_amount,
            tax_amount: doc.tax_amount,
            withholding_tax_amount: doc.withholding_tax_amount,
            total_amount: doc.total_amount,
            payment_type: doc.payment_type,
            payment_method_id: doc.payment_type === 'cash' ? doc.payment_method_id : null,
            notes: doc.notes || '',
            description: `استيراد مشتريات تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            items: itemsPayload
          };

          const pinvRes: any = await apiRequest('/purchase_invoices', 'POST', pinvPayload);
          createdDocId = pinvRes.id;
          createdDocNumber = pinvRes.invoice_number || `PINV-${createdDocId.slice(-6)}`;

          // Generate Journal Entry for Purchase Invoice
          try {
            const fullPinv = { ...pinvPayload, id: createdDocId, invoice_number: createdDocNumber };
            const journalData = PostingService.generatePurchaseInvoiceJournal(
              fullPinv as any,
              suppliers,
              products,
              accounts,
              paymentMethods,
              companySettings
            );

            const jeRes: any = await apiRequest('/journal_entries', 'POST', {
              ...journalData,
              reference_id: createdDocId,
              company_id: user?.company_id
            });
            createdJournalId = jeRes.id;
            createdJournalNumber = jeRes.entry_number || '';
          } catch (jeErr: any) {
            console.warn('Journal generation for purchase invoice warning:', jeErr);
          }

        } else if (doc.doc_type === 'أمر شراء') {
          const poPayload = {
            supplier_id: doc.party_id,
            supplier_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount_amount: doc.discount_amount,
            tax_amount: doc.tax_amount,
            total_amount: doc.total_amount,
            notes: doc.notes || '',
            description: `استيراد أمر شراء تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            status: 'draft',
            items: itemsPayload
          };

          const poRes: any = await apiRequest('/purchase_orders', 'POST', poPayload);
          createdDocId = poRes.id;
          createdDocNumber = poRes.order_number || `PO-${createdDocId.slice(-6)}`;

        } else if (doc.doc_type === 'مرتجع شراء') {
          // Note: purchase_returns table only stores total_amount and withholding_tax_amount
          const pretPayload = {
            supplier_id: doc.party_id,
            supplier_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
            date: doc.date,
            withholding_tax_amount: doc.withholding_tax_amount,
            total_amount: doc.total_amount,
            payment_type: doc.payment_type,
            payment_method_id: doc.payment_type === 'cash' ? doc.payment_method_id : null,
            notes: doc.notes || '',
            description: `استيراد مرتجع شراء تشغيلة: ${batchNumber} - مرجع: ${doc.ref}`,
            batch_number: batchNumber,
            items: itemsPayload
          };

          const pretRes: any = await apiRequest('/purchase_returns', 'POST', pretPayload);
          createdDocId = pretRes.id;
          createdDocNumber = pretRes.return_number || `PRET-${createdDocId.slice(-6)}`;

          // Generate Journal Entry for Purchase Return
          try {
            const fullPret = { ...pretPayload, id: createdDocId, return_number: createdDocNumber };
            const journalData = PostingService.generatePurchaseReturnJournal(
              fullPret as any,
              suppliers,
              products,
              accounts,
              paymentMethods
            );

            const jeRes: any = await apiRequest('/journal_entries', 'POST', {
              ...journalData,
              reference_id: createdDocId,
              company_id: user?.company_id
            });
            createdJournalId = jeRes.id;
            createdJournalNumber = jeRes.entry_number || '';
          } catch (jeErr: any) {
            console.warn('Journal generation for purchase return warning:', jeErr);
          }
        }

        updatedDocuments[idx] = {
          ...doc,
          created_document_id: createdDocId,
          created_document_number: createdDocNumber,
          created_journal_id: createdJournalId,
          created_journal_number: createdJournalNumber,
          status: 'saved',
          error_message: undefined
        };
        successCount++;

      } catch (err: any) {
        console.error(`Error saving document ${doc.ref}:`, err);
        const errMsg = err.message || err.detail || 'خطأ أثناء الحفظ والترحيل';
        updatedDocuments[idx] = {
          ...doc,
          status: 'failed',
          error_message: errMsg
        };
        failedCount++;
      }
    }

    setDocuments(updatedDocuments);

    // Save batch record in document_import_batches
    try {
      const batchRecord = {
        company_id: user?.company_id,
        batch_number: batchNumber,
        batch_type: isSales ? 'sales' : 'purchases',
        batch_date: batchDate,
        total_documents: updatedDocuments.filter(d => d.status === 'saved').length,
        total_amount: updatedDocuments.filter(d => d.status === 'saved').reduce((sum, d) => sum + d.total_amount, 0),
        details: updatedDocuments.map(d => ({
          ref: d.ref,
          doc_type: d.doc_type,
          party_name: d.party_name,
          date: d.date,
          total_amount: d.total_amount,
          created_document_id: d.created_document_id,
          created_document_number: d.created_document_number,
          created_journal_number: d.created_journal_number,
          status: d.status,
          error_message: d.error_message
        })),
        status: failedCount === 0 ? 'posted' : 'partial',
        created_by: user?.id || user?.email
      };

      await apiRequest('/document_import_batches', 'POST', batchRecord);
    } catch (bErr: any) {
      console.warn('Failed to record batch audit history:', bErr);
    }

    setIsSavingBatch(false);
    setSaveProgress(null);
    setIsBatchSaved(true);

    if (failedCount === 0) {
      showNotification(`تم حفظ وترحيل كامل الدفعة بنجاح! تم إنشاء ${successCount} مستند والقيود التلقائية`, 'success');
    } else {
      showNotification(`تم ترحيل ${successCount} مستند بنجاح، وتعذر حفظ ${failedCount} مستند (راجع الأسباب بالجدول)`, 'warning');
    }
  };

  // Export processed data to Excel after save
  const handleExportAfterSave = () => {
    if (documents.length === 0) return;

    const wb = XLSX.utils.book_new();

    const headers = [
      'تاريخ التشغيلة',
      'رقم التشغيلة (Batch)',
      'رقم الفاتورة / المستند بالنظام',
      'رقم القيد المحاسبي',
      'Ref (المرجع الأصلي)',
      'نوع المستند',
      isSales ? 'العميل' : 'المورد',
      'تاريخ المستند',
      'المخزن',
      'كود الصنف',
      'اسم الصنف',
      'الكمية',
      'السعر',
      'الخصم',
      'الصافي قبل الضريبة',
      'نسبة ض.ق.م %',
      'قيمة ض.ق.م',
      'نسبة ض.خ.أ %',
      'قيمة ض.خ.أ',
      'الإجمالي النهائي للسطر',
      'طريقة الدفع',
      'حالة الحفظ والترحيل',
      'ملاحظات'
    ];

    const exportRows: any[][] = [];

    documents.forEach(doc => {
      doc.items.forEach(item => {
        exportRows.push([
          batchDate,
          batchNumber,
          doc.created_document_number || (doc.status === 'failed' ? `لم يتم الحفظ: ${doc.error_message || 'خطأ'}` : 'لم يتم الحفظ'),
          doc.created_journal_number || (doc.doc_type.includes('أمر') ? 'بدون قيد (أمر)' : '-'),
          doc.ref,
          doc.doc_type,
          doc.party_name,
          doc.date,
          doc.warehouse_name || '-',
          item.product_code,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.discount_amount,
          item.subtotal,
          item.vat_rate,
          item.vat_amount,
          item.withholding_tax_rate,
          item.withholding_tax_amount,
          item.total,
          doc.payment_type === 'cash' ? 'نقدي' : 'آجل',
          doc.status === 'saved' ? 'تم الحفظ والترحيل' : `فشل: ${doc.error_message || 'لم يحفظ'}`,
          item.description || doc.notes || ''
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'المستندات المرحلة');

    const outFileName = `${batchNumber}_${isSales ? 'مبيعات' : 'مشتريات'}_المرحلة.xlsx`;
    XLSX.writeFile(wb, outFileName);
    showNotification('تم تصدير ملف الإكسيل المحفوظ بنجاح', 'success');
  };

  return (
    <div className="w-full px-2 sm:px-4 py-3 space-y-3.5" dir={dir}>
      
      {/* Merged Compact Header & Upload Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Right: Title & Info */}
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isSales ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'}`}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
                  {pageTitle}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {isSales ? 'مبيعات' : 'مشتريات'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                استيراد الفواتير والأوامر والمرتجعات مع توليد أرقام القيود التلقائية
              </p>
            </div>
          </div>

          {/* Center: Merged Upload Dropzone / Button */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed cursor-pointer transition-all duration-150 select-none ${
              isDragging 
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700' 
                : fileName
                  ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 hover:border-emerald-400'
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
            }`}
            title="اضغط لاختيار ملف الإكسيل أو اسحبه وأفلته هنا"
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              accept=".xlsx, .xls, .csv"
              className="hidden" 
            />
            <UploadCloud className={`w-4 h-4 shrink-0 ${fileName ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isParsing ? (
              <span className="text-xs font-semibold flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                جاري الفحص...
              </span>
            ) : fileName ? (
              <span className="text-xs font-semibold truncate max-w-[220px]" dir="ltr">
                {fileName}
              </span>
            ) : (
              <span className="text-xs font-semibold">
                اضغط لاختيار ملف الإكسيل أو اسحبه هنا
              </span>
            )}
          </div>

          {/* Left: Tight inputs for Date, Batch # and Download Template */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">التاريخ:</span>
              <input 
                type="date"
                value={batchDate}
                disabled={isBatchSaved}
                onChange={(e) => setBatchDate(e.target.value)}
                className="text-xs font-mono font-medium bg-transparent focus:outline-none disabled:opacity-60 cursor-pointer"
              />
            </div>

            {/* Batch Number */}
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
              <Hash className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">التشغيلة:</span>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 select-all">
                {isGeneratingBatchNumber ? 'جاري التوليد...' : batchNumber}
              </span>
            </div>

            {/* Download Template Button */}
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg transition-colors shadow-sm"
              title="تحميل نموذج الإكسيل النموذجي المشروح مع أمثلة عملية جاهزة"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل النموذج</span>
            </button>
          </div>

        </div>
      </div>

      {/* Validation Errors Box (if any) */}
      <AnimatePresence>
        {validationErrors.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 shadow-sm space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs md:text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>تنبيهات وأخطاء الفحص التفصيلي ({validationErrors.length} ملاحظة):</span>
              </div>
              <span className="text-[11px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                يرجى تصحيح الأخطاء في الإكسيل أو التعديل بالجدول أدناه
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-amber-200/80 dark:border-amber-800/80 bg-white dark:bg-slate-900">
              <table className="w-full text-right text-xs">
                <thead className="bg-amber-100/60 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800 sticky top-0">
                  <tr>
                    <th className="p-2 font-bold">رقم الصف بالإكسيل</th>
                    <th className="p-2 font-bold">رقم المرجع (Ref)</th>
                    <th className="p-2 font-bold">الحقل</th>
                    <th className="p-2 font-bold">سبب الخطأ بالتفصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 dark:divide-slate-800">
                  {validationErrors.map((err, i) => (
                    <tr key={i} className="hover:bg-amber-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-2 font-mono font-bold text-amber-700 dark:text-amber-400">الصف {err.rowNumber}</td>
                      <td className="p-2 font-mono">{err.ref}</td>
                      <td className="p-2 font-semibold text-slate-700 dark:text-slate-300">{err.field}</td>
                      <td className="p-2 text-red-600 dark:text-red-400">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3 Distinct Totals Rows: Invoices / Orders / Returns */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {/* Row 1: Invoices */}
          <SummaryRowCard 
            title={isSales ? 'فواتير بيع' : 'فواتير شراء'}
            badgeColor="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
            summary={invoicesSummary}
            isVatEnabled={isVatEnabled}
            isWhtEnabled={isWhtEnabled}
          />

          {/* Row 2: Orders */}
          <SummaryRowCard 
            title={isSales ? 'أوامر بيع' : 'أوامر شراء'}
            badgeColor="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800"
            summary={ordersSummary}
            isVatEnabled={isVatEnabled}
            isWhtEnabled={false}
          />

          {/* Row 3: Returns */}
          <SummaryRowCard 
            title={isSales ? 'مرتجعات بيع' : 'مرتجعات شراء'}
            badgeColor="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800"
            summary={returnsSummary}
            isVatEnabled={isVatEnabled}
            isWhtEnabled={isWhtEnabled}
          />
        </div>
      )}

      {/* Actions Bar: Save & Post / Export After Save */}
      {documents.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              إجمالي المستندات الجاهزة:
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-mono">
              {documents.length} مستند
            </span>
            {isBatchSaved && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تم الحفظ والترحيل للدفعة</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Save & Post Button */}
            {!isBatchSaved && (
              <button
                onClick={handleSaveAndPostBatch}
                disabled={isSavingBatch || validationErrors.length > 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingBatch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ والترحيل...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>حفظ وترحيل المستندات</span>
                  </>
                )}
              </button>
            )}

            {/* Export After Save Button */}
            {isBatchSaved && (
              <button
                onClick={handleExportAfterSave}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold rounded-xl shadow-md transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>تصدير إكسيل بعد الحفظ (مع أرقام الفواتير والقيود)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Save Progress Bar */}
      {saveProgress && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>{saveProgress.statusText}</span>
            <span className="font-mono">{Math.round((saveProgress.current / saveProgress.total) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Interactive Table of Valid Documents (Accordion) */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>جدول المستندات الصحيحة ومطابقتها ({documents.length}):</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const allOpen: Record<string, boolean> = {};
                  documents.forEach(d => { allOpen[d.ref] = true; });
                  setExpandedRefs(allOpen);
                }}
                className="text-xs text-slate-600 dark:text-slate-400 hover:underline"
              >
                فتح الكل
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setExpandedRefs({})}
                className="text-xs text-slate-600 dark:text-slate-400 hover:underline"
              >
                طي الكل
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {documents.map((doc, docIdx) => {
              const isExpanded = !!expandedRefs[doc.ref];
              const docTypeBadgeColor = 
                doc.doc_type.includes('فاتورة') ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' :
                doc.doc_type.includes('أمر') ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800' :
                'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800';

              const allServices = doc.items.length > 0 && doc.items.every(i => i.is_service === true);

              return (
                <div 
                  key={doc.ref}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Document Header Row (Parent) */}
                  <div className="p-2.5 md:p-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Chevron toggle */}
                      <button
                        onClick={() => toggleDocExpand(doc.ref)}
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                        title={isExpanded ? 'طي الأصناف' : 'عرض الأصناف'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {/* 1. Document Number Link / Badge (BEFORE Ref as requested) */}
                      {doc.created_document_number && (
                        <button
                          type="button"
                          onClick={() => handleNavigateToDocument(doc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold shadow-sm transition-all transform hover:scale-105 cursor-pointer"
                          title="انقر للانتقال مباشرة إلى المستند في تبويب جديد"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{doc.created_document_number}</span>
                          <ExternalLink className="w-3 h-3 opacity-80" />
                        </button>
                      )}

                      {/* 2. Journal Entry Number Link / Badge (BEFORE Ref as requested) */}
                      {doc.created_journal_number && (
                        <button
                          type="button"
                          onClick={() => handleNavigateToJournal(doc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold shadow-sm transition-all transform hover:scale-105 cursor-pointer"
                          title="انقر للانتقال مباشرة إلى القيد المحاسبي في تبويب جديد"
                        >
                          <Hash className="w-3.5 h-3.5" />
                          <span>قيد: {doc.created_journal_number}</span>
                          <ExternalLink className="w-3 h-3 opacity-80" />
                        </button>
                      )}

                      {/* 3. Error Badge if document failed */}
                      {doc.status === 'failed' && (
                        <div 
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold"
                          title={doc.error_message}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span className="truncate max-w-[280px]">فشل الحفظ: {doc.error_message || 'خطأ في الحفظ'}</span>
                        </div>
                      )}

                      {/* 4. Ref Badge */}
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs text-slate-800 dark:text-slate-200">
                        {doc.ref}
                      </span>

                      {/* 5. Document Type Badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${docTypeBadgeColor}`}>
                        {doc.doc_type}
                      </span>

                      {/* 6. Party Name */}
                      <span className="font-bold text-xs md:text-sm text-slate-900 dark:text-white">
                        {doc.party_name}
                      </span>

                      {/* 7. Date */}
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {doc.date}
                      </span>

                      {/* 8. Warehouse or Service Badge */}
                      {allServices ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                          خدمات (لا يلزم مخزن)
                        </span>
                      ) : doc.warehouse_name ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {doc.warehouse_name}
                        </span>
                      ) : null}

                      {/* 9. Payment Type */}
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {doc.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                      </span>
                    </div>

                    {/* Left: Net Total Badge & Delete Action (Redundant duplicate values removed as requested) */}
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-mono bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-lg">
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium">الصافي:</span>
                        <span className="text-emerald-900 dark:text-emerald-100 font-extrabold text-sm">{formatMoney(doc.total_amount)}</span>
                      </div>

                      {!isBatchSaved && (
                        <button
                          onClick={() => handleDeleteDocument(doc.ref)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title="حذف المستند بالكامل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Collapsible Items Sub-Table */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-x-auto"
                      >
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold">
                            <tr>
                              <th className="p-2.5 w-10 text-center">#</th>
                              <th className="p-2.5">كود الصنف</th>
                              <th className="p-2.5">اسم الصنف</th>
                              <th className="p-2.5 text-center">الكمية</th>
                              <th className="p-2.5 text-center">السعر</th>
                              <th className="p-2.5 text-center">الخصم</th>
                              <th className="p-2.5 text-center">الصافي قبل الضريبة</th>
                              <th className="p-2.5 text-center">ض.ق.م (%)</th>
                              <th className="p-2.5 text-center">قيمة ض.ق.م</th>
                              <th className="p-2.5 text-center">ض.خ.أ (%)</th>
                              <th className="p-2.5 text-center">قيمة ض.خ.أ</th>
                              <th className="p-2.5 text-center font-extrabold text-slate-900 dark:text-white">الإجمالي</th>
                              {!isBatchSaved && <th className="p-2.5 text-center w-20">إجراءات</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                            {doc.items.map((item, itemIdx) => (
                              <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="p-2.5 text-center text-slate-400 font-sans">{itemIdx + 1}</td>
                                <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{item.product_code}</td>
                                <td className="p-2.5 font-sans font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  <span>{item.product_name}</span>
                                  {item.is_service && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                                      خدمة
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center font-bold text-slate-900 dark:text-white">{item.quantity}</td>
                                <td className="p-2.5 text-center">{formatMoney(item.unit_price)}</td>
                                <td className="p-2.5 text-center text-amber-600 font-bold">{formatMoney(item.discount_amount)}</td>
                                <td className="p-2.5 text-center text-blue-600 font-bold">{formatMoney(item.subtotal)}</td>
                                <td className="p-2.5 text-center text-slate-500 font-sans">{item.vat_rate}%</td>
                                <td className="p-2.5 text-center text-emerald-600 font-bold">{formatMoney(item.vat_amount)}</td>
                                <td className="p-2.5 text-center text-slate-500 font-sans">{item.withholding_tax_rate}%</td>
                                <td className="p-2.5 text-center text-purple-600 font-bold">{formatMoney(item.withholding_tax_amount)}</td>
                                <td className="p-2.5 text-center font-extrabold text-emerald-700 dark:text-emerald-300">{formatMoney(item.total)}</td>
                                {!isBatchSaved && (
                                  <td className="p-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1 font-sans">
                                      <button
                                        onClick={() => setEditingItem({ docRef: doc.ref, item })}
                                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600"
                                        title="تعديل هذا البند"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteItem(doc.ref, item.id)}
                                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600"
                                        title="حذف هذا البند"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <span>تعديل بند الصنف ({editingItem.item.product_name})</span>
              </h3>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الكمية:</label>
                <input 
                  type="number"
                  min="0.001"
                  step="any"
                  value={editingItem.item.quantity}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, quantity: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">السعر (قبل الضريبة):</label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  value={editingItem.item.unit_price}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, unit_price: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الخصم:</label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  value={editingItem.item.discount_amount}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, discount_amount: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  نسبة ض.ق.م (%) {isVatEnabled ? '' : '(معطلة بالشركة)'}:
                </label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  disabled={!isVatEnabled}
                  value={isVatEnabled ? editingItem.item.vat_rate : 0}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, vat_rate: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  نسبة ض.خ.أ (%) {isWhtEnabled ? '' : '(معطلة بالشركة)'}:
                </label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  disabled={!isWhtEnabled}
                  value={isWhtEnabled ? editingItem.item.withholding_tax_rate : 0}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, withholding_tax_rate: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">ملاحظات البند:</label>
                <input 
                  type="text"
                  value={editingItem.item.description || ''}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, description: e.target.value }
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleSaveItemEdit(editingItem.item)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sleek unified row card for category totals (Invoices, Orders, Returns)
const SummaryRowCard: React.FC<{
  title: string;
  badgeColor: string;
  summary: {
    count: number;
    totalItems: number;
    gross: number;
    discount: number;
    subtotal: number;
    vat: number;
    wht: number;
    net: number;
  };
  isVatEnabled: boolean;
  isWhtEnabled: boolean;
}> = ({ title, badgeColor, summary, isVatEnabled, isWhtEnabled }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 md:p-2.5 shadow-xs grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-center">
    
    {/* Category & Count */}
    <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-center justify-between lg:justify-start gap-2 border-b lg:border-b-0 lg:border-l border-slate-100 dark:border-slate-800 pb-1.5 lg:pb-0 lg:pl-2">
      <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold border ${badgeColor} whitespace-nowrap`}>
        {title}
      </span>
      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
        <span>{summary.count} مستند</span>
        <span className="mx-1 text-slate-300">/</span>
        <span>{summary.totalItems} بند</span>
      </div>
    </div>

    {/* Gross */}
    <div className="text-center">
      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">الإجمالي</span>
      <span className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
        {formatMoney(summary.gross)}
      </span>
    </div>

    {/* Discount */}
    <div className="text-center">
      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">إجمالي الخصم</span>
      <span className="text-xs md:text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
        {formatMoney(summary.discount)}
      </span>
    </div>

    {/* Subtotal */}
    <div className="text-center">
      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">الصافي قبل الضريبة</span>
      <span className="text-xs md:text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">
        {formatMoney(summary.subtotal)}
      </span>
    </div>

    {/* VAT */}
    <div className="text-center">
      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
        ض.ق.م {isVatEnabled ? '(14%)' : '(معطلة)'}
      </span>
      <span className="text-xs md:text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
        {isVatEnabled ? formatMoney(summary.vat) : '-'}
      </span>
    </div>

    {/* WHT */}
    <div className="text-center">
      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
        ض.خ.إ {isWhtEnabled ? '(1%)' : '(معطلة)'}
      </span>
      <span className="text-xs md:text-sm font-bold text-purple-600 dark:text-purple-400 font-mono">
        {isWhtEnabled ? formatMoney(summary.wht) : '-'}
      </span>
    </div>

    {/* Net Total */}
    <div className="text-center bg-emerald-50/70 dark:bg-emerald-950/40 rounded-lg py-1 px-1.5 border border-emerald-200/80 dark:border-emerald-800/80">
      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">الصافي النهائي</span>
      <span className="text-xs md:text-sm font-extrabold text-emerald-900 dark:text-emerald-100 font-mono">
        {formatMoney(summary.net)}
      </span>
    </div>

  </div>
);

export default DocumentImport;
