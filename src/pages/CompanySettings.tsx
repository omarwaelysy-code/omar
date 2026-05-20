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
  vat_enabled: boolean;
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
      <label className="block text-sm font-semibold text-slate-500 mb-2">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/5 transition-all outline-none"
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
                  className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 text-sm font-medium`}
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
                    className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-sm font-medium ${value === option.code ? 'bg-indigo-50 text-indigo-600' : 'text-slate-705 text-slate-700'}`}
                  >
                    <div className="flex items-center gap-2">
                       {renderOption(option)}
                    </div>
                    {value === option.code && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-slate-400 italic font-medium">
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
    inventory_cost_method: 'wac',
    vat_enabled: false
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
            inventory_cost_method: company.settings?.inventory_cost_method || 'wac',
            vat_enabled: company.settings?.vat_enabled || company.vat_enabled || false
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
        vat_enabled: data.vat_enabled,
        settings: {
          ...originalSettings,
          currency: data.currency,
          enable_multi_currency: data.enable_multi_currency,
          inventory_cost_method: data.inventory_cost_method || 'wac',
          vat_enabled: data.vat_enabled
        }
      });
      
      // Update local original settings to reflect the save
      setOriginalSettings({
        ...originalSettings,
        currency: data.currency,
        enable_multi_currency: data.enable_multi_currency,
        inventory_cost_method: data.inventory_cost_method || 'wac',
        vat_enabled: data.vat_enabled
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
    return new Date(2024, month, 0).getDate(); // Using 2024 (leap year) to handle Feb 29
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col gap-2 pb-4 border-b border-slate-100">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">
          {t('company_settings.title')}
        </h1>
        <p className="text-slate-400 font-semibold text-sm">
          {t('company_settings.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Card 1: Logo Section */}
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-indigo-600 justify-end">
            <span className="font-bold text-lg">{t('company_settings.logo')}</span>
            <ImageIcon className="w-5 h-5" />
          </div>

          <div className="flex flex-col md:flex-row-reverse items-center gap-6 justify-between">
            {/* Logo box */}
            <div className="w-32 h-32 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center relative overflow-hidden flex-shrink-0">
              {data.logo_url ? (
                <img src={data.logo_url} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
              ) : (
                <Building2 className="w-12 h-12 text-slate-300" />
              )}
              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </div>

            {/* Helper text */}
            <p className="text-slate-400 text-sm font-medium flex-1 text-center md:text-right leading-relaxed">
              {language === 'ar' 
                ? 'يفضّل استخدام صورة مربعة بحجم 512x512 بيكسل على الأقل' 
                : 'Prefer a square image, 512x512px at least'}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-4">
              {data.logo_url && (
                <button
                  type="button"
                  onClick={() => setData(prev => ({ ...prev, logo_url: '' }))}
                  className="px-4 py-2 bg-transparent text-rose-500 hover:text-rose-600 font-bold text-sm transition-colors rounded-xl"
                >
                  {t('common.delete')}
                </button>
              )}
              <button
                type="button"
                onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-sm"
              >
                <Upload size={16} />
                <span>{data.logo_url ? (language === 'ar' ? 'تغيير' : 'Change') : (language === 'ar' ? 'إضافة' : 'Add')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Basic Info */}
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-indigo-600 justify-end">
            <span className="font-bold text-lg">{language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}</span>
            <FileText className="w-5 h-5" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-500 mb-2">
                {t('company_settings.name')}
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-800 font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-500 mb-2">
                {t('company_settings.commercial_register')}
              </label>
              <input
                type="text"
                value={data.commercial_register}
                onChange={(e) => setData({ ...data, commercial_register: e.target.value })}
                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-800 font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-500 mb-2">
                {t('company_settings.tax_number')}
              </label>
              <input
                type="text"
                value={data.tax_number}
                onChange={(e) => setData({ ...data, tax_number: e.target.value })}
                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-800 font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
              />
            </div>

            <div>
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
                    <span className="text-xl">{o.flag}</span>
                    <span className="font-semibold text-base">{language === 'ar' ? o.nameAr : o.name}</span>
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
              <label className="block text-sm font-semibold text-slate-500 mb-2">
                {t('company_settings.address')}
              </label>
              <div className="relative group">
                <MapPin className={`absolute ${dir === 'rtl' ? 'right-5' : 'left-5'} top-4 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors pointer-events-none`} />
                <textarea
                  value={data.address}
                  onChange={(e) => setData({ ...data, address: e.target.value })}
                  rows={3}
                  className={`w-full ${dir === 'rtl' ? 'pr-12 pl-5' : 'pl-12 pr-5'} py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-800 font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all min-h-[100px]`}
                />
              </div>
            </div>

            {/* VAT Toggle inside Card 2 */}
            <div className="md:col-span-2 pt-6 border-t border-slate-100 flex items-center justify-between cursor-pointer select-none"
              onClick={() => setData(prev => ({ ...prev, vat_enabled: !prev.vat_enabled }))}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-800 text-base">
                  {t('company_settings.vat_enabled')}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {t('company_settings.vat_enabled_desc')}
                </span>
              </div>
              <div 
                className={`relative w-14 h-8 rounded-full transition-all duration-300 shadow-inner ${data.vat_enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                  dir === 'rtl'
                    ? (data.vat_enabled ? 'translate-x-[-120%]' : 'translate-x-[-10%]')
                    : (data.vat_enabled ? 'translate-x-[120%]' : 'translate-x-[10%]')
                }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Financial Settings */}
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center gap-2 text-indigo-600 justify-end">
            <span className="font-bold text-lg">{language === 'ar' ? 'الإعدادات المالية' : 'Financial Settings'}</span>
            <Coins className="w-5 h-5" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
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
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{o.flag}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 leading-tight">{language === 'ar' ? o.nameAr : o.name}</span>
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

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-500 mb-2">
                {t('company_settings.fiscal_year_end')}*
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
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-800 font-semibold hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/5 outline-none appearance-none cursor-pointer transition-all"
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
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-800 font-semibold hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/5 outline-none appearance-none cursor-pointer transition-all"
                  >
                    {Array.from({ length: daysInMonth(data.fiscal_year_month) }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d} className="text-slate-900">{d}</option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none transition-transform group-focus-within:rotate-180`} />
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-450 text-slate-400 text-center leading-relaxed mt-2 uppercase tracking-wide">
                * {language === 'ar' 
                  ? 'سيتم تعيين السنة المالية لتنتهي في هذا التاريخ من كل عام.' 
                  : 'Fiscal year will close automatically on this day annually.'}
              </p>
            </div>

            {/* Multi-Currency Toggle inside Card 3 */}
            <div className={`md:col-span-2 pt-6 border-t border-slate-100 flex items-center justify-between cursor-pointer select-none`}
              onClick={() => setData(prev => ({ ...prev, enable_multi_currency: !prev.enable_multi_currency }))}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-800 text-base">
                  {language === 'ar' ? 'تفعيل العملات المتعددة' : 'Enable Multi-Currency'}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {language === 'ar' 
                    ? 'إدارة حسابات الصرف والتحويل الدولي.' 
                    : 'Manage international exchange rates.'}
                </span>
              </div>
              <div 
                className={`relative w-14 h-8 rounded-full transition-all duration-300 shadow-inner ${data.enable_multi_currency ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                  dir === 'rtl'
                    ? (data.enable_multi_currency ? 'translate-x-[-120%]' : 'translate-x-[-10%]')
                    : (data.enable_multi_currency ? 'translate-x-[120%]' : 'translate-x-[10%]')
                }`} />
              </div>
            </div>

            {/* Inventory Costing Policy Selection inside Card 3 */}
            <div className="md:col-span-2 pt-6 border-t border-slate-100 space-y-6">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-indigo-500" />
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 text-base">
                    {t('company_settings.inventory_cost_method')}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {language === 'ar' ? 'حدد الأسلوب المحاسبي لتقييم وطلب بضاعة المخازن.' : 'Select the accounting method used to evaluate stock.'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* WAC Option */}
                <button
                  type="button"
                  onClick={() => setData(prev => ({ ...prev, inventory_cost_method: 'wac' }))}
                  className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} ${
                    data.inventory_cost_method === 'wac'
                      ? 'bg-indigo-50/40 border-indigo-500 text-indigo-900 shadow-sm shadow-indigo-500/5'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-base text-slate-900">
                      {t('company_settings.inventory_cost_method.wac')}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      data.inventory_cost_method === 'wac' ? 'border-indigo-500' : 'border-slate-300'
                    }`}>
                      {data.inventory_cost_method === 'wac' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 leading-relaxed font-semibold">
                    {language === 'ar' ? 'أكثر شيوعاً واستقراراً للأسعار المستمرة.' : 'More common and stable for fluctuating prices.'}
                  </span>
                </button>

                {/* FIFO Option */}
                <button
                  type="button"
                  onClick={() => setData(prev => ({ ...prev, inventory_cost_method: 'fifo' }))}
                  className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} ${
                    data.inventory_cost_method === 'fifo'
                      ? 'bg-indigo-50/40 border-indigo-500 text-indigo-900 shadow-sm shadow-indigo-500/5'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-base text-slate-900">
                      {t('company_settings.inventory_cost_method.fifo')}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      data.inventory_cost_method === 'fifo' ? 'border-indigo-500' : 'border-slate-300'
                    }`}>
                      {data.inventory_cost_method === 'fifo' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 leading-relaxed font-semibold">
                    {language === 'ar' ? 'مثالي في حالات توريد بضاعة ذات صلاحية محددة.' : 'Ideal for perishable goods.'}
                  </span>
                </button>
              </div>

              {/* Policy Definition Display */}
              <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex gap-3.5 transition-all duration-300">
                <Info size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-semibold">
                    {language === 'ar' ? 'تفاصيل السياسة المحاسبية:' : 'Policy details:'}
                  </h4>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                    {data.inventory_cost_method === 'fifo'
                      ? t('company_settings.inventory_cost_method.fifo.desc')
                      : t('company_settings.inventory_cost_method.wac.desc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-4 flex justify-start pb-20">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/10 font-bold active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>{t('common.save')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
