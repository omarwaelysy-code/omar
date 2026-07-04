import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ExportButtonsProps {
  onExportExcel: () => void;
  onExportPDF: () => void;
  onExportExcelSelected?: () => void;
  onExportPDFSelected?: () => void;
  selectedCount?: number;
  className?: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ 
  onExportExcel, 
  onExportPDF,
  onExportExcelSelected,
  onExportPDFSelected,
  selectedCount = 0,
  className = ""
}) => {
  const { t, language } = useLanguage();
  const [showExcelMenu, setShowExcelMenu] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  
  const excelRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (excelRef.current && !excelRef.current.contains(event.target as Node)) {
        setShowExcelMenu(false);
      }
      if (pdfRef.current && !pdfRef.current.contains(event.target as Node)) {
        setShowPdfMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAr = language === 'ar';

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
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-zinc-200 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
          title={t('common.export_excel')}
        >
          <Download size={20} className="text-emerald-600" />
          <span className="hidden sm:inline">Excel</span>
          {selectedCount > 0 && <ChevronDown size={14} className="text-zinc-400" />}
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
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-zinc-200 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
          title={t('common.export_pdf')}
        >
          <FileText size={20} className="text-red-600" />
          <span className="hidden sm:inline">PDF</span>
          {selectedCount > 0 && <ChevronDown size={14} className="text-zinc-400" />}
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
              className="w-full text-right px-4 py-2 hover:bg-red-50 rounded-xl text-xs font-bold text-red-750 border-t border-zinc-50"
            >
              {isAr ? `تصدير المحدد فقط (${selectedCount})` : `Export Selected Only (${selectedCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
