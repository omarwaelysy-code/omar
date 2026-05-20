import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Upload, 
  Globe, 
  Coins, 
  Calendar, 
  MapPin, 
  FileText, 
  Save,
  Loader2,
  Image as ImageIcon,
  Search,
  ChevronDown,
  Check,
  Boxes,
  Info
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { COUNTRIES, CURRENCIES, MONTHS } from '../constants/company';
import toast from 'react-hot-toast';

interface CompanyData {
  id: string;
  name: string;
  logo_url: string;
  commercial_register: string;
  tax_number: string;
  country: string;
  address: string;
  currency: string;
  fiscal_year_day: number;
  fiscal_year_month: number;
  enable_multi_currency: boolean;
  inventory_cost_method?: 'wac' | 'fifo';
}

// Searchable Select Component
interface SearchableSelectProps {
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

function SearchableSelect({ options, value, onChange, label, placeholder, icon, renderOption, filterFn, dir }: SearchableSelectProps) {
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
      <label className="block text-sm font-medium text-zinc-700 mb-2">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-white border border-zinc-200 rounded-lg hover:border-emerald-500 transition-all outline-none"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {icon}
          {selectedOption ? (
            renderOption(selectedOption)
          ) : (
            <span className="text-zinc-400">{placeholder}</span>
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
            className="absolute z-50 w-full mt-2 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-zinc-100 bg-zinc-50">
              <div className="relative">
                <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400`} />
                <input
                  type="text"
                  autoFocus
                  placeholder={dir === 'rtl' ? 'بحث...' : 'Search...'}
                  className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm`}
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
                    className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 transition-colors text-sm ${value === option.code ? 'bg-emerald-50 text-emerald-600' : 'text-zinc-700'}`}
                  >
                    <div className="flex items-center gap-2">
                       {renderOption(option)}
                    </div>
                    {value === option.code && <Check className="w-4 h-4" />}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-zinc-500 italic">
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

export function CompanySettings() {
  const { t, language, dir } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<any>({});
  const [data, setData] = useState<CompanyData>({
    id: '',
    name: '',
    logo_url: '',
    commercial_register: '',
    tax_number: '',
    country: '',
    address: '',
    currency: 'EGP',
    fiscal_year_day: 31,
    fiscal_year_month: 12,
    enable_multi_currency: false,
    inventory_cost_method: 'wac'
  });

  useEffect(() => {
    if (user?.company_id) {
      loadCompanyData();
    }
  }, [user?.company_id]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      const company = await dbService.get<any>('companies', user!.company_id);
      if (company) {
        let fday = 31, fmonth = 12;
        if (company.fiscal_year_end) {
          // Standard date string format is YYYY-MM-DD
          const parts = company.fiscal_year_end.split('-');
          if (parts.length === 3) {
            fday = parseInt(parts[2]);
            fmonth = parseInt(parts[1]);
          } else {
            // Fallback for native Date objects or other formats
            const d = new Date(company.fiscal_year_end);
            if (!isNaN(d.getTime())) {
              fday = d.getUTCDate();
              fmonth = d.getUTCMonth() + 1;
            }
          }
        }

          setOriginalSettings(company.settings || {});
          setData({
            id: company.id,
            name: company.name || '',
            logo_url: company.logo_url || '',
            commercial_register: company.commercial_register || '',
            tax_number: company.tax_number || '',
            country: company.country || '',
            address: company.address || '',
            currency: company.settings?.currency || company.currency || 'EGP',
            fiscal_year_day: fday,
            fiscal_year_month: fmonth,
            enable_multi_currency: company.settings?.enable_multi_currency || false,
            inventory_cost_method: company.settings?.inventory_cost_method || 'wac'
          });
      }
    } catch (error) {
      console.error('Failed to load company data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id) return;

    try {
      setSaving(true);
      
      // Construct a valid ISO date for the current year to store in DB
      // We manually construct the string to avoid timezone shifts from Date.toISOString()
      const currentYear = new Date().getFullYear();
      const monthStr = String(data.fiscal_year_month).padStart(2, '0');
      const dayStr = String(data.fiscal_year_day).padStart(2, '0');
      const fiscalYearEnd = `${currentYear}-${monthStr}-${dayStr}`;
      
      await dbService.update('companies', user.company_id, {
        name: data.name,
        logo_url: data.logo_url,
        commercial_register: data.commercial_register,
        tax_number: data.tax_number,
        country: data.country,
        address: data.address,
        fiscal_year_end: fiscalYearEnd,
        settings: {
          ...originalSettings,
          currency: data.currency,
          enable_multi_currency: data.enable_multi_currency,
          inventory_cost_method: data.inventory_cost_method || 'wac'
        }
      });
      
      // Update local original settings to reflect the save
      setOriginalSettings({
        ...originalSettings,
        currency: data.currency,
        enable_multi_currency: data.enable_multi_currency,
        inventory_cost_method: data.inventory_cost_method || 'wac'
      });
      
      toast.success(t('company_settings.save_success'));
    } catch (error) {
      console.error('Failed to save company settings:', error);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setData(prev => ({ ...prev, logo_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const daysInMonth = (month: number) => {
    return new Date(2024, month, 0).getDate(); // Using 2024 (leap year) to handle 29 Feb
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-12 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3 leading-none italic serif">
            {t('company_settings.title')}
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">
            {t('company_settings.subtitle')}
          </p>
        </div>
        <div className="w-20 h-20 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all">
          <Building2 size={36} />
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Logo Section */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center">
              <div className="w-full aspect-square bg-slate-50 rounded-[2.5rem] border-4 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group transition-all hover:border-emerald-500/50 hover:bg-emerald-50/30">
                {data.logo_url ? (
                  <img src={data.logo_url} alt="Logo" className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                ) : (
                  <Building2 className="w-20 h-20 text-slate-200" />
                )}
                <label className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                  <div className="bg-white text-slate-900 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                    <Upload size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'رفع شعار' : 'Upload Logo'}</span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              </div>
              
              <div className="mt-8 space-y-4 w-full">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  {language === 'ar' 
                    ? 'يفضل استخدام صورة مربعة بحجم 512x512 بيكسل' 
                    : 'Prefer a square image, 512x512px'}
                </p>
                <div className="flex flex-col gap-3">
                   <button 
                    type="button"
                    onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 text-sm"
                  >
                    {language === 'ar' ? 'تغيير الشعار' : 'Change Logo'}
                  </button>
                  {data.logo_url && (
                      <button 
                          type="button" 
                          onClick={() => setData(prev => ({ ...prev, logo_url: '' }))}
                          className="w-full py-4 bg-slate-50 text-red-500 hover:bg-red-50 rounded-2xl font-black transition-all border border-slate-100 text-sm"
                      >
                          {t('common.delete')}
                      </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="lg:col-span-2 space-y-12">
            {/* Basic Info */}
            <div className="bg-white p-10 md:p-14 rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-10">
              <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                 <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <FileText size={24} />
                 </div>
                 <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight">
                    {language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
                 </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em] px-1">
                    {t('company_settings.name')}
                  </label>
                  <input
                    type="text"
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-xl font-black text-slate-900 shadow-inner focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em] px-1">
                    {t('company_settings.commercial_register')}
                  </label>
                  <input
                    type="text"
                    value={data.commercial_register}
                    onChange={(e) => setData({ ...data, commercial_register: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black text-slate-900 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em] px-1">
                    {t('company_settings.tax_number')}
                  </label>
                  <input
                    type="text"
                    value={data.tax_number}
                    onChange={(e) => setData({ ...data, tax_number: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black text-slate-900 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <SearchableSelect
                    label={t('company_settings.country')}
                    placeholder={t('common.select_category')}
                    value={data.country}
                    onChange={(val) => setData({ ...data, country: val })}
                    options={COUNTRIES}
                    dir={dir}
                    icon={<Globe className="w-5 h-5 text-slate-400" />}
                    renderOption={(o) => (
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <span className="text-2xl">{o.flag}</span>
                        <span className="font-black text-lg">{language === 'ar' ? o.nameAr : o.name}</span>
                      </div>
                    )}
                    filterFn={(o, q) => 
                      o.name.toLowerCase().includes(q.toLowerCase()) || 
                      o.nameAr.includes(q) || 
                      o.code.toLowerCase().includes(q.toLowerCase())
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em] px-1">
                    {t('company_settings.address')}
                  </label>
                  <div className="relative group">
                    <MapPin className={`absolute ${dir === 'rtl' ? 'right-5' : 'left-5'} top-5 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} />
                    <textarea
                      value={data.address}
                      onChange={(e) => setData({ ...data, address: e.target.value })}
                      rows={3}
                      className={`w-full ${dir === 'rtl' ? 'pr-14 pl-6' : 'pl-14 pr-6'} py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-lg font-black text-slate-900 focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all shadow-inner min-h-[120px]`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Info */}
            <div className="bg-white p-10 md:p-14 rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-10 relative overflow-hidden group">
              <div className="relative z-10 space-y-10">
                <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                   <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                      <Coins size={24} />
                   </div>
                   <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight">
                      {language === 'ar' ? 'الإعدادات المالية' : 'Financial Settings'}
                   </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div>
                    <SearchableSelect
                      label={t('company_settings.currency')}
                      placeholder={t('common.select_category')}
                      value={data.currency}
                      onChange={(val) => setData({ ...data, currency: val })}
                      options={CURRENCIES}
                      dir={dir}
                      icon={<Coins className="w-5 h-5 text-slate-400" />}
                      renderOption={(o) => (
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{o.flag}</span>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 leading-tight">{language === 'ar' ? o.nameAr : o.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{o.code} ({o.symbol})</span>
                          </div>
                        </div>
                      )}
                      filterFn={(o, q) => 
                        o.name.toLowerCase().includes(q.toLowerCase()) || 
                        o.nameAr.includes(q) || 
                        o.code.toLowerCase().includes(q.toLowerCase())
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
                      {t('company_settings.fiscal_year_end')}
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative group">
                        <select
                          value={data.fiscal_year_month}
                          onChange={(e) => {
                              const m = parseInt(e.target.value);
                              const maxDays = daysInMonth(m);
                              setData({ 
                                  ...data, 
                                  fiscal_year_month: m,
                                  fiscal_year_day: data.fiscal_year_day > maxDays ? maxDays : data.fiscal_year_day
                              });
                          }}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-black hover:bg-slate-100 transition-all outline-none appearance-none focus:ring-4 focus:ring-emerald-500/5"
                        >
                          {MONTHS.map(m => (
                            <option key={m.value} value={m.value} className="text-slate-900">
                              {language === 'ar' ? m.nameAr : m.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none transition-transform group-focus-within:rotate-180`} />
                      </div>
                      <div className="relative group">
                        <select
                          value={data.fiscal_year_day}
                          onChange={(e) => setData({ ...data, fiscal_year_day: parseInt(e.target.value) })}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-black hover:bg-slate-100 transition-all outline-none appearance-none focus:ring-4 focus:ring-emerald-500/5"
                        >
                          {Array.from({ length: daysInMonth(data.fiscal_year_month) }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d} className="text-slate-900">{d}</option>
                          ))}
                        </select>
                        <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none transition-transform group-focus-within:rotate-180`} />
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                       <Calendar size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                       <p className="text-[10px] font-bold text-emerald-800 leading-relaxed uppercase tracking-widest italic">
                          {language === 'ar' 
                            ? 'سيتم إقفال السنة المالية آلياً في هذا اليوم من كل عام.' 
                            : 'Fiscal year will close automatically on this day annually.'}
                       </p>
                    </div>
                  </div>

                  {/* Multi-Currency Toggle */}
                  <div className="md:col-span-2 p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] transition-all hover:bg-slate-100 group/toggle overflow-hidden relative">
                    <div 
                      className="flex items-center justify-between cursor-pointer select-none relative z-10"
                      onClick={() => setData(prev => ({ ...prev, enable_multi_currency: !prev.enable_multi_currency }))}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-slate-900 text-xl tracking-tight">
                          {language === 'ar' ? 'تفعيل العملات المتعددة' : 'Enable Multi-Currency'}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">
                          {language === 'ar' 
                            ? 'إدارة حسابات الصرف والتحويل الدولي.' 
                            : 'Manage international exchange rates.'}
                        </span>
                      </div>
                      <div 
                        className={`relative w-20 h-10 rounded-full transition-all duration-300 shadow-inner ${data.enable_multi_currency ? 'bg-emerald-600' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1.5 w-7 h-7 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                          dir === 'rtl'
                            ? (data.enable_multi_currency ? 'translate-x-[-120%]' : 'translate-x-[-5%]')
                            : (data.enable_multi_currency ? 'translate-x-[120%]' : 'translate-x-[5%]')
                        }`} />
                      </div>
                    </div>
                  </div>

                  {/* Inventory Costing Policy Selection */}
                  <div className="md:col-span-2 p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] transition-all relative space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <Boxes size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-xl tracking-tight">
                          {t('company_settings.inventory_cost_method')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                          {language === 'ar' ? 'حدد الأسلوب المحاسبي لتقييم وطلب بضاعة المخازن.' : 'Select the accounting method used to evaluate stock and calculate COGS.'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* WAC Option */}
                      <button
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, inventory_cost_method: 'wac' }))}
                        className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col gap-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} ${
                          data.inventory_cost_method === 'wac'
                            ? 'bg-emerald-50 border-emerald-500 text-slate-900 shadow-md shadow-emerald-500/5'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-black text-lg text-slate-900">
                            {t('company_settings.inventory_cost_method.wac')}
                          </span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            data.inventory_cost_method === 'wac' ? 'border-emerald-500' : 'border-slate-300'
                          }`}>
                            {data.inventory_cost_method === 'wac' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 leading-relaxed font-semibold">
                          {language === 'ar' ? 'أكثر شيوعاً واستقراراً للأسعار المستمرة.' : 'More common and stable for fluctuating prices.'}
                        </span>
                      </button>

                      {/* FIFO Option */}
                      <button
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, inventory_cost_method: 'fifo' }))}
                        className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col gap-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} ${
                          data.inventory_cost_method === 'fifo'
                            ? 'bg-emerald-50 border-emerald-500 text-slate-900 shadow-md shadow-emerald-500/5'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-black text-lg text-slate-900">
                            {t('company_settings.inventory_cost_method.fifo')}
                          </span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            data.inventory_cost_method === 'fifo' ? 'border-emerald-500' : 'border-slate-300'
                          }`}>
                            {data.inventory_cost_method === 'fifo' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 leading-relaxed font-semibold">
                          {language === 'ar' ? 'مثالي في حالات توريد بضاعة ذات صلاحية محددة.' : 'Ideal for perishable goods and highly accurate matching.'}
                        </span>
                      </button>
                    </div>

                    {/* Policy Definition Display */}
                    <div className="p-5 bg-white border border-slate-200 rounded-2xl flex gap-4 transition-all duration-300">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Info size={16} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                          {language === 'ar' ? 'تعريف وتفاصيل السياسة المحددة:' : 'Policy definition & details:'}
                        </h4>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                          {data.inventory_cost_method === 'fifo'
                            ? t('company_settings.inventory_cost_method.fifo.desc')
                            : t('company_settings.inventory_cost_method.wac.desc')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-10 flex justify-end pb-20">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 font-bold active:scale-95 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span>{t('common.save')}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
