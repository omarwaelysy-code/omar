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
  ArrowRightLeft, BookOpen, Layers, Check, Globe
} from 'lucide-react';
import { motion } from 'framer-motion';

// Translation helpers for account usages, screens, and classifications
export const getAccountUsageDisplay = (usage?: string, language: 'ar' | 'en' = 'ar'): string => {
  if (!usage) return language === 'ar' ? 'غير محدد' : 'Undefined';
  return getAccountUsageLabel(usage, language) || usage;
};

export const getTargetScreenLabel = (screenName: string, language: 'ar' | 'en' = 'ar'): string => {
  if (language === 'ar') return screenName;
  const map: Record<string, string> = {
    'شاشة طرق الدفع والخزائن': 'Payment Methods & Cash Desks',
    'شاشة طرق الدفع والبنوك': 'Payment Methods & Banks',
    'شاشة البيانات الأساسية للعملاء': 'Customers Master Data',
    'شاشة البيانات الأساسية للموردين': 'Suppliers Master Data',
    'شاشة بطاقة الصنف': 'Item Card Screen',
    'شاشة إعدادات الشركة': 'Company Settings',
    'شاشة إعدادات الحسابات الافتراضية': 'Default Accounts Settings',
    'شاشة الأرصدة الافتتاحية': 'Opening Balances Screen',
    'شاشة إعدادات الخصم': 'Discount Settings'
  };
  return map[screenName] || screenName;
};

