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
  TrendingUp,
  ScanLine
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { dbService, apiRequest } from '../services/dbService';
import { COUNTRIES, CURRENCIES, MONTHS } from '../constants/company';

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
  exchange_rate_update_method?: 'manual' | 'auto';
  inventory_cost_method?: 'wac' | 'fifo' | 'lifo';
  inventory_cost_method_level?: 'company' | 'item';
  vat_enabled: boolean;
  wht_enabled: boolean;
  purchase_workflow_mode?: 'Simple' | 'Enterprise Strict' | 'Enterprise Flexible';
  goods_receipt_matching_mode?: 'SupplierProduct' | 'ProductOnly' | 'SupplierProductWarehouse' | 'SmartMatching';
  allow_negative_stock?: boolean;
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
  const { showNotification } = useNotification();
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
    exchange_rate_update_method: 'manual',
    inventory_cost_method: 'wac',
    inventory_cost_method_level: 'item',
    vat_enabled: false,
    wht_enabled: false,
    purchase_workflow_mode: 'Simple',
    goods_receipt_matching_mode: 'SmartMatching'
  });

  // ─── Exchange Rate Settings state ──────────────────────────────────────────────────
  const [erIsUpdating,   setErIsUpdating]   = useState(false);
  const [erIsTesting,    setErIsTesting]     = useState(false);
  const [erAutoUpdate,   setErAutoUpdate]   = useState(false);
  const [erFrequency,    setErFrequency]    = useState<'daily' | 'weekly'>('daily');
  const [erLastUpdate,   setErLastUpdate]   = useState<string | null>(null);
  const [erConnStatus,   setErConnStatus]   = useState<'idle' | 'ok' | 'error'>('idle');
  const [erLastResult,   setErLastResult]   = useState<string | null>(null);

  // ─── Barcode Scanner Settings state ────────────────────────────────────────────────
  const [barcodeSettings, setBarcodeSettings] = useState({
    enable_camera_scanner: true,
    enable_hid_scanner: true,
    enable_continuous_mode: true,
    play_sound_on_success: true,
    prevent_unknown_items: true,
    auto_increase_quantity: true,
    show_success_message: true,
  });

  const formatSyncDateTime = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  };

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
        const totalUpdated = result.updated + result.inserted;
        const summary = `${totalUpdated} currencies updated successfully. (تم تحديث ${totalUpdated} من العملات بنجاح.)`;
        setErLastUpdate(formatSyncDateTime());
        setErConnStatus('ok');
        setErLastResult(summary);
        showNotification('تم تحديث أسعار الصرف بنجاح', 'success');
      } else {
        setErConnStatus('error');
        setErLastResult(`فشل: ${result.message}`);
        showNotification(`فشل التحديث: ${result.message}`, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErConnStatus('error');
      setErLastResult(`خطأ: ${msg}`);
      showNotification(`خطأ: ${msg}`, 'error');
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
        showNotification('اختبار الاتصال ناجح', 'success');
      } else {
        setErConnStatus('error');
        setErLastResult(`فشل الاتصال: ${result.message}`);
        showNotification('فشل اختبار الاتصال', 'error');
      }
    } catch (err: unknown) {
      setErConnStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      setErLastResult(`خطأ الاتصال: ${msg}`);
      showNotification('فشل اختبار الاتصال', 'error');
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

          const settings = company.settings || {};
          setOriginalSettings(settings);
          setData({
            id: company.id,
            name: company.name || '',
            logo_url: company.logo_url || '',
            commercial_register: company.commercial_register || '',
            tax_number: company.tax_number || '',
            country: company.country || '',
            address: company.address || '',
            currency: settings.currency || company.currency || 'EGP',
            fiscal_year_day: fday,
            fiscal_year_month: fmonth,
            enable_multi_currency: settings.enable_multi_currency || false,
            exchange_rate_update_method: settings.exchange_rate_update_method || 'manual',
            inventory_cost_method: settings.inventory_cost_method || 'wac',
            inventory_cost_method_level: 'item',
            vat_enabled: settings.vat_enabled || company.vat_enabled || false,
            wht_enabled: settings.wht_enabled || company.wht_enabled || false,
            purchase_workflow_mode: company.purchase_workflow_mode || settings.purchase_workflow_mode || 'Simple',
            goods_receipt_matching_mode: company.goods_receipt_matching_mode || 'SmartMatching',
            allow_negative_stock: settings.allow_negative_stock || false
          });

          setErAutoUpdate(settings.er_auto_update || false);
          setErFrequency(settings.er_frequency || 'daily');
          setErLastUpdate(settings.er_last_update || null);
          setErConnStatus(settings.er_conn_status || 'idle');
          setErLastResult(settings.er_last_result || null);

          // Load barcode scanner settings
          const bs = settings.barcode_scanner || {};
          setBarcodeSettings({
            enable_camera_scanner: bs.enable_camera_scanner !== false,
            enable_hid_scanner: bs.enable_hid_scanner !== false,
            enable_continuous_mode: bs.enable_continuous_mode !== false,
            play_sound_on_success: bs.play_sound_on_success !== false,
            prevent_unknown_items: bs.prevent_unknown_items !== false,
            auto_increase_quantity: bs.auto_increase_quantity !== false,
            show_success_message: bs.show_success_message !== false,
          });
      }
    } catch (error) {
      console.error('Failed to load company data:', error);
      showNotification(t('common.error'), 'error');
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
      
      const newSettings = {
        ...originalSettings,
        currency: data.currency,
        enable_multi_currency: data.enable_multi_currency,
        exchange_rate_update_method: data.exchange_rate_update_method || 'manual',
        er_auto_update: erAutoUpdate,
        er_frequency: erFrequency,
        er_last_update: erLastUpdate,
        er_conn_status: erConnStatus,
        er_last_result: erLastResult,
        inventory_cost_method_level: 'item',
        inventory_cost_method: data.inventory_cost_method || 'wac',
        vat_enabled: data.vat_enabled,
        wht_enabled: data.wht_enabled,
        purchase_workflow_mode: data.purchase_workflow_mode || 'Simple',
        goods_receipt_matching_mode: data.goods_receipt_matching_mode || 'SmartMatching',
        allow_negative_stock: data.allow_negative_stock || false,
        barcode_scanner: barcodeSettings,
      };

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
        purchase_workflow_mode: data.purchase_workflow_mode || 'Simple',
        goods_receipt_matching_mode: data.goods_receipt_matching_mode || 'SmartMatching',
        settings: newSettings
      });
      
      // Update local original settings to reflect the save
      setOriginalSettings(newSettings);
      
      showNotification(t('company_settings.save_success'), 'success');
    } catch (error) {
      console.error('Failed to save company settings:', error);
      showNotification(t('common.error'), 'error');
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
    <div className="w-full max-w-[98%] 2xl:max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700" dir={dir}>
      <div className="flex flex-col gap-2 pb-4 border-b border-slate-100">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">
          {t('company_settings.title')}
        </h1>
        <p className="text-slate-400 font-semibold text-sm">
          {t('company_settings.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Card 1: Logo & Basic Info */}
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-indigo-600 justify-end">
            <span className="font-bold text-lg">{language === 'ar' ? 'المعلومات الأساسية والشعار' : 'Basic Information & Logo'}</span>
            <FileText className="w-5 h-5" />
          </div>

          <div className="flex flex-col md:flex-row-reverse items-center gap-6 justify-between border-b border-slate-100 pb-6">
            {/* Logo box */}
            <div className="w-28 h-28 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center relative overflow-hidden flex-shrink-0">
              {data.logo_url ? (
                <img src={data.logo_url} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
              ) : (
                <Building2 className="w-10 h-10 text-slate-300" />
              )}
              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </div>

            {/* Helper text */}
            <p className="text-slate-400 text-xs font-medium flex-1 text-center md:text-right leading-relaxed">
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
                  className="px-4 py-2 bg-transparent text-rose-500 hover:text-rose-600 font-bold text-xs transition-colors rounded-xl"
                >
                  {t('common.delete')}
                </button>
              )}
              <button
                type="button"
                onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all shadow-sm"
              >
                <Upload size={14} />
                <span>{data.logo_url ? (language === 'ar' ? 'تغيير الشعار' : 'Change Logo') : (language === 'ar' ? 'إضافة شعار' : 'Add Logo')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-500 mb-2">
                {t('company_settings.name')}
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-sm"
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
                className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-sm"
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
                className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-sm"
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
                    <span className="font-semibold text-sm">{language === 'ar' ? o.nameAr : o.name}</span>
                  </div>
                )}
                filterFn={(o, q) => 
                  o.name.toLowerCase().includes(q.toLowerCase()) || 
                  o.nameAr.includes(q) || 
                  o.code.toLowerCase().includes(q.toLowerCase())
                }
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-sm font-semibold text-slate-500 mb-2">
                {t('company_settings.address')}
              </label>
              <div className="relative group">
                <MapPin className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors pointer-events-none`} />
                <textarea
                  value={data.address}
                  onChange={(e) => setData({ ...data, address: e.target.value })}
                  rows={2}
                  className={`w-full ${dir === 'rtl' ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 font-medium focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-sm min-h-[70px]`}
                />
              </div>
            </div>

            {/* VAT & WHT Toggles side-by-side in grid */}
            <div className="sm:col-span-2 lg:col-span-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* VAT Toggle */}
              <div 
                className="flex items-center justify-between cursor-pointer select-none p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-50/80 transition-colors"
                onClick={() => setData(prev => ({ ...prev, vat_enabled: !prev.vat_enabled }))}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-800 text-sm">
                    {t('company_settings.vat_enabled')}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {t('company_settings.vat_enabled_desc')}
                  </span>
                </div>
                <div 
                  className={`relative w-12 h-7 rounded-full transition-all duration-300 shadow-inner ms-3 flex-shrink-0 ${data.vat_enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                    dir === 'rtl'
                      ? (data.vat_enabled ? 'translate-x-[-110%]' : 'translate-x-[-5%]')
                      : (data.vat_enabled ? 'translate-x-[110%]' : 'translate-x-[5%]')
                  }`} />
                </div>
              </div>

              {/* WHT Toggle */}
              <div 
                className="flex items-center justify-between cursor-pointer select-none p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-50/80 transition-colors"
                onClick={() => setData(prev => ({ ...prev, wht_enabled: !prev.wht_enabled }))}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-800 text-sm">
                    {t('company_settings.wht_enabled')}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {t('company_settings.wht_enabled_desc')}
                  </span>
                </div>
                <div 
                  className={`relative w-12 h-7 rounded-full transition-all duration-300 shadow-inner ms-3 flex-shrink-0 ${data.wht_enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                    dir === 'rtl'
                      ? (data.wht_enabled ? 'translate-x-[-110%]' : 'translate-x-[-5%]')
                      : (data.wht_enabled ? 'translate-x-[110%]' : 'translate-x-[5%]')
                  }`} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Financial, Currency & Exchange Rates Section (ALL Currency settings unified in ONE place) */}
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-indigo-600 justify-end">
            <span className="font-bold text-lg">{language === 'ar' ? 'إعدادات العملات وأسعار الصرف' : 'Currency & Exchange Rate Settings'}</span>
            <Coins className="w-5 h-5" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-500 mb-2">
                {t('company_settings.fiscal_year_end')}*
              </label>
              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm font-semibold hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/5 outline-none appearance-none cursor-pointer transition-all"
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value} className="text-slate-900">
                        {language === 'ar' ? m.nameAr : m.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none transition-transform group-focus-within:rotate-180`} />
                </div>
                <div className="relative group">
                  <select
                    value={data.fiscal_year_day}
                    onChange={(e) => setData({ ...data, fiscal_year_day: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm font-semibold hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/5 outline-none appearance-none cursor-pointer transition-all"
                  >
                    {Array.from({ length: daysInMonth(data.fiscal_year_month) }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d} className="text-slate-900">{d}</option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none transition-transform group-focus-within:rotate-180`} />
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-400 text-center leading-relaxed mt-1">
                * {language === 'ar' 
                  ? 'سيتم تعيين السنة المالية لتنتهي في هذا التاريخ من كل عام.' 
                  : 'Fiscal year will close automatically on this day annually.'}
              </p>
            </div>
          </div>

          {/* Multi-Currency Toggle Section */}
          <div className="pt-5 border-t border-slate-100 space-y-4">
            <div 
              className="flex items-center justify-between cursor-pointer select-none p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
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
                className={`relative w-14 h-8 rounded-full transition-all duration-300 shadow-inner ms-4 flex-shrink-0 ${data.enable_multi_currency ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                  dir === 'rtl'
                    ? (data.enable_multi_currency ? 'translate-x-[-120%]' : 'translate-x-[-10%]')
                    : (data.enable_multi_currency ? 'translate-x-[120%]' : 'translate-x-[10%]')
                }`} />
              </div>
            </div>

            {/* Method Selection (Manual vs Automatic) */}
            {data.enable_multi_currency && (
              <div className="pt-3 space-y-4">
                <label className="block text-sm font-semibold text-slate-500">
                  {language === 'ar' ? 'طريقة تحديث أسعار الصرف' : 'Exchange Rate Update Method'}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Manual option */}
                  <div
                    onClick={() => setData(prev => ({ ...prev, exchange_rate_update_method: 'manual' }))}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      data.exchange_rate_update_method === 'manual'
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-sm">التحديث اليدوي (Manual)</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        data.exchange_rate_update_method === 'manual' ? 'border-indigo-600' : 'border-slate-300'
                      }`}>
                        {data.exchange_rate_update_method === 'manual' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 mt-2 leading-relaxed">
                      يقوم المستخدم بإدخال أسعار الصرف يدوياً وإدارتها بنفسه.
                    </span>
                  </div>

                  {/* Auto option */}
                  <div
                    onClick={() => setData(prev => ({ ...prev, exchange_rate_update_method: 'auto' }))}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      data.exchange_rate_update_method === 'auto'
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-sm">التحديث التلقائي (Automatic)</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        data.exchange_rate_update_method === 'auto' ? 'border-indigo-600' : 'border-slate-300'
                      }`}>
                        {data.exchange_rate_update_method === 'auto' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 mt-2 leading-relaxed">
                      يتم جلب أسعار الصرف تلقائياً من مزود خارجي.
                    </span>
                  </div>
                </div>

                {/* Automatic Exchange Rate Settings Block embedded directly HERE in ONE place */}
                {data.exchange_rate_update_method === 'auto' && (
                  <div className="p-6 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-5 mt-4" dir="rtl">
                    <div className="flex items-center gap-2 text-indigo-600 justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-bold text-base text-slate-800">إعدادات أسعار الصرف التلقائية</span>
                      </div>
                    </div>

                    {/* Provider info row */}
                    <div className="flex flex-wrap items-center justify-between bg-white rounded-xl p-4 border border-slate-200/80 gap-3">
                      <div className="flex items-center gap-3">
                        {erConnStatus === 'ok'  && <Wifi    className="w-5 h-5 text-emerald-500" />}
                        {erConnStatus === 'error' && <WifiOff className="w-5 h-5 text-rose-500" />}
                        {erConnStatus === 'idle'  && <Wifi    className="w-5 h-5 text-slate-300" />}
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">حالة الاتصال (Connection Status)</span>
                          <span className={`text-xs font-bold ${
                            erConnStatus === 'ok'    ? 'text-emerald-600'
                            : erConnStatus === 'error' ? 'text-rose-600'
                            : 'text-slate-400'
                          }`}>
                            {erConnStatus === 'ok'    ? 'متصل (Connected)' : erConnStatus === 'error' ? 'فشل الاتصال (Failed)' : 'لم يختبر بعد'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">اسم مزود الأسعار</span>
                        <span className="text-xs font-bold text-slate-700 block">ExchangeRate.host</span>
                        <a 
                          href="https://exchangerate.host" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[11px] text-indigo-600 hover:underline font-semibold block"
                        >
                          https://exchangerate.host
                        </a>
                      </div>
                    </div>

                    {/* Last update row */}
                    <div className="flex items-center gap-2 px-1">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-400">آخر مزامنة ناجحة: </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {erLastUpdate ?? 'لم يتم التحديث بعد'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons row */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        id="er-update-now-btn"
                        onClick={handleErUpdate}
                        disabled={erIsUpdating}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${erIsUpdating ? 'animate-spin' : ''}`} />
                        {erIsUpdating ? 'جاري التحديث...' : 'تحديث أسعار الصرف الآن (Sync Now)'}
                      </button>

                      <button
                        type="button"
                        id="er-test-conn-btn"
                        onClick={handleErTest}
                        disabled={erIsTesting}
                        className="flex items-center gap-2 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {erIsTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        {erIsTesting ? 'جاري الاختبار...' : 'اختبار الاتصال (Test)'}
                      </button>
                    </div>

                    {/* Last sync result */}
                    {erLastResult && (
                      <div className={`flex items-start gap-2.5 rounded-xl p-3 border ${
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

                    <div className="border-t border-slate-200/60 pt-3" />

                    {/* Automatic Update toggle */}
                    <div
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setErAutoUpdate(p => !p)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 text-sm">تحديث تلقائي (Auto Update)</span>
                        <span className="text-xs text-slate-400">تحديث أسعار الصرف تلقائياً وفق الجدول المحدد</span>
                      </div>
                      <div className={`relative w-12 h-7 rounded-full transition-all duration-300 shadow-inner ${erAutoUpdate ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                          erAutoUpdate ? 'translate-x-[-110%]' : 'translate-x-[-5%]'
                        }`} />
                      </div>
                    </div>

                    {/* Update Frequency */}
                    <AnimatePresence>
                      {erAutoUpdate && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-2">تكرار التحديث (Frequency)</label>
                            <div className="flex gap-3">
                              {(['daily', 'weekly'] as const).map(freq => (
                                <button
                                  key={freq}
                                  type="button"
                                  onClick={() => setErFrequency(freq)}
                                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                    erFrequency === freq
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                                  }`}
                                >
                                  {freq === 'daily' ? 'يومي (Once Daily)' : 'أسبوعي (Once Weekly)'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Inventory & Purchase Settings & Negative Stock (Compact layout) */}
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-indigo-600 justify-end">
            <span className="font-bold text-lg">{language === 'ar' ? 'إعدادات المخازن والمشتريات' : 'Inventory & Purchase Settings'}</span>
            <TrendingUp className="w-5 h-5" />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-500">
              {language === 'ar' ? 'نمط سير عمل المشتريات (Purchase Workflow Mode)' : 'Purchase Workflow Mode'}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Simple Mode */}
              <div
                onClick={() => setData(prev => ({ ...prev, purchase_workflow_mode: 'Simple' }))}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  data.purchase_workflow_mode === 'Simple' || !data.purchase_workflow_mode
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      {language === 'ar' ? 'مبسط (Simple)' : 'Simple'}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      data.purchase_workflow_mode === 'Simple' || !data.purchase_workflow_mode ? 'border-indigo-600' : 'border-slate-300'
                    }`}>
                      {(data.purchase_workflow_mode === 'Simple' || !data.purchase_workflow_mode) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    {language === 'ar' 
                      ? 'تحديث المخزن من الفاتورة مباشرة.'
                      : 'Update inventory directly from invoice.'}
                  </p>
                </div>
              </div>

              {/* Enterprise Flexible Mode */}
              <div
                onClick={() => setData(prev => ({ ...prev, purchase_workflow_mode: 'Enterprise Flexible' }))}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  data.purchase_workflow_mode === 'Enterprise Flexible'
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      {language === 'ar' ? 'مرن (Enterprise Flexible)' : 'Enterprise Flexible'}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      data.purchase_workflow_mode === 'Enterprise Flexible' ? 'border-indigo-600' : 'border-slate-300'
                    }`}>
                      {data.purchase_workflow_mode === 'Enterprise Flexible' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    {language === 'ar' 
                      ? 'فاتورة مباشرة، مع خيار Goods Receipt تلقائياً.'
                      : 'Invoice directly, option to auto-generate Goods Receipt.'}
                  </p>
                </div>
              </div>

              {/* Enterprise Strict Mode */}
              <div
                onClick={() => setData(prev => ({ ...prev, purchase_workflow_mode: 'Enterprise Strict' }))}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  data.purchase_workflow_mode === 'Enterprise Strict'
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      {language === 'ar' ? 'صارم (Enterprise Strict)' : 'Enterprise Strict'}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      data.purchase_workflow_mode === 'Enterprise Strict' ? 'border-indigo-600' : 'border-slate-300'
                    }`}>
                      {data.purchase_workflow_mode === 'Enterprise Strict' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    {language === 'ar' 
                      ? 'يجب استلام البضائع أولاً وربط الفاتورة بالاستلام.'
                      : 'Goods must be received first and linked.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="block text-sm font-semibold text-slate-500">
              {language === 'ar' ? 'نمط مطابقة إذن الاستلام بالفاتورة (Goods Receipt Matching Mode)' : 'Goods Receipt Matching Mode'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Supplier + Product */}
              <div
                onClick={() => setData(prev => ({ ...prev, goods_receipt_matching_mode: 'SupplierProduct' }))}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  data.goods_receipt_matching_mode === 'SupplierProduct'
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      {language === 'ar' ? 'المورد + الصنف' : 'Supplier + Product'}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      data.goods_receipt_matching_mode === 'SupplierProduct' ? 'border-indigo-600' : 'border-slate-300'
                    }`}>
                      {data.goods_receipt_matching_mode === 'SupplierProduct' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    {language === 'ar' ? 'المورد والصنف' : 'Supplier & Product'}
                  </p>
                </div>
              </div>

              {/* Product Only */}
              <div
                onClick={() => setData(prev => ({ ...prev, goods_receipt_matching_mode: 'ProductOnly' }))}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  data.goods_receipt_matching_mode === 'ProductOnly'
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      {language === 'ar' ? 'الصنف فقط' : 'Product Only'}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      data.goods_receipt_matching_mode === 'ProductOnly' ? 'border-indigo-600' : 'border-slate-300'
                    }`}>
                      {data.goods_receipt_matching_mode === 'ProductOnly' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    {language === 'ar' ? 'الصنف فقط' : 'Product only'}
                  </p>
                </div>
              </div>

              {/* Supplier + Product + Warehouse */}
              <div
                onClick={() => setData(prev => ({ ...prev, goods_receipt_matching_mode: 'SupplierProductWarehouse' }))}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  data.goods_receipt_matching_mode === 'SupplierProductWarehouse'
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      {language === 'ar' ? 'مورد + صنف + مخزن' : 'Supplier + Product + Warehouse'}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      data.goods_receipt_matching_mode === 'SupplierProductWarehouse' ? 'border-indigo-600' : 'border-slate-300'
                    }`}>
                      {data.goods_receipt_matching_mode === 'SupplierProductWarehouse' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    {language === 'ar' ? 'مورد، صنف ومخزن' : 'Supplier, product & warehouse'}
                  </p>
                </div>
              </div>

              {/* Smart Matching */}
              <div
                onClick={() => setData(prev => ({ ...prev, goods_receipt_matching_mode: 'SmartMatching' }))}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  data.goods_receipt_matching_mode === 'SmartMatching' || !data.goods_receipt_matching_mode
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      {language === 'ar' ? 'مطابقة ذكية (Smart)' : 'Smart Matching'}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      data.goods_receipt_matching_mode === 'SmartMatching' || !data.goods_receipt_matching_mode ? 'border-indigo-600' : 'border-slate-300'
                    }`}>
                      {(data.goods_receipt_matching_mode === 'SmartMatching' || !data.goods_receipt_matching_mode) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    {language === 'ar' ? 'مطابقة تلقائية متكاملة' : 'Integrated auto matching'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Allow Negative Stock Balance Toggle (Embedded inside Card 3 to eliminate extra card height!) */}
          <div className="pt-3 border-t border-slate-100">
            <div
              className="flex items-center justify-between cursor-pointer select-none p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              onClick={() => setData((prev) => ({ ...prev, allow_negative_stock: !prev.allow_negative_stock }))}
            >
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="font-bold text-slate-800 text-sm">
                  {language === 'ar' ? 'السماح بصرف رصيد بالسالب (تخطي رصيد المخزون)' : 'Allow Negative Stock Balance'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium leading-relaxed">
                  {language === 'ar' 
                    ? 'يسمح بعمليات الصرف أو البيع حتى لو كان رصيد الصنف في المخزن أقل من الصفر (غير متوفر).'
                    : 'Allows dispensing or selling items even if the stock balance is below zero (out of stock).'}
                </span>
              </div>
              <div
                className={`relative w-12 h-7 rounded-full transition-all duration-300 shadow-inner ms-3 flex-shrink-0 ${
                  data.allow_negative_stock ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                    dir === 'rtl'
                      ? data.allow_negative_stock ? 'translate-x-[-110%]' : 'translate-x-[-5%]'
                      : data.allow_negative_stock ? 'translate-x-[110%]' : 'translate-x-[5%]'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Barcode Scanner Settings (Optimized into 2 columns grid to cut height by 50%!) */}
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-indigo-600 justify-end">
            <span className="font-bold text-lg">
              {language === 'ar' ? 'إعدادات قراءة الباركود' : 'Barcode Scanner Settings'}
            </span>
            <ScanLine className="w-5 h-5" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {([
              {
                key: 'enable_camera_scanner',
                labelAr: 'تفعيل استخدام كاميرا الباركود',
                labelEn: 'Enable Camera Barcode Scanner',
                descAr: 'يسمح بفتح الكاميرا لمسح الباركود داخل الفواتير.',
                descEn: 'Allow opening camera to scan barcodes.',
              },
              {
                key: 'enable_hid_scanner',
                labelAr: 'تفعيل Barcode Scanner (USB / Bluetooth)',
                labelEn: 'Enable USB / Bluetooth Scanner',
                descAr: 'يدعم القارئات المتصلة عبر USB أو Bluetooth تلقائياً.',
                descEn: 'Auto-detect USB and Bluetooth readers.',
              },
              {
                key: 'enable_continuous_mode',
                labelAr: 'تفعيل وضع القراءة المستمرة',
                labelEn: 'Enable Continuous Scan Mode',
                descAr: 'تبقى الكاميرا مفتوحة لمسح أكثر من صنف متتالياً.',
                descEn: 'Keep camera open for sequential scanning.',
              },
              {
                key: 'play_sound_on_success',
                labelAr: 'تشغيل صوت عند نجاح القراءة',
                labelEn: 'Play Sound on Successful Scan',
                descAr: 'يصدر صوت Beep قصير عند كل قراءة ناجحة.',
                descEn: 'Plays a short beep on successful scan.',
              },
              {
                key: 'prevent_unknown_items',
                labelAr: 'منع إضافة أصناف غير معروفة',
                labelEn: 'Block Unknown Barcodes',
                descAr: 'لا يضيف أي صنف إذا لم يعثر على الباركود بالنظام.',
                descEn: 'Block adding items when barcode is not found.',
              },
              {
                key: 'auto_increase_quantity',
                labelAr: 'زيادة الكمية تلقائياً عند تكرار القراءة',
                labelEn: 'Auto-Increase Qty on Duplicate Scan',
                descAr: 'إذا كان الصنف موجوداً تزاد كميته بدلاً من تكراره.',
                descEn: 'Increase quantity instead of adding a new line.',
              },
              {
                key: 'show_success_message',
                labelAr: 'إظهار رسالة نجاح بعد القراءة',
                labelEn: 'Show Success Notification After Scan',
                descAr: 'يعرض إشعار مؤقت بعد إضافة الصنف بنجاح.',
                descEn: 'Shows brief toast notification after scan.',
              },
            ] as const).map(({ key, labelAr, labelEn, descAr, descEn }) => (
              <div
                key={key}
                className="flex items-center justify-between cursor-pointer select-none p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors"
                onClick={() =>
                  setBarcodeSettings((prev) => ({ ...prev, [key]: !prev[key] }))
                }
              >
                <div className="flex flex-col gap-0.5 flex-1 me-2">
                  <span className="font-bold text-slate-800 text-xs">
                    {language === 'ar' ? labelAr : labelEn}
                  </span>
                  <span className="text-[10.5px] text-slate-400 font-medium leading-normal">
                    {language === 'ar' ? descAr : descEn}
                  </span>
                </div>
                <div
                  className={`relative w-12 h-7 rounded-full transition-all duration-300 shadow-inner flex-shrink-0 ${
                    barcodeSettings[key] ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${
                      dir === 'rtl'
                        ? barcodeSettings[key] ? 'translate-x-[-110%]' : 'translate-x-[-5%]'
                        : barcodeSettings[key] ? 'translate-x-[110%]' : 'translate-x-[5%]'
                    }`}
                  />
                </div>
              </div>
            ))}
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
