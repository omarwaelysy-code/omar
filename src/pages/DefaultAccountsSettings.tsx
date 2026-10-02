import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Account } from '../types';
import { dbService } from '../services/dbService';
import { 
  defaultAccountsService, 
  DefaultAccountItem, 
  DEFAULT_ACCOUNTS_CONFIG 
} from '../services/defaultAccountsService';
import { getAccountUsageLabel } from '../utils/accountUsageUtils';
import { 
  Save, RefreshCw, ShieldCheck, Search, Filter, 
  ArrowRightLeft, BookOpen, Layers, Check
} from 'lucide-react';
import { motion } from 'framer-motion';

// Arabic translation map for account usage
export const getAccountUsageArabic = (usage?: string): string => {
  if (!usage) return 'غير محدد';
  const specialMap: Record<string, string> = {
    cash: 'نقدية',
    bank: 'بنك',
    customer: 'عملاء',
    accounts_receivable: 'عملاء',
    supplier: 'موردين',
    accounts_payable: 'موردين',
    inventory: 'مخزون',
    vat: 'ضريبة قيمة مضافة',
    input_vat: 'ضريبة مدخلات',
    output_vat: 'ضريبة مخرجات',
    withholding_tax_customers: 'خصم أ.ت.ص عملاء',
    withholding_tax_suppliers: 'خصم أ.ت.ص موردين',
    capital: 'رأس المال',
    retained_earnings: 'أرباح مرحلة',
    opening_balance: 'رصيد افتتاحي',
    sales_revenue: 'إيراد مبيعات',
    sales_returns: 'مردودات مبيعات',
    earned_discounts: 'خصم مبيعات (مسموح به)',
    cost_of_sales: 'تكلفة مبيعات',
    purchases: 'مشتريات',
    purchase_returns: 'مردودات مشتريات',
    granted_discounts: 'خصم مشتريات (مكتسب)',
    realized_forex_gain: 'أرباح فروق عملة محققة',
    realized_forex_loss: 'خسائر فروق عملة محققة',
    unrealized_forex_gain: 'أرباح فروق عملة غير محققة',
    unrealized_forex_loss: 'خسائر فروق عملة غير محققة',
    operating_expense: 'مصروفات تشغيلية',
    administrative_expense: 'مصروفات إدارية',
    petty_cash: 'عهد نقدية',
    equity: 'حقوق ملكية',
    fixed_asset: 'أصل ثابت'
  };
  return specialMap[usage] || getAccountUsageLabel(usage, 'ar') || usage;
};

// Compatible usage values for matching default account items
const getCompatibleUsages = (targetUsage: string): string[] => {
  switch (targetUsage) {
    case 'cash':
      return ['cash', 'petty_cash', 'main_cash'];
    case 'bank':
      return ['bank', 'wallet', 'credit_card', 'debit_card'];
    case 'customer':
      return ['customer', 'accounts_receivable'];
    case 'supplier':
      return ['supplier', 'accounts_payable'];
    case 'inventory':
      return ['inventory', 'raw_materials', 'work_in_progress', 'finished_goods'];
    case 'vat':
      return ['vat', 'input_vat', 'output_vat'];
    case 'withholding_tax_customers':
      return ['withholding_tax_customers'];
    case 'withholding_tax_suppliers':
      return ['withholding_tax_suppliers'];
    case 'capital':
      return ['capital', 'equity'];
    case 'retained_earnings':
      return ['retained_earnings', 'equity'];
    case 'opening_balance':
      return ['opening_balance', 'equity'];
    case 'sales_revenue':
      return ['sales_revenue', 'service_revenue', 'other_revenue'];
    case 'sales_returns':
      return ['sales_returns'];
    case 'earned_discounts':
      return ['earned_discounts', 'customer_discount'];
    case 'cost_of_sales':
      return ['cost_of_sales'];
    case 'purchases':
      return ['purchases'];
    case 'purchase_returns':
      return ['purchase_returns'];
    case 'granted_discounts':
      return ['granted_discounts', 'supplier_discount'];
    case 'realized_forex_gain':
      return ['realized_forex_gain', 'forex_gain'];
    case 'realized_forex_loss':
      return ['realized_forex_loss', 'forex_loss'];
    case 'unrealized_forex_gain':
      return ['unrealized_forex_gain'];
    case 'unrealized_forex_loss':
      return ['unrealized_forex_loss'];
    default:
      return [targetUsage];
  }
};

