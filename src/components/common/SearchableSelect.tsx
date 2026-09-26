import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  code?: string;
  subLabel?: string;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel diacritics
    .trim();
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'اختر...',
  searchPlaceholder = 'بحث...',
  emptyText = 'لا توجد نتائج',
  icon,
  disabled = false,
  className = '',
  clearable = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = normalizeArabic(searchTerm);
    return options.filter(opt => {
      const l = normalizeArabic(opt.label || '');
      const c = normalizeArabic(opt.code || '');
      const s = normalizeArabic(opt.subLabel || '');
      return l.includes(q) || c.includes(q) || s.includes(q);
    });
  }, [options, searchTerm]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      // Set initial highlighted index to currently selected option or 0
      const currentIdx = filteredOptions.findIndex(o => o.value === value);
      setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
    }
  }, [isOpen, value]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
        setSearchTerm('');
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen(prev => !prev);
          setSearchTerm('');
        }}
        className={`w-full h-[42px] px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-2 text-start transition-all outline-none ${
          isOpen ? 'ring-2 ring-emerald-500 border-emerald-500 bg-white shadow-sm' : 'hover:bg-zinc-100/70'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      >
        <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
          {icon && <span className="shrink-0 text-zinc-400">{icon}</span>}
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-zinc-900 truncate text-sm">{selectedOption.label}</span>
              {selectedOption.code && (
                <span className="text-[11px] font-mono px-1.5 py-0.5 bg-zinc-200/70 text-zinc-600 rounded">
                  #{selectedOption.code}
                </span>
              )}
            </div>
          ) : (
            <span className="text-zinc-400 font-normal truncate text-sm">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 rounded-full transition-colors"
              title="إلغاء التحديد"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Input Box */}
          <div className="p-2 border-b border-zinc-100 bg-zinc-50/80 sticky top-0 z-10">
            <div className="relative">
              <Search size={16} className="absolute start-2.5 top-2.5 text-zinc-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full text-sm py-1.5 ps-8 pe-8 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-zinc-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    inputRef.current?.focus();
                  }}
                  className="absolute end-2 top-2 p-0.5 text-zinc-400 hover:text-zinc-600 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-zinc-50/80 scrollbar-thin">
            {clearable && !searchTerm && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg text-start flex items-center justify-between text-zinc-400 hover:bg-zinc-50 transition-colors ${
                  !value ? 'bg-zinc-50 font-bold text-zinc-600' : ''
                }`}
              >
                <span>{placeholder}</span>
                {!value && <Check size={16} className="text-zinc-400" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-400">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full px-3 py-2 text-sm rounded-lg text-start flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-800 font-bold'
                        : isHighlighted
                        ? 'bg-zinc-100/70 text-zinc-900'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.code && (
                        <span className="text-[11px] font-mono px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded border border-zinc-200/50">
                          #{opt.code}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={16} className="text-emerald-600 shrink-0 ms-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
