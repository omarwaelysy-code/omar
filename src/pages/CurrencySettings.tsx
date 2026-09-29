import React, { useState, useEffect, useCallback } from 'react';
import { 
  Coins, 
  Globe, 
  Save, 
  Loader2, 
  RefreshCw, 
  Wifi, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  Search,
  ArrowRightLeft,
  Building2
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { dbService, apiRequest } from '../services/dbService';
import { CURRENCIES } from '../constants/company';
import { SearchableSelect } from '../components/SearchableSelect';

interface CurrencyRateItem {
  id: string;
  code: string;
  name: string;
  name_ar?: string;
  symbol: string;
  rate?: number;
  rate_date?: string;
}

export function CurrencySettings() {
  const { language, dir } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { openTab } = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [originalSettings, setOriginalSettings] = useState<Record<string, any>>({});

  // Settings State
  const [baseCurrency, setBaseCurrency] = useState('EGP');
  const [enableMultiCurrency, setEnableMultiCurrency] = useState(false);
  const [exchangeRateUpdateMethod, setExchangeRateUpdateMethod] = useState<'manual' | 'auto'>('manual');
  const [erAutoUpdate, setErAutoUpdate] = useState(false);
  const [erFrequency, setErFrequency] = useState<'daily' | 'weekly'>('daily');
  const [erLastUpdate, setErLastUpdate] = useState<string | null>(null);
  const [erConnStatus, setErConnStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [erLastResult, setErLastResult] = useState<string | null>(null);

  // Operation States
  const [erIsUpdating, setErIsUpdating] = useState(false);
  const [erIsTesting, setErIsTesting] = useState(false);

  // Active Currencies Snapshot
  const [currenciesList, setCurrenciesList] = useState<CurrencyRateItem[]>([]);
  const [ratesSearch, setRatesSearch] = useState('');

  const formatSyncDateTime = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const loadData = useCallback(async () => {
    if (!user?.company_id) return;
    try {
      setLoading(true);
      const company = await dbService.get<any>('companies', user.company_id);
      if (company) {
        setCompanyName(company.name || '');
        const settings = company.settings || {};
        setOriginalSettings(settings);

        setBaseCurrency(settings.currency || company.currency || 'EGP');
        setEnableMultiCurrency(settings.enable_multi_currency || false);
        setExchangeRateUpdateMethod(settings.exchange_rate_update_method || 'manual');
        setErAutoUpdate(settings.er_auto_update || false);
        setErFrequency(settings.er_frequency || 'daily');
        setErLastUpdate(settings.er_last_update || null);
        setErConnStatus(settings.er_conn_status || 'idle');
        setErLastResult(settings.er_last_result || null);
      }

      // Load registered currencies and recent rates
      try {
        const currencies = await dbService.listAll<any>('currencies');
        const companyCurrencies = currencies.filter((c: any) => c.company_id === user.company_id);
        
        let ratesMap: Record<string, { rate: number; date: string }> = {};
        try {
          const rates = await dbService.listAll<any>('currency_rates');
          const companyRates = rates.filter((r: any) => r.company_id === user.company_id);
          companyRates.forEach((r: any) => {
            if (!ratesMap[r.currency_id] || new Date(r.rate_date) > new Date(ratesMap[r.currency_id].date)) {
              ratesMap[r.currency_id] = { rate: Number(r.rate), date: r.rate_date };
            }
          });
        } catch {
          // ignore if currency_rates table empty
        }

        const enriched: CurrencyRateItem[] = companyCurrencies.map((c: any) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          name_ar: c.name_ar,
          symbol: c.symbol,
          rate: ratesMap[c.id]?.rate,
          rate_date: ratesMap[c.id]?.date
        }));
        setCurrenciesList(enriched);
      } catch (err) {
        console.warn('Could not load currencies snapshot:', err);
      }

    } catch (error) {
      console.error('Failed to load currency settings:', error);
      showNotification(language === 'ar' ? 'فشل تحميل إعدادات العملات' : 'Failed to load currency settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.company_id, language, showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Exchange Rates Sync
  const handleErUpdate = useCallback(async () => {
    setErIsUpdating(true);
    setErConnStatus('idle');
    setErLastResult(null);
    try {
      const result = await apiRequest<{
        success: boolean;
        inserted: number;
        updated: number;
        skipped: number;
        message: string;
      }>('/currencies/update-rates', 'POST', { baseCurrency });

      if (result.success) {
        const totalUpdated = result.updated + result.inserted;
        const summary = language === 'ar' 
          ? `تم تحديث أسعار ${totalUpdated} عملة بنجاح من المزود المباشر.` 
          : `${totalUpdated} currency rates successfully updated from live provider.`;
        const timeStr = formatSyncDateTime();
        setErLastUpdate(timeStr);
        setErConnStatus('ok');
        setErLastResult(summary);
        showNotification(language === 'ar' ? 'تم تحديث أسعار الصرف بنجاح' : 'Exchange rates updated successfully', 'success');
        
        // Refresh rates list
        loadData();
      } else {
        setErConnStatus('error');
        setErLastResult(language === 'ar' ? `فشل التحديث: ${result.message}` : `Failed: ${result.message}`);
        showNotification(language === 'ar' ? `فشل التحديث: ${result.message}` : `Failed: ${result.message}`, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErConnStatus('error');
      setErLastResult(language === 'ar' ? `خطأ: ${msg}` : `Error: ${msg}`);
      showNotification(language === 'ar' ? `خطأ: ${msg}` : `Error: ${msg}`, 'error');
    } finally {
      setErIsUpdating(false);
    }
  }, [baseCurrency, language, showNotification, loadData]);

  // Test Connection
  const handleErTest = useCallback(async () => {
    setErIsTesting(true);
    setErConnStatus('idle');
    setErLastResult(null);
    try {
      const result = await apiRequest<{
        success: boolean;
        message: string;
      }>('/currencies/update-rates', 'POST', { baseCurrency: baseCurrency || 'EGP' });
      if (result.success) {
        setErConnStatus('ok');
        setErLastResult(language === 'ar' ? 'الاتصال ناجح — تم التحقق من مزود أسعار الصرف بنجاح.' : 'Connection successful — ExchangeRate provider responded OK.');
        showNotification(language === 'ar' ? 'اختبار الاتصال ناجح' : 'Connection test successful', 'success');
      } else {
        setErConnStatus('error');
        setErLastResult(language === 'ar' ? `فشل الاتصال: ${result.message}` : `Connection failed: ${result.message}`);
        showNotification(language === 'ar' ? 'فشل اختبار الاتصال' : 'Connection test failed', 'error');
      }
    } catch (err: unknown) {
      setErConnStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      setErLastResult(language === 'ar' ? `خطأ الاتصال: ${msg}` : `Connection error: ${msg}`);
      showNotification(language === 'ar' ? 'فشل اختبار الاتصال' : 'Connection test failed', 'error');
    } finally {
      setErIsTesting(false);
    }
  }, [baseCurrency, language, showNotification]);

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id) return;

    try {
      setSaving(true);
      const updatedSettings = {
        ...originalSettings,
        currency: baseCurrency,
        enable_multi_currency: enableMultiCurrency,
        exchange_rate_update_method: exchangeRateUpdateMethod,
        er_auto_update: erAutoUpdate,
        er_frequency: erFrequency,
        er_last_update: erLastUpdate,
        er_conn_status: erConnStatus,
        er_last_result: erLastResult,
      };

      await dbService.update('companies', user.company_id, {
        currency: baseCurrency,
        settings: updatedSettings
      });

      setOriginalSettings(updatedSettings);

      // Notify other views
      window.dispatchEvent(new CustomEvent('company_settings_updated', {
        detail: { currency: baseCurrency, enable_multi_currency: enableMultiCurrency }
      }));

      showNotification(
        language === 'ar' ? 'تم حفظ إعدادات العملات بنجاح' : 'Currency settings saved successfully',
        'success'
      );
    } catch (error) {
      console.error('Failed to save currency settings:', error);
      showNotification(
        language === 'ar' ? 'حدث خطأ أثناء حفظ الإعدادات' : 'Error saving settings',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredCurrencies = currenciesList.filter(c => 
    c.code.toLowerCase().includes(ratesSearch.toLowerCase()) ||
    c.name.toLowerCase().includes(ratesSearch.toLowerCase()) ||
    (c.name_ar && c.name_ar.includes(ratesSearch))
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-slate-500 text-sm font-medium">
          {language === 'ar' ? 'جاري تحميل إعدادات العملات...' : 'Loading currency settings...'}
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5" dir={dir}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
              <span>{language === 'ar' ? 'إعدادات العملات وأسعار الصرف' : 'Currency & Exchange Rate Settings'}</span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {baseCurrency}
              </span>
            </h1>
            <p className="text-slate-400 font-medium text-xs mt-0.5">
              {language === 'ar' 
                ? 'إدارة العملة الأساسية، تفعيل نظام تعدد العملات، وضبط مزامنة أسعار الصرف اللحظية.' 
                : 'Manage primary currency, multi-currency activation, and exchange rate synchronization.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="submit"
            form="currency-settings-form"
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Active Company Banner */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-white to-amber-50/40 p-3.5 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-indigo-900 font-bold">
          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{language === 'ar' ? 'الشركة الحالية:' : 'Active Company:'}</span>
          <span className="text-indigo-700 font-black">{companyName || (language === 'ar' ? 'الشركة الرئيسية' : 'Main Company')}</span>
        </div>
        <div className="flex items-center gap-3 text-slate-600 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {language === 'ar' ? `العملة الأساسية: ${baseCurrency}` : `Base Currency: ${baseCurrency}`}
          </span>
          <span className="text-slate-300">|</span>
          <span className={`font-semibold ${enableMultiCurrency ? 'text-indigo-600' : 'text-slate-400'}`}>
            {enableMultiCurrency 
              ? (language === 'ar' ? 'نظام العملات المتعددة: مفعّل' : 'Multi-Currency: Active')
              : (language === 'ar' ? 'نظام العملات المتعددة: معطّل' : 'Multi-Currency: Disabled')}
          </span>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <form id="currency-settings-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        
        {/* ========================================================================= */}
        {/* COLUMN 1: Base Currency & Multi-Currency Controls                         */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          
          {/* Card 1: Base Currency */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Coins className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-sm md:text-base text-slate-800">
                  {language === 'ar' ? 'العملة الأساسية للنظام' : 'Primary Base Currency'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                {baseCurrency}
              </span>
            </div>

            <div>
              <SearchableSelect
                label={language === 'ar' ? 'اختر العملة الأساسية' : 'Select Base Currency'}
                placeholder={language === 'ar' ? 'ابحث عن العملة...' : 'Search currency...'}
                value={baseCurrency}
                onChange={(val) => setBaseCurrency(val)}
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
              <p className="text-[11px] font-medium text-slate-400 mt-2 leading-relaxed">
                {language === 'ar'
                  ? '💡 العملة الأساسية هي العملة المعتمدة في تقييم الحسابات العامة، الأرباح والخسائر، وقائمة المركز المالي.'
                  : '💡 The base currency is used to evaluate financial statements, general ledger, and balance sheet.'}
              </p>
            </div>
          </div>

          {/* Card 2: Multi-Currency Toggle & Method */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Globe className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-sm md:text-base text-slate-800">
                  {language === 'ar' ? 'نظام تعدد العملات والتحويل' : 'Multi-Currency & Conversion'}
                </span>
              </div>
            </div>

            {/* Toggle Row */}
            <div 
              className="flex items-center justify-between cursor-pointer select-none p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors"
              onClick={() => setEnableMultiCurrency(prev => !prev)}
            >
              <div className="flex flex-col gap-0.5 pr-2">
                <span className="font-bold text-slate-800 text-sm">
                  {language === 'ar' ? 'تفعيل العملات المتعددة' : 'Enable Multi-Currency'}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {language === 'ar' 
                    ? 'إتاحة إصدار فواتير وسندات بعملات أجنبية مع تسجيل فروق العملة.' 
                    : 'Allow foreign currencies in invoices and receipts with automated gain/loss.'}
                </span>
              </div>
              <div 
                className={`relative w-12 h-6 rounded-full transition-all duration-300 shadow-inner shrink-0 ${enableMultiCurrency ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-xs transition-all duration-300 transform ${
                  dir === 'rtl'
                    ? (enableMultiCurrency ? 'translate-x-[-135%]' : 'translate-x-[-10%]')
                    : (enableMultiCurrency ? 'translate-x-[135%]' : 'translate-x-[10%]')
                }`} />
              </div>
            </div>

            {/* Exchange Rate Update Method (When multi-currency is enabled) */}
            {enableMultiCurrency && (
              <div className="pt-2 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ar' ? 'طريقة تحديث أسعار الصرف:' : 'Exchange Rate Update Method:'}
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Manual Option */}
                  <div
                    onClick={() => setExchangeRateUpdateMethod('manual')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      exchangeRateUpdateMethod === 'manual'
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-xs'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs sm:text-sm">
                        {language === 'ar' ? 'التحديث اليدوي (Manual)' : 'Manual Update'}
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        exchangeRateUpdateMethod === 'manual' ? 'border-indigo-600' : 'border-slate-300'
                      }`}>
                        {exchangeRateUpdateMethod === 'manual' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {language === 'ar' ? 'يقوم المستخدم بإدخال وتثبيت أسعار الصرف يدوياً.' : 'User manually specifies and locks rates.'}
                    </span>
                  </div>

                  {/* Auto Option */}
                  <div
                    onClick={() => setExchangeRateUpdateMethod('auto')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      exchangeRateUpdateMethod === 'auto'
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-xs'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs sm:text-sm">
                        {language === 'ar' ? 'التحديث التلقائي (Automatic)' : 'Automatic Update'}
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        exchangeRateUpdateMethod === 'auto' ? 'border-indigo-600' : 'border-slate-300'
                      }`}>
                        {exchangeRateUpdateMethod === 'auto' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {language === 'ar' ? 'جلب ومزامنة أسعار الصرف تلقائياً من خادم المزود.' : 'Fetch live exchange rates from provider.'}
                    </span>
                  </div>
                </div>

                {/* Auto Update Schedule */}
                {exchangeRateUpdateMethod === 'auto' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div
                      className="flex items-center justify-between cursor-pointer select-none p-2.5 bg-slate-50/70 rounded-xl border border-slate-100"
                      onClick={() => setErAutoUpdate(p => !p)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 text-xs">
                          {language === 'ar' ? 'التحديث المجدول تلقائياً (Scheduled)' : 'Scheduled Auto-Update'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {language === 'ar' ? 'تحديث الأسعار في الخلفية بدون تدخل يدوي' : 'Update rates automatically in background'}
                        </span>
                      </div>
                      <div className={`relative w-9 h-5 rounded-full transition-all duration-300 shadow-inner ${erAutoUpdate ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-all duration-300 transform ${
                          dir === 'rtl'
                            ? (erAutoUpdate ? 'translate-x-[-110%]' : 'translate-x-[-5%]')
                            : (erAutoUpdate ? 'translate-x-[110%]' : 'translate-x-[5%]')
                        }`} />
                      </div>
                    </div>

                    {erAutoUpdate && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                        <label className="block text-[11px] font-bold text-slate-600">
                          {language === 'ar' ? 'تكرار التحديث (Update Frequency):' : 'Update Frequency:'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setErFrequency('daily')}
                            className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                              erFrequency === 'daily'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                            }`}
                          >
                            {language === 'ar' ? 'يومي (Once Daily)' : 'Once Daily'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setErFrequency('weekly')}
                            className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                              erFrequency === 'weekly'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                            }`}
                          >
                            {language === 'ar' ? 'أسبوعي (Once Weekly)' : 'Once Weekly'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: Provider Connection, Diagnostics & Active Rates Snapshot       */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          
          {/* Card 3: Provider & Diagnostics */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-sm md:text-base text-slate-800">
                  {language === 'ar' ? 'مزود أسعار الصرف والفحص المباشر' : 'Provider & Live Diagnostics'}
                </span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                erConnStatus === 'ok' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : erConnStatus === 'error'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {erConnStatus === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {erConnStatus === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                {erConnStatus === 'ok' ? (language === 'ar' ? 'متصل' : 'Connected') : erConnStatus === 'error' ? (language === 'ar' ? 'خطأ' : 'Error') : (language === 'ar' ? 'غير متصل' : 'Idle')}
              </span>
            </div>

            {/* Provider Details Box */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === 'ar' ? 'المزود المعتمد' : 'API Provider'}
                  </span>
                  <span className="text-xs font-bold text-slate-800">ExchangeRate.host</span>
                </div>
                <a 
                  href="https://exchangerate.host" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  <span>exchangerate.host</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Last update timestamp */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 font-medium">
                  {language === 'ar' ? 'آخر مزامنة ناجحة:' : 'Last successful sync:'}
                </span>
                <span className="font-bold text-slate-700">
                  {erLastUpdate || (language === 'ar' ? 'لم تتم مزامنة بعد' : 'No sync recorded')}
                </span>
              </div>
            </div>

            {/* Live Actions Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                id="er-update-now-btn"
                onClick={handleErUpdate}
                disabled={erIsUpdating}
                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${erIsUpdating ? 'animate-spin' : ''}`} />
                <span>{erIsUpdating ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث أسعار الصرف الآن (Sync Now)' : 'Sync Rates Now')}</span>
              </button>

              <button
                type="button"
                id="er-test-conn-btn"
                onClick={handleErTest}
                disabled={erIsTesting}
                className="flex items-center justify-center gap-2 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {erIsTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-indigo-600" />}
                <span>{erIsTesting ? (language === 'ar' ? 'جاري الفحص...' : 'Testing...') : (language === 'ar' ? 'اختبار الاتصال' : 'Test Connection')}</span>
              </button>
            </div>

            {/* Test / Sync Result Banner */}
            {erLastResult && (
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                erConnStatus === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {erConnStatus === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="font-semibold leading-relaxed">{erLastResult}</span>
              </div>
            )}
          </div>

          {/* Card 4: Active Rates Snapshot & Quick Link */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-sm text-slate-800">
                  {language === 'ar' ? 'قائمة العملات المسجلة والأسعار' : 'Registered Currencies & Rates'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => openTab('currencies', language === 'ar' ? 'إدارة العملات' : 'Currency Management')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{language === 'ar' ? 'فتح شاشة إدارة العملات التفصيلية' : 'Open Currency Directory'}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className={`w-3.5 h-3.5 text-slate-400 absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2`} />
              <input
                type="text"
                value={ratesSearch}
                onChange={(e) => setRatesSearch(e.target.value)}
                placeholder={language === 'ar' ? 'تصفية العملات...' : 'Filter currencies...'}
                className={`w-full ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500`}
              />
            </div>

            {/* Currency Rates Mini Table */}
            <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
              {filteredCurrencies.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-medium">
                  {language === 'ar' 
                    ? 'لا توجد عملات إضافية مسجلة حالياً. يمكنك إضافتها من شاشة إدارة العملات.' 
                    : 'No additional currencies found. Add them in Currencies Management.'}
                </div>
              ) : (
                filteredCurrencies.map((c) => (
                  <div 
                    key={c.id} 
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-indigo-50/40 rounded-xl border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-indigo-700 shadow-2xs">
                        {c.code}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">
                          {language === 'ar' && c.name_ar ? c.name_ar : c.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {c.symbol} | {c.code}
                        </span>
                      </div>
                    </div>

                    <div className="text-left font-mono">
                      <div className="font-black text-xs text-indigo-700">
                        {c.rate ? `1 ${c.code} = ${Number(c.rate).toFixed(4)} ${baseCurrency}` : (language === 'ar' ? 'غير مسجل' : 'N/A')}
                      </div>
                      {c.rate_date && (
                        <div className="text-[10px] text-slate-400">
                          {new Date(c.rate_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </form>
    </div>
  );
}
