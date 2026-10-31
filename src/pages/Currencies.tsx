import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Coins, 
  History, 
  ToggleLeft, 
  ToggleRight, 
  Calendar,
  AlertCircle,
  TrendingUp,
  Save,
  X,
  LayoutGrid,
  List,
  PlusCircle,
  Search,
  Trash2,
  RefreshCw,
  TrendingDown,
  BarChart3,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Currency, ExchangeRate, Company } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { format } from 'date-fns';
import { WORLD_CURRENCIES, WorldCurrency } from '../constants/worldCurrencies';
import { apiRequest } from '../services/dbService';

export default function Currencies() {
  const { language, t, dir } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, ExchangeRate[]>>({});
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  
  // Modals
  const [isAddCurrencyOpen, setIsAddCurrencyOpen] = useState(false);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [chartType, setChartType] = useState<'area' | 'line'>('area');
  const [chartDateFrom, setChartDateFrom] = useState('');
  const [chartDateTo, setChartDateTo] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mainSearchQuery, setMainSearchQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);
  /** Latest rate from currency_rates table, keyed by currency_id */
  const [autoRates, setAutoRates] = useState<Record<string, { rate: number; rate_date: string } | null>>({});
  const [autoHistory, setAutoHistory] = useState<any[]>([]);

  const handleUpdateRates = async () => {
    if (!company) return;
    setIsUpdatingRates(true);
    try {
      const baseCurrency = company.settings?.currency || 'EGP';
      // Call the server-side API route — keeps Node.js code off the browser bundle
      const result = await apiRequest<{
        success: boolean;
        inserted: number;
        updated: number;
        skipped: number;
        message: string;
      }>('/currencies/update-rates', 'POST', { baseCurrency });

      if (result.success) {
        showNotification(
          language === 'ar'
            ? `تم تحديث أسعار الصرف بنجاح.\nمضاف: ${result.inserted} | محدَّث: ${result.updated} | متجاوَز: ${result.skipped}`
            : `Exchange rates updated successfully.\nInserted: ${result.inserted} | Updated: ${result.updated} | Skipped: ${result.skipped}`,
          'success'
        );
        // Refresh the list without reloading the whole page
        await loadData();
      } else {
        showNotification(
          language === 'ar'
            ? `فشل تحديث أسعار الصرف: ${result.message}`
            : `Failed to update exchange rates: ${result.message}`,
          'error'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(language === 'ar' ? `خطأ: ${msg}` : `Error: ${msg}`, 'error');
    } finally {
      setIsUpdatingRates(false);
    }
  };

  // Search in selection
  const [searchQuery, setSearchQuery] = useState('');
  
  // History Filters
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  
  // Forms
  const [newCurrency, setNewCurrency] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    symbol: '',
    is_active: true,
    flag: ''
  });

  const [newRate, setNewRate] = useState({
    exchange_rate: '',
    rate_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  useEffect(() => {
    loadData();

    // Real-time synchronization
    const handleRefresh = (e: any) => {
      if (e.detail?.collection === 'currencies' || e.detail?.collection === 'exchange_rates' || e.detail?.collection === 'companies') {
        loadData();
      }
    };
    window.addEventListener('db-refresh', handleRefresh as EventListener);
    return () => window.removeEventListener('db-refresh', handleRefresh as EventListener);
  }, [user]);

  const loadData = async () => {
    if (!user?.company_id) return;
    try {
      const [currData, compData] = await Promise.all([
        dbService.list<Currency>('currencies', user.company_id),
        dbService.get<Company>('companies', user.company_id)
      ]);
      
      setCurrencies(currData);
      setCompany(compData);
      
      // Initially, we only need the latest rate for each currency for the main view
      const ratesMap: Record<string, ExchangeRate[]> = {};
      for (const curr of currData) {
        const latestRate = await dbService.list<ExchangeRate>('exchange_rates', {
          currency_id: curr.id,
          company_id: user.company_id,
          _limit: 1,
          _sort: 'rate_date',
          _order: 'desc'
        });
        ratesMap[curr.id] = latestRate;
      }
      setExchangeRates(ratesMap);

      // Phase 5: load latest rates from currency_rates (LEFT JOIN, read-only)
      try {
        const latestAutoRates = await apiRequest<Array<{
          currency_id: string;
          rate: number | null;
          rate_date: string | null;
        }>>(`/currency-rates/latest?company_id=${user.company_id}`);

        const autoMap: Record<string, { rate: number; rate_date: string } | null> = {};
        for (const row of latestAutoRates) {
          autoMap[row.currency_id] =
            row.rate !== null && row.rate_date !== null
              ? { rate: Number(row.rate), rate_date: row.rate_date }
              : null;
        }
        setAutoRates(autoMap);
      } catch {
        // Non-blocking: auto-rates display degrades gracefully if endpoint fails
        setAutoRates({});
      }
    } catch (error) {
      console.error('Failed to load currency data:', error);
      showNotification(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (curr: Currency) => {
    if (!user?.company_id) return;
    setLoadingHistory(true);
    try {
      const [autoData, manualRates] = await Promise.all([
        apiRequest<any[]>(`/currency-rates/history?currency_code=${curr.code}&company_id=${user.company_id}`).catch(() => []),
        dbService.list<ExchangeRate>('exchange_rates', {
          currency_id: curr.id,
          company_id: user.company_id
        }).catch(() => [])
      ]);
      setAutoHistory(Array.isArray(autoData) ? autoData : []);
      const sorted = (Array.isArray(manualRates) ? manualRates : []).sort(
        (a, b) => new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime()
      );
      setExchangeRates(prev => ({ ...prev, [curr.id]: sorted }));
    } catch (error) {
      console.error('Failed to load rate history:', error);
      showNotification(t('common.error'), 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAddCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id) return;

    // Check for duplicates
    const isDuplicate = currencies.some(c => c.code.toLowerCase() === newCurrency.code.toLowerCase());
    if (isDuplicate) {
      showNotification(language === 'ar' ? 'هذه العملة مضافة بالفعل' : 'This currency is already added', 'error');
      return;
    }

    try {
      const currencyData: Omit<Currency, 'id'> = {
        ...newCurrency,
        company_id: user.company_id,
        created_at: new Date().toISOString()
      };

      const id = await dbService.add('currencies', currencyData);
      
      // Update local state for instant feedback
      const addedCurrency = { id, ...currencyData };
      setCurrencies(prev => [...prev, addedCurrency]);
      setExchangeRates(prev => ({ ...prev, [id]: [] }));
      
      setIsAddCurrencyOpen(false);
      setNewCurrency({
        code: '',
        name_ar: '',
        name_en: '',
        symbol: '',
        is_active: true,
        flag: ''
      });
      setSearchQuery('');
      showNotification(t('common.save_success'), 'success');
      
      // Automatically show rate addition for the new currency
      setSelectedCurrency(addedCurrency);
      setIsHistoryOpen(true);
    } catch (error) {
      console.error('Failed to add currency:', error);
      showNotification(t('common.error'), 'error');
    }
  };

  const handleDeleteCurrency = async (id: string) => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه العملة؟' : 'Are you sure you want to delete this currency?')) return;
    try {
      await dbService.delete('currencies', id);
      setCurrencies(prev => prev.filter(c => c.id !== id));
      showNotification(t('common.delete_success'), 'success');
    } catch (error) {
      console.error('Failed to delete currency:', error);
      showNotification(t('common.error'), 'error');
    }
  };

  const toggleCurrencyStatus = async (currency: Currency) => {
    try {
      await dbService.update('currencies', currency.id, {
        is_active: !currency.is_active
      });
      setCurrencies(currencies.map(c => 
        c.id === currency.id ? { ...c, is_active: !c.is_active } : c
      ));
      showNotification(t('common.update_success'), 'success');
    } catch (error) {
      console.error('Failed to toggle currency status:', error);
      showNotification(t('common.error'), 'error');
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id || !selectedCurrency) return;

    try {
      const rateData: Omit<ExchangeRate, 'id'> = {
        currency_id: selectedCurrency.id,
        exchange_rate: Number(newRate.exchange_rate),
        rate_date: newRate.rate_date,
        notes: newRate.notes,
        created_by: user.id || '',
        created_at: new Date().toISOString(),
        company_id: user.company_id
      };

      const id = await dbService.add('exchange_rates', rateData);
      
      // Update local state for immediate feedback
      const newRateRecord = { id, ...rateData };
      setExchangeRates(prev => {
        const currentCurrencyRates = prev[selectedCurrency.id] || [];
        const updated = [newRateRecord, ...currentCurrencyRates].sort((a, b) => 
          new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime()
        );
        return {
          ...prev,
          [selectedCurrency.id]: updated
        };
      });
      
      setIsAddRateOpen(false);
      setNewRate({
        exchange_rate: '',
        rate_date: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
      });
      showNotification(t('common.save_success'), 'success');
    } catch (error) {
      console.error('Failed to add exchange rate:', error);
      showNotification(t('common.error'), 'error');
    }
  };

  const filteredWorldCurrencies = WORLD_CURRENCIES.filter(curr => {
    const query = searchQuery.toLowerCase();
    return (
      curr.code.toLowerCase().includes(query) ||
      curr.name_ar.toLowerCase().includes(query) ||
      curr.name_en.toLowerCase().includes(query)
    );
  });

  const selectWorldCurrency = (curr: WorldCurrency) => {
    setNewCurrency({
      ...newCurrency,
      code: curr.code,
      name_ar: curr.name_ar,
      name_en: curr.name_en,
      symbol: curr.symbol,
      flag: curr.flag
    });
    setSearchQuery('');
  };

  const filteredCurrencies = currencies.filter(curr => {
    const query = mainSearchQuery.toLowerCase();
    const latestRate = exchangeRates[curr.id]?.[0];
    const rateValue = latestRate?.exchange_rate.toString() || '';
    
    return (
      curr.code.toLowerCase().includes(query) ||
      curr.name_ar.toLowerCase().includes(query) ||
      curr.name_en.toLowerCase().includes(query) ||
      curr.symbol.toLowerCase().includes(query) ||
      rateValue.includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Coins className="w-8 h-8 text-emerald-600" />
            {t('currencies.title')}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {t('currencies.subtitle')}
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Main Search Bar */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث في العملات والقيمة...' : 'Search currencies and value...'}
              className="w-full bg-white border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              value={mainSearchQuery}
              onChange={e => setMainSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex bg-zinc-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white text-emerald-600 shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
              title={language === 'ar' ? 'عرض شبكي' : 'Grid View'}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'list' 
                  ? 'bg-white text-emerald-600 shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
              title={language === 'ar' ? 'عرض قائمة' : 'List View'}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
          {company?.settings?.exchange_rate_update_method === 'auto' && (
            <button
              onClick={handleUpdateRates}
              disabled={isUpdatingRates}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full md:w-auto justify-center whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdatingRates ? 'animate-spin' : ''}`} />
              {isUpdatingRates
                ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...')
                : (language === 'ar' ? 'تحديث أسعار الصرف (Sync)' : 'Update Exchange Rates')}
            </button>
          )}
          <button
            onClick={() => setIsAddCurrencyOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors w-full md:w-auto justify-center whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            {t('currencies.add')}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-900 text-sm">
            {t('currencies.base_currency_hint', { currency: company?.settings?.currency || 'EGP' })}
          </h3>
          <p className="text-xs text-amber-700 mt-1">
            {language === 'ar' 
              ? 'تستخدم العملة الأساسية في جميع التقارير والقيود المحاسبية. يتم إدخال العملات الأخرى مع تحديد سعر صرفها بالمقارنة مع العملة الأساسية.' 
              : 'Base currency is used in all reports and accounting entries. Other currencies are defined by their exchange rate relative to the base currency.'}
          </p>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCurrencies.map(curr => {
            const latestRate = exchangeRates[curr.id]?.[0];
            return (
              <div key={curr.id} className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center relative overflow-hidden">
                      <span className="text-2xl absolute -top-1 -right-1 opacity-20 select-none">{curr.flag}</span>
                      <span className="text-emerald-600 font-bold text-lg z-10">{curr.symbol}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                        <span>{curr.flag}</span>
                        {language === 'ar' ? curr.name_ar : curr.name_en}
                      </h3>
                      <p className="text-xs text-zinc-400 font-mono">{curr.code}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleCurrencyStatus(curr)}
                    className={`p-1.5 rounded-lg transition-colors ${curr.is_active ? 'text-green-600 hover:bg-green-50' : 'text-zinc-400 hover:bg-zinc-50'}`}
                  >
                    {curr.is_active ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-zinc-50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 uppercase font-bold">{t('currencies.rate')}</span>
                      {latestRate ? (
                        <>
                          <span className="text-sm font-bold text-zinc-800">
                            1 {curr.code} = {latestRate.exchange_rate.toLocaleString(undefined, { minimumFractionDigits: 4 })} EGP
                          </span>
                          <span className="text-[10px] text-zinc-500 font-medium">
                            1 EGP = {(latestRate.exchange_rate > 0 ? 1 / latestRate.exchange_rate : 0).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })} {curr.code}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-zinc-800">---</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end justify-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">{t('currencies.rate_date')}</span>
                      <span className="text-xs text-zinc-600 font-mono">
                        {latestRate ? format(new Date(latestRate.rate_date), 'dd/MM/yyyy') : '---'}
                      </span>
                    </div>
                  </div>

                  {/* Phase 5 – currency_rates auto-fetched rate (read-only, LEFT JOIN) */}
                  {(() => {
                    const ar = autoRates[curr.id];
                    const hasAutoRate = ar !== undefined; // key present means API returned a row
                    if (!hasAutoRate) return null; // still loading or currency not yet in map
                    return (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-blue-500 uppercase font-bold tracking-wider">
                            {language === 'ar' ? 'سعر تلقائي' : 'Live Rate'}
                          </span>
                          {ar ? (
                            <>
                              <span className="text-sm font-bold text-blue-800">
                                1 {curr.code} = {ar.rate.toLocaleString(undefined, { minimumFractionDigits: 4 })} EGP
                              </span>
                              <span className="text-[10px] text-blue-600/80 font-medium">
                                1 EGP = {(ar.rate > 0 ? 1 / ar.rate : 0).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })} {curr.code}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs italic text-blue-300">
                              {language === 'ar' ? 'لا يوجد سعر صرف' : 'No exchange rate available'}
                            </span>
                          )}
                        </div>
                        {ar && (
                          <div className="flex flex-col items-end justify-center">
                            <span className="text-[10px] text-blue-400 font-bold uppercase">
                              {t('currencies.rate_date')}
                            </span>
                            <span className="text-xs text-blue-600 font-mono">
                              {format(new Date(ar.rate_date), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex gap-2">
                    {company?.settings?.exchange_rate_update_method !== 'auto' && (
                      <button
                        onClick={() => {
                          setSelectedCurrency(curr);
                          setIsAddRateOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-black transition-colors"
                      >
                        <PlusCircle className="w-4 h-4" />
                        {t('currencies.add_rate')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedCurrency(curr);
                        setIsHistoryOpen(true);
                        loadHistory(curr);
                      }}
                      className={`${company?.settings?.exchange_rate_update_method === 'auto' ? 'flex-1' : 'w-12'} flex items-center justify-center gap-2 bg-zinc-100 text-zinc-600 py-2.5 rounded-xl hover:bg-zinc-200 transition-colors font-medium text-sm`}
                    >
                      <History className="w-5 h-5" />
                      {company?.settings?.exchange_rate_update_method === 'auto' && (language === 'ar' ? 'سجل المزامنة' : 'Sync History')}
                    </button>
                    {(!latestRate || exchangeRates[curr.id]?.length === 0) && (
                      <button
                        onClick={() => handleDeleteCurrency(curr.id)}
                        className="w-12 flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                        title={language === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCurrency(curr);
                      setChartPeriod('all');
                      setChartDateFrom('');
                      setChartDateTo('');
                      setIsChartOpen(true);
                      loadHistory(curr);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200/80 py-2.5 rounded-xl hover:bg-emerald-100 transition-colors font-bold text-sm"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>{language === 'ar' ? 'رسم بياني لتغير سعر العملة' : 'Exchange Rate Change Chart'}</span>
                  </button>
                </div>
              </div>
            );
          })}
          {filteredCurrencies.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-400 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p>{t('common.no_results')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className={`px-6 py-4 font-bold text-zinc-500 uppercase tracking-wider ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'العملة' : 'Currency'}</th>
                  <th className="px-6 py-4 text-center font-bold text-zinc-500 uppercase tracking-wider">{t('currencies.code')}</th>
                  <th className="px-6 py-4 text-center font-bold text-zinc-500 uppercase tracking-wider">{t('currencies.symbol')}</th>
                  <th className="px-6 py-4 text-center font-bold text-zinc-500 uppercase tracking-wider">{t('currencies.rate')}</th>
                  <th className="px-6 py-4 text-center font-bold text-blue-400 uppercase tracking-wider">{language === 'ar' ? 'سعر تلقائي' : 'Live Rate'}</th>
                  <th className="px-6 py-4 text-center font-bold text-zinc-500 uppercase tracking-wider">{t('common.status')}</th>
                  <th className="px-6 py-4 text-center font-bold text-zinc-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredCurrencies.map(curr => {
                  const latestRate = exchangeRates[curr.id]?.[0];
                  return (
                    <tr key={curr.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xl drop-shadow-sm">{curr.flag}</span>
                          <span className="font-bold text-zinc-900">{language === 'ar' ? curr.name_ar : curr.name_en}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-zinc-500 uppercase">{curr.code}</td>
                      <td className="px-6 py-4 text-center font-bold text-emerald-600">{curr.symbol}</td>
                      <td className="px-6 py-4 text-center">
                        {latestRate ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-800">
                              1 {curr.code} = {latestRate.exchange_rate.toLocaleString(undefined, { minimumFractionDigits: 4 })} EGP
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium">
                              1 EGP = {(latestRate.exchange_rate > 0 ? 1 / latestRate.exchange_rate : 0).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })} {curr.code}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono italic mt-0.5">{format(new Date(latestRate.rate_date), 'dd/MM/yyyy')}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-300">---</span>
                        )}
                      </td>
                      {/* Phase 5 – Live Rate from currency_rates */}
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          const ar = autoRates[curr.id];
                          if (ar === undefined) return <span className="text-zinc-200">—</span>;
                          if (ar === null) return (
                            <span className="text-[10px] italic text-blue-300">
                              {language === 'ar' ? 'لا يوجد سعر صرف' : 'No exchange rate available'}
                            </span>
                          );
                          return (
                            <div className="flex flex-col">
                              <span className="font-bold text-blue-800">
                                1 {curr.code} = {ar.rate.toLocaleString(undefined, { minimumFractionDigits: 4 })} EGP
                              </span>
                              <span className="text-[10px] text-blue-500/80 font-medium">
                                1 EGP = {(ar.rate > 0 ? 1 / ar.rate : 0).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })} {curr.code}
                              </span>
                              <span className="text-[10px] text-blue-400 font-mono mt-0.5">
                                {format(new Date(ar.rate_date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => toggleCurrencyStatus(curr)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                            curr.is_active 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                          }`}
                        >
                          {curr.is_active ? t('common.active') : t('common.inactive')}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          {company?.settings?.exchange_rate_update_method !== 'auto' && (
                            <button
                              onClick={() => {
                                setSelectedCurrency(curr);
                                setIsAddRateOpen(true);
                              }}
                              className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title={t('currencies.add_rate')}
                            >
                              <PlusCircle className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedCurrency(curr);
                              setIsHistoryOpen(true);
                              loadHistory(curr);
                            }}
                            className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title={company?.settings?.exchange_rate_update_method === 'auto' ? (language === 'ar' ? 'سجل المزامنة' : 'Sync History') : t('currencies.history')}
                          >
                            <History className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCurrency(curr);
                              setChartPeriod('all');
                              setChartDateFrom('');
                              setChartDateTo('');
                              setIsChartOpen(true);
                              loadHistory(curr);
                            }}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title={language === 'ar' ? 'رسم بياني لتغير سعر العملة' : 'Exchange Rate Change Chart'}
                          >
                            <TrendingUp className="w-5 h-5" />
                          </button>
                          {(!latestRate || exchangeRates[curr.id]?.length === 0) && (
                            <button
                              onClick={() => handleDeleteCurrency(curr.id)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title={language === 'ar' ? 'حذف' : 'Delete'}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCurrencies.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">
                      {t('common.no_results')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Currency Modal */}
      {isAddCurrencyOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">{t('currencies.add')}</h2>
              <button onClick={() => setIsAddCurrencyOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Currency Search/Selection */}
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'ابحث عن عملة عالمية...' : 'Search global currencies...'}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                {!searchQuery && (
                  <div className="bg-white border border-zinc-100 rounded-xl max-h-60 overflow-y-auto shadow-sm">
                    <div className="sticky top-0 bg-zinc-50 px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                      {language === 'ar' ? 'عملات شائعة' : 'Popular Currencies'}
                    </div>
                    {WORLD_CURRENCIES.slice(0, 5).map(curr => {
                      const isAdded = currencies.some(c => c.code.toLowerCase() === curr.code.toLowerCase());
                      const isBase = company?.settings?.currency?.toLowerCase() === curr.code.toLowerCase();
                      const isDisabled = isAdded || isBase;
                      
                      return (
                        <button
                          key={curr.code}
                          type="button"
                          onClick={() => !isDisabled && selectWorldCurrency(curr)}
                          disabled={isDisabled}
                          className={`w-full px-4 py-3 text-right flex items-center justify-between group transition-colors border-b border-zinc-50 last:border-0 ${
                            isDisabled ? 'opacity-50 cursor-not-allowed bg-zinc-50/50' : 'hover:bg-emerald-50/50'
                          }`}
                          style={{ direction: dir }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl drop-shadow-sm">{curr.flag}</span>
                            <div className="text-right">
                              <p className="text-sm font-bold text-zinc-800">{language === 'ar' ? curr.name_ar : curr.name_en}</p>
                              <p className="text-[10px] text-zinc-400 font-mono tracking-tighter">
                                {curr.code} • {curr.symbol}
                                {isBase && (
                                  <span className="mx-1 text-amber-600 font-bold bg-amber-50 px-1 rounded">
                                    {language === 'ar' ? 'العملة الأساسية' : 'Base Currency'}
                                  </span>
                                )}
                                {isAdded && !isBase && (
                                  <span className="mx-1 text-emerald-600 font-bold bg-emerald-50 px-1 rounded">
                                    {language === 'ar' ? 'مضافة مسبقاً' : 'Added'}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          {!isDisabled && <PlusCircle className="w-5 h-5 text-zinc-200 group-hover:text-emerald-600 transition-colors" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {searchQuery && (
                  <div className="bg-white border border-emerald-100 rounded-xl max-h-60 overflow-y-auto shadow-lg z-20 relative">
                    <div className="sticky top-0 bg-emerald-50 px-4 py-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest border-b border-emerald-100">
                      {language === 'ar' ? 'نتائج البحث' : 'Search Results'}
                    </div>
                    {filteredWorldCurrencies.length > 0 ? (
                      filteredWorldCurrencies.map(curr => {
                        const isAdded = currencies.some(c => c.code.toLowerCase() === curr.code.toLowerCase());
                        const isBase = company?.settings?.currency?.toLowerCase() === curr.code.toLowerCase();
                        const isDisabled = isAdded || isBase;

                        return (
                          <button
                            key={curr.code}
                            type="button"
                            onClick={() => !isDisabled && selectWorldCurrency(curr)}
                            disabled={isDisabled}
                            className={`w-full px-4 py-3 text-right flex items-center justify-between group transition-colors border-b border-zinc-50 last:border-0 ${
                              isDisabled ? 'opacity-50 cursor-not-allowed bg-zinc-50/50' : 'hover:bg-emerald-50/50'
                            }`}
                            style={{ direction: dir }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl drop-shadow-sm">{curr.flag}</span>
                              <div className="text-right">
                                <p className="text-sm font-bold text-zinc-800">{language === 'ar' ? curr.name_ar : curr.name_en}</p>
                                <p className="text-[10px] text-zinc-400 font-mono tracking-tighter">
                                  {curr.code} • {curr.symbol}
                                  {isBase && (
                                    <span className="mx-1 text-amber-600 font-bold bg-amber-50 px-1 rounded">
                                      {language === 'ar' ? 'العملة الأساسية' : 'Base Currency'}
                                    </span>
                                  )}
                                  {isAdded && !isBase && (
                                    <span className="mx-1 text-emerald-600 font-bold bg-emerald-50 px-1 rounded">
                                      {language === 'ar' ? 'مضافة مسبقاً' : 'Added'}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {!isDisabled && <PlusCircle className="w-5 h-5 text-zinc-200 group-hover:text-emerald-600 transition-colors" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-zinc-400 bg-white">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-xs uppercase font-bold tracking-widest">{t('common.no_results')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={handleAddCurrency} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('currencies.code')}</label>
                    <div className="relative">
                      <input
                        readOnly
                        disabled
                        type="text"
                        placeholder="اختر من القائمة أعلاه"
                        className="w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none opacity-70 cursor-not-allowed font-mono"
                        value={newCurrency.code}
                      />
                      {newCurrency.flag && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">{newCurrency.flag}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      {language === 'ar' ? '* كود العملة دولي ولا يمكن تعديله برمجياً لضمان سلامة العمليات.' : '* Currency code is international and locked for data integrity.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('currencies.name_ar')}</label>
                    <input
                      readOnly
                      required
                      type="text"
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none opacity-70 cursor-not-allowed"
                      value={newCurrency.name_ar}
                      onChange={e => setNewCurrency({ ...newCurrency, name_ar: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('currencies.name_en')}</label>
                    <input
                      readOnly
                      required
                      type="text"
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none opacity-70 cursor-not-allowed"
                      value={newCurrency.name_en}
                      onChange={e => setNewCurrency({ ...newCurrency, name_en: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('currencies.symbol')}</label>
                    <input
                      readOnly
                      required
                      type="text"
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none opacity-70 cursor-not-allowed font-mono"
                      value={newCurrency.symbol}
                      onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                    />
                  </div>
                  
                  <div className="col-span-2 pt-2">
                    <button 
                      type="button"
                      onClick={() => setNewCurrency(prev => ({ ...prev, is_active: !prev.is_active }))}
                      className="flex items-center gap-3 cursor-pointer select-none"
                    >
                      <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${newCurrency.is_active ? 'bg-green-600' : 'bg-zinc-200'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${
                          dir === 'rtl' 
                            ? (newCurrency.is_active ? 'right-5.5' : 'right-0.5')
                            : (newCurrency.is_active ? 'left-5.5' : 'left-0.5')
                        }`} />
                      </div>
                      <span className="text-sm font-bold text-zinc-700">{t('common.status')} ({newCurrency.is_active ? t('common.active') : t('common.inactive')})</span>
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!newCurrency.code}
                  className={`w-full font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-6 ${
                    !newCurrency.code 
                      ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <Save className="w-5 h-5" />
                  {t('common.save')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Rate Modal */}
      {isAddRateOpen && selectedCurrency && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">{t('currencies.add_rate')}</h2>
                  <p className="text-xs text-zinc-400">{language === 'ar' ? selectedCurrency.name_ar : selectedCurrency.name_en}</p>
                </div>
              </div>
              <button onClick={() => setIsAddRateOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddRate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('currencies.rate')}</label>
                <input
                  required
                  type="number"
                  step="0.000001"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  value={newRate.exchange_rate}
                  onChange={e => setNewRate({ ...newRate, exchange_rate: e.target.value })}
                  placeholder={language === 'ar' ? `مثال: 50.0 (1 ${selectedCurrency.code} = 50.0 EGP)` : `e.g. 50.0 (1 ${selectedCurrency.code} = 50.0 EGP)`}
                />
                <p className="text-[10px] text-zinc-500 font-semibold mt-1.5 leading-relaxed">
                  {language === 'ar'
                    ? `* الاتجاه: كم يعادل 1 ${selectedCurrency.name_ar} بالجنيه المصري (مثال: 1 ${selectedCurrency.code} = 50.00 جنيه)`
                    : `* Direction: How much 1 ${selectedCurrency.code} is in EGP (e.g. 1 ${selectedCurrency.code} = 50.00 EGP)`}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('currencies.rate_date')}</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    required
                    type="date"
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    value={newRate.rate_date}
                    onChange={e => setNewRate({ ...newRate, rate_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('common.notes')}</label>
                <textarea
                  rows={3}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  value={newRate.notes}
                  onChange={e => setNewRate({ ...newRate, notes: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 mt-6"
              >
                <Save className="w-5 h-5" />
                {t('common.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryOpen && selectedCurrency && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <History className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">{t('currencies.exchange_rates')}</h2>
                  <p className="text-xs text-zinc-400">{language === 'ar' ? selectedCurrency.name_ar : selectedCurrency.name_en}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsHistoryOpen(false);
                    setChartPeriod('all');
                    setChartDateFrom('');
                    setChartDateTo('');
                    setIsChartOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors text-xs font-bold"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>{language === 'ar' ? 'عرض الرسم البياني' : 'View Chart'}</span>
                </button>
                <button onClick={() => {
                  setIsHistoryOpen(false);
                  setHistorySearchQuery('');
                  setHistoryDateFrom('');
                  setHistoryDateTo('');
                }} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* History Filters */}
            <div className="p-4 bg-zinc-50 border-b border-zinc-100 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث في القيمة أو الملاحظات...' : 'Search rate or notes...'}
                  className="w-full bg-white border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  value={historySearchQuery}
                  onChange={e => setHistorySearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="date"
                  className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:outline-none"
                  value={historyDateFrom}
                  onChange={e => setHistoryDateFrom(e.target.value)}
                  title={language === 'ar' ? 'من تاريخ' : 'From date'}
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="date"
                  className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:outline-none"
                  value={historyDateTo}
                  onChange={e => setHistoryDateTo(e.target.value)}
                  title={language === 'ar' ? 'إلى تاريخ' : 'To date'}
                />
              </div>
            </div>
            
            {company?.settings?.exchange_rate_update_method === 'auto' ? (
              <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-3 grid grid-cols-7 text-[10px] font-bold text-zinc-400 uppercase tracking-wider" dir={dir}>
                <div className="col-span-1">{language === 'ar' ? 'العملة' : 'Currency'}</div>
                <div className="col-span-1">{language === 'ar' ? 'سعر الصرف' : 'Rate'}</div>
                <div className="col-span-1">{language === 'ar' ? 'المزود' : 'Provider'}</div>
                <div className="col-span-1">{language === 'ar' ? 'التاريخ' : 'Date'}</div>
                <div className="col-span-1">{language === 'ar' ? 'الوقت' : 'Time'}</div>
                <div className="col-span-1">{language === 'ar' ? 'بواسطة' : 'By'}</div>
                <div className="col-span-1">{language === 'ar' ? 'الحالة' : 'Status'}</div>
              </div>
            ) : (
              <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-3 grid grid-cols-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <div className="col-span-1">{t('currencies.rate')}</div>
                <div className="col-span-1">{t('currencies.rate_date')}</div>
                <div className="col-span-2">{t('common.notes')}</div>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-0">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest animate-pulse">
                    {language === 'ar' ? 'جاري تحميل السجل...' : 'Loading history...'}
                  </p>
                </div>
              ) : (() => {
                const isAuto = company?.settings?.exchange_rate_update_method === 'auto';
                if (isAuto) {
                  let filteredHistory = [...autoHistory];
                  if (historySearchQuery) {
                    const query = historySearchQuery.toLowerCase();
                    filteredHistory = filteredHistory.filter(r => 
                      r.currency_code.toLowerCase().includes(query) || 
                      r.exchange_rate.toString().includes(query) ||
                      r.provider.toLowerCase().includes(query) ||
                      r.updated_by.toLowerCase().includes(query)
                    );
                  }
                  if (historyDateFrom) {
                    filteredHistory = filteredHistory.filter(r => {
                      const parts = r.retrieved_date.split('/');
                      if (parts.length === 3) {
                        const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        return formatted >= historyDateFrom;
                      }
                      return true;
                    });
                  }
                  if (historyDateTo) {
                    filteredHistory = filteredHistory.filter(r => {
                      const parts = r.retrieved_date.split('/');
                      if (parts.length === 3) {
                        const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        return formatted <= historyDateTo;
                      }
                      return true;
                    });
                  }

                  if (filteredHistory.length > 0) {
                    return filteredHistory.map((rate, idx) => (
                      <div 
                        key={rate.id} 
                        className={`px-6 py-4 grid grid-cols-7 items-center text-xs border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors ${idx === 0 && !historySearchQuery && !historyDateFrom && !historyDateTo ? 'bg-emerald-50/30' : ''}`}
                        dir={dir}
                      >
                        <div className="col-span-1 font-bold text-zinc-850 text-zinc-800">{rate.currency_code}</div>
                        <div className="col-span-1 font-bold text-zinc-800">
                          {rate.status === 'Failed' ? '---' : Number(rate.exchange_rate).toLocaleString()}
                        </div>
                        <div className="col-span-1 text-zinc-500 truncate px-1" title={rate.provider}>{rate.provider}</div>
                        <div className="col-span-1 text-zinc-500 font-mono text-[11px]">{rate.retrieved_date}</div>
                        <div className="col-span-1 text-zinc-400 font-mono text-[10px]">{rate.retrieved_time}</div>
                        <div className="col-span-1 text-zinc-500">{rate.updated_by}</div>
                        <div className="col-span-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rate.status === 'Success' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {rate.status === 'Success' ? (language === 'ar' ? 'ناجح' : 'Success') : (language === 'ar' ? 'فشل' : 'Failed')}
                          </span>
                        </div>
                      </div>
                    ));
                  }
                  return (
                    <div className="p-12 text-center text-zinc-400 italic">
                      {t('common.no_data')}
                    </div>
                  );
                } else {
                  let filteredRates = (exchangeRates[selectedCurrency.id] || []);
                  if (historySearchQuery) {
                    const query = historySearchQuery.toLowerCase();
                    filteredRates = filteredRates.filter(r => 
                      r.exchange_rate.toString().includes(query) || 
                      (r.notes || '').toLowerCase().includes(query)
                    );
                  }
                  if (historyDateFrom) {
                    filteredRates = filteredRates.filter(r => r.rate_date >= historyDateFrom);
                  }
                  if (historyDateTo) {
                    filteredRates = filteredRates.filter(r => r.rate_date <= historyDateTo);
                  }

                  if (filteredRates.length > 0) {
                    return filteredRates.map((rate, idx) => (
                      <div 
                        key={rate.id} 
                        className={`px-6 py-4 grid grid-cols-4 items-center text-sm border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors ${idx === 0 && !historySearchQuery && !historyDateFrom && !historyDateTo ? 'bg-emerald-50/30' : ''}`}
                      >
                        <div className="col-span-1 font-bold text-zinc-800">{rate.exchange_rate.toLocaleString()}</div>
                        <div className="col-span-1 text-zinc-500 font-mono text-xs">{format(new Date(rate.rate_date), 'dd/MM/yyyy')}</div>
                        <div className="col-span-2 text-zinc-400 text-xs italic">{rate.notes || '---'}</div>
                      </div>
                    ));
                  }
                  return (
                    <div className="p-12 text-center text-zinc-400 italic">
                      {t('common.no_data')}
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Exchange Rate Change Chart Modal */}
      {isChartOpen && selectedCurrency && (() => {
        const baseCurr = company?.settings?.currency || 'EGP';

        // Parse date strings (DD/MM/YYYY or YYYY-MM-DD) into ISO YYYY-MM-DD and display DD/MM/YYYY
        const parseDateInfo = (rawDate: string, rawTime?: string) => {
          const str = String(rawDate || '').trim();
          let isoDate = '';
          let displayDate = str;
          const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (dmyMatch) {
            const dd = dmyMatch[1].padStart(2, '0');
            const mm = dmyMatch[2].padStart(2, '0');
            const yyyy = dmyMatch[3];
            isoDate = `${yyyy}-${mm}-${dd}`;
            displayDate = `${dd}/${mm}/${yyyy}`;
          } else if (ymdMatch) {
            const yyyy = ymdMatch[1];
            const mm = ymdMatch[2].padStart(2, '0');
            const dd = ymdMatch[3].padStart(2, '0');
            isoDate = `${yyyy}-${mm}-${dd}`;
            displayDate = `${dd}/${mm}/${yyyy}`;
          } else {
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
              isoDate = format(d, 'yyyy-MM-dd');
              displayDate = format(d, 'dd/MM/yyyy');
            }
          }
          const ts = isoDate ? new Date(`${isoDate}T00:00:00`).getTime() : 0;
          return { isoDate, displayDate, timestamp: ts, time: rawTime || '' };
        };

        // Build raw points from autoHistory (if available) and manual exchange_rates
        const validAuto = (autoHistory || [])
          .filter(r => r.status !== 'Failed' && Number(r.exchange_rate) > 0)
          .map(r => {
            const dInfo = parseDateInfo(r.retrieved_date || r.created_at, r.retrieved_time);
            return {
              id: r.id,
              rate: Number(r.exchange_rate),
              isoDate: dInfo.isoDate,
              displayDate: dInfo.displayDate,
              shortDate: dInfo.displayDate.slice(0, 5),
              time: dInfo.time,
              timestamp: r.created_at ? new Date(r.created_at).getTime() : dInfo.timestamp,
              source: r.provider || (language === 'ar' ? 'تلقائي' : 'Auto')
            };
          });

        const validManual = (exchangeRates[selectedCurrency.id] || [])
          .filter(r => Number(r.exchange_rate) > 0)
          .map(r => {
            const dInfo = parseDateInfo(r.rate_date);
            return {
              id: r.id,
              rate: Number(r.exchange_rate),
              isoDate: dInfo.isoDate,
              displayDate: dInfo.displayDate,
              shortDate: dInfo.displayDate.slice(0, 5),
              time: '',
              timestamp: dInfo.timestamp,
              source: r.notes || (language === 'ar' ? 'إدخال يدوي' : 'Manual')
            };
          });

        // Prefer auto history if company uses auto or if auto has records; otherwise use manual or merge
        let combinedPoints = validAuto.length > 0 ? validAuto : validManual;
        if (combinedPoints.length === 0 && autoRates[selectedCurrency.id]) {
          const ar = autoRates[selectedCurrency.id]!;
          const dInfo = parseDateInfo(ar.rate_date);
          combinedPoints = [{
            id: 'latest-auto',
            rate: Number(ar.rate),
            isoDate: dInfo.isoDate,
            displayDate: dInfo.displayDate,
            shortDate: dInfo.displayDate.slice(0, 5),
            time: '',
            timestamp: dInfo.timestamp,
            source: language === 'ar' ? 'سعر تلقائي' : 'Live Rate'
          }];
        }

        // Sort chronologically (oldest -> newest)
        const chronologicalAll = [...combinedPoints].sort((a, b) => a.timestamp - b.timestamp);

        // Apply period / date filters
        const latestTs = chronologicalAll.length > 0 ? chronologicalAll[chronologicalAll.length - 1].timestamp : Date.now();
        const filteredPoints = chronologicalAll.filter(pt => {
          if (chartDateFrom && pt.isoDate && pt.isoDate < chartDateFrom) return false;
          if (chartDateTo && pt.isoDate && pt.isoDate > chartDateTo) return false;
          if (!chartDateFrom && !chartDateTo && chartPeriod !== 'all') {
            const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
            const days = daysMap[chartPeriod] || 30;
            const cutoff = latestTs - days * 24 * 60 * 60 * 1000;
            if (pt.timestamp < cutoff) return false;
          }
          return true;
        });

        // Enrich with point-to-point delta
        const chartData = filteredPoints.map((pt, idx) => {
          const prev = idx > 0 ? filteredPoints[idx - 1].rate : pt.rate;
          const diff = pt.rate - prev;
          const diffPct = prev > 0 ? (diff / prev) * 100 : 0;
          return {
            ...pt,
            diff,
            diffPct
          };
        });

        // Calculate KPI metrics
        const firstRate = chartData.length > 0 ? chartData[0].rate : 0;
        const currentRate = chartData.length > 0 ? chartData[chartData.length - 1].rate : 0;
        const currentDate = chartData.length > 0 ? chartData[chartData.length - 1].displayDate : '---';
        const totalChange = currentRate - firstRate;
        const totalChangePct = firstRate > 0 ? (totalChange / firstRate) * 100 : 0;

        let minPoint = chartData[0] || null;
        let maxPoint = chartData[0] || null;
        let sumRates = 0;
        for (const p of chartData) {
          sumRates += p.rate;
          if (!minPoint || p.rate < minPoint.rate) minPoint = p;
          if (!maxPoint || p.rate > maxPoint.rate) maxPoint = p;
        }
        const avgRate = chartData.length > 0 ? sumRates / chartData.length : 0;
        const yPadding = maxPoint && minPoint
          ? Math.max((maxPoint.rate - minPoint.rate) * 0.2, currentRate * 0.005, 0.05)
          : 1;
        const yMin = minPoint ? Math.max(0, Number((minPoint.rate - yPadding).toFixed(4))) : 0;
        const yMax = maxPoint ? Number((maxPoint.rate + yPadding).toFixed(4)) : 100;

        const isUp = totalChange > 0.0001;
        const isDown = totalChange < -0.0001;

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col" dir={dir}>
              {/* Modal Header */}
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                      <span>{language === 'ar' ? 'الرسم البياني لتغير سعر العملة' : 'Exchange Rate Trend Chart'}</span>
                      <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg">
                        {selectedCurrency.code} / {baseCurr}
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                      <span>{selectedCurrency.flag}</span>
                      <span>{language === 'ar' ? selectedCurrency.name_ar : selectedCurrency.name_en}</span>
                      <span>•</span>
                      <span>{language === 'ar' ? `${chartData.length} قراءة مسجلة` : `${chartData.length} recorded points`}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsChartOpen(false);
                      setIsHistoryOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded-xl hover:bg-zinc-200 transition-colors text-xs font-bold"
                  >
                    <History className="w-4 h-4" />
                    <span>{language === 'ar' ? 'سجل الأسعار' : 'Rate History'}</span>
                  </button>
                  <button
                    onClick={() => setIsChartOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Filters & Controls Bar */}
              <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-zinc-200">
                  {([
                    { id: 'all', labelAr: 'الكل', labelEn: 'All' },
                    { id: '7d', labelAr: 'آخر 7 أيام', labelEn: '7 Days' },
                    { id: '30d', labelAr: 'آخر 30 يوم', labelEn: '30 Days' },
                    { id: '90d', labelAr: 'آخر 90 يوم', labelEn: '90 Days' },
                  ] as const).map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setChartPeriod(p.id);
                        setChartDateFrom('');
                        setChartDateTo('');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        chartPeriod === p.id && !chartDateFrom && !chartDateTo
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {language === 'ar' ? p.labelAr : p.labelEn}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-xl px-2.5 py-1">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    <input
                      type="date"
                      value={chartDateFrom}
                      onChange={e => setChartDateFrom(e.target.value)}
                      className="text-xs focus:outline-none bg-transparent font-mono"
                      title={language === 'ar' ? 'من تاريخ' : 'From date'}
                    />
                    <span className="text-zinc-300">-</span>
                    <input
                      type="date"
                      value={chartDateTo}
                      onChange={e => setChartDateTo(e.target.value)}
                      className="text-xs focus:outline-none bg-transparent font-mono"
                      title={language === 'ar' ? 'إلى تاريخ' : 'To date'}
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-zinc-200">
                    <button
                      onClick={() => setChartType('area')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        chartType === 'area' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                      }`}
                    >
                      {language === 'ar' ? 'مساحي' : 'Area'}
                    </button>
                    <button
                      onClick={() => setChartType('line')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        chartType === 'line' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                      }`}
                    >
                      {language === 'ar' ? 'خطي' : 'Line'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1">
                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest animate-pulse">
                      {language === 'ar' ? 'جاري تحميل بيانات الرسم البياني...' : 'Loading chart data...'}
                    </p>
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="py-16 text-center text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-bold">{language === 'ar' ? 'لا توجد قراءات أسعار صرف مسجلة لهذه الفترة' : 'No exchange rate records found for this period'}</p>
                  </div>
                ) : (
                  <>
                    {/* 4 Summary KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                        <p className="text-[11px] font-bold text-zinc-400">{language === 'ar' ? 'آخر سعر صرف' : 'Latest Rate'}</p>
                        <p className="text-lg font-black text-zinc-900 font-mono mt-0.5">
                          {currentRate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} <span className="text-xs font-bold text-zinc-500">{baseCurr}</span>
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{currentDate}</p>
                      </div>

                      <div className={`p-3.5 rounded-2xl border ${
                        isUp ? 'bg-emerald-50/60 border-emerald-200' : isDown ? 'bg-rose-50/60 border-rose-200' : 'bg-zinc-50 border-zinc-200/80'
                      }`}>
                        <p className="text-[11px] font-bold text-zinc-500">{language === 'ar' ? 'مقدار ونسبة التغير' : 'Change'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isUp ? (
                            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : isDown ? (
                            <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                          ) : (
                            <Activity className="w-4 h-4 text-zinc-500 shrink-0" />
                          )}
                          <span className={`text-base font-black font-mono ${
                            isUp ? 'text-emerald-700' : isDown ? 'text-rose-700' : 'text-zinc-800'
                          }`} dir="ltr">
                            {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(4)} ({totalChangePct >= 0 ? '+' : ''}{totalChangePct.toFixed(2)}%)
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {language === 'ar' ? `مقارنة ببداية الفترة (${firstRate.toFixed(4)})` : `vs period start (${firstRate.toFixed(4)})`}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100">
                        <p className="text-[11px] font-bold text-blue-500">{language === 'ar' ? 'أعلى سعر مسجل' : 'Highest Rate'}</p>
                        <p className="text-lg font-black text-blue-900 font-mono mt-0.5">
                          {maxPoint ? maxPoint.rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '---'} <span className="text-xs font-bold text-blue-600">{baseCurr}</span>
                        </p>
                        <p className="text-[10px] text-blue-500 font-mono mt-0.5">{maxPoint?.displayDate || '---'}</p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100">
                        <p className="text-[11px] font-bold text-amber-600">{language === 'ar' ? 'أقل سعر مسجل' : 'Lowest Rate'}</p>
                        <p className="text-lg font-black text-amber-900 font-mono mt-0.5">
                          {minPoint ? minPoint.rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '---'} <span className="text-xs font-bold text-amber-700">{baseCurr}</span>
                        </p>
                        <p className="text-[10px] text-amber-600 font-mono mt-0.5">{minPoint?.displayDate || '---'}</p>
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-zinc-700">
                          {language === 'ar'
                            ? `منحنى حركة سعر ${selectedCurrency.name_ar} (1 ${selectedCurrency.code} مقابل ${baseCurr})`
                            : `${selectedCurrency.name_en} Exchange Rate Trend (1 ${selectedCurrency.code} to ${baseCurr})`}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {language === 'ar' ? `المتوسط: ${avgRate.toFixed(4)} ${baseCurr}` : `Avg: ${avgRate.toFixed(4)} ${baseCurr}`}
                        </span>
                      </div>

                      <div className="h-[320px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          {chartType === 'area' ? (
                            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                              <defs>
                                <linearGradient id="currencyRateGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                                  <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                              <XAxis
                                dataKey="shortDate"
                                tick={{ fontSize: 11, fill: '#71717a', fontWeight: 600 }}
                                axisLine={{ stroke: '#e4e4e7' }}
                                tickLine={false}
                              />
                              <YAxis
                                domain={[yMin, yMax]}
                                tick={{ fontSize: 11, fill: '#71717a', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val: number) => Number(val).toFixed(2)}
                                width={55}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const pt = payload[0].payload;
                                  return (
                                    <div className="bg-zinc-900 text-white p-3 rounded-xl shadow-xl border border-zinc-700 text-xs space-y-1" dir={dir}>
                                      <div className="font-mono text-zinc-300 flex items-center justify-between gap-4 border-b border-zinc-700/80 pb-1">
                                        <span>{pt.displayDate}</span>
                                        {pt.time && <span className="text-[10px] text-zinc-400">{pt.time}</span>}
                                      </div>
                                      <div className="font-black text-sm text-emerald-400 font-mono pt-0.5" dir="ltr">
                                        1 {selectedCurrency.code} = {Number(pt.rate).toFixed(4)} {baseCurr}
                                      </div>
                                      {pt.diff !== 0 && (
                                        <div className={`text-[11px] font-bold font-mono ${pt.diff > 0 ? 'text-emerald-300' : 'text-rose-300'}`} dir="ltr">
                                          {pt.diff > 0 ? '▲ +' : '▼ '}{pt.diff.toFixed(4)} ({pt.diffPct >= 0 ? '+' : ''}{pt.diffPct.toFixed(2)}%)
                                        </div>
                                      )}
                                      {pt.source && (
                                        <div className="text-[10px] text-zinc-400">
                                          {language === 'ar' ? `المصدر: ${pt.source}` : `Source: ${pt.source}`}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }}
                              />
                              {chartData.length > 1 && (
                                <ReferenceLine
                                  y={avgRate}
                                  stroke="#94a3b8"
                                  strokeDasharray="4 4"
                                />
                              )}
                              <Area
                                type="monotone"
                                dataKey="rate"
                                stroke="#059669"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#currencyRateGradient)"
                                dot={{ r: 3.5, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                                activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                              />
                            </AreaChart>
                          ) : (
                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                              <XAxis
                                dataKey="shortDate"
                                tick={{ fontSize: 11, fill: '#71717a', fontWeight: 600 }}
                                axisLine={{ stroke: '#e4e4e7' }}
                                tickLine={false}
                              />
                              <YAxis
                                domain={[yMin, yMax]}
                                tick={{ fontSize: 11, fill: '#71717a', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val: number) => Number(val).toFixed(2)}
                                width={55}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const pt = payload[0].payload;
                                  return (
                                    <div className="bg-zinc-900 text-white p-3 rounded-xl shadow-xl border border-zinc-700 text-xs space-y-1" dir={dir}>
                                      <div className="font-mono text-zinc-300 flex items-center justify-between gap-4 border-b border-zinc-700/80 pb-1">
                                        <span>{pt.displayDate}</span>
                                        {pt.time && <span className="text-[10px] text-zinc-400">{pt.time}</span>}
                                      </div>
                                      <div className="font-black text-sm text-emerald-400 font-mono pt-0.5" dir="ltr">
                                        1 {selectedCurrency.code} = {Number(pt.rate).toFixed(4)} {baseCurr}
                                      </div>
                                      {pt.diff !== 0 && (
                                        <div className={`text-[11px] font-bold font-mono ${pt.diff > 0 ? 'text-emerald-300' : 'text-rose-300'}`} dir="ltr">
                                          {pt.diff > 0 ? '▲ +' : '▼ '}{pt.diff.toFixed(4)} ({pt.diffPct >= 0 ? '+' : ''}{pt.diffPct.toFixed(2)}%)
                                        </div>
                                      )}
                                      {pt.source && (
                                        <div className="text-[10px] text-zinc-400">
                                          {language === 'ar' ? `المصدر: ${pt.source}` : `Source: ${pt.source}`}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }}
                              />
                              {chartData.length > 1 && (
                                <ReferenceLine
                                  y={avgRate}
                                  stroke="#94a3b8"
                                  strokeDasharray="4 4"
                                />
                              )}
                              <Line
                                type="monotone"
                                dataKey="rate"
                                stroke="#059669"
                                strokeWidth={2.5}
                                dot={{ r: 3.5, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                                activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                              />
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
