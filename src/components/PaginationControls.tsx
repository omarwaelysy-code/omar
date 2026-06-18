import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({ page, limit, total, onPageChange, onLimitChange }) => {
  const { t, dir } = useLanguage();
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className={`p-4 border-t border-slate-200 flex items-center justify-between bg-white text-sm`}>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-slate-600 font-medium">
          {t('common.items_per_page')}:
          <input 
            type="number" 
            min="1" 
            max="1000"
            value={limit} 
            onChange={(e) => onLimitChange(Number(e.target.value) || 50)}
            className="w-16 px-2 py-1 border border-slate-300 rounded focus:ring-emerald-500 focus:border-emerald-500 text-center"
          />
        </label>
        <span className="text-slate-500">
          {t('common.total_results')}: <strong className="text-slate-800">{total}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors"
        >
          {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <span className="text-slate-600 font-medium px-2">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors"
        >
          {dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
};