export const DefaultAccountsSettings: React.FC = () => {
  const { user } = useAuth();
  const { dir } = useLanguage();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<DefaultAccountItem[]>([]);
  const [selectedMappings, setSelectedMappings] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScreenFilter, setSelectedScreenFilter] = useState('all');
  const [saveSuccessMap, setSaveSuccessMap] = useState<Record<string, boolean>>({});

  // 1. Fetch Company Accounts
  useEffect(() => {
    if (user?.company_id) {
      const unsub = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data || []);
      });
      return () => unsub();
    }
  }, [user?.company_id]);

  // 2. Fetch Default Accounts Config
  const loadDefaultAccounts = async () => {
    setLoading(true);
    try {
      const { mappings, accounts: loadedAccounts } = await defaultAccountsService.getDefaultAccounts();
      setSelectedMappings(mappings);
      setItems(loadedAccounts);
    } catch (err: any) {
      console.error(err);
      showNotification('فشل تحميل الحسابات الافتراضية', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.company_id) {
      loadDefaultAccounts();
    }
  }, [user?.company_id]);

  // 3. Handle Single Account Change
  const handleSelectAccount = (key: string, accountId: string) => {
    setSelectedMappings(prev => ({
      ...prev,
      [key]: accountId
    }));
  };

  // 4. Save Single Account
  const handleSaveSingle = async (key: string) => {
    const accountId = selectedMappings[key];
    if (!accountId) return;
    setSaving(true);
    try {
      const success = await defaultAccountsService.updateDefaultAccount(key, accountId);
      if (success) {
        showNotification('تم تحديث الحساب الافتراضي بنجاح', 'success');
        setSaveSuccessMap(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
          setSaveSuccessMap(prev => ({ ...prev, [key]: false }));
        }, 2500);
        await loadDefaultAccounts();
      } else {
        showNotification('فشل حفظ الحساب الافتراضي', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 5. Save All Mappings
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const success = await defaultAccountsService.saveAllDefaultAccounts(selectedMappings);
      if (success) {
        showNotification('تم حفظ وتحديث جميع الحسابات الافتراضية بنجاح', 'success');
        await loadDefaultAccounts();
      } else {
        showNotification('فشل حفظ التغييرات', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 6. Check and Merge Missing Default Accounts
  const handleCheckAndMerge = async () => {
    setMerging(true);
    try {
      const res = await defaultAccountsService.checkAndMergeDefaultAccounts();
      if (res && res.success) {
        showNotification(res.message, 'success');
        await loadDefaultAccounts();
      } else {
        showNotification('حدث خطأ أثناء فحص ودمج الحسابات', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'حدث خطأ أثناء فحص الدليل', 'error');
    } finally {
      setMerging(false);
    }
  };

  // Filter accounts compatible with item's usage
  const getCompatibleAccounts = (item: DefaultAccountItem, currentSelectedId?: string) => {
    const allowed = getCompatibleUsages(item.accountUsage);
    return accounts.filter(acc => {
      // 1. Current selected account is always kept visible
      if (acc.id === currentSelectedId || acc.id === item.accountId) return true;
      // 2. Strict usage match if account has account_usage
      if (acc.account_usage && allowed.includes(acc.account_usage)) return true;
      // 3. Fallback to code prefix if account_usage is missing
      if (!acc.account_usage && item.defaultCode && acc.code) {
        const pfx = item.defaultCode.length >= 4 ? item.defaultCode.slice(0, 3) : item.defaultCode.slice(0, 2);
        if (acc.code.startsWith(pfx)) return true;
      }
      return false;
    });
  };

  // Screens list for filter
  const uniqueScreens = useMemo(() => {
    const screens = new Set(DEFAULT_ACCOUNTS_CONFIG.map(i => i.targetScreen));
    return Array.from(screens);
  }, []);

  // Filtered rows
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const usageAr = getAccountUsageArabic(item.accountUsage).toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        item.defaultCode.toLowerCase().includes(term) ||
        item.nameAr.toLowerCase().includes(term) ||
        item.targetScreen.toLowerCase().includes(term) ||
        item.classificationAr.toLowerCase().includes(term) ||
        usageAr.includes(term) ||
        (item.accountName && item.accountName.toLowerCase().includes(term)) ||
        (item.accountCode && item.accountCode.toLowerCase().includes(term));
      
      const matchesScreen = selectedScreenFilter === 'all' || item.targetScreen === selectedScreenFilter;
      return matchesSearch && matchesScreen;
    });
  }, [items, searchTerm, selectedScreenFilter]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4" dir={dir}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wide">
              <ShieldCheck size={14} />
              <span>إدارة الحسابات الافتراضية وحماية الدليل المحاسبي</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              إعدادات الحسابات الافتراضية
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
              جدول الحسابات الافتراضية الإلزامية لتوجيه القيود الآلية (المبيعات، المخزون، الضرائب، فروق العملة، الأرباح المرحلة). يمكنك ربط أي حساب بديل من نفس الاستخدام مع حماية الحسابات من الحذف.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleCheckAndMerge}
              disabled={merging || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <RefreshCw size={15} className={merging ? 'animate-spin' : ''} />
              <span>{merging ? 'جاري فحص ودمج الحسابات...' : 'فحص ودمج الحسابات مع الدليل'}</span>
            </button>

            <button
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Save size={15} className={saving ? 'animate-spin' : ''} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ كافة التغييرات'}</span>
            </button>
          </div>
        </div>

        {/* Badges Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span>إجمالي الحسابات: <strong className="text-white">{items.length} حساب</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span>حسابات بطاقة الصنف: <strong className="text-white">{items.filter(i => i.targetScreen.includes('الصنف')).length} حسابات</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
            <span>طرق الدفع والخزائن: <strong className="text-white">{items.filter(i => i.targetScreen.includes('الدفع')).length} حسابات</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <span>حماية الحذف: <strong className="text-white">مفعلة تلقائياً</strong></span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برمز، اسم، أو استخدام الحساب..."
            className="w-full pr-10 pl-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-slate-400" />
          <select
            value={selectedScreenFilter}
            onChange={(e) => setSelectedScreenFilter(e.target.value)}
            className="w-full md:w-72 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs bg-white font-medium text-slate-700 transition-all"
          >
            <option value="all">جميع الشاشات ({items.length})</option>
            {uniqueScreens.map(screen => (
              <option key={screen} value={screen}>
                {screen} ({items.filter(i => i.targetScreen === screen).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-xs">جاري تحميل جدول الحسابات الافتراضية...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <p className="font-bold text-sm">لا توجد نتائج مطابقة لبحثك</p>
            <p className="text-xs text-slate-400">جرب البحث بكلمات أخرى أو اختر جميع الشاشات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 text-xs font-black uppercase tracking-wider">
                  <th className="py-2.5 px-2 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[170px]">الحساب الافتراضي القياسي</th>
                  <th className="py-2.5 px-3 w-32 whitespace-nowrap">استخدام الحساب</th>
                  <th className="py-2.5 px-3 w-36 whitespace-nowrap">القائمة / التصنيف</th>
                  <th className="py-2.5 px-3 min-w-[240px]">الحساب المربوط حالياً</th>
                  <th className="py-2.5 px-3 w-44 whitespace-nowrap">شاشة التعيين التلقائي</th>
                  <th className="py-2.5 px-2 w-14 text-center">حفظ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map((item, index) => {
                  const currentSelectedId = selectedMappings[item.key] || item.accountId;
                  const isSavedSuccessfully = saveSuccessMap[item.key];
                  const isModified = currentSelectedId !== item.accountId;
                  const compatibleAccounts = getCompatibleAccounts(item, currentSelectedId);

                  return (
                    <motion.tr
                      key={item.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.1 }}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* 1. Index */}
                      <td className="py-2 px-2 text-center font-bold text-slate-400 text-xs">
                        {index + 1}
                      </td>

                      {/* 2. Standard Default Account */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-700 border border-slate-200/70">
                            {item.defaultCode}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{item.nameAr}</span>
                        </div>
                      </td>

                      {/* 3. Account Usage (in Arabic) */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                          {getAccountUsageArabic(item.accountUsage)}
                        </span>
                      </td>

                      {/* 4. Classification */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {item.classificationAr}
                        </span>
                      </td>

                      {/* 5. Active Linked Account & Dropdown Selector */}
                      <td className="py-2 px-3">
                        <div className="relative">
                          <select
                            value={currentSelectedId || ''}
                            onChange={(e) => handleSelectAccount(item.key, e.target.value)}
                            className={`w-full py-1.5 px-2.5 pr-3 pl-7 text-xs rounded-lg border font-medium transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2 ${
                              isModified
                                ? 'border-amber-400 bg-amber-50/50 text-amber-900 focus:ring-amber-500/20'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                          >
                            <option value="">-- اختر حساباً بديلاً من الدليل --</option>
                            {compatibleAccounts.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name} {acc.account_usage ? `(${getAccountUsageArabic(acc.account_usage)})` : ''}
                              </option>
                            ))}
                          </select>
                          <ArrowRightLeft size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </td>

                      {/* 6. Target Screen */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">
                          <Layers size={11} className="text-emerald-600" />
                          {item.targetScreen}
                        </span>
                      </td>

                      {/* 7. Actions */}
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => handleSaveSingle(item.key)}
                          disabled={saving || !isModified}
                          title={isModified ? 'حفظ التغيير لهذا الحساب' : 'الحساب محفوظ'}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                            isSavedSuccessfully
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : isModified
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:scale-105 active:scale-95'
                              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                          }`}
                        >
                          {isSavedSuccessfully ? (
                            <Check size={14} />
                          ) : (
                            <Save size={14} />
                          )}
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Golden Info Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-2.5 text-slate-800 font-black text-base">
          <BookOpen size={18} className="text-emerald-600" />
          <h3>ملاحظات وقواعد عمل الحسابات الافتراضية</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
            <h4 className="font-bold text-slate-900">1. الدمج التلقائي مع أي دليل</h4>
            <p>
              عند الضغط على زر &quot;فحص ودمج الحسابات&quot; يتم فحص الدليل المحاسبي للشركة، وإن كان ينقصه أي من هذه الحسابات، يتم إنشاؤه فوراً تحت التصنيف المناسب دون تكرار أو مساس بالحسابات الحالية.
            </p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
            <h4 className="font-bold text-slate-900">2. تغيير الحساب المربوط بنفس الاستخدام</h4>
            <p>
              يمكنك تغيير ربط أي حساب باختيار حساب بديل من نفس الاستخدام (مثلاً نقدية لنقدية، مورد لمورد، عميل لعميل) وتوجيه القيود الآلية إليه فوراً وبشكل منضبط محاسبياً.
            </p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
            <h4 className="font-bold text-slate-900">3. الحماية الصارمة من الحذف</h4>
            <p>
              تمنع قاعدة البيانات والنظام حذف أي حساب معتمد كافتراضي (سواء كان الكود القياسي أو الحساب الذي قمت بتحديده) لضمان عدم اختلال القيود الآلية أو التقارير المالية.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
