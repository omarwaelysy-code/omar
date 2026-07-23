import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Account, AccountType } from '../types';
import { Search, Plus, Trash2, Edit2, X, History, Sparkles, Hash, FileText, BookOpen, User, Layers, AlertCircle, LayoutGrid, List, ChevronRight, ChevronLeft, Save, ChevronDown, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { parseAccount } from '../services/geminiService';
import { ExportButtons } from '../components/ExportButtons';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { useRef } from 'react';
import { useViewPreference } from '../hooks/useViewPreference';
import { useNavigation } from '../contexts/NavigationContext';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { ACCOUNT_USAGE_OPTIONS, getAccountUsageLabel, ACCOUNT_USAGE_GROUPS } from '../utils/accountUsageUtils';
import { generateDefaultCOA } from '../services/coaService';

export const Accounts: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { setCurrentPage, setPendingAccountTypeEditId } = useNavigation();
  const [view, setView] = useViewPreference('accounts', 'card');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [types, setTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiText, setAiText] = useState('');
  const [isUsageDropdownOpen, setIsUsageDropdownOpen] = useState(false);
  const [usageSearchTerm, setUsageSearchTerm] = useState('');
  const [isCoaWizardOpen, setIsCoaWizardOpen] = useState(false);
  const [coaBusinessType, setCoaBusinessType] = useState<'commercial' | 'service' | 'all'>('all');
  const [coaLanguage, setCoaLanguage] = useState<'ar' | 'en'>(language || 'ar');
  const [isGeneratingCoa, setIsGeneratingCoa] = useState(false);
  const [coaProgress, setCoaProgress] = useState('');
  const tableRef = useRef<HTMLTableElement>(null);
  const usageDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (usageDropdownRef.current && !usageDropdownRef.current.contains(event.target as Node)) {
        setIsUsageDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const groupedAndFilteredOptions = React.useMemo(() => {
    return ACCOUNT_USAGE_GROUPS.map(group => {
      const filteredItems = ACCOUNT_USAGE_OPTIONS.filter(opt => {
        if (!group.keys.includes(opt.key)) return false;
        if (!usageSearchTerm.trim()) return true;
        const query = usageSearchTerm.toLowerCase();
        return opt.ar.toLowerCase().includes(query) || opt.en.toLowerCase().includes(query) || opt.key.toLowerCase().includes(query);
      });
      return {
        ...group,
        items: filteredItems
      };
    });
  }, [usageSearchTerm]);

  const macroGroupedOptions = React.useMemo(() => {
    const map = new Map<string, { macroAr: string; macroEn: string; groups: typeof groupedAndFilteredOptions }>();
    
    groupedAndFilteredOptions.forEach(group => {
      if (group.items.length === 0) return;
      const key = group.macroAr;
      if (!map.has(key)) {
        map.set(key, {
          macroAr: group.macroAr,
          macroEn: group.macroEn,
          groups: []
        });
      }
      map.get(key)!.groups.push(group);
    });
    
    return Array.from(map.values());
  }, [groupedAndFilteredOptions]);

  const handleExportExcel = () => {
    const headers = {
      'code': t('accounts.column_code'),
      'name': t('accounts.column_name'),
      'type_name': t('accounts.column_type'),
      'account_usage_label': language === 'ar' ? 'استخدام الحساب' : 'Account Usage'
    };
    const mappedAccounts = accounts.map(a => ({
      ...a,
      account_usage_label: getAccountUsageLabel(a.account_usage, language)
    }));
    const formattedData = formatDataForExcel(mappedAccounts, headers);
    exportToExcel(formattedData, { filename: 'Accounts_List', sheetName: language === 'ar' ? 'الحسابات' : 'Accounts' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Accounts_List',
        reportTitle: t('accounts.title')
      });
    }
  };

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type_id: '',
    opening_balance: 0,
    required_sub_account: false,
    parent_id: '',
    is_active: true,
    account_usage: 'other'
  });

  useEffect(() => {
    if (user?.company_id) {
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubTypes = dbService.subscribe<AccountType>('account_types', user.company_id, setTypes);
      setLoading(false);
      return () => {
        unsubAccounts();
        unsubTypes();
      };
    }
  }, [user?.company_id]);

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setIsAiParsing(true);
    try {
      const result = await parseAccount(aiText);
      if (result) {
        const matchingType = types.find(t => t.name.includes(result.typeName) || result.typeName.includes(t.name));
        setFormData({
          code: result.code || '',
          name: result.name || '',
          type_id: matchingType?.id || '',
          opening_balance: 0,
          required_sub_account: result.name?.toLowerCase().includes('عملاء') || result.name?.toLowerCase().includes('موردين') || false,
          parent_id: '',
          is_active: true,
          account_usage: 'other'
        });
        showNotification(t('common.ai_parse_success'), 'success');
        setAiText('');
      }
    } catch (error) {
      console.error(error);
      showNotification(t('common.ai_parse_error'), 'error');
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleGenerateCOA = async () => {
    if (!user) return;
    try {
      setIsGeneratingCoa(true);
      await generateDefaultCOA(user.company_id, user.id, user.username, coaLanguage, coaBusinessType, setCoaProgress);
      setIsCoaWizardOpen(false);
      showNotification(language === 'ar' ? 'تم توليد الدليل المحاسبي بنجاح' : 'Chart of Accounts generated successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء بناء الدليل' : 'Error generating COA', 'error');
    } finally {
      setIsGeneratingCoa(false);
      setCoaProgress('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const selectedType = types.find(t => t.id === formData.type_id);
    const accountData = {
      ...formData,
      type_name: selectedType?.name || '',
      company_id: user.company_id
    };

    try {
      if (editingAccount) {
        const fieldsToTrack = [
          { field: 'code', label: 'الكود' },
          { field: 'name', label: 'الاسم' },
          { field: 'type_id', label: 'نوع الحساب' },
          { field: 'required_sub_account', label: 'يلزم حساب فرعي' },
          { field: 'is_active', label: 'نشط' },
          { field: 'account_usage', label: 'استخدام الحساب' }
        ];
        await dbService.updateWithLog(
          'accounts',
          editingAccount.id,
          accountData,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل حساب',
          'accounts',
          fieldsToTrack
        );
        showNotification('تم تحديث بيانات الحساب بنجاح', 'success');
      } else {
        const id = await dbService.add('accounts', accountData);
        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة حساب', `إضافة حساب جديد: ${formData.name}`, 'accounts', id);
        showNotification('تم إضافة الحساب بنجاح', 'success');
      }
      closeModal();
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setAccountToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete || !user) return;
    try {
      const account = accounts.find(a => a.id === accountToDelete);
      await dbService.delete('accounts', accountToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف حساب', `حذف الحساب: ${account?.name}`, 'accounts', accountToDelete);
      setIsDeleteModalOpen(false);
      setAccountToDelete(null);
      showNotification('تم حذف الحساب بنجاح', 'success');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء الحذف', 'error');
    }
  };

  const openModal = (account?: Account) => {
    setIsUsageDropdownOpen(false);
    setUsageSearchTerm('');
    if (account) {
      // Robust boolean conversion for Postgres (handles true, 'true', 1, 't', etc.)
      const rawVal = (account as any).required_sub_account;
      const requiredSubAccount = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === 't' || rawVal === '1';

      setEditingAccount(account);
      const newFormData = {
        code: account.code,
        name: account.name,
        type_id: account.type_id,
        opening_balance: account.opening_balance || 0,
        required_sub_account: requiredSubAccount,
        parent_id: account.parent_id || '',
        is_active: account.is_active !== false,
        account_usage: account.account_usage || 'other'
      };

      setFormData(newFormData);
    } else {
      setEditingAccount(null);
      setFormData({
        code: '',
        name: '',
        type_id: '',
        opening_balance: 0,
        required_sub_account: false,
        parent_id: '',
        is_active: true,
        account_usage: 'other'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setAiText('');
    setIsUsageDropdownOpen(false);
    setUsageSearchTerm('');
  };

  const filteredAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getAccountUsageLabel(a.account_usage, language).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto p-4 md:p-8" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
            <BookOpen size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 italic serif">{t('accounts.title')}</h2>
            <p className="text-slate-500 font-medium">{t('accounts.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => {
              setActivityLogDocumentId(undefined);
              setIsActivityLogOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
          >
            <History size={20} />
            <span className="hidden md:inline">{language === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
          </button>
          <ExportButtons 
            onExportExcel={handleExportExcel} 
            onExportPDF={handleExportPDF} 
          />
          {accounts.length === 0 && (
            <button 
              onClick={() => setIsCoaWizardOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-100 transition-all active:scale-95 border border-indigo-200"
              title={language === 'ar' ? 'إنشاء دليل محاسبي افتراضي' : 'Generate Default COA'}
            >
              <Sparkles size={20} />
              <span className="hidden md:inline">{language === 'ar' ? 'دليل آلي' : 'Auto COA'}</span>
            </button>
          )}
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50"
          >
            <Plus size={20} />
            {t('accounts.add')}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
        <div className="relative flex-1 group w-full">
          <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
          <input 
            type="text" 
            placeholder={t('accounts.search_placeholder')}
            className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex bg-zinc-100 p-1.5 rounded-2xl gap-1 shrink-0">
          <button 
            type="button"
            onClick={() => setView('card')} 
            className={`p-2 rounded-xl transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
            title="عرض كروت"
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            type="button"
            onClick={() => setView('table')} 
            className={`p-2 rounded-xl transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
            title="عرض جدول"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {view === 'table' && !loading ? (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm" dir={dir}>
          <table ref={tableRef} className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className={`px-6 py-4 text-sm font-bold text-slate-700 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('accounts.column_code')}</th>
                <th className={`px-6 py-4 text-sm font-bold text-slate-700 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('accounts.column_name')}</th>
                <th className={`px-6 py-4 text-sm font-bold text-slate-700 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('accounts.column_type')}</th>
                <th className={`px-6 py-4 text-sm font-bold text-slate-700 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'استخدام الحساب' : 'Account Usage'}</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 text-left no-pdf">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredAccounts.map((account) => (
                <tr 
                  key={account.id}
                  onClick={() => openModal(account)}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono font-bold text-emerald-600 text-sm">
                    {account.code}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {account.name}
                  </td>
                  <td 
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingAccountTypeEditId(account.type_id);
                      setCurrentPage('account_types');
                    }}
                    className="px-6 py-4 text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer font-bold"
                  >
                    <div className="flex items-center gap-2">
                      <span>{account.type_name}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${account.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {account.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {getAccountUsageLabel(account.account_usage, language)}
                  </td>
                  <td className="px-6 py-4 text-left no-pdf">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivityLogDocumentId(account.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
                      >
                        <History size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(account);
                        }}
                        className="p-2 text-slate-300 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(account.id);
                        }}
                        className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-3xl border border-slate-200" />)
          ) : filteredAccounts.map(account => (
          <div key={account.id} className="group bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-emerald-200 transition-all duration-300 flex flex-col justify-between gap-4" dir={dir}>
            <div className="flex items-start justify-between gap-4">
               <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-sm">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight group-hover:text-emerald-700 transition-colors">{account.name}</h3>
                    <div className={`flex items-center gap-2 mt-1.5 flex-wrap ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span className="font-mono text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider border border-slate-200">{account.code}</span>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingAccountTypeEditId(account.type_id);
                          setCurrentPage('account_types');
                        }}
                        className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider cursor-pointer hover:bg-emerald-100 transition-colors"
                      >
                        {account.type_name}
                      </span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${account.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {account.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                      </span>
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {getAccountUsageLabel(account.account_usage, language)}
                      </span>
                    </div>
                  </div>
               </div>
               
               <div className={`flex gap-1 no-pdf opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(account.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
                >
                  <History size={16} />
                </button>
                <button onClick={() => openModal(account)} className="p-2 text-slate-300 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(account.id)} className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">Accounting Balance</span>
               <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-emerald-500 transition-all duration-500 group-hover:scale-125" />
            </div>
          </div>
        ))
      }
    </div>
  )}

      </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[85vh] relative">
          <div className="p-2 md:p-2.5 md:px-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[70] flex-wrap gap-2" dir={dir}>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                type="button"
                onClick={closeModal} 
                className="flex items-center gap-1 px-2.5 py-0.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap"
              >
                {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                <span>{language === 'ar' ? 'العودة للقائمة' : 'Return to List'}</span>
              </button>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap w-full md:w-auto flex-1 justify-center md:justify-end">
              <h3 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-none font-sans mr-auto md:mr-0">
                {editingAccount ? t('accounts.edit') : t('accounts.add')}
              </h3>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                type="button"
                onClick={closeModal}
                className="w-20 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 transition-all flex items-center gap-1 justify-center active:scale-95 border border-zinc-200 shadow-sm text-[11px] whitespace-nowrap font-sans"
              >
                <X size={12} />
                <span>{language === 'ar' ? 'إلغاء' : 'Cancel'}</span>
              </button>
              <button 
                type="button"
                onClick={() => {
                  const form = document.getElementById('account-form') as HTMLFormElement;
                  if (form) {
                    if (form.requestSubmit) {
                      form.requestSubmit();
                    } else {
                      document.getElementById('hidden-account-submit')?.click();
                    }
                  }
                }}
                className="w-20 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 justify-center active:scale-95 shadow-sm text-[11px] whitespace-nowrap font-sans"
              >
                <Save size={12} />
                <span>{language === 'ar' ? 'حفظ' : 'Save'}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-slate-50/50">
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="bg-white p-6 rounded-[2rem] border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-emerald-700 font-bold text-sm">
                  <Sparkles size={18} />
                  <span>{t('accounts.ai_input')}</span>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <input 
                    type="text"
                    placeholder={t('accounts.ai_placeholder')}
                    className="flex-1 px-6 py-4 bg-zinc-50 border border-emerald-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none text-sm transition-all"
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAiParse()}
                  />
                  <button 
                    onClick={handleAiParse}
                    disabled={isAiParsing || !aiText.trim()}
                    className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap flex gap-2 items-center justify-center"
                  >
                    {isAiParsing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles size={16} />}
                    {isAiParsing ? t('accounts.ai_analyzing') : t('accounts.ai_analyze')}
                  </button>
                </div>
              </div>

              <form id="account-form" onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
                <button type="submit" id="hidden-account-submit" className="hidden" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t('accounts.form_name')}</label>
                    <div className="relative group">
                      <FileText className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                      <input 
                        required
                        type="text" 
                        className={`w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-bold ${dir === 'rtl' ? 'pr-12' : 'pl-12'}`}
                        placeholder={language === 'ar' ? 'مثال: البنك الأهلي، الموردين، المبيعات' : 'e.g., National Bank, Suppliers, Sales'}
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t('accounts.form_code')}</label>
                    <div className="relative group">
                      <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                      <input 
                        required
                        type="text" 
                        className={`w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-mono font-bold ${dir === 'rtl' ? 'pr-12' : 'pl-12'}`}
                        placeholder="1101"
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t('accounts.form_type')}</label>
                    <select 
                      required
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all appearance-none font-bold"
                      value={formData.type_id}
                      onChange={(e) => setFormData({...formData, type_id: e.target.value})}
                    >
                      <option value="">{t('accounts.select_type')}</option>
                      {types.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative" ref={usageDropdownRef}>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t('accounts.form_usage')}</label>
                    <button
                      type="button"
                      onClick={() => setIsUsageDropdownOpen(!isUsageDropdownOpen)}
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all flex items-center justify-between font-bold"
                    >
                      <span>
                        {formData.account_usage ? getAccountUsageLabel(formData.account_usage, language) : t('accounts.usage_general')}
                      </span>
                      <ChevronDown size={20} className="text-slate-400" />
                    </button>
                    
                    <AnimatePresence>
                      {isUsageDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className={`absolute ${dir === 'rtl' ? 'right-0' : 'left-0'} top-full mt-2 w-[800px] max-w-[90vw] md:max-w-[800px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 z-[160] overflow-hidden`}
                        >
                          <div className="p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                            <div className="relative">
                              <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                              <input
                                type="text"
                                placeholder={language === 'ar' ? 'البحث في استخدامات الحساب...' : 'Search account usages...'}
                                className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold`}
                                value={usageSearchTerm}
                                onChange={(e) => setUsageSearchTerm(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="max-h-[65vh] overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-8">
                            {macroGroupedOptions.map((macro, mIdx) => (
                              <div key={mIdx} className="space-y-4 bg-slate-50/70 p-4 md:p-5 rounded-3xl border border-slate-200 shadow-sm">
                                {/* Macro Category Header */}
                                <div className="flex items-center gap-2.5 pb-2.5 border-b-2 border-slate-900/10">
                                  <div className="w-3 h-3 rounded-full bg-emerald-600 shadow-sm" />
                                  <h3 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                                    {language === 'ar' ? macro.macroAr : macro.macroEn}
                                  </h3>
                                </div>

                                {/* Sub-groups within Macro Category */}
                                <div className="space-y-6 pt-1">
                                  {macro.groups.map((group, gIdx) => (
                                    <div key={gIdx} className="space-y-3 pb-5 border-b-2 border-slate-200/80 last:border-b-0 last:pb-0">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                          <span>{language === 'ar' ? group.labelAr : group.labelEn}</span>
                                        </h4>
                                        <span className="text-[10px] font-bold bg-white text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200">
                                          {group.items.length} {language === 'ar' ? 'عنصر' : 'items'}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {group.items.map(opt => (
                                          <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => {
                                              setFormData({...formData, account_usage: opt.key as any});
                                              setIsUsageDropdownOpen(false);
                                              setUsageSearchTerm('');
                                            }}
                                            className={`w-full text-start px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between ${
                                              formData.account_usage === opt.key
                                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                                                : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
                                            }`}
                                          >
                                            <span>{language === 'ar' ? opt.ar : opt.en}</span>
                                            {formData.account_usage === opt.key && <CheckCircle2 size={16} />}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                            {macroGroupedOptions.length === 0 && (
                              <div className="py-8 text-center text-slate-500 font-bold">
                                {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 leading-none mb-1">{language === 'ar' ? 'حالة النشاط' : 'Activity Status'}</h4>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{language === 'ar' ? 'تحديد ما إذا كان الحساب نشطاً في النظام أم لا' : 'Specify whether the account is active in the system or not'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.is_active ? 'bg-emerald-600' : 'bg-slate-200'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_active ? (dir === 'rtl' ? '-translate-x-6' : 'translate-x-6') : (dir === 'rtl' ? '-translate-x-1' : 'translate-x-1')}`}
                    />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
{isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir={dir}>
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
               <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{t('common.delete_confirm')}</h3>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا الحساب؟ ستفقد كافة البيانات المرتبطة بالحركات المالية لهذا الحساب.' : 'Are you sure you want to delete this account? You will lose all data associated with the financial movements of this account.'}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setAccountToDelete(null);
                }}
                className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                {language === 'ar' ? 'تأكيد الحذف' : 'Delete Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCoaWizardOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir={dir}>
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {language === 'ar' ? 'الدليل المحاسبي الآلي' : 'Auto Chart of Accounts'}
              </h3>
              <button 
                onClick={() => setIsCoaWizardOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-all"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-slate-500 mb-6 font-medium text-sm leading-relaxed">
              {language === 'ar' 
                ? 'سيقوم النظام بإنشاء شجرة حسابات قياسية متكاملة مناسبة لنشاطك التجاري.'
                : 'The system will generate a standard integrated chart of accounts suitable for your business activity.'}
            </p>

            {/* Language Selection */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 mb-2">
                {language === 'ar' ? 'لغة الدليل المحاسبي:' : 'COA Language:'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCoaLanguage('ar')}
                  className={`py-3 px-4 rounded-xl font-bold text-sm border transition-all ${coaLanguage === 'ar' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  العربية (Arabic)
                </button>
                <button
                  type="button"
                  onClick={() => setCoaLanguage('en')}
                  className={`py-3 px-4 rounded-xl font-bold text-sm border transition-all ${coaLanguage === 'en' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <label className="block text-xs font-bold text-slate-500 mb-1">
                {language === 'ar' ? 'نوع النشاط التجاري:' : 'Business Activity Type:'}
              </label>
              <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500">
                <input 
                  type="radio" 
                  name="businessType" 
                  value="all"
                  checked={coaBusinessType === 'all'}
                  onChange={() => setCoaBusinessType('all')}
                  className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-sm">
                    {language === 'ar' ? 'شامل (تجاري وخدمي)' : 'Comprehensive (Commercial & Service)'}
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500">
                <input 
                  type="radio" 
                  name="businessType" 
                  value="commercial"
                  checked={coaBusinessType === 'commercial'}
                  onChange={() => setCoaBusinessType('commercial')}
                  className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-sm">
                    {language === 'ar' ? 'تجاري فقط' : 'Commercial Only'}
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500">
                <input 
                  type="radio" 
                  name="businessType" 
                  value="service"
                  checked={coaBusinessType === 'service'}
                  onChange={() => setCoaBusinessType('service')}
                  className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-sm">
                    {language === 'ar' ? 'خدمي فقط' : 'Service Only'}
                  </span>
                </div>
              </label>
            </div>

            {coaProgress && (
              <div className="mb-6 p-4 bg-indigo-50 rounded-xl flex items-center gap-3 border border-indigo-100">
                <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                <span className="text-sm font-bold text-indigo-700">{coaProgress}</span>
              </div>
            )}

            <button 
              onClick={handleGenerateCOA}
              disabled={isGeneratingCoa}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGeneratingCoa ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{language === 'ar' ? 'جاري البناء...' : 'Building...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>{language === 'ar' ? 'بناء الدليل الآن' : 'Generate COA Now'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <PageActivityLog 
        isOpen={isActivityLogOpen} 
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }} 
        category="accounts"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
