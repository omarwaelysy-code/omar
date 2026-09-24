import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService, apiRequest } from '../services/dbService';
import { PostingService } from '../services/PostingService';
import { formatNumber, formatMoney } from '../utils/formatUtils';
import { Customer, Supplier, Product, Warehouse, PaymentMethod, Account } from '../types';
import { 
  FileSpreadsheet, UploadCloud, Download, CheckCircle2, AlertTriangle, 
  Trash2, Edit3, ChevronDown, ChevronUp, FileText, ArrowUpFromLine, 
  ArrowDownToLine, RotateCcw, Hash, Calendar, Layers, ShieldCheck, 
  X, Check, RefreshCw, Eye, Sparkles
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
}

interface ParsedDocument {
  ref: string;
  doc_type: string;
  date: string;
  party_id: string;
  party_name: string;
  party_code?: string;
  warehouse_id?: string;
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
  // Post-save data
  created_document_id?: string;
  created_document_number?: string;
  created_journal_id?: string;
  created_journal_number?: string;
  status?: 'pending' | 'saved' | 'failed';
  error_message?: string;
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

  const isSales = type === 'sales';
  const pageTitle = isSales ? 'استيراد مستندات بيع من إكسيل' : 'استيراد مستندات شراء من إكسيل';
  const entityLabel = isSales ? 'العميل' : 'المورد';
  const sequenceModuleName = isSales ? 'sales_import_batches' : 'purchases_import_batches';

  // System master data
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

