import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { X, Printer, Download, FileText, AlertTriangle } from 'lucide-react';
import { TemplateRenderer, normalizeDocumentData, TemplateLayout } from './TemplateRenderer';
import html2pdf from 'html2pdf.js';
import { useNotification } from '../contexts/NotificationContext';

interface PaperSize {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: string;
}

interface Template {
  id: string;
  company_id: string;
  name: string;
  description: string;
  paper_size_id: string;
  orientation: 'portrait' | 'landscape';
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  is_active: boolean;
  layout?: TemplateLayout;
  document_type?: string;
  is_default?: boolean;
}

interface TemplatePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: string;
  documentData: any;
  title: string;
}

const DEFAULT_TEMPLATE_LAYOUT: TemplateLayout = {
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
        text: 'مستند ERP',
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

export function TemplatePrintModal({
  isOpen,
  onClose,
  documentType,
  documentData,
  title
}: TemplatePrintModalProps) {
  const { dir, language } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const toast = {
    success: (msg: string) => showNotification(msg, 'success'),
    error: (msg: string) => showNotification(msg, 'error'),
    info: (msg: string) => showNotification(msg, 'info')
  };
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, documentType]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const [allTemplates, allSizes, companyData] = await Promise.all([
        dbService.list<Template>('templates', user?.company_id || ''),
        dbService.list<PaperSize>('paper_sizes', user?.company_id || ''),
        user?.company_id ? dbService.get<any>('companies', user.company_id) : Promise.resolve(null)
      ]);

      setPaperSizes(allSizes);
      setCompany(companyData);

      // Filter templates by target document type and active status
      const matched = allTemplates.filter(t => t.document_type === documentType && t.is_active);
      setTemplates(matched);

      if (matched.length > 0) {
        // Find default template, or select the first one
        const defaultTemp = matched.find(t => t.is_default) || matched[0];
        setSelectedTemplate(defaultTemp);
      } else {
        // Create a fallback mock template
        const fallbackTemplate: Template = {
          id: 'fallback',
          company_id: user?.company_id || '',
          name: language === 'ar' ? 'قالب النظام الافتراضي' : 'Default System Template',
          description: '',
          paper_size_id: 'a4',
          orientation: 'portrait',
          margin_top: 10,
          margin_bottom: 10,
          margin_left: 10,
          margin_right: 10,
          is_active: true,
          layout: {
            ...DEFAULT_TEMPLATE_LAYOUT,
            header: DEFAULT_TEMPLATE_LAYOUT.header.map(el => {
              if (el.id === 'title-default') {
                return {
                  ...el,
                  properties: { ...el.properties, text: title }
                };
              }
              return el;
            })
          }
        };
        setTemplates([fallbackTemplate]);
        setSelectedTemplate(fallbackTemplate);
      }
    } catch (e) {
      console.error('Failed to load print templates:', e);
      toast.error(language === 'ar' ? 'فشل تحميل قوالب الطباعة' : 'Failed to load printing templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedTemplate) return;
    
    const printArea = document.getElementById('template-print-capture-area');
    if (!printArea) {
      toast.error('Print capture element not found');
      return;
    }

    const opt = {
      margin: [
        Number(selectedTemplate.margin_top || 10),
        Number(selectedTemplate.margin_right || 10),
        Number(selectedTemplate.margin_bottom || 10),
        Number(selectedTemplate.margin_left || 10)
      ],
      filename: `${title}-${documentData.invoice_number || documentData.voucher_number || documentData.entry_number || 'doc'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2.5, useCORS: true, logging: false },
      jsPDF: { 
        unit: 'mm', 
        format: selectedTemplate.paper_size_id === 'custom' ? 'a4' : (selectedTemplate.paper_size_id || 'a4'), 
        orientation: selectedTemplate.orientation || 'portrait' 
      }
    };

    try {
      showNotification(language === 'ar' ? 'جاري تحضير ملف PDF...' : 'Preparing PDF file...', 'info');
      // @ts-ignore
      const html2pdfFunc = html2pdf.default || html2pdf;
      await html2pdfFunc().set(opt).from(printArea).save();
      showNotification(language === 'ar' ? 'تم تحميل الملف بنجاح' : 'PDF downloaded successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'فشل تحميل الملف' : 'Failed to download PDF', 'error');
    }
  };

  const handlePrint = () => {
    const printArea = document.getElementById('template-print-capture-area');
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
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
            body {
              font-family: "Cairo", sans-serif;
              margin: 0;
              padding: 0;
              background: white;
            }
            @page {
              size: ${selectedTemplate?.paper_size_id || 'A4'} ${selectedTemplate?.orientation || 'portrait'};
              margin: 0;
            }
          </style>
        </head>
        <body dir="${dir}">
          ${printArea.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.parent.document.body.removeChild(window.frameElement);
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  if (!isOpen) return null;

  const normalized = selectedTemplate 
    ? normalizeDocumentData(documentType, documentData, company, user)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-[1200px] h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-zinc-200" dir={dir}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-lg font-black text-zinc-900">{language === 'ar' ? 'طباعة المستند بالنموذج' : 'Print Document with Template'}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{language === 'ar' ? 'اختر القالب المفضل للطباعة أو التصدير' : 'Select print layout style'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-zinc-200/50 text-zinc-400 hover:text-zinc-700 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left/Right Sidebar: Templates Selector */}
          <div className="w-72 border-r border-zinc-100 p-4 overflow-y-auto space-y-4">
            <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'القوالب المتاحة' : 'Available Templates'}</h3>
            
            {loading ? (
              <p className="text-xs text-zinc-400 text-center py-4">{language === 'ar' ? 'جاري تحميل القوالب...' : 'Loading layouts...'}</p>
            ) : (
              <div className="space-y-2">
                {templates.map(temp => (
                  <div
                    key={temp.id}
                    onClick={() => setSelectedTemplate(temp)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedTemplate?.id === temp.id
                        ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                        : 'border-zinc-200 hover:bg-zinc-50'
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

          {/* Center Area: Preview Sheet */}
          <div className="flex-1 bg-zinc-100 overflow-auto p-8 flex items-start justify-center">
            {selectedTemplate && normalized && (
              <div id="template-print-capture-area" className="bg-white shadow-lg">
                <TemplateRenderer
                  layout={selectedTemplate.layout || DEFAULT_TEMPLATE_LAYOUT}
                  data={normalized}
                  scale={3.2}
                  margin={{
                    top: Number(selectedTemplate.margin_top || 10),
                    bottom: Number(selectedTemplate.margin_bottom || 10),
                    left: Number(selectedTemplate.margin_left || 10),
                    right: Number(selectedTemplate.margin_right || 10)
                  }}
                  width={selectedTemplate.paper_size_id === 'receipt_58' ? 58 : selectedTemplate.paper_size_id === 'receipt_80' ? 80 : 210}
                  dir={dir}
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-all"
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-zinc-800 text-white px-5 py-2.5 rounded-xl hover:bg-zinc-950 transition-all font-bold text-sm shadow-md"
          >
            <Download size={16} />
            <span>{language === 'ar' ? 'تحميل PDF' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-md"
          >
            <Printer size={16} />
            <span>{language === 'ar' ? 'طباعة مباشرة' : 'Print Now'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
