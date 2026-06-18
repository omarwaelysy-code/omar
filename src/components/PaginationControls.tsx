import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  className?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({ 
  page, 
  limit, 
  total, 
  onPageChange, 
  onLimitChange,
  className = 'border-t border-slate-200'
}) => {
  const { t, dir } = useLanguage();
  const totalPages = Math.ceil(total / limit) || 1;

  // Local state to prevent React controlled input lag and reset issues
  const [inputValue, setInputValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (total < 50 && total > 0) {
        setInputValue(`${total}/${total}`);
      } else {
        setInputValue(limit.toString());
      }
    }
  }, [limit, total, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    // Only update parent state if it's a valid number
    const numeric = val.replace(/[^0-9]/g, '');
    const num = Number(numeric);
    if (num > 0 && num <= 1000) {
      onLimitChange(num);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // On focus, show the actual numeric limit so it's clean and easy to edit
    setInputValue(limit.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numeric = inputValue.replace(/[^0-9]/g, '');
    const num = Number(numeric);
    if (!num || num <= 0 || num > 1000) {
      // fallback to default
      onLimitChange(50);
      setInputValue('50');
    } else {
      onLimitChange(num);
      if (total < 50 && total > 0) {
        setInputValue(`${total}/${total}`);
      } else {
        setInputValue(num.toString());
      }
    }
  };

  return (
    <div className={`p-4 flex items-center justify-between bg-white text-sm ${className}`}>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-slate-600 font-medium">
          {t('common.items_per_page')}:
          <input 
            type="text" 
            value={inputValue} 
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-20 px-2 py-1 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-center font-bold text-slate-700 bg-slate-50 transition-all outline-none"
          />
        </label>
        <span className="text-slate-500">
          {t('common.total_results')}: <strong className="text-slate-800">{total}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors border border-slate-100 hover:border-slate-200 active:scale-95 transition-transform"
        >
          {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <span className="text-slate-600 font-bold px-2">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors border border-slate-100 hover:border-slate-200 active:scale-95 transition-transform"
        >
          {dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
};
