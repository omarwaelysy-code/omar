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
  Check
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
    enable_multi_currency: false
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
            enable_multi_currency: company.settings?.enable_multi_currency || false
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
          enable_multi_currency: data.enable_multi_currency
        }
      });
      
      // Update local original settings to reflect the save
      setOriginalSettings({
        ...originalSettings,
        currency: data.currency,
        enable_multi_currency: data.enable_multi_currency
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
    <div className="max-w-4xl mx-auto p-6" dir={dir}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">{t('company_settings.title')}</h1>
        <p className="text-zinc-500 font-medium italic">{t('company_settings.subtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo Section */}
        <section className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-emerald-600">
            <ImageIcon className="w-5 h-5" />
            <h2 className="font-semibold">{t('company_settings.logo')}</h2>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-32 h-32 rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center bg-zinc-50 relative overflow-hidden group">
              {data.logo_url ? (
                <img src={data.logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <Building2 className="w-12 h-12 text-zinc-300" />
              )}
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Upload className="w-6 h-6 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </label>
            </div>
            <div className="flex-1 text-center md:text-right">
              <p className="text-sm text-zinc-500 mb-4">
                {language === 'ar' 
                  ? 'يفضل استخدام صورة مربعة بحجم 512x512 بيكسل على الأقل' 
                  : 'Prefer a square image, at least 512x512 pixels'}
              </p>
              <div className="flex items-center justify-center md:justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                  className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {t('common.add')}
                </button>
                {data.logo_url && (
                    <button 
                        type="button" 
                        onClick={() => setData(prev => ({ ...prev, logo_url: '' }))}
                        className="px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg text-sm font-bold transition-colors"
                    >
                        {t('common.delete')}
                    </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Basic Info */}
        <section className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-emerald-600">
            <FileText className="w-5 h-5" />
            <h2 className="font-semibold">{language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.name')}
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.commercial_register')}
              </label>
              <input
                type="text"
                value={data.commercial_register}
                onChange={(e) => setData({ ...data, commercial_register: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.tax_number')}
              </label>
              <input
                type="text"
                value={data.tax_number}
                onChange={(e) => setData({ ...data, tax_number: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800"
              />
            </div>
            
            <SearchableSelect
              label={t('company_settings.country')}
              placeholder={t('common.select_category')}
              value={data.country}
              onChange={(val) => setData({ ...data, country: val })}
              options={COUNTRIES}
              dir={dir}
              icon={<Globe className="w-4 h-4 text-zinc-400" />}
              renderOption={(o) => (
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-lg">{o.flag}</span>
                  <span className="font-bold">{language === 'ar' ? o.nameAr : o.name}</span>
                </div>
              )}
              filterFn={(o, q) => 
                o.name.toLowerCase().includes(q.toLowerCase()) || 
                o.nameAr.includes(q) || 
                o.code.toLowerCase().includes(q.toLowerCase())
              }
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.address')}
              </label>
              <div className="relative">
                <MapPin className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 w-4 h-4 text-zinc-400 pointer-events-none`} />
                <textarea
                  value={data.address}
                  onChange={(e) => setData({ ...data, address: e.target.value })}
                  rows={3}
                  className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none font-bold text-zinc-800`}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Financial Info */}
        <section className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm text-right">
          <div className="flex items-center gap-2 mb-6 text-emerald-600">
            <Coins className="w-5 h-5" />
            <h2 className="font-semibold">{language === 'ar' ? 'الإعدادات المالية' : 'Financial Settings'}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <SearchableSelect
              label={t('company_settings.currency')}
              placeholder={t('common.select_category')}
              value={data.currency}
              onChange={(val) => setData({ ...data, currency: val })}
              options={CURRENCIES}
              dir={dir}
              icon={<Coins className="w-4 h-4 text-zinc-400" />}
              renderOption={(o) => (
                <div className="flex items-center gap-3">
                  <span className="text-lg">{o.flag}</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">{language === 'ar' ? o.nameAr : o.name}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{o.code} ({o.symbol})</span>
                  </div>
                </div>
              )}
              filterFn={(o, q) => 
                o.name.toLowerCase().includes(q.toLowerCase()) || 
                o.nameAr.includes(q) || 
                o.code.toLowerCase().includes(q.toLowerCase())
              }
            />

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {t('company_settings.fiscal_year_end')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
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
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none font-bold text-zinc-700"
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>
                        {language === 'ar' ? m.nameAr : m.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                </div>
                <div className="relative">
                  <select
                    value={data.fiscal_year_day}
                    onChange={(e) => setData({ ...data, fiscal_year_day: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none font-bold text-zinc-700"
                  >
                    {Array.from({ length: daysInMonth(data.fiscal_year_month) }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 mt-2 italic">
                  {language === 'ar' 
                    ? '* سيتم تعيين السنة المالية لتنتهي في هذا التاريخ من كل عام.' 
                    : '* Fiscal year will be set to end on this date every year.'}
              </p>
            </div>

            {/* Enable Multi-Currency Toggle */}
            <div className="md:col-span-2 pt-4 border-t border-zinc-50">
              <div 
                className="flex items-center gap-3 cursor-pointer group select-none"
                onClick={() => setData(prev => ({ ...prev, enable_multi_currency: !prev.enable_multi_currency }))}
              >
                <div 
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${data.enable_multi_currency ? 'bg-emerald-600' : 'bg-zinc-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${
                    dir === 'rtl'
                      ? (data.enable_multi_currency ? 'right-7' : 'right-1')
                      : (data.enable_multi_currency ? 'left-7' : 'left-1')
                  }`} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-zinc-800 text-sm">
                    {language === 'ar' ? 'تفعيل العملات المتعددة' : 'Enable Multi-Currency'}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {language === 'ar' 
                      ? 'عند التفعيل، ستتمكن من إدارة عملات متعددة وأسعار الصرف.' 
                      : 'When enabled, you will be able to manage multiple currencies and exchange rates.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4 pb-12">
          <button
            type="submit"
            disabled={saving}
            className="px-10 py-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-3 font-black uppercase tracking-wider"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
