import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { AccountType } from '../types';
import { Search, Plus, Trash2, Edit2, X, History, Sparkles, Hash, FileText, PieChart, LayoutGrid, List, Save, ChevronRight, ChevronLeft } from 'lucide-react';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { parseAccountType, parseAccountTypesBulk } from '../services/geminiService';
import { useViewPreference } from '../hooks/useViewPreference';
import { useNavigation } from '../contexts/NavigationContext';

export const AccountTypes: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { pendingAccountTypeEditId, setPendingAccountTypeEditId } = useNavigation();
  const [view, setView] = useViewPreference('account_types', 'card');
  const [types, setTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AccountType | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiText, setAiText] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    statement_type: 'balance_sheet' as 'income_statement' | 'balance_sheet',
    classification: 'asset' as 'asset' | 'liability' | 'equity' | 'liability_equity' | 'cash_and_equivalents' | 'receivables' | 'payables' | 'revenue' | 'cost' | 'expense' | 'interest_expense' | 'depreciation' | 'other_revenue' | 'other_expense',
    is_active: true
  });

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'asset': return language === 'ar' ? 'أصل' : 'Asset';
      case 'liability': return language === 'ar' ? 'التزام' : 'Liability';
      case 'equity': return language === 'ar' ? 'حقوق ملكية' : 'Equity';
      case 'liability_equity': return language === 'ar' ? 'التزام/حقوق ملكية' : 'Liability/Equity';
      case 'cash_and_equivalents': return language === 'ar' ? 'نقدية وما في حكمها' : 'Cash & Cash Equivalents';
      case 'receivables': return language === 'ar' ? 'عملاء' : 'Customers / Receivables';
      case 'payables': return language === 'ar' ? 'موردين' : 'Suppliers / Payables';
      case 'revenue': return language === 'ar' ? 'إيراد' : 'Revenue';
      case 'cost': return language === 'ar' ? 'تكلفة' : 'Cost';
      case 'expense': return language === 'ar' ? 'مصروف' : 'Expense';
      case 'interest_expense': return language === 'ar' ? 'فوائد مدينة' : 'Debit Interest';
      case 'depreciation': return language === 'ar' ? 'اهلاكات' : 'Depreciation';
      case 'other_revenue': return language === 'ar' ? 'ايرادات اخرى' : 'Other Revenues';
      case 'other_expense': return language === 'ar' ? 'مصروفات اخرى' : 'Other Expenses';
      default: return classification;
    }
  };

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<AccountType>('account_types', user.company_id, setTypes);
      setLoading(false);
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    if (pendingAccountTypeEditId && types.length > 0) {
      const type = types.find(t => t.id === pendingAccountTypeEditId);
      if (type) {
        openModal(type);
      }
      setPendingAccountTypeEditId(null);
    }
  }, [pendingAccountTypeEditId, types, setPendingAccountTypeEditId]);

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setIsAiParsing(true);
    try {
      const result = await parseAccountTypesBulk(aiText);
      if (result && result.types && result.types.length > 0) {
        if (result.types.length === 1) {
          // Single item: fill form
          const item = result.types[0];
          setFormData({
            code: item.code || '',
            name: item.name || '',
            statement_type: item.statementType || 'balance_sheet',
            classification: item.classification || (item.statementType === 'income_statement' ? 'revenue' : 'asset'),
            is_active: true
          });
        } else {
          // Multiple items: show notification and maybe handle later, but for now we can add them directly
          if (window.confirm(language === 'ar' ? `تم العثور على ${result.types.length} أنواع حسابات. هل تريد إضافتها جميعاً؟` : `Found ${result.types.length} account types. Do you want to add them all?`)) {
            for (const item of result.types) {
              await dbService.add('account_types', {
                code: item.code || '',
                name: item.name || '',
                statement_type: item.statementType || 'balance_sheet',
                classification: item.classification || (item.statementType === 'income_statement' ? 'revenue' : 'asset'),
                company_id: user?.company_id,
                is_active: true
              });
            }
            showNotification(language === 'ar' ? `تم إضافة ${result.types.length} أنواع حسابات بنجاح` : `Successfully added ${result.types.length} account types`, 'success');
            closeModal();
          }
        }
        showNotification(language === 'ar' ? 'تم تحليل البيانات بنجاح' : 'Data analyzed successfully', 'success');
        setAiText('');
      }
    } catch (error) {
      console.error(error);
      showNotification(language === 'ar' ? 'فشل تحليل البيانات بالذكاء الاصطناعي' : 'AI data analysis failed', 'error');
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingType) {
        const fieldsToTrack = [
          { field: 'code', label: 'الكود' },
          { field: 'name', label: 'الاسم' },
          { field: 'statement_type', label: 'نوع القائمة' },
          { field: 'classification', label: 'التصنيف' },
          { field: 'is_active', label: 'نشط' }
        ];
        await dbService.updateWithLog(
          'account_types',
          editingType.id,
          { ...formData, company_id: user.company_id },
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل نوع حساب',
          'account_types',
          fieldsToTrack
        );
        showNotification(language === 'ar' ? 'تم تحديث نوع الحساب بنجاح' : 'Account type updated successfully', 'success');
      } else {
        const id = await dbService.add('account_types', { ...formData, company_id: user.company_id });
        await dbService.logActivity(user.id, user.username, user.company_id, language === 'ar' ? 'إضافة نوع حساب' : 'Add Account Type', `إضافة نوع حساب جديد: ${formData.name}`, 'account_types', id);
        showNotification(language === 'ar' ? 'تم إضافة نوع الحساب بنجاح' : 'Account type added successfully', 'success');
      }
      closeModal();
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'An error occurred while saving', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setTypeToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!typeToDelete || !user) return;
    try {
      const type = types.find(t => t.id === typeToDelete);
      await dbService.delete('account_types', typeToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف نوع حساب', `حذف نوع الحساب: ${type?.name}`, 'account_types', typeToDelete);
      setIsDeleteModalOpen(false);
      setTypeToDelete(null);
      showNotification(language === 'ar' ? 'تم حذف نوع الحساب بنجاح' : 'Account type deleted successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء الحذف' : 'An error occurred while deleting', 'error');
    }
  };

  const openModal = (type?: AccountType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        code: type.code,
        name: type.name,
        statement_type: type.statement_type,
        classification: type.classification || (type.statement_type === 'income_statement' ? 'revenue' : 'asset'),
        is_active: type.is_active !== false
      });
    } else {
      setEditingType(null);
      setFormData({
        code: '',
        name: '',
        statement_type: 'balance_sheet',
        classification: 'asset',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
    setAiText('');
  };

  const filteredTypes = types.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto p-4 md:p-8" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('nav.account_types')}</h2>
          <p className="text-zinc-500 text-sm">{language === 'ar' ? 'تعريف أنواع الحسابات وتصنيفها (ميزانية / قائمة دخل).' : 'Define account types and their classifications (Balance Sheet / Income Statement).'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setActivityLogDocumentId(undefined);
              setIsActivityLogOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95"
            title="{t('common.activity_log')}"
          >
            <History size={20} />
            <span className="hidden md:inline">سجل النشاط</span>
          </button>
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            إضافة نوع حساب
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder={language === 'ar' ? 'البحث باسم النوع أو الكود...' : 'Search by type name or code...'}
            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex bg-zinc-100 p-1.5 rounded-2xl gap-1 shrink-0">
          <button 
            onClick={() => setView('card')} 
            className={`p-2 rounded-xl transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
            title="عرض كروت"
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            onClick={() => setView('table')} 
            className={`p-2 rounded-xl transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
            title="عرض جدول"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-20 bg-zinc-100 animate-pulse rounded-2xl" />)
        ) : view === 'table' ? (
          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm" dir="rtl">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700">{language === 'ar' ? 'الكود' : 'Code'}</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700">{language === 'ar' ? 'الاسم' : 'Name'}</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700">{language === 'ar' ? 'نوع القائمة' : 'Statement Type'}</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700">{language === 'ar' ? 'التصنيف الرئيسي' : 'Main Classification'}</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-left">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                {filteredTypes.map((type) => (
                  <tr 
                    key={type.id}
                    onClick={() => openModal(type)}
                    className="hover:bg-zinc-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-emerald-600 text-sm">
                      {type.code}
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">
                      {type.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          type.statement_type === 'balance_sheet' ? 'text-blue-600 bg-blue-50' : 'text-emerald-600 bg-emerald-50'
                        }`}>
                          {type.statement_type === 'balance_sheet' ? (language === 'ar' ? 'الميزانية' : 'Balance Sheet') : (language === 'ar' ? 'قائمة الدخل' : 'Income Statement')}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${type.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {type.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {getClassificationLabel(type.classification)}
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivityLogDocumentId(type.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                          title="سجل النشاط"
                        >
                          <History size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(type);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(type.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
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
          filteredTypes.map(type => (
          <div key={type.id} className="group bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all duration-300 flex items-center justify-between gap-4">
            <div className="flex items-center flex-1 gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20 shrink-0">
                <PieChart size={20} />
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 flex-1">
                <h3 className="text-lg font-bold text-zinc-900">{type.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-300 hidden md:inline font-light">|</span>
                  <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">{type.code}</span>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    type.statement_type === 'balance_sheet' ? 'text-blue-600 bg-blue-50' : 'text-emerald-600 bg-emerald-50'
                  }`}>
                    {type.statement_type === 'balance_sheet' ? 'الميزانية' : 'قائمة الدخل'}
                  </span>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${type.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {type.is_active !== false ? 'نشط' : 'غير نشط'}
                  </span>
                  <span className="inline-block text-[10px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {getClassificationLabel(type.classification)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-1">
              <button 
                onClick={() => {
                  setActivityLogDocumentId(type.id);
                  setIsActivityLogOpen(true);
                }}
                className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                title="سجل النشاط"
              >
                <History size={18} />
              </button>
              <button onClick={() => openModal(type)} className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all">
                <Edit2 size={18} />
              </button>
              <button onClick={() => handleDelete(type.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>

      </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[80vh] relative">
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
                {editingType ? (language === 'ar' ? 'تعديل نوع حساب' : 'Edit Account Type') : (language === 'ar' ? 'إضافة نوع حساب جديد' : 'Create New Account Type')}
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
                  const form = document.getElementById('account-type-form') as HTMLFormElement;
                  if (form) {
                    if (form.requestSubmit) {
                      form.requestSubmit();
                    } else {
                      document.getElementById('hidden-account-type-submit')?.click();
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
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-6 rounded-[2rem] border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-emerald-700 font-bold text-sm">
                  <Sparkles size={18} />
                  <span>{language === 'ar' ? 'الإدخال الذكي (AI)' : 'Smart Input (AI)'}</span>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <input 
                    type="text"
                    placeholder={language === 'ar' ? 'مثال: أصول متداولة تابعة للميزانية بكود 11' : 'e.g. Current Assets under Balance Sheet with code 11'}
                    className="flex-1 px-6 py-4 bg-zinc-50 border border-emerald-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none text-sm transition-all"
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAiParse()}
                  />
                  <button 
                    onClick={handleAiParse}
                    disabled={isAiParsing || !aiText.trim()}
                    className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap"
                  >
                    {isAiParsing ? (language === 'ar' ? 'جاري التحليل...' : 'Analyzing...') : (language === 'ar' ? 'تحليل ذكي' : 'Smart Analyze')}
                  </button>
                </div>
              </div>

              <form id="account-type-form" onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
                <button type="submit" id="hidden-account-type-submit" className="hidden" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">{language === 'ar' ? 'كود النوع' : 'Type Code'}</label>
                    <div className="relative group">
                      <Hash className="absolute left-4 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <input 
                        required
                        type="text" 
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-mono font-bold"
                        placeholder={language === 'ar' ? 'مثال: 11، 21، 31' : 'e.g. 11, 21, 31'}
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">{language === 'ar' ? 'اسم النوع' : 'Type Name'}</label>
                    <div className="relative group">
                      <FileText className="absolute left-4 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <input 
                        required
                        type="text" 
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-bold"
                        placeholder={language === 'ar' ? 'مثال: أصول متداولة، خصوم طويلة الأجل' : 'e.g. Current Assets, Long-term liabilities'}
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">{language === 'ar' ? 'تابع لـ' : 'Statement'}</label>
                    <select 
                      required
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all appearance-none font-bold"
                      value={formData.statement_type}
                      onChange={(e) => {
                        const val = e.target.value as 'income_statement' | 'balance_sheet';
                        setFormData({
                          ...formData, 
                          statement_type: val,
                          classification: val === 'income_statement' ? 'revenue' : 'asset'
                        });
                      }}
                    >
                      <option value="balance_sheet">{language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet'}</option>
                      <option value="income_statement">{language === 'ar' ? 'قائمة الدخل' : 'Income Statement'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 mb-2 uppercase tracking-widest">{language === 'ar' ? 'التصنيف' : 'Classification'}</label>
                    <select 
                      required
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all appearance-none font-bold"
                      value={formData.classification}
                      onChange={(e) => setFormData({...formData, classification: e.target.value as any})}
                    >
                      {formData.statement_type === 'balance_sheet' ? (
                        <>
                          <option value="asset">{language === 'ar' ? 'أصل' : 'Asset'}</option>
                          <option value="cash_and_equivalents">{language === 'ar' ? 'نقدية وما في حكمها' : 'Cash & Cash Equivalents'}</option>
                          <option value="receivables">{language === 'ar' ? 'عملاء' : 'Customers / Receivables'}</option>
                          <option value="liability">{language === 'ar' ? 'التزام (خصوم)' : 'Liability'}</option>
                          <option value="payables">{language === 'ar' ? 'موردين' : 'Suppliers / Payables'}</option>
                          <option value="equity">{language === 'ar' ? 'حقوق ملكية' : 'Equity'}</option>
                          <option value="liability_equity">{language === 'ar' ? 'التزام / حقوق ملكية (مشترك)' : 'Liability/Equity (Joint)'}</option>
                        </>
                      ) : (
                        <>
                          <option value="revenue">{language === 'ar' ? 'إيراد' : 'Revenue'}</option>
                          <option value="other_revenue">{language === 'ar' ? 'ايرادات اخرى' : 'Other Revenues'}</option>
                          <option value="cost">{language === 'ar' ? 'تكلفة' : 'Cost'}</option>
                          <option value="expense">{language === 'ar' ? 'مصروف' : 'Expense'}</option>
                          <option value="interest_expense">{language === 'ar' ? 'فوائد مدينة' : 'Debit Interest'}</option>
                          <option value="depreciation">{language === 'ar' ? 'اهلاكات' : 'Depreciation'}</option>
                          <option value="other_expense">{language === 'ar' ? 'مصروفات اخرى' : 'Other Expenses'}</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 leading-none mb-1">{language === 'ar' ? 'حالة النشاط' : 'Activity Status'}</h4>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{language === 'ar' ? 'تحديد ما إذا كان نوع الحساب نشطاً في النظام أم لا' : 'Specify whether the account type is active in the system or not'}</p>
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
            <p className="text-zinc-500 mb-6">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف نوع الحساب هذا؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this account type? This action cannot be undone.'}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setTypeToDelete(null);
                }}
                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                حذف
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
        category="account_types"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
