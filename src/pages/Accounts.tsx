import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Account, AccountType } from '../types';
import { Search, Plus, Trash2, Edit2, X, History, Sparkles, Hash, FileText, BookOpen } from 'lucide-react';
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
    type_id: ''
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
          type_id: matchingType?.id || ''
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
          { field: 'type_id', label: 'نوع الحساب' }
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
        showNotification('تم تحديث الحساب بنجاح');
      } else {
        const id = await dbService.add('accounts', accountData);
        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة حساب', `إضافة حساب جديد: ${formData.name}`, 'accounts', id);
        showNotification('تم إضافة الحساب بنجاح');
      }
      closeModal();
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء الحفظ', 'error');
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
      showNotification('تم حذف الحساب بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء الحذف', 'error');
    }
  };

  const openModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        code: account.code,
        name: account.name,
        type_id: account.type_id
      });
    } else {
      setEditingAccount(null);
      setFormData({
        code: '',
        name: '',
        type_id: ''
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('accounts.title')}</h2>
          <p className="text-zinc-500 text-sm">{t('accounts.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => {
              setActivityLogDocumentId(undefined);
              setIsActivityLogOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
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
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-200"
          >
            <Plus size={20} />
            {t('accounts.add')}
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-zinc-400`} size={20} />
          <input 
            type="text" 
            placeholder={t('accounts.search_placeholder')}
            className={`w-full ${dir === 'rtl' ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-20 bg-zinc-100 animate-pulse rounded-2xl" />)
        ) : filteredAccounts.map(account => (
          <div key={account.id} className="group bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all duration-300 flex items-center justify-between gap-4" dir={dir}>
            <div className={`flex items-center gap-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">{account.name}</h3>
                <div className={`flex items-center gap-2 mt-1 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">{account.code}</span>
                  <span className="inline-block text-[10px] font-bold text-zinc-500 bg-zinc-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {account.type_name}
                  </span>
                </div>
              </div>
            </div>
            
            <div className={`flex gap-1 no-pdf ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <button 
                onClick={() => {
                  setActivityLogDocumentId(account.id);
                  setIsActivityLogOpen(true);
                }}
                className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
              >
                <History size={18} />
              </button>
              <button onClick={() => openModal(account)} className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all">
                <Edit2 size={18} />
              </button>
              <button onClick={() => handleDelete(account.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className={`p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className="text-xl font-bold text-zinc-900">{editingAccount ? t('accounts.edit') : t('accounts.add')}</h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 bg-emerald-50/50 border-b border-emerald-100" dir={dir}>
              <div className={`flex items-center gap-2 mb-3 text-emerald-700 font-bold text-sm ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <Sparkles size={18} />
                <span>{t('accounts.ai_input')}</span>
              </div>
              <div className={`flex gap-2 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <input 
                  type="text"
                  placeholder={t('accounts.ai_placeholder')}
                  className={`flex-1 px-4 py-2 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAiParse()}
                />
                <button 
                  onClick={handleAiParse}
                  disabled={isAiParsing || !aiText.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isAiParsing ? t('accounts.ai_analyzing') : t('accounts.ai_analyze')}
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleSubmit} className="p-8 space-y-5 flex-1 overflow-y-auto" dir={dir}>
                <div className="space-y-5">
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('accounts.form_code')}</label>
                    <div className="relative">
                      <Hash className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input 
                        required
                        type="text" 
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        placeholder={language === 'ar' ? 'مثال: 1101، 1201، 2101' : 'e.g., 1101, 1201, 2101'}
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('accounts.form_name')}</label>
                    <div className="relative">
                      <FileText className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input 
                        required
                        type="text" 
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        placeholder={language === 'ar' ? 'مثال: البنك الأهلي، الموردين، المبيعات' : 'e.g., National Bank, Suppliers, Sales'}
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('accounts.form_type')}</label>
                    <select 
                      required
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={formData.type_id}
                      onChange={(e) => setFormData({...formData, type_id: e.target.value})}
                    >
                      <option value="">{language === 'ar' ? 'اختر النوع...' : 'Select type...'}</option>
                      {types.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    {editingAccount ? (language === 'ar' ? 'تحديث البيانات' : 'Update Data') : (language === 'ar' ? 'حفظ الحساب' : 'Save Account')}
                  </button>
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>

              <div className="hidden md:block w-80 border-r border-zinc-100 bg-zinc-50/30">
                <InlineActivityLog category="accounts" documentId={editingAccount?.id} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" dir={dir}>
            <h3 className="text-xl font-bold text-zinc-900 mb-4">{t('common.delete_confirm')}</h3>
            <p className="text-zinc-500 mb-6">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا الحساب؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this account? This action cannot be undone.'}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setAccountToDelete(null);
                }}
                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                {language === 'ar' ? 'حذف' : 'Delete'}
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
