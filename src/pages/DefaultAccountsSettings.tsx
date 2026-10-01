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
import { 
  Settings, Save, RefreshCw, ShieldCheck, Search, Filter, 
  CheckCircle2, AlertTriangle, ArrowRightLeft, BookOpen, Layers, 
  SlidersHorizontal, Check, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const DefaultAccountsSettings: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
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

  // Screens list for filter
  const uniqueScreens = useMemo(() => {
    const screens = new Set(DEFAULT_ACCOUNTS_CONFIG.map(i => i.targetScreen));
    return Array.from(screens);
  }, []);

  // Filtered rows
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.defaultCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.targetScreen.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.accountName && item.accountName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.accountCode && item.accountCode.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesScreen = selectedScreenFilter === 'all' || item.targetScreen === selectedScreenFilter;
      return matchesSearch && matchesScreen;
    });
  }, [items, searchTerm, selectedScreenFilter]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8" dir={dir}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden border border-emerald-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wide">
              <ShieldCheck size={16} />
              <span>إدارة الحسابات الافتراضية وحماية الدليل المحاسبي</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
              إعدادات الحسابات الافتراضية
            </h1>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed">
              جدول الحسابات الافتراضية الإلزامية لتوجيه القيود الآلية (المبيعات، المخزون، الضرائب، فروق العملة، الأرباح المرحلة). يمكنك ربط أي حساب بديل من دليل حساباتك مع ضمان الحماية التلقائية من الحذف.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCheckAndMerge}
              disabled={merging || loading}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <RefreshCw size={18} className={merging ? 'animate-spin' : ''} />
              <span>{merging ? 'جاري فحص ودمج الحسابات...' : 'فحص ودمج الحسابات مع الدليل'}</span>
            </button>

            <button
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Save size={18} className={saving ? 'animate-spin' : ''} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ كافة التغييرات'}</span>
            </button>
          </div>
        </div>

        {/* Badges Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 text-xs md:text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
            <span>إجمالي الحسابات الافتراضية: <strong className="text-white">23 حساب</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
            <span>حسابات بطاقة الصنف: <strong className="text-white">9 حسابات</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400"></div>
            <span>حسابات الشاشة الحالية: <strong className="text-white">5 حسابات</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
            <span>حماية الحذف: <strong className="text-white">مفعلة تلقائياً</strong></span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالرمز، الاسم، أو الشاشة..."
            className="w-full pr-11 pl-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter size={18} className="text-slate-400" />
          <select
            value={selectedScreenFilter}
            onChange={(e) => setSelectedScreenFilter(e.target.value)}
            className="w-full md:w-72 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm bg-white font-medium text-slate-700 transition-all"
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
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4 text-slate-400">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-sm">جاري تحميل جدول الحسابات الافتراضية...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-2">
            <AlertTriangle size={40} className="mx-auto text-amber-500 opacity-60" />
            <p className="font-bold text-base">لا توجد نتائج مطابقة لبحثك</p>
            <p className="text-xs text-slate-400">جرب البحث بكلمات أخرى أو اختر جميع الشاشات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 text-xs font-black uppercase tracking-wider">
                  <th className="py-4 px-4 w-12 text-center">#</th>
                  <th className="py-4 px-4 w-64">الحساب الافتراضي القياسي</th>
                  <th className="py-4 px-4 w-44">القائمة / التصنيف</th>
                  <th className="py-4 px-6 min-w-[280px]">الحساب المربوط حالياً (تغيير من الدليل)</th>
                  <th className="py-4 px-4 w-60">شاشة التعيين كحساب افتراضي</th>
                  <th className="py-4 px-4 w-28 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredItems.map((item, index) => {
                  const currentSelectedId = selectedMappings[item.key] || item.accountId;
                  const isSavedSuccessfully = saveSuccessMap[item.key];
                  const isModified = currentSelectedId !== item.accountId;

                  return (
                    <motion.tr
                      key={item.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* 1. Index */}
                      <td className="py-4 px-4 text-center font-bold text-slate-400">
                        {index + 1}
                      </td>

                      {/* 2. Standard Default Account */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700 border border-slate-200/60">
                              {item.defaultCode}
                            </span>
                            <span className="font-bold text-slate-900">{item.nameAr}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 block font-sans">
                            {item.nameEn}
                          </span>
                        </div>
                      </td>

                      {/* 3. Classification */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                          {item.classificationAr}
                        </span>
                      </td>

                      {/* 4. Active Linked Account & Dropdown Selector */}
                      <td className="py-4 px-6">
                        <div className="space-y-1.5">
                          <div className="relative">
                            <select
                              value={currentSelectedId || ''}
                              onChange={(e) => handleSelectAccount(item.key, e.target.value)}
                              className={`w-full py-2 px-3 text-xs md:text-sm rounded-xl border font-medium transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2 ${
                                isModified
                                  ? 'border-amber-400 bg-amber-50/50 text-amber-900 focus:ring-amber-500/20'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-500'
                              }`}
                            >
                              <option value="">-- اختر حساباً من الدليل المحاسبي --</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name} {acc.account_usage ? `(${acc.account_usage})` : ''}
                                </option>
                              ))}
                            </select>
                            <ArrowRightLeft size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            {item.isCustom ? (
                              <span className="text-amber-600 font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                حساب مخصص (تم تغييره عن الكود القياسي)
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                مطابق للحساب الافتراضي القياسي
                              </span>
                            )}
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-400 flex items-center gap-1">
                              <Lock size={10} /> محمي من الحذف
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Target Screen */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">
                          <Layers size={13} className="text-emerald-600" />
                          {item.targetScreen}
                        </span>
                      </td>

                      {/* 6. Actions */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleSaveSingle(item.key)}
                          disabled={saving || !isModified}
                          title="حفظ التغيير لهذا الحساب"
                          className={`p-2 rounded-xl text-xs font-bold transition-all ${
                            isSavedSuccessfully
                              ? 'bg-emerald-500 text-white shadow-md'
                              : isModified
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md hover:scale-105 active:scale-95'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isSavedSuccessfully ? (
                            <Check size={16} />
                          ) : (
                            <Save size={16} />
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
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3 text-slate-800 font-black text-lg">
          <BookOpen size={22} className="text-emerald-600" />
          <h3>ملاحظات وقواعد عمل الحسابات الافتراضية</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs md:text-sm text-slate-600 leading-relaxed">
          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <h4 className="font-bold text-slate-900">1. الدمج التلقائي مع أي دليل</h4>
            <p>
              عند الضغط على زر &quot;فحص ودمج الحسابات&quot; يتم فحص الدليل المحاسبي للشركة، وإن كان ينقصه أي من هذه الحسابات الـ 23، يتم إنشاؤه فوراً تحت التصنيف المناسب دون تكرار أو مساس بالحسابات الحالية.
            </p>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <h4 className="font-bold text-slate-900">2. تغيير الحساب المربوط</h4>
            <p>
              يمكنك في أي وقت تغيير ربط أي حساب باختيار حساب آخر من دليل حساباتك وحفظ التعديل. سيتم توجيه القيود الآلية التالية إلى الحساب الجديد تلقائياً.
            </p>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2">
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
