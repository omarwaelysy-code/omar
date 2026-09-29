import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Check } from 'lucide-react';

export interface SearchableSelectProps {
  options: any[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  icon?: React.ReactNode;
  renderOption: (option: any) => React.ReactNode;
  filterFn: (option: any, query: string) => boolean;
  dir: 'rtl' | 'ltr';
}

export function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  label, 
  placeholder, 
  icon, 
  renderOption, 
  filterFn, 
  dir 
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.code === value);
  const filteredOptions = options.filter(o => filterFn(o, query));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[11px] font-bold text-slate-600 mb-0.5">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 h-8 bg-white border border-slate-200 rounded-lg hover:border-indigo-500 transition-all outline-none text-xs cursor-pointer"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {icon}
          {selectedOption ? (
            renderOption(selectedOption)
          ) : (
            <span className="text-zinc-400 font-medium">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                <input
                  type="text"
                  autoFocus
                  placeholder={dir === 'rtl' ? 'بحث...' : 'Search...'}
                  className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-xs font-medium`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => {
                      onChange(option.code);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-medium cursor-pointer ${value === option.code ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'}`}
                  >
                    <div className="flex items-center gap-2">
                       {renderOption(option)}
                    </div>
                    {value === option.code && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 italic font-medium">
                  {dir === 'rtl' ? 'لا توجد نتائج' : 'No results found'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