export const getClassificationDisplay = (classificationAr: string, language: 'ar' | 'en' = 'ar'): string => {
  if (language === 'ar') return classificationAr;
  const map: Record<string, string> = {
    'الميزانية / أصول متداولة': 'Balance Sheet / Current Assets',
    'الميزانية / التزامات متداولة': 'Balance Sheet / Current Liabilities',
    'الميزانية / حقوق ملكية': 'Balance Sheet / Equity',
    'قائمة الدخل / إيرادات': 'Income Statement / Revenue',
    'قائمة الدخل / إيرادات أخرى': 'Income Statement / Other Income',
    'قائمة الدخل / تكاليف': 'Income Statement / Cost of Sales',
    'قائمة الدخل / مصروفات مالية': 'Income Statement / Finance Expenses'
  };
  return map[classificationAr] || classificationAr;
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
  const { language, dir } = useLanguage();
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
  const [namingMode, setNamingMode] = useState<'ar' | 'en' | 'bilingual'>(() => {
    const saved = localStorage.getItem('default_accounts_naming_mode') as 'ar' | 'en' | 'bilingual' | null;
    if (saved) return saved;
    return language === 'en' ? 'en' : 'ar';
  });
  const [isApplyingNaming, setIsApplyingNaming] = useState(false);

  // Automatically adapt default naming mode when user toggles application language
  useEffect(() => {
    const saved = localStorage.getItem('default_accounts_naming_mode');
    if (!saved) {
      setNamingMode(language === 'en' ? 'en' : 'ar');
    }
  }, [language]);

  const handleNamingModeChange = (mode: 'ar' | 'en' | 'bilingual') => {
    setNamingMode(mode);
    localStorage.setItem('default_accounts_naming_mode', mode);
  };

  const PARENTS_EN_MAP: Record<string, { ar: string; en: string }> = {
    '11': { ar: 'الأصول المتداولة', en: 'Current Assets' },
    '1101': { ar: 'النقدية وما في حكمها', en: 'Cash and Cash Equivalents' },
    '1102': { ar: 'الذمم المدينة', en: 'Trade & Other Receivables' },
    '1103': { ar: 'المخزون', en: 'Inventory' },
    '1104': { ar: 'أرصدة مدينة أخرى', en: 'Other Debit Balances' },
    '21': { ar: 'الالتزامات المتداولة', en: 'Current Liabilities' },
    '2101': { ar: 'الذمم الدائنة', en: 'Trade & Other Payables' },
    '2102': { ar: 'أرصدة دائنة أخرى', en: 'Other Credit Balances' },
    '41': { ar: 'الإيرادات التشغيلية', en: 'Operating Revenue' },
    '42': { ar: 'إيرادات أخرى', en: 'Other Income' },
    '4202': { ar: 'أرباح فروق عملة', en: 'Foreign Exchange Gains' },
    '63': { ar: 'المصروفات المالية والإهلاكات', en: 'Finance Costs & Depreciation' },
    '6302': { ar: 'خسائر فروق عملة', en: 'Foreign Exchange Losses' }
  };

  const handleApplyNamingToCoa = async () => {
    if (!user?.company_id) return;
    const modeLabel = namingMode === 'ar' ? (language === 'ar' ? 'العربية' : 'Arabic') : (namingMode === 'en' ? (language === 'ar' ? 'الإنجليزية' : 'English') : (language === 'ar' ? 'باللغتين (عربي | English)' : 'Bilingual (Arabic | English)'));
    const confirmMsg = language === 'ar' 
      ? `هل أنت متأكد من تطبيق صيغة التسمية [${modeLabel}] على أسماء الحسابات الافتراضية في دليل الحسابات؟`
      : `Are you sure you want to apply the [${modeLabel}] naming format to default accounts in the Chart of Accounts?`;
    
    if (!window.confirm(confirmMsg)) return;

    setIsApplyingNaming(true);
    try {
      let updatedCount = 0;
      // 1. Update leaf default accounts
      for (const item of items) {
        const targetId = selectedMappings[item.key] || item.accountId;
        if (!targetId) continue;
        const targetAcc = accounts.find(a => a.id === targetId);
        if (!targetAcc) continue;

        let newName = item.nameAr;
        if (namingMode === 'en') {
          newName = item.nameEn || item.nameAr;
        } else if (namingMode === 'bilingual') {
          newName = item.nameEn ? `${item.nameAr} | ${item.nameEn}` : item.nameAr;
        }

        if (targetAcc.name !== newName) {
          await dbService.update('accounts', targetId, { name: newName });
          updatedCount++;
        }
      }

      // 2. Update parent default accounts if present
      for (const [code, pData] of Object.entries(PARENTS_EN_MAP)) {
        const parentAcc = accounts.find(a => a.code === code);
        if (parentAcc) {
          let newParentName = pData.ar;
          if (namingMode === 'en') {
            newParentName = pData.en;
          } else if (namingMode === 'bilingual') {
            newParentName = `${pData.ar} | ${pData.en}`;
          }

          if (parentAcc.name !== newParentName) {
            await dbService.update('accounts', parentAcc.id, { name: newParentName });
            updatedCount++;
          }
        }
      }

      const successMsg = language === 'ar'
        ? `تم تحديث تسمية ${updatedCount} حساب في دليل الحسابات بصيغة: ${modeLabel}`
        : `Successfully updated ${updatedCount} accounts in Chart of Accounts with format: ${modeLabel}`;
      showNotification(successMsg, 'success');
      await loadDefaultAccounts();
    } catch (err: any) {
      showNotification(err.message || (language === 'ar' ? 'حدث خطأ أثناء تطبيق التسمية' : 'Error applying naming format'), 'error');
    } finally {
      setIsApplyingNaming(false);
    }
  };

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
      showNotification(language === 'ar' ? 'فشل تحميل الحسابات الافتراضية' : 'Failed to load default accounts', 'error');
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
        showNotification(language === 'ar' ? 'تم تحديث الحساب الافتراضي بنجاح' : 'Default account updated successfully', 'success');
        setSaveSuccessMap(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
          setSaveSuccessMap(prev => ({ ...prev, [key]: false }));
        }, 2500);
        await loadDefaultAccounts();
      } else {
        showNotification(language === 'ar' ? 'فشل حفظ الحساب الافتراضي' : 'Failed to save default account', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || (language === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving changes'), 'error');
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
        showNotification(language === 'ar' ? 'تم حفظ وتحديث جميع الحسابات الافتراضية بنجاح' : 'All default accounts saved successfully', 'success');
        await loadDefaultAccounts();
      } else {
        showNotification(language === 'ar' ? 'فشل حفظ التغييرات' : 'Failed to save changes', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || (language === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving changes'), 'error');
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
        showNotification(language === 'ar' ? 'حدث خطأ أثناء فحص ودمج الحسابات' : 'Error checking and merging accounts', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || (language === 'ar' ? 'حدث خطأ أثناء فحص الدليل' : 'Error checking Chart of Accounts'), 'error');
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
      const usageLabelAr = getAccountUsageDisplay(item.accountUsage, 'ar').toLowerCase();
      const usageLabelEn = getAccountUsageDisplay(item.accountUsage, 'en').toLowerCase();
      const screenLabelAr = getTargetScreenLabel(item.targetScreen, 'ar').toLowerCase();
      const screenLabelEn = getTargetScreenLabel(item.targetScreen, 'en').toLowerCase();
      const classLabelAr = getClassificationDisplay(item.classificationAr, 'ar').toLowerCase();
      const classLabelEn = getClassificationDisplay(item.classificationAr, 'en').toLowerCase();

      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        item.defaultCode.toLowerCase().includes(term) ||
        item.nameAr.toLowerCase().includes(term) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(term)) ||
        screenLabelAr.includes(term) ||
        screenLabelEn.includes(term) ||
        classLabelAr.includes(term) ||
        classLabelEn.includes(term) ||
        usageLabelAr.includes(term) ||
        usageLabelEn.includes(term) ||
        (item.accountName && item.accountName.toLowerCase().includes(term)) ||
        (item.accountCode && item.accountCode.toLowerCase().includes(term));
      
      const matchesScreen = selectedScreenFilter === 'all' || item.targetScreen === selectedScreenFilter;
      return matchesSearch && matchesScreen;
    });
  }, [items, searchTerm, selectedScreenFilter]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4" dir={dir}>
      {/* Header Banner - Emerald Green Theme */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden border border-emerald-500/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-emerald-100 text-xs font-bold tracking-wide">
              <ShieldCheck size={14} />
              <span>
                {language === 'ar' ? 'إدارة الحسابات الافتراضية وحماية الدليل المحاسبي' : 'Default Accounts Management & COA Protection'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              {language === 'ar' ? 'إعدادات الحسابات الافتراضية' : 'Default Accounts Settings'}
            </h1>
            <p className="text-emerald-100/90 text-xs md:text-sm max-w-2xl leading-relaxed font-medium">
              {language === 'ar'
                ? 'جدول الحسابات الافتراضية الإلزامية لتوجيه القيود الآلية (المبيعات، المخزون، الضرائب، فروق العملة، الأرباح المرحلة). يمكنك ربط أي حساب بديل من نفس الاستخدام مع حماية الحسابات من الحذف.'
                : 'Mandatory default accounts for automated system entries (Sales, Inventory, VAT, FX differences, Retained Earnings). You can map compatible alternative accounts while preserving deletion protection.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleCheckAndMerge}
              disabled={merging || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs shadow-md border border-white/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <RefreshCw size={15} className={merging ? 'animate-spin' : ''} />
              <span>
                {merging 
                  ? (language === 'ar' ? 'جاري فحص ودمج الحسابات...' : 'Checking & Merging...') 
                  : (language === 'ar' ? 'فحص ودمج الحسابات مع الدليل' : 'Check & Merge with COA')}
              </span>
            </button>

            <button
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Save size={15} className={saving ? 'animate-spin' : ''} />
              <span>
                {saving 
                  ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
                  : (language === 'ar' ? 'حفظ كافة التغييرات' : 'Save All Changes')}
              </span>
            </button>
          </div>
        </div>

        {/* Badges Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-white/15 text-xs">
          <div className="flex items-center gap-2 text-emerald-100">
            <div className="w-2 h-2 rounded-full bg-white"></div>
            <span>
              {language === 'ar' ? 'إجمالي الحسابات: ' : 'Total Accounts: '}
              <strong className="text-white">{items.length} {language === 'ar' ? 'حساب' : 'Accounts'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-100">
            <div className="w-2 h-2 rounded-full bg-emerald-300"></div>
            <span>
              {language === 'ar' ? 'حسابات بطاقة الصنف: ' : 'Item Card Accounts: '}
              <strong className="text-white">{items.filter(i => i.targetScreen.includes('الصنف')).length} {language === 'ar' ? 'حسابات' : 'Accounts'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-100">
            <div className="w-2 h-2 rounded-full bg-teal-300"></div>
            <span>
              {language === 'ar' ? 'طرق الدفع والخزائن: ' : 'Payment & Cash: '}
              <strong className="text-white">{items.filter(i => i.targetScreen.includes('الدفع')).length} {language === 'ar' ? 'حسابات' : 'Accounts'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-100">
            <div className="w-2 h-2 rounded-full bg-amber-300"></div>
            <span>
              {language === 'ar' ? 'حماية الحذف: ' : 'Deletion Protection: '}
              <strong className="text-white">{language === 'ar' ? 'مفعلة تلقائياً' : 'Auto Enabled'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar with 3 Display Options */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'ar' ? 'بحث برمز، اسم، أو استخدام الحساب...' : 'Search by code, name, or account usage...'}
              className={`w-full py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs transition-all ${
                dir === 'rtl' ? 'pr-10 pl-3' : 'pl-10 pr-3'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={16} className="text-slate-400 shrink-0" />
            <select
              value={selectedScreenFilter}
              onChange={(e) => setSelectedScreenFilter(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs bg-white font-medium text-slate-700 transition-all cursor-pointer"
            >
              <option value="all">
                {language === 'ar' ? `جميع الشاشات (${items.length})` : `All Screens (${items.length})`}
              </option>
              {uniqueScreens.map(screen => (
                <option key={screen} value={screen}>
                  {getTargetScreenLabel(screen, language)} ({items.filter(i => i.targetScreen === screen).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3 Choices for Default Account Display: Arabic / English / Bilingual */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1 shrink-0">
              <Globe size={13} className="text-emerald-600" />
              <span>{language === 'ar' ? 'عرض الدليل:' : 'COA View:'}</span>
            </span>
            <button
              type="button"
              onClick={() => handleNamingModeChange('ar')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                namingMode === 'ar'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {language === 'ar' ? 'عربي' : 'Arabic'}
            </button>
            <button
              type="button"
              onClick={() => handleNamingModeChange('en')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                namingMode === 'en'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleNamingModeChange('bilingual')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                namingMode === 'bilingual'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title={language === 'ar' ? 'عرض الاسمين معاً (عربي | إنجليزي)' : 'Display both names (Arabic | English)'}
            >
              {language === 'ar' ? 'باللغتين' : 'Bilingual'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleApplyNamingToCoa}
            disabled={isApplyingNaming || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80 font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
            title={language === 'ar' ? 'تحديث وتطبيق هذه الصيغة على أسماء الحسابات في الدليل المحاسبي' : 'Apply this naming format to default accounts in Chart of Accounts'}
          >
            <Check size={13} className={isApplyingNaming ? 'animate-spin text-emerald-600' : 'text-emerald-600'} />
            <span>{isApplyingNaming ? (language === 'ar' ? 'جاري التطبيق...' : 'Applying...') : (language === 'ar' ? 'تطبيق على الدليل' : 'Apply to COA')}</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-xs">
              {language === 'ar' ? 'جاري تحميل جدول الحسابات الافتراضية...' : 'Loading default accounts table...'}
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <p className="font-bold text-sm">
              {language === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching results found'}
            </p>
            <p className="text-xs text-slate-400">
              {language === 'ar' ? 'جرب البحث بكلمات أخرى أو اختر جميع الشاشات' : 'Try searching with other keywords or select all screens'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full border-collapse ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 text-xs font-black uppercase tracking-wider">
                  <th className="py-2.5 px-2 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[180px]">
                    {language === 'ar' ? 'الحساب الافتراضي القياسي' : 'Standard Default Account'}
                  </th>
                  <th className="py-2.5 px-3 w-36 whitespace-nowrap">
                    {language === 'ar' ? 'استخدام الحساب' : 'Account Usage'}
                  </th>
                  <th className="py-2.5 px-3 w-44 whitespace-nowrap">
                    {language === 'ar' ? 'القائمة / التصنيف' : 'Statement / Classification'}
                  </th>
                  <th className="py-2.5 px-3 min-w-[260px]">
                    {language === 'ar' ? 'الحساب المربوط حالياً' : 'Currently Linked Account'}
                  </th>
                  <th className="py-2.5 px-3 w-48 whitespace-nowrap">
                    {language === 'ar' ? 'شاشة التعيين التلقائي' : 'Auto Assignment Screen'}
                  </th>
                  <th className="py-2.5 px-2 w-14 text-center">
                    {language === 'ar' ? 'حفظ' : 'Save'}
                  </th>
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
                      <td className="py-2.5 px-2 text-center font-bold text-slate-400 text-xs">
                        {index + 1}
                      </td>

                      {/* 2. Standard Default Account */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-700 border border-slate-200/70 shrink-0">
                            {item.defaultCode}
                          </span>
                          {namingMode === 'ar' && (
                            <span className="font-bold text-slate-900 text-xs">{item.nameAr}</span>
                          )}
                          {namingMode === 'en' && (
                            <span className="font-bold text-emerald-800 font-mono text-xs">{item.nameEn || item.nameAr}</span>
                          )}
                          {namingMode === 'bilingual' && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">{item.nameAr}</span>
                              <span className="text-slate-300 font-normal">|</span>
                              <span className="text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                                {item.nameEn}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Account Usage */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                          {getAccountUsageDisplay(item.accountUsage, language)}
                        </span>
                      </td>

                      {/* 4. Classification */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {getClassificationDisplay(item.classificationAr, language)}
                        </span>
                      </td>

                      {/* 5. Active Linked Account & Dropdown Selector */}
                      <td className="py-2.5 px-3">
                        <div className="relative">
                          <select
                            value={currentSelectedId || ''}
                            onChange={(e) => handleSelectAccount(item.key, e.target.value)}
                            className={`w-full py-1.5 px-2.5 text-xs rounded-lg border font-medium transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2 ${
                              dir === 'rtl' ? 'pr-3 pl-7' : 'pl-3 pr-7'
                            } ${
                              isModified
                                ? 'border-amber-400 bg-amber-50/50 text-amber-900 focus:ring-amber-500/20'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                          >
                            <option value="">
                              {language === 'ar' ? '-- اختر حساباً بديلاً من الدليل --' : '-- Select alternative account from COA --'}
                            </option>
                            {compatibleAccounts.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name} {acc.account_usage ? `(${getAccountUsageDisplay(acc.account_usage, language)})` : ''}
                              </option>
                            ))}
                          </select>
                          <ArrowRightLeft 
                            size={13} 
                            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${
                              dir === 'rtl' ? 'left-2' : 'right-2'
                            }`} 
                          />
                        </div>
                      </td>

                      {/* 6. Target Screen */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">
                          <Layers size={11} className="text-emerald-600" />
                          {getTargetScreenLabel(item.targetScreen, language)}
                        </span>
                      </td>

                      {/* 7. Actions */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => handleSaveSingle(item.key)}
                          disabled={saving || !isModified}
                          title={isModified 
                            ? (language === 'ar' ? 'حفظ التغيير لهذا الحساب' : 'Save change for this account') 
                            : (language === 'ar' ? 'الحساب محفوظ' : 'Account saved')}
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
          <h3>
            {language === 'ar' ? 'ملاحظات وقواعد عمل الحسابات الافتراضية' : 'Default Accounts Rules & Operational Notes'}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
            <h4 className="font-bold text-slate-900">
              {language === 'ar' ? '1. الدمج التلقائي مع أي دليل' : '1. Automatic Merge with COA'}
            </h4>
            <p>
              {language === 'ar'
                ? 'عند الضغط على زر "فحص ودمج الحسابات" يتم فحص الدليل المحاسبي للشركة، وإن كان ينقصه أي من هذه الحسابات، يتم إنشاؤه فوراً تحت التصنيف المناسب دون تكرار أو مساس بالحسابات الحالية.'
                : 'Clicking "Check & Merge with COA" scans company accounts and generates any missing standard accounts under their proper classifications without duplicates or affecting existing accounts.'}
            </p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
            <h4 className="font-bold text-slate-900">
              {language === 'ar' ? '2. تغيير الحساب المربوط بنفس الاستخدام' : '2. Compatible Account Reassignment'}
            </h4>
            <p>
              {language === 'ar'
                ? 'يمكنك تغيير ربط أي حساب باختيار حساب بديل من نفس الاستخدام (مثلاً نقدية لنقدية، مورد لمورد، عميل لعميل) وتوجيه القيود الآلية إليه فوراً وبشكل منضبط محاسبياً.'
                : 'You can reassign any mapping to a compatible alternative account with the same usage (e.g. Cash to Cash, Supplier to Supplier) to direct automated entries seamlessly.'}
            </p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1.5">
            <h4 className="font-bold text-slate-900">
              {language === 'ar' ? '3. الحماية الصارمة من الحذف' : '3. Strict Deletion Protection'}
            </h4>
            <p>
              {language === 'ar'
                ? 'تمنع قاعدة البيانات والنظام حذف أي حساب معتمد كافتراضي (سواء كان الكود القياسي أو الحساب الذي قمت بتحديده) لضمان عدم اختلال القيود الآلية أو التقارير المالية.'
                : 'The system and database strictly prevent deleting any mapped default account to preserve accounting integrity for automated postings and financial statements.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
