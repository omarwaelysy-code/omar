import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const isArabic = language === 'ar';
  const targetLanguage = isArabic ? 'en' : 'ar';
  const targetLabel = isArabic ? 'English' : 'العربية';

  return (
    <button
      type="button"
      onClick={() => setLanguage(targetLanguage)}
      className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl text-slate-700 font-semibold text-sm transition-all shadow-xs active:scale-95 cursor-pointer"
      title={isArabic ? 'Switch to English' : 'التحويل إلى العربية'}
    >
      <Globe size={16} className="text-[#1B853A]" />
      <span>{targetLabel}</span>
    </button>
  );
};

