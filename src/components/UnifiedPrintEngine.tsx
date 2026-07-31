import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { X, Printer, Download, FileText, Settings, Sliders } from 'lucide-react';
import { TemplateRenderer, normalizeDocumentData } from './TemplateRenderer';
import { useNotification } from '../contexts/NotificationContext';
import { PaperSize, Template, PrintProfile } from '../types';

const DEFAULT_TEMPLATE_LAYOUT = {
  headerHeight: 70,
  footerHeight: 50,
  watermarkOpacity: 0.15,
  watermarkRotation: -45,
  header: [
    {
      id: 'title-default',
      type: 'text',
      x: 75,
      y: 12,
      width: 60,
      height: 10,
      properties: {
        text: 'مستند النظام الافتراضي',
        fontSize: 18,
        bold: true,
        align: 'center',
        color: '#18181b',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'doc-num-label',
      type: 'text',
      x: 10,
      y: 10,
      width: 30,
      height: 6,
      properties: {
        text: 'رقم المستند:',
        fontSize: 10,
        bold: true,
        align: 'right',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'doc-num-val',
      type: 'variable',
      x: 40,
      y: 10,
      width: 30,
      height: 6,
      properties: {
        fontSize: 10,
        align: 'right',
        fontFamily: 'Cairo'
      },
      binding: 'document_number'
    },
    {
      id: 'doc-date-label',
      type: 'text',
      x: 140,
      y: 10,
      width: 30,
      height: 6,
      properties: {
        text: 'التاريخ:',
        fontSize: 10,
        bold: true,
        align: 'left',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'doc-date-val',
      type: 'variable',
      x: 170,
      y: 10,
      width: 30,
      height: 6,
      properties: {
        fontSize: 10,
        align: 'left',
        fontFamily: 'Cairo'
      },
      binding: 'date'
    }
  ],
  details: {
    columns: [
      { id: 'product_code', label: 'الكود / Code', field: 'product_code', width: 20 },
      { id: 'product_name', label: 'البيان / Details', field: 'product_name', width: 50 },
      { id: 'quantity', label: 'الكمية / Qty', field: 'quantity', width: 15 },
      { id: 'total', label: 'الإجمالي / Total', field: 'total', width: 15 }
    ],
    properties: {
      fontSize: 10,
      borderColor: '#e4e4e7',
      boldHeader: true,
      headerBgColor: '#f4f4f5',
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
      id: 'total-label',
      type: 'text',
      x: 130,
      y: 10,
      width: 35,
      height: 6,
      properties: {
        text: 'الإجمالي النهائي:',
        fontSize: 11,
        bold: true,
        align: 'left',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'total-val',
      type: 'variable',
      x: 165,
      y: 10,
      width: 35,
      height: 6,
      properties: {
        fontSize: 11,
        bold: true,
        align: 'left',
        fontFamily: 'Cairo'
      },
      binding: 'net_total'
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

        // Filter templates by document type & status
        const matchedTemplates = allTemplates.filter(t => t.document_type === opType && t.is_active);
        setTemplates(matchedTemplates);
        setPrintProfiles(allProfiles);

        // 1. Resolve Template
        let activeTemplate: Template | null = null;
        if (templateId) {
          activeTemplate = matchedTemplates.find(t => t.id === templateId) || null;
        }
        if (!activeTemplate && matchedTemplates.length > 0) {
          activeTemplate = matchedTemplates.find(t => t.is_default) || matchedTemplates[0];
        }

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

  const handlePrint = () => {
    const printArea = document.getElementById('unified-print-capture-area');
    if (!printArea) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${titleText}</title>
          <style>
            body {
              font-family: "Cairo", sans-serif;
              margin: 0;
              padding: 0;
              background: white;
            }
            @page {
              size: ${activePaperSizeId === 'custom' ? `${actualWidthMm}mm ${actualHeightMm}mm` : `${activePaperSizeId} ${activeOrientation}`};
              margin: 0;
            }
            .print-page {
              box-shadow: none !important;
              margin: 0 !important;
            }
          </style>
        </head>
        <body dir="${dir}">
          ${printArea.innerHTML}
          <script>
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                try {
                  window.parent.document.body.removeChild(window.frameElement);
                } catch (e) {}
              }, 100);
            }, 300);
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  const handleDownloadPDF = async () => {
    if (!documentData) {
      showNotification(language === 'ar' ? 'بيانات المستند غير متوفرة' : 'No document data available', 'error');
      return;
    }

    const normalized = normalizeDocumentData(operationType, documentData, company, user);
    if (!normalized) {
      showNotification(language === 'ar' ? 'فشل معالجة البيانات' : 'Could not normalize document data', 'error');
      return;
    }

    const companyDto = {
      name: normalized.company_name || '',
      logoUrl: normalized.company_logo || '',
      taxNumber: normalized.company_tax_number || '',
      phone: normalized.company_phone || ''
    };

    const itemsDto = (normalized.items || []).map(itm => ({
      product_code: String(itm.product_code || '-'),
      product_name: String(itm.product_name || '-'),
      quantity: String(itm.quantity || '0'),
      unit: String(itm.unit || 'حبة'),
      unit_price: String(itm.unit_price || '0'),
      discount: String(itm.discount || '0'),
      vat_amount: String(itm.vat_amount || '0'),
      total: String(itm.total || '0')
    }));

    let templateName = 'ReportTemplate';
    let dto: any = {};

    if (operationType === 'invoices' || operationType === 'returns' || operationType === 'sales_orders') {
      templateName = 'SalesInvoicePdf';
      dto = {
        company: companyDto,
        invoice_number: normalized.document_number || '',
        date: normalized.date || '',
        due_date: documentData?.due_date || documentData?.payment_terms_date || '',
        payment_method: normalized.payment_method || '',
        customer_name: normalized.customer_name || '',
        customer_tax_number: normalized.customer_tax_number || documentData?.customer_tax_number || documentData?.tax_number || '',
        customer_phone: normalized.customer_phone,
        items: itemsDto,
        subtotal: String(normalized.subtotal || '0'),
        discount_amount: String(normalized.discount_amount || '0'),
        vat_amount: String(normalized.vat_amount || '0'),
        net_total: String(normalized.net_total || '0'),
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
        date: normalized.date || '',
        due_date: documentData?.due_date || documentData?.payment_terms_date || '',
        payment_method: normalized.payment_method || '',
        supplier_name: normalized.supplier_name || '',
        supplier_tax_number: normalized.supplier_tax_number || documentData?.supplier_tax_number || documentData?.tax_number || '',
        supplier_phone: normalized.supplier_phone,
        items: itemsDto,
        subtotal: String(normalized.subtotal || '0'),
        discount_amount: String(normalized.discount_amount || '0'),
        vat_amount: String(normalized.vat_amount || '0'),
        net_total: String(normalized.net_total || '0'),
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

    try {
      showNotification(language === 'ar' ? 'جاري تحضير ملف PDF...' : 'Preparing PDF file...', 'info');
      
      const response = await fetch('/api/erp/print/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateName,
          dto
        })
      });

      if (!response.ok) {
        let serverErrorMsg = 'Failed to generate PDF on server';
        try {
          const errorJson = await response.json();
          if (errorJson && errorJson.exceptionMessage) {
            console.error("=================== BACKEND PDF FAILURE DETAILS ===================");
            console.error(`- Failed File: ${errorJson.failedFile}`);
            console.error(`- Line Number: ${errorJson.lineNumber}`);
            console.error(`- Exception Name: ${errorJson.exceptionName}`);
            console.error(`- Exception Message: ${errorJson.exceptionMessage}`);
            console.error(`- Stack Trace:\n${errorJson.stackTrace}`);
            console.error("===================================================================");
            serverErrorMsg = `Backend PDF Error: ${errorJson.exceptionMessage} (at ${errorJson.failedFile}:${errorJson.lineNumber})`;
          } else if (errorJson && errorJson.error) {
            serverErrorMsg = `Backend PDF Error: ${errorJson.error}`;
          }
        } catch (e) {
          // Fallback to generic message if parsing fails
        }
        throw new Error(serverErrorMsg);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${operationType}_${normalized.document_number || 'doc'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showNotification(language === 'ar' ? 'تم تحميل الملف بنجاح' : 'PDF downloaded successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'فشل تحميل الملف' : 'Failed to download PDF', 'error');
    }
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
                <div className="space-y-2">
                  {templates.map(temp => (
                    <div
                      key={temp.id}
                      onClick={() => setSelectedTemplate(temp)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedTemplate?.id === temp.id
                          ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                          : 'border-zinc-200 hover:bg-zinc-50 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-800">{temp.name}</span>
                        {temp.is_default && (
                          <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded">
                            {language === 'ar' ? 'افتراضي' : 'Default'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 capitalize">
                        {temp.paper_size_id} - {temp.orientation === 'portrait' ? (language === 'ar' ? 'طولي' : 'Portrait') : (language === 'ar' ? 'عرضي' : 'Landscape')}
                      </p>
                    </div>
                  ))}
                </div>
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
                  layout={selectedTemplate.layout || DEFAULT_TEMPLATE_LAYOUT}
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