  // Grand summary for top KPI cards
  const batchSummary = useMemo(() => {
    let gross = 0;
    let discount = 0;
    let subtotal = 0;
    let vat = 0;
    let wht = 0;
    let net = 0;
    let totalItems = 0;

    documents.forEach(doc => {
      gross += doc.gross_total;
      discount += doc.discount_amount;
      subtotal += doc.subtotal;
      vat += doc.tax_amount;
      wht += doc.withholding_tax_amount;
      net += doc.total_amount;
      totalItems += doc.items.length;
    });

    return {
      gross: Number(gross.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      vat: Number(vat.toFixed(2)),
      wht: Number(wht.toFixed(2)),
      net: Number(net.toFixed(2)),
      docCount: documents.length,
      totalItems
    };
  }, [documents]);

  // Download comprehensive explanation template with realistic examples
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

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
      ['7. كود المخزن أو اسم المخزن:', 'المخزن المراد الصرف منه أو الإضافة إليه. في حالة تركه فارغاً، يتم استخدام المخزن الافتراضي للشركة.'],
      ['8. الكمية والسعر والخصم:', 'الكمية يجب أن تكون رقماً موجباً أكبر من صفر. السعر هو سعر الوحدة قبل الضريبة والخصم. الخصم قيمة نقدية على مستوى البند (أو 0).'],
      ['9. نسبة ضريبة القيمة المضافة %:', 'النسبة المئوية لضريبة القيمة المضافة مثل 14 أو 0 (بدون علامة %).'],
      ['10. نسبة ضريبة الخصم والإضافة %:', 'النسبة المئوية لضريبة الخصم والإضافة (ض.خ.أ) مثل 1 أو 0.'],
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
      ['Ref-000001', 'فاتورة بيع', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 10, 150, 0, 14, 1, 'آجل', 'فاتورة مبيعات بضاعة - صنف أول'],
      ['Ref-000001', 'فاتورة بيع', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 5, 200, 20, 14, 1, 'آجل', 'فاتورة مبيعات بضاعة - صنف ثانٍ لنفس الفاتورة'],
      ['Ref-000002', 'أمر بيع', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 25, 145, 50, 14, 0, 'آجل', 'أمر بيع معتمد للعميل'],
      ['Ref-000003', 'مرتجع بيع', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 2, 200, 0, 14, 1, 'نقدي', 'مرتجع مبيعات نقدي تالف']
    ] : [
      ['Ref-000001', 'فاتورة شراء', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 50, 120, 100, 14, 1, 'آجل', 'فاتورة توريد خامات - بند أول'],
      ['Ref-000001', 'فاتورة شراء', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 30, 180, 0, 14, 1, 'آجل', 'فاتورة توريد خامات - بند ثانٍ'],
      ['Ref-000002', 'أمر شراء', batchDate, sampleParty, sampleProd1, sampleProdName1, sampleWarehouse, 100, 115, 0, 14, 0, 'آجل', 'أمر شراء معتمد للمورد'],
      ['Ref-000003', 'مرتجع شراء', batchDate, sampleParty, sampleProd2, sampleProdName2, sampleWarehouse, 5, 180, 0, 14, 1, 'آجل', 'مرتجع مشتريات لعدم مطابقة المواصفات']
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
          warehouse_id?: string;
          warehouse_name?: string;
          payment_type: 'cash' | 'credit';
          payment_method_id?: string;
          notes?: string;
        };
        items: ParsedItem[];
      }> = {};

      const validSalesTypes = ['فاتورة بيع', 'أمر بيع', 'مرتجع بيع'];
      const validPurchaseTypes = ['فاتورة شراء', 'أمر شراء', 'مرتجع شراء'];
      const allowedDocTypes = isSales ? validSalesTypes : validPurchaseTypes;

      // Default warehouse fallback
      const defaultWh = warehouses.find(w => (w as any).is_default) || warehouses[0];

      // Process rows (row 0 is header, rows 1+ are data)
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNumber = i + 1; // 1-indexed Excel row

        // Skip completely empty rows
        if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) {
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
            field: 'Ref',
            message: 'رقم المرجع (العمود الأول) إلزامي ولا يمكن تركه فارغاً'
          });
        }

        // 2. Validate Doc Type
        if (!rawDocType) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'نوع المستند',
            message: 'نوع المستند إلزامي'
          });
        } else if (!allowedDocTypes.includes(rawDocType)) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: 'نوع المستند',
            message: `نوع المستند "${rawDocType}" غير صالح لشاشة ${isSales ? 'المبيعات' : 'المشتريات'}. الأنواع المسموحة: ${allowedDocTypes.join(' أو ')}`
          });
        }

        // 3. Validate Date
        let parsedDate = batchDate;
        if (rawDate) {
          if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            parsedDate = rawDate;
          } else if (typeof rawDate === 'number') {
            // Excel serial date number
            const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            parsedDate = d.toISOString().slice(0, 10);
          } else {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              parsedDate = d.toISOString().slice(0, 10);
            } else {
              errors.push({
                rowNumber,
                ref: rawRef,
                field: 'التاريخ',
                message: `تنسيق التاريخ غير صحيح "${rawDate}". يرجى كتابته بتنسيق YYYY-MM-DD`
              });
            }
          }
        }

        // 4. Validate Customer / Supplier
        let matchedParty: Customer | Supplier | undefined;
        if (!rawParty) {
          errors.push({
            rowNumber,
            ref: rawRef,
            field: entityLabel,
            message: `اسم أو كود ${entityLabel} إلزامي`
          });
        } else {
          const list = isSales ? customers : suppliers;
          matchedParty = list.find(p => 
            p.id === rawParty || 
            (p.code && p.code.toLowerCase() === rawParty.toLowerCase()) || 
            (p.name && p.name.trim().toLowerCase() === rawParty.toLowerCase())
          );

          if (!matchedParty) {
            errors.push({
              rowNumber,
              ref: rawRef,
              field: entityLabel,
              message: `لم يتم العثور على ${entityLabel} "${rawParty}" في دليل ${isSales ? 'العملاء' : 'الموردين'}`
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

        // 6. Validate Warehouse
        let matchedWarehouse: Warehouse | undefined = defaultWh;
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

        // 8. Tax rates
        const vatRateNum = rawVatRate !== '' && rawVatRate !== undefined 
          ? (parseFloat(String(rawVatRate)) || 0)
          : (parseFloat(String(isSales ? matchedProduct?.vat_rate : matchedProduct?.purchase_vat_rate)) || 14);

        const whtRateNum = rawWhtRate !== '' && rawWhtRate !== undefined
          ? (parseFloat(String(rawWhtRate)) || 0)
          : (parseFloat(String(isSales ? matchedProduct?.sales_withholding_tax_rate : matchedProduct?.purchase_withholding_tax_rate)) || 0);

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
                warehouse_id: matchedWarehouse?.id || '',
                warehouse_name: matchedWarehouse?.name || '',
                payment_type: paymentType,
                payment_method_id: paymentMethods[0]?.id || '',
                notes: rawNotes
              },
              items: []
            };
          } else {
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
              description: rawNotes
            });
          }
        }
      }

      setValidationErrors(errors);

      // Convert grouped documents to list and calculate totals
      const docsList: ParsedDocument[] = Object.values(groupedDocs).map(g => {
        const totals = recalculateDocTotals(g.items);
        return {
          ref: g.header.ref,
          doc_type: g.header.doc_type,
          date: g.header.date,
          party_id: g.header.party_id,
          party_name: g.header.party_name,
          party_code: g.header.party_code,
          warehouse_id: g.header.warehouse_id,
          warehouse_name: g.header.warehouse_name,
          payment_type: g.header.payment_type,
          payment_method_id: g.header.payment_method_id,
          notes: g.header.notes,
          items: g.items,
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
      showNotification('خطأ أثناء قراءة ملف الإكسيل: ' + err.message, 'error');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Toggle accordion expand
  const toggleDocExpand = (ref: string) => {
    setExpandedRefs(prev => ({ ...prev, [ref]: !prev[ref] }));
  };

  // Delete entire document
  const handleDeleteDocument = (ref: string) => {
    if (confirm(`هل أنت متأكد من حذف المستند بالكامل رقم المرجع ${ref}؟`)) {
      setDocuments(prev => prev.filter(d => d.ref !== ref));
      showNotification(`تم حذف المستند ${ref}`, 'info');
    }
  };

  // Delete single item in a document
  const handleDeleteItem = (docRef: string, itemId: string) => {
    setDocuments(prev => {
      return prev.map(doc => {
        if (doc.ref !== docRef) return doc;
        const newItems = doc.items.filter(item => item.id !== itemId);
        const newTotals = recalculateDocTotals(newItems);
        return {
          ...doc,
          items: newItems,
          ...newTotals
        };
      }).filter(doc => doc.items.length > 0); // Remove document if it has no items left
    });
    showNotification('تم حذف الصنف وإعادة احتساب الإجماليات', 'info');
  };

  // Save edited item
  const handleSaveItemEdit = (updatedItem: ParsedItem) => {
    if (!editingItem) return;
    const docRef = editingItem.docRef;

    // Recalculate item line
    const lineGross = updatedItem.quantity * updatedItem.unit_price;
    const lineSubtotal = Math.max(0, lineGross - updatedItem.discount_amount);
    const lineVat = Number(((lineSubtotal * updatedItem.vat_rate) / 100).toFixed(2));
    const lineWht = Number(((lineSubtotal * updatedItem.withholding_tax_rate) / 100).toFixed(2));
    const lineTotal = Number((lineSubtotal + lineVat - lineWht).toFixed(2));

    const finalItem: ParsedItem = {
      ...updatedItem,
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
          const retPayload = {
            customer_id: doc.party_id,
            customer_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount: doc.discount_amount,
            tax: doc.tax_amount,
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
          const pretPayload = {
            supplier_id: doc.party_id,
            supplier_name: doc.party_name,
            warehouse_id: doc.warehouse_id || null,
            date: doc.date,
            subtotal: doc.subtotal,
            discount: doc.discount_amount,
            tax: doc.tax_amount,
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
          status: 'saved'
        };
        successCount++;

      } catch (err: any) {
        console.error(`Error saving document ${doc.ref}:`, err);
        updatedDocuments[idx] = {
          ...doc,
          status: 'failed',
          error_message: err.message
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
          status: d.status
        })),
        status: failedCount === 0 ? 'posted' : 'partial',
        created_by: user?.id || user?.email
      };

      await dbService.add('document_import_batches', batchRecord);
    } catch (bErr: any) {
      console.warn('Could not record document_import_batches entry:', bErr);
    }

    setIsSavingBatch(false);
    setSaveProgress(null);
    setIsBatchSaved(true);

    if (failedCount === 0) {
      showNotification(`تم حفظ وترحيل جميع المستندات (${successCount}) بنجاح تام!`, 'success');
    } else {
      showNotification(`تم حفظ ${successCount} مستند وفشل ${failedCount} مستند`, 'warning');
    }
  };

  // Export after save with Batch Number, Invoice Numbers, Journal Numbers
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
      'ملاحظات'
    ];

    const exportRows: any[][] = [];

    documents.forEach(doc => {
      doc.items.forEach(item => {
        exportRows.push([
          batchDate,
          batchNumber,
          doc.created_document_number || 'لم يتم الحفظ',
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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${isSales ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'}`}>
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {pageTitle}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                  {isSales ? 'مبيعات' : 'مشتريات'}
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                استيراد الفواتير والأوامر والمرتجعات دفعة واحدة من ملف إكسيل مع توليد الأرقام والقيود المحاسبية التلقائية
              </p>
            </div>
          </div>

          {/* Batch Date & Number Display */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
            {/* Batch Date */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">تاريخ التشغيلة:</span>
              <input 
                type="date"
                value={batchDate}
                disabled={documents.length > 0 || isSavingBatch}
                onChange={(e) => setBatchDate(e.target.value)}
                className="text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              />
            </div>

            <div className="h-5 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

            {/* Batch Number */}
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">رقم التشغيلة:</span>
              <div className="text-xs font-mono font-bold px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-lg select-all">
                {isGeneratingBatchNumber ? 'جاري التوليد...' : batchNumber}
              </div>
            </div>

            {/* Download Template Button */}
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-50/50 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
              title="تحميل نموذج الإكسيل النموذجي المشروح مع أمثلة عملية جاهزة"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل النموذج المشروح</span>
            </button>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
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
        className={`border-2 border-dashed rounded-2xl p-6 md:p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging 
            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]' 
            : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 bg-white dark:bg-slate-900'
        }`}
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
        
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shadow-inner">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
              اضغط لاختيار ملف الإكسيل أو اسحبه وأفلته هنا
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              يدعم ملفات (.xlsx, .xls) مع التحقق الفوري من صحة الأكواد والأسعار والعملاء والأصناف
            </p>
          </div>
          {fileName && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{fileName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Validation Errors Box (if any) */}
      <AnimatePresence>
        {validationErrors.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>تنبيهات وأخطاء الفحص التفصيلي ({validationErrors.length} ملاحظة):</span>
              </div>
              <span className="text-xs bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                يرجى تصحيح الأخطاء في الإكسيل أو التعديل بالجدول أدناه
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-amber-200/80 dark:border-amber-800/80 bg-white dark:bg-slate-900">
              <table className="w-full text-right text-xs">
                <thead className="bg-amber-100/60 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800 sticky top-0">
                  <tr>
                    <th className="p-2.5 font-bold">رقم الصف بالإكسيل</th>
                    <th className="p-2.5 font-bold">رقم المرجع (Ref)</th>
                    <th className="p-2.5 font-bold">الحقل</th>
                    <th className="p-2.5 font-bold">سبب الخطأ بالتفصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 dark:divide-slate-800">
                  {validationErrors.map((err, i) => (
                    <tr key={i} className="hover:bg-amber-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-2.5 font-mono font-bold text-amber-700 dark:text-amber-400">الصف {err.rowNumber}</td>
                      <td className="p-2.5 font-mono">{err.ref}</td>
                      <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{err.field}</td>
                      <td className="p-2.5 text-red-600 dark:text-red-400">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Summary Cards (KPIs) */}
      {documents.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Gross */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">الإجمالي</span>
            <span className="text-sm md:text-base font-bold text-slate-900 dark:text-white block font-mono">
              {formatMoney(batchSummary.gross)}
            </span>
          </div>

          {/* Discount */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">إجمالي الخصم</span>
            <span className="text-sm md:text-base font-bold text-amber-600 dark:text-amber-400 block font-mono">
              {formatMoney(batchSummary.discount)}
            </span>
          </div>

          {/* Subtotal */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">الصافي قبل الضريبة</span>
            <span className="text-sm md:text-base font-bold text-blue-600 dark:text-blue-400 block font-mono">
              {formatMoney(batchSummary.subtotal)}
            </span>
          </div>

          {/* VAT */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">ض.ق.م (14%)</span>
            <span className="text-sm md:text-base font-bold text-emerald-600 dark:text-emerald-400 block font-mono">
              {formatMoney(batchSummary.vat)}
            </span>
          </div>

          {/* WHT */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">ض.خ.أ</span>
            <span className="text-sm md:text-base font-bold text-purple-600 dark:text-purple-400 block font-mono">
              {formatMoney(batchSummary.wht)}
            </span>
          </div>

          {/* Net Total */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 shadow-sm text-center col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 block mb-1">الصافي النهائي</span>
            <span className="text-sm md:text-base font-bold text-emerald-800 dark:text-emerald-200 block font-mono">
              {formatMoney(batchSummary.net)}
            </span>
          </div>

          {/* Doc count */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">المستندات</span>
            <span className="text-sm md:text-base font-bold text-slate-900 dark:text-white block font-mono">
              {batchSummary.docCount}
            </span>
          </div>

          {/* Items count */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">إجمالي البنود</span>
            <span className="text-sm md:text-base font-bold text-slate-900 dark:text-white block font-mono">
              {batchSummary.totalItems}
            </span>
          </div>
        </div>
      )}

      {/* Actions Bar: Save & Post / Export After Save */}
      {documents.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
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

          <div className="flex items-center gap-3">
            {/* Save & Post Button */}
            {!isBatchSaved && (
              <button
                onClick={handleSaveAndPostBatch}
                disabled={isSavingBatch || validationErrors.length > 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors"
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>{saveProgress.statusText}</span>
            <span className="font-mono">{Math.round((saveProgress.current / saveProgress.total) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Interactive Table of Valid Documents (Accordion) */}
      {documents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
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

          <div className="space-y-3">
            {documents.map((doc, docIdx) => {
              const isExpanded = !!expandedRefs[doc.ref];
              const docTypeBadgeColor = 
                doc.doc_type.includes('فاتورة') ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' :
                doc.doc_type.includes('أمر') ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800' :
                'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800';

              return (
                <div 
                  key={doc.ref}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
                >
                  {/* Document Header Row (Parent) */}
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleDocExpand(doc.ref)}
                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                        title={isExpanded ? 'طي الأصناف' : 'عرض الأصناف'}
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>

                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200">
                        {doc.ref}
                      </span>

                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${docTypeBadgeColor}`}>
                        {doc.doc_type}
                      </span>

                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {doc.party_name}
                      </span>

                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {doc.date}
                      </span>

                      {doc.warehouse_name && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {doc.warehouse_name}
                        </span>
                      )}

                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {doc.payment_type === 'cash' ? 'نقدي' : 'آجل'}
                      </span>
                    </div>

                    {/* Totals & Generated Numbers */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Generated Numbers (shown after save) */}
                      {doc.created_document_number && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-mono font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>رقم الفاتورة: {doc.created_document_number}</span>
                        </div>
                      )}

                      {doc.created_journal_number && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-mono font-bold">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>رقم القيد: {doc.created_journal_number}</span>
                        </div>
                      )}

                      {/* Totals Pill */}
                      <div className="flex items-center gap-2 text-xs font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
                        <span className="text-slate-500">الإجمالي:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{formatMoney(doc.subtotal)}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-500">الضريبة:</span>
                        <span className="text-emerald-600 font-bold">{formatMoney(doc.tax_amount)}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-500">الصافي:</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">{formatMoney(doc.total_amount)}</span>
                      </div>

                      {/* Delete Document Button */}
                      {!isBatchSaved && (
                        <button
                          onClick={() => handleDeleteDocument(doc.ref)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
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
                              <th className="p-3 w-10 text-center">#</th>
                              <th className="p-3">كود الصنف</th>
                              <th className="p-3">اسم الصنف</th>
                              <th className="p-3 text-center">الكمية</th>
                              <th className="p-3 text-center">السعر</th>
                              <th className="p-3 text-center">الخصم</th>
                              <th className="p-3 text-center">الصافي قبل الضريبة</th>
                              <th className="p-3 text-center">ض.ق.م (%)</th>
                              <th className="p-3 text-center">قيمة ض.ق.م</th>
                              <th className="p-3 text-center">ض.خ.أ (%)</th>
                              <th className="p-3 text-center">قيمة ض.خ.أ</th>
                              <th className="p-3 text-center font-extrabold text-slate-900 dark:text-white">الإجمالي</th>
                              {!isBatchSaved && <th className="p-3 text-center w-24">إجراءات</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                            {doc.items.map((item, itemIdx) => (
                              <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="p-3 text-center text-slate-400 font-sans">{itemIdx + 1}</td>
                                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{item.product_code}</td>
                                <td className="p-3 font-sans font-medium text-slate-900 dark:text-slate-100">{item.product_name}</td>
                                <td className="p-3 text-center font-bold text-slate-900 dark:text-white">{item.quantity}</td>
                                <td className="p-3 text-center">{formatMoney(item.unit_price)}</td>
                                <td className="p-3 text-center text-amber-600 font-bold">{formatMoney(item.discount_amount)}</td>
                                <td className="p-3 text-center text-blue-600 font-bold">{formatMoney(item.subtotal)}</td>
                                <td className="p-3 text-center text-slate-500 font-sans">{item.vat_rate}%</td>
                                <td className="p-3 text-center text-emerald-600 font-bold">{formatMoney(item.vat_amount)}</td>
                                <td className="p-3 text-center text-slate-500 font-sans">{item.withholding_tax_rate}%</td>
                                <td className="p-3 text-center text-purple-600 font-bold">{formatMoney(item.withholding_tax_amount)}</td>
                                <td className="p-3 text-center font-extrabold text-emerald-700 dark:text-emerald-300">{formatMoney(item.total)}</td>
                                {!isBatchSaved && (
                                  <td className="p-3 text-center">
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                <span>تعديل بند الصنف ({editingItem.item.product_name})</span>
              </h3>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
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
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">نسبة ض.ق.م (%):</label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  value={editingItem.item.vat_rate}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, vat_rate: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">نسبة ض.خ.أ (%):</label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  value={editingItem.item.withholding_tax_rate}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, withholding_tax_rate: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
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
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleSaveItemEdit(editingItem.item)}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
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

export default DocumentImport;
