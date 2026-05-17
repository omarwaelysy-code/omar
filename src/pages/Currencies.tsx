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
  Search
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Currency, ExchangeRate, Company } from '../types';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { WORLD_CURRENCIES, WorldCurrency } from '../constants/worldCurrencies';

export default function Currencies() {
  const { language, t, dir } = useLanguage();
  const { user } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, ExchangeRate[]>>({});
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  
  // Modals
  const [isAddCurrencyOpen, setIsAddCurrencyOpen] = useState(false);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mainSearchQuery, setMainSearchQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

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
    } catch (error) {
      console.error('Failed to load currency data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (currencyId: string) => {
    if (!user?.company_id) return;
    setLoadingHistory(true);
    try {
      const rates = await dbService.list<ExchangeRate>('exchange_rates', {
        currency_id: currencyId,
        company_id: user.company_id
      });
      const sorted = rates.sort((a, b) => new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime());
      setExchangeRates(prev => ({ ...prev, [currencyId]: sorted }));
    } catch (error) {
      console.error('Failed to load rate history:', error);
      toast.error(t('common.error'));
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
      toast.error(language === 'ar' ? 'هذه العملة مضافة بالفعل' : 'This currency is already added');
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
      toast.success(t('common.save_success'));
      
      // Automatically show rate addition for the new currency
      setSelectedCurrency(addedCurrency);
      setIsHistoryOpen(true);
    } catch (error) {
      console.error('Failed to add currency:', error);
      toast.error(t('common.error'));
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
      toast.success(t('common.update_success'));
    } catch (error) {
      console.error('Failed to toggle currency status:', error);
      toast.error(t('common.error'));
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
      toast.success(t('common.save_success'));
    } catch (error) {
      console.error('Failed to add exchange rate:', error);
      toast.error(t('common.error'));
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
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Coins className="w-8 h-8 text-indigo-600" />
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
              className="w-full bg-white border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              value={mainSearchQuery}
              onChange={e => setMainSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex bg-zinc-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
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
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
              title={language === 'ar' ? 'عرض قائمة' : 'List View'}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setIsAddCurrencyOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors w-full md:w-auto justify-center whitespace-nowrap"
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
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center relative overflow-hidden">
                      <span className="text-2xl absolute -top-1 -right-1 opacity-20 select-none">{curr.flag}</span>
                      <span className="text-indigo-600 font-bold text-lg z-10">{curr.symbol}</span>
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
                      <span className="text-lg font-bold text-zinc-800">
                        {latestRate ? latestRate.exchange_rate.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '---'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">{t('currencies.rate_date')}</span>
                      <span className="text-xs text-zinc-600">
                        {latestRate ? format(new Date(latestRate.rate_date), 'dd/MM/yyyy') : '---'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
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
                    <button
                      onClick={() => {
                        setSelectedCurrency(curr);
                        setIsHistoryOpen(true);
                        loadHistory(curr.id);
                      }}
                      className="w-12 flex items-center justify-center bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition-colors"
                    >
                      <History className="w-5 h-5" />
                    </button>
                  </div>
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
                      <td className="px-6 py-4 text-center font-bold text-indigo-600">{curr.symbol}</td>
                      <td className="px-6 py-4 text-center">
                        {latestRate ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-800">{latestRate.exchange_rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-[10px] text-zinc-400 font-mono italic">{format(new Date(latestRate.rate_date), 'dd/MM/yyyy')}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-300">---</span>
                        )}
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
                          <button
                            onClick={() => {
                              setSelectedCurrency(curr);
                              setIsAddRateOpen(true);
                            }}
                            className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title={t('currencies.add_rate')}
                          >
                            <PlusCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCurrency(curr);
                              setIsHistoryOpen(true);
                              loadHistory(curr.id);
                            }}
                            className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title={t('currencies.history')}
                          >
                            <History className="w-5 h-5" />
                          </button>
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
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
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
                      return (
                        <button
                          key={curr.code}
                          type="button"
                          onClick={() => !isAdded && selectWorldCurrency(curr)}
                          disabled={isAdded}
                          className={`w-full px-4 py-3 text-right flex items-center justify-between group transition-colors border-b border-zinc-50 last:border-0 ${
                            isAdded ? 'opacity-50 cursor-not-allowed bg-zinc-50/50' : 'hover:bg-indigo-50/50'
                          }`}
                          style={{ direction: dir }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl drop-shadow-sm">{curr.flag}</span>
                            <div className="text-right">
                              <p className="text-sm font-bold text-zinc-800">{language === 'ar' ? curr.name_ar : curr.name_en}</p>
                              <p className="text-[10px] text-zinc-400 font-mono tracking-tighter">
                                {curr.code} • {curr.symbol}
                                {isAdded && (
                                  <span className="mx-1 text-indigo-600 font-bold bg-indigo-50 px-1 rounded">
                                    {language === 'ar' ? 'مضافة مسبقاً' : 'Added'}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          {!isAdded && <PlusCircle className="w-5 h-5 text-zinc-200 group-hover:text-indigo-600 transition-colors" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {searchQuery && (
                  <div className="bg-white border border-indigo-100 rounded-xl max-h-60 overflow-y-auto shadow-lg z-20 relative">
                    <div className="sticky top-0 bg-indigo-50 px-4 py-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest border-b border-indigo-100">
                      {language === 'ar' ? 'نتائج البحث' : 'Search Results'}
                    </div>
                    {filteredWorldCurrencies.length > 0 ? (
                      filteredWorldCurrencies.map(curr => {
                        const isAdded = currencies.some(c => c.code.toLowerCase() === curr.code.toLowerCase());
                        return (
                          <button
                            key={curr.code}
                            type="button"
                            onClick={() => !isAdded && selectWorldCurrency(curr)}
                            disabled={isAdded}
                            className={`w-full px-4 py-3 text-right flex items-center justify-between group transition-colors border-b border-zinc-50 last:border-0 ${
                              isAdded ? 'opacity-50 cursor-not-allowed bg-zinc-50/50' : 'hover:bg-indigo-50/50'
                            }`}
                            style={{ direction: dir }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl drop-shadow-sm">{curr.flag}</span>
                              <div className="text-right">
                                <p className="text-sm font-bold text-zinc-800">{language === 'ar' ? curr.name_ar : curr.name_en}</p>
                                <p className="text-[10px] text-zinc-400 font-mono tracking-tighter">
                                  {curr.code} • {curr.symbol}
                                  {isAdded && (
                                    <span className="mx-1 text-indigo-600 font-bold bg-indigo-50 px-1 rounded">
                                      {language === 'ar' ? 'مضافة مسبقاً' : 'Added'}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {!isAdded && <PlusCircle className="w-5 h-5 text-zinc-200 group-hover:text-indigo-600 transition-colors" />}
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
                      required
                      type="text"
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      value={newCurrency.name_ar}
                      onChange={e => setNewCurrency({ ...newCurrency, name_ar: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('currencies.name_en')}</label>
                    <input
                      required
                      type="text"
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      value={newCurrency.name_en}
                      onChange={e => setNewCurrency({ ...newCurrency, name_en: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('currencies.symbol')}</label>
                    <input
                      required
                      type="text"
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
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
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-indigo-600" />
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
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  value={newRate.exchange_rate}
                  onChange={e => setNewRate({ ...newRate, exchange_rate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('currencies.rate_date')}</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    required
                    type="date"
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    value={newRate.rate_date}
                    onChange={e => setNewRate({ ...newRate, rate_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">{t('common.notes')}</label>
                <textarea
                  rows={3}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  value={newRate.notes}
                  onChange={e => setNewRate({ ...newRate, notes: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mt-6"
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
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <History className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">{t('currencies.exchange_rates')}</h2>
                  <p className="text-xs text-zinc-400">{language === 'ar' ? selectedCurrency.name_ar : selectedCurrency.name_en}</p>
                </div>
              </div>
              <button onClick={() => {
                setIsHistoryOpen(false);
                setHistorySearchQuery('');
                setHistoryDateFrom('');
                setHistoryDateTo('');
              }} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* History Filters */}
            <div className="p-4 bg-zinc-50 border-b border-zinc-100 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث في القيمة أو الملاحظات...' : 'Search rate or notes...'}
                  className="w-full bg-white border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
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
            
            <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-3 grid grid-cols-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <div className="col-span-1">{t('currencies.rate')}</div>
              <div className="col-span-1">{t('currencies.rate_date')}</div>
              <div className="col-span-2">{t('common.notes')}</div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-0">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest animate-pulse">
                    {language === 'ar' ? 'جاري تحميل السجل...' : 'Loading history...'}
                  </p>
                </div>
              ) : (() => {
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
                      className={`px-6 py-4 grid grid-cols-4 items-center text-sm border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors ${idx === 0 && !historySearchQuery && !historyDateFrom && !historyDateTo ? 'bg-indigo-50/30' : ''}`}
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
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
