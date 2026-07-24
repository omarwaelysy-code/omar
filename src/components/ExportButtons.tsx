import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Printer, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ExportButtonsProps {
  onExportExcel: () => void;
  onExportPDF: () => void;
  onPrint?: () => void;
  onExportExcelSelected?: () => void;
  onExportPDFSelected?: () => void;
  onPrintSelected?: () => void;
  selectedCount?: number;
  className?: string;
  showPrint?: boolean;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ 
  onExportExcel, 
  onExportPDF,
  onPrint,
  onExportExcelSelected,
  onExportPDFSelected,
  onPrintSelected,
  selectedCount = 0,
  className = "",
  showPrint = true
}) => {
  const { t, language } = useLanguage();
  const [showExcelMenu, setShowExcelMenu] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  
  const excelRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (excelRef.current && !excelRef.current.contains(event.target as Node)) {
        setShowExcelMenu(false);
      }
      if (pdfRef.current && !pdfRef.current.contains(event.target as Node)) {
        setShowPdfMenu(false);
      }
      if (printRef.current && !printRef.current.contains(event.target as Node)) {
        setShowPrintMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAr = language === 'ar';

  const handlePrintClick = () => {
    if (selectedCount > 0 && onPrintSelected) {
      setShowPrintMenu(!showPrintMenu);
    } else if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Excel Export */}
      <div className="relative" ref={excelRef}>
        <button 
          onClick={() => {
            if (selectedCount > 0 && onExportExcelSelected) {
              setShowExcelMenu(!showExcelMenu);
            } else {
              onExportExcel();
            }
          }}
          className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold hover:bg-emerald-100 transition-all active:scale-95 shadow-sm text-xs sm:text-sm"
          title={t('common.export_excel') || (isAr ? 'تصدير اكسيل' : 'Export Excel')}
        >
          <Download size={18} className="text-emerald-600 shrink-0" />
          <span>Excel</span>
          {selectedCount > 0 && <ChevronDown size={14} className="text-emerald-500" />}
        </button>

        {showExcelMenu && selectedCount > 0 && (
          <div className="absolute right-0 mt-1.5 w-48 bg-white border border-zinc-150 rounded-2xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <button
              onClick={() => { onExportExcel(); setShowExcelMenu(false); }}
              className="w-full text-right px-4 py-2 hover:bg-zinc-50 rounded-xl text-xs font-bold text-zinc-700"
            >
              {isAr ? 'تصدير الكل' : 'Export All'}
            </button>
            <button
              onClick={() => { if (onExportExcelSelected) onExportExcelSelected(); setShowExcelMenu(false); }}
              className="w-full text-right px-4 py-2 hover:bg-emerald-50 rounded-xl text-xs font-bold text-emerald-750 border-t border-zinc-50"
            >
              {isAr ? `تصدير المحدد فقط (${selectedCount})` : `Export Selected Only (${selectedCount})`}
            </button>
          </div>
        )}
      </div>

      {/* PDF Export */}
      <div className="relative" ref={pdfRef}>
        <button 
          onClick={() => {
            if (selectedCount > 0 && onExportPDFSelected) {
              setShowPdfMenu(!showPdfMenu);
            } else {
              onExportPDF();
            }
          }}
          className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold hover:bg-rose-100 transition-all active:scale-95 shadow-sm text-xs sm:text-sm"
          title={t('common.export_pdf') || (isAr ? 'تصدير PDF' : 'Export PDF')}
        >
          <FileText size={18} className="text-rose-600 shrink-0" />
          <span>PDF</span>
          {selectedCount > 0 && <ChevronDown size={14} className="text-rose-500" />}
        </button>

        {showPdfMenu && selectedCount > 0 && (
          <div className="absolute right-0 mt-1.5 w-48 bg-white border border-zinc-150 rounded-2xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <button
              onClick={() => { onExportPDF(); setShowPdfMenu(false); }}
              className="w-full text-right px-4 py-2 hover:bg-zinc-50 rounded-xl text-xs font-bold text-zinc-700"
            >
              {isAr ? 'تصدير الكل' : 'Export All'}
            </button>
            <button
              onClick={() => { if (onExportPDFSelected) onExportPDFSelected(); setShowPdfMenu(false); }}
              className="w-full text-right px-4 py-2 hover:bg-rose-50 rounded-xl text-xs font-bold text-rose-750 border-t border-zinc-50"
            >
              {isAr ? `تصدير المحدد فقط (${selectedCount})` : `Export Selected Only (${selectedCount})`}
            </button>
          </div>
        )}
      </div>

      {/* Direct Print Button */}
      {showPrint && (
        <div className="relative" ref={printRef}>
          <button 
            onClick={handlePrintClick}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl font-bold hover:bg-blue-100 transition-all active:scale-95 shadow-sm text-xs sm:text-sm"
            title={isAr ? 'طباعة مباشرة' : 'Direct Print'}
          >
            <Printer size={18} className="text-blue-600 shrink-0" />
            <span>{isAr ? 'طباعة' : 'Print'}</span>
            {selectedCount > 0 && onPrintSelected && <ChevronDown size={14} className="text-blue-500" />}
          </button>

          {showPrintMenu && selectedCount > 0 && onPrintSelected && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white border border-zinc-150 rounded-2xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => { if (onPrint) onPrint(); else window.print(); setShowPrintMenu(false); }}
                className="w-full text-right px-4 py-2 hover:bg-zinc-50 rounded-xl text-xs font-bold text-zinc-700"
              >
                {isAr ? 'طباعة الكل' : 'Print All'}
              </button>
              <button
                onClick={() => { onPrintSelected(); setShowPrintMenu(false); }}
                className="w-full text-right px-4 py-2 hover:bg-blue-50 rounded-xl text-xs font-bold text-blue-750 border-t border-zinc-50"
              >
                {isAr ? `طباعة المحدد فقط (${selectedCount})` : `Print Selected Only (${selectedCount})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
