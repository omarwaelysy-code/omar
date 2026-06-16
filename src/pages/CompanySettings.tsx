import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  TrendingUp
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { dbService, apiRequest } from '../services/dbService';
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
  inventory_cost_method?: 'wac' | 'fifo' | 'lifo';
  inventory_cost_method_level?: 'company' | 'item';
  vat_enabled: boolean;
  wht_enabled: boolean;
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
    inventory_cost_method_level: 'item',
    vat_enabled: false,
    wht_enabled: false
  });

  // ─── Exchange Rate Settings state ──────────────────────────────────────────────────
  const [erIsUpdating,   setErIsUpdating]   = useState(false);
  const [erIsTesting,    setErIsTesting]     = useState(false);
  const [erAutoUpdate,   setErAutoUpdate]   = useState(false);
  const [erFrequency,    setErFrequency]    = useState<'daily' | 'weekly'>('daily');
  const [erLastUpdate,   setErLastUpdate]   = useState<string | null>(null);
  const [erConnStatus,   setErConnStatus]   = useState<'idle' | 'ok' | 'error'>('idle');
  const [erLastResult,   setErLastResult]   = useState<string | null>(null);

  /** Update Exchange Rates Now */
  const handleErUpdate = useCallback(async () => {
    if (!data.currency) return;
    setErIsUpdating(true);
    setErLastResult(null);
    try {
      const result = await apiRequest<{
        success: boolean;
        inserted: number;
        updated: number;
        skipped: number;
        message: string;
      }>('/currencies/update-rates', 'POST', { baseCurrency: data.currency });

      if (result.success) {
        const summary = `تم بنجاح — مضاف: ${result.inserted} | محدّث: ${result.updated} | متجاوز: ${result.skipped}`;
        setErLastUpdate(new Date().toLocaleString('ar-EG'));
        setErConnStatus('ok');
        setErLastResult(summary);
        toast.success('تم تحديث أسعار الصرف بنجاح');
      } else {
        setErConnStatus('error');
        setErLastResult(`فشل: ${result.message}`);
        toast.error(`فشل التحديث: ${result.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErConnStatus('error');
      setErLastResult(`خطأ: ${msg}`);
      toast.error(`خطأ: ${msg}`);
    } finally {
      setErIsUpdating(false);
    }
  }, [data.currency]);

  /** Test Connection only (fetch without persisting) */
  const handleErTest = useCallback(async () => {
    setErIsTesting(true);
    setErConnStatus('idle');
    setErLastResult(null);
    try {
      const result = await apiRequest<{
        success: boolean;
        inserted: number;
        updated: number;
        skipped: number;
        message: string;
      }>('/currencies/update-rates', 'POST', { baseCurrency: data.currency || 'EGP' });
      if (result.success) {
        setErConnStatus('ok');
        setErLastResult('الاتصال ناجح — تم استقبال بيانات أسعار الصرف بنجاح');
        toast.success('اختبار الاتصال ناجح');
      } else {
        setErConnStatus('error');
        setErLastResult(`فشل الاتصال: ${result.message}`);
        toast.error('فشل اختبار الاتصال');
      }
    } catch (err: unknown) {
      setErConnStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      setErLastResult(`خطأ الاتصال: ${msg}`);
      toast.error('فشل اختبار الاتصال');
    } finally {
      setErIsTesting(false);
    }
  }, [data.currency]);

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
            inventory_cost_method_level: 'item',
            vat_enabled: company.settings?.vat_enabled || company.vat_enabled || false,
            wht_enabled: company.settings?.wht_enabled || company.wht_enabled || false
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
        wht_enabled: data.wht_enabled,
        settings: {
          ...originalSettings,
          currency: data.currency,
          enable_multi_currency: data.enable_multi_currency,
          inventory_cost_method_level: 'item',
          inventory_cost_method: data.inventory_cost_method || 'wac',
          vat_enabled: data.vat_enabled,
          wht_enabled: data.wht_enabled
        }
      });
      
      // Update local original settings to reflect the save
      setOriginalSettings({
        ...originalSettings,
        currency: data.currency,
        enable_multi_currency: data.enable_multi_currency,
        inventory_cost_method_level: 'item',
        inventory_cost_method: data.inventory_cost_method || 'wac',
        vat_enabled: data.vat_enabled,
        wht_enabled: data.wht_enabled
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

            {/* WHT Toggle inside Card 2 */}
            <div className="md:col-span-2 pt-6 border-t border-slate-100 flex items-center justify-between cursor-pointer select-none"
              onClick={() => setData(prev => ({ ...prev, wht_enabled: !prev.wht_enabled }))}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-800 text-base">
                  {t('company_settings.wht_enabled')}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {t('company_settings.wht_enabled_desc')}
                </span>
              </div>
              <div 
                className={`relative w-14 h-8 rounded-full transition-all duration-300 shadow-inner ${data.wht_enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                  dir === 'rtl'
                    ? (data.wht_enabled ? 'translate-x-[-120%]' : 'translate-x-[-10%]')
                    : (data.wht_enabled ? 'translate-x-[120%]' : 'translate-x-[10%]')
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

          </div>
        </div>

        {/* Card 4: Exchange Rate Settings — إعدادات أسعار الصرف */}
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-6" dir="rtl">
          {/* Card header */}
          <div className="flex items-center gap-2 text-indigo-600 justify-end">
            <span className="font-bold text-lg">إعدادات أسعار الصرف</span>
            <TrendingUp className="w-5 h-5" />
          </div>

          {/* Provider info row */}
          <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-5 py-4 border border-slate-100">
            <div className="flex items-center gap-3">
              {erConnStatus === 'ok'  && <Wifi    className="w-5 h-5 text-emerald-500" />}
              {erConnStatus === 'error' && <WifiOff className="w-5 h-5 text-rose-500" />}
              {erConnStatus === 'idle'  && <Wifi    className="w-5 h-5 text-slate-300" />}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">حالة الاتصال</span>
                <span className={`text-sm font-bold ${
                  erConnStatus === 'ok'    ? 'text-emerald-600'
                  : erConnStatus === 'error' ? 'text-rose-600'
                  : 'text-slate-400'
                }`}>
                  {erConnStatus === 'ok'    ? 'متصل' : erConnStatus === 'error' ? 'غير متصل' : 'لم يختبر بعد'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">مزود البيانات</span>
              <span className="text-sm font-bold text-slate-700">open.er-api.com</span>
            </div>
          </div>

          {/* Last update row */}
          <div className="flex items-center gap-3 px-1">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-400">آخر تحديث ناجح: </span>
              <span className="text-xs font-semibold text-slate-600">
                {erLastUpdate ?? 'لم يتم التحديث بعد'}
              </span>
            </div>
          </div>

          {/* Action buttons row */}
          <div className="flex flex-wrap gap-3">
            {/* Update Now */}
            <button
              type="button"
              id="er-update-now-btn"
              onClick={handleErUpdate}
              disabled={erIsUpdating}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-5 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${erIsUpdating ? 'animate-spin' : ''}`} />
              {erIsUpdating ? 'جاري التحديث...' : 'تحديث أسعار الصرف الآن'}
            </button>

            {/* Test Connection */}
            <button
              type="button"
              id="er-test-conn-btn"
              onClick={handleErTest}
              disabled={erIsTesting}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {erIsTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {erIsTesting ? 'جاري الاختبار...' : 'اختبار الاتصال'}
            </button>
          </div>

          {/* Last sync result */}
          {erLastResult && (
            <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 border ${
              erConnStatus === 'ok'
                ? 'bg-emerald-50 border-emerald-100'
                : 'bg-rose-50 border-rose-100'
            }`}>
              {erConnStatus === 'ok'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                : <XCircle      className="w-4 h-4 text-rose-500    shrink-0 mt-0.5" />}
              <span className={`text-xs font-semibold ${
                erConnStatus === 'ok' ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {erLastResult}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Automatic Update toggle */}
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setErAutoUpdate(p => !p)}
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-slate-800 text-base">تحديث تلقائي</span>
              <span className="text-xs font-semibold text-slate-400">تحديث أسعار الصرف تلقائياً وفق الجدول المحدد</span>
            </div>
            <div className={`relative w-14 h-8 rounded-full transition-all duration-300 shadow-inner ${erAutoUpdate ? 'bg-indigo-600' : 'bg-slate-200'}`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform translate-x-[-120%] ${
                erAutoUpdate ? 'translate-x-[-120%]' : 'translate-x-[-10%]'
              }`} />
            </div>
          </div>

          {/* Update Frequency — only shown when auto update is on */}
          <AnimatePresence>
            {erAutoUpdate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <label className="block text-sm font-semibold text-slate-500 mb-3">تكرار التحديث</label>
                  <div className="flex gap-3">
                    {(['daily', 'weekly'] as const).map(freq => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setErFrequency(freq)}
                        className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
                          erFrequency === freq
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                        }`}
                      >
                        {freq === 'daily' ? 'يومي (Daily)' : 'أسبوعي (Weekly)'}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
