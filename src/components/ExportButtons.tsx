import React from 'react';
import { Download, FileText } from 'lucide-react';

interface ExportButtonsProps {
  onExportExcel: () => void;
  onExportPDF: () => void;
  className?: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ 
  onExportExcel, 
  onExportPDF,
  className = ""
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button 
        onClick={onExportExcel}
        className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-zinc-200 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
        title="تصدير إكسل"
      >
        <Download size={20} className="text-emerald-600" />
        <span className="hidden sm:inline">إكسل</span>
      </button>
      <button 
        onClick={onExportPDF}
        className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-zinc-200 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
        title="تصدير PDF"
      >
        <FileText size={20} className="text-red-600" />
        <span className="hidden sm:inline">PDF</span>
      </button>
    </div>
  );
};
