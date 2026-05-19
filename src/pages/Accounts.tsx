import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Account, AccountType } from '../types';
import { Search, Plus, Trash2, Edit2, X, History, Sparkles, Hash, FileText, BookOpen, User } from 'lucide-react';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { parseAccount } from '../services/geminiService';
import { ExportButtons } from '../components/ExportButtons';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { useRef } from 'react';

export const Accounts: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
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
  const tableRef = useRef<HTMLTableElement>(null);

  const handleExportExcel = () => {
    const headers = {
      'code': t('accounts.column_code'),
      'name': t('accounts.column_name'),
      'type_name': t('accounts.column_type')
    };
    const formattedData = formatDataForExcel(accounts, headers);
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
    parent_id: ''
  });

  useEffect(() => {
    if (user) {
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubTypes = dbService.subscribe<AccountType>('account_types', user.company_id, setTypes);
      setLoading(false);
      return () => {
        unsubAccounts();
        unsubTypes();
      };
    }
  }, [user]);

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
          parent_id: ''
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
          { field: 'required_sub_account', label: 'يلزم حساب فرعي' }
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
    console.log('[ERP] Data from API/List:', account);
    if (account) {
      // Robust boolean conversion for Postgres (handles true, 'true', 1, 't', etc.)
      const rawVal = (account as any).required_sub_account;
      const requiredSubAccount = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === 't' || rawVal === '1';
      
      console.log('[ERP] required_sub_account raw:', rawVal, 'parsed:', requiredSubAccount);
      setEditingAccount(account);
      const newFormData = {
        code: account.code,
        name: account.name,
        type_id: account.type_id,
        opening_balance: account.opening_balance || 0,
        required_sub_account: requiredSubAccount,
        parent_id: account.parent_id || ''
      };
      console.log('[ERP] Form State being set:', newFormData);
      setFormData(newFormData);
    } else {
      setEditingAccount(null);
      setFormData({
        code: '',
        name: '',
        type_id: '',
        opening_balance: 0,
        required_sub_account: false,
        parent_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setAiText('');
  };

  const filteredAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
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
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50"
          >
            <Plus size={20} />
            {t('accounts.add')}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 bg-slate-50/30">
        <div className="relative flex-1 group">
          <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
          <input 
            type="text" 
            placeholder={t('accounts.search_placeholder')}
            className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

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
                    <div className={`flex items-center gap-2 mt-1.5 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span className="font-mono text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider border border-slate-200">{account.code}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {account.type_name}
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
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[95vh] md:max-w-6xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
            <div className={`p-6 md:p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                   <BookOpen size={24} />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingAccount ? t('accounts.edit') : t('accounts.add')}</h3>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">General Ledger Account</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-900 p-2.5 hover:bg-slate-50 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 md:p-10 bg-emerald-50/30 border-b border-emerald-100/50" dir={dir}>
              <div className={`flex items-center gap-3 mb-4 text-emerald-800 font-black text-xs uppercase tracking-widest ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-right'}`}>
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                   <Sparkles size={16} />
                </div>
                <span>{t('accounts.ai_input')}</span>
              </div>
              <div className={`flex flex-col md:flex-row gap-3 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <input 
                  type="text"
                  placeholder={t('accounts.ai_placeholder')}
                  className={`flex-1 px-6 py-4 bg-white border border-emerald-200 rounded-[1.25rem] focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none font-bold text-slate-900 placeholder:text-slate-400 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAiParse()}
                />
                <button 
                   onClick={handleAiParse}
                   disabled={isAiParsing || !aiText.trim()}
                   className="px-8 py-4 bg-emerald-600 text-white rounded-[1.25rem] font-black text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 border border-emerald-500/50 active:scale-95"
                >
                  {isAiParsing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('accounts.ai_analyzing')}
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      {t('accounts.ai_analyze')}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/10">
              <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6 flex-1 overflow-y-auto pb-32 md:pb-10 custom-scrollbar" dir={dir}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('accounts.form_name')}</label>
                    <div className="relative group">
                      <FileText className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                      <input 
                        required
                        type="text" 
                        className="premium-input font-bold"
                        placeholder={language === 'ar' ? 'مثال: البنك الأهلي، الموردين، المبيعات' : 'e.g., National Bank, Suppliers, Sales'}
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('accounts.form_code')}</label>
                    <div className="relative group">
                      <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                      <input 
                        required
                        type="text" 
                        className="premium-input font-mono font-bold tracking-widest"
                        placeholder={language === 'ar' ? 'مثال: 1101، 1201، 2101' : 'e.g., 1101, 1201, 2101'}
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('accounts.form_type')}</label>
                    <div className="relative group">
                       <BookOpen className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                       <select 
                        required
                        className="premium-input font-bold pr-12 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[8px_center] bg-[length:16px] bg-no-repeat"
                        value={formData.type_id}
                        onChange={(e) => setFormData({...formData, type_id: e.target.value, parent_id: ''})}
                      >
                        <option value="">{language === 'ar' ? 'اختر النوع...' : 'Select type...'}</option>
                        {types.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الحساب الرئيسي' : 'Parent Account'}</label>
                    <div className="relative group">
                       <BookOpen className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                       <select 
                        className="premium-input font-bold pr-12 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[8px_center] bg-[length:16px] bg-no-repeat"
                        value={formData.parent_id}
                        onChange={(e) => setFormData({...formData, parent_id: e.target.value})}
                      >
                        <option value="">{language === 'ar' ? 'حساب رئيسي (مستوى أول)' : 'Main Account (Level 1)'}</option>
                        {accounts
                          .filter(a => a.type_id === formData.type_id && a.id !== editingAccount?.id)
                          .map(a => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</label>
                    <div className="relative group">
                      <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        className="premium-input font-black"
                        placeholder="0.00"
                        value={formData.opening_balance}
                        onChange={(e) => setFormData({...formData, opening_balance: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-3 font-bold italic px-4 py-2 bg-slate-100 rounded-xl w-fit border border-slate-200 mb-6">{language === 'ar' ? 'القيمة الموجبة للمدين والسالبة للدائن' : 'Positive for Debit, Negative for Credit'}</p>
                    
                    <div className={`p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between group-within:border-emerald-500 transition-all ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${formData.required_sub_account ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                           <User size={20} />
                        </div>
                        <div>
                           <p className="font-bold text-slate-900">{language === 'ar' ? 'يلزم حساب فرعي' : 'Required Sub-account'}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === 'ar' ? 'إسأل عن العميل/المورد عند التسجيل' : 'Ask for Customer/Supplier on Entry'}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          id="required_sub_account_switch"
                          className="sr-only peer" 
                          checked={formData.required_sub_account}
                          onChange={(e) => {
                            const val = e.target.checked;
                            console.log('[ERP] Switch Change:', val);
                            setFormData({...formData, required_sub_account: val});
                          }}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] peer-checked:after:left-[auto] peer-checked:after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-10 flex gap-4 sticky bottom-0 bg-white/80 backdrop-blur-md pb-4">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50"
                  >
                    {editingAccount ? (language === 'ar' ? 'تحديث بيانات الحساب' : 'Update Data') : (language === 'ar' ? 'تأكيد وحفظ الحساب' : 'Confirm & Save Account')}
                  </button>
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="px-8 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>

              <div className="hidden md:block w-96 border-r border-slate-100 bg-slate-50/20 shadow-inner overflow-y-auto custom-scrollbar">
                <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                   <div className="flex items-center gap-2">
                       <History size={16} className="text-slate-400" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">سجل نشاط الحساب</span>
                    </div>
                </div>
                <InlineActivityLog category="accounts" documentId={editingAccount?.id} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
