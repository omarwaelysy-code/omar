import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { AccountType } from '../types';
import { Search, Plus, Trash2, Edit2, X, History, Sparkles, Hash, FileText, PieChart } from 'lucide-react';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { parseAccountType } from '../services/geminiService';

export const AccountTypes: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
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
    classification: 'asset' as 'asset' | 'liability_equity' | 'revenue' | 'cost' | 'expense'
  });

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<AccountType>('account_types', user.company_id, setTypes);
      setLoading(false);
      return () => unsub();
    }
  }, [user]);

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setIsAiParsing(true);
    try {
      const result = await parseAccountType(aiText);
      if (result) {
        setFormData({
          code: result.code || '',
          name: result.name || '',
          statement_type: result.statementType || 'balance_sheet',
          classification: result.classification || (result.statementType === 'income_statement' ? 'revenue' : 'asset')
        });
        showNotification('تم تحليل البيانات بنجاح', 'success');
        setAiText('');
      }
    } catch (error) {
      console.error(error);
      showNotification('فشل تحليل البيانات بالذكاء الاصطناعي', 'error');
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
          { field: 'classification', label: 'التصنيف' }
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
        showNotification('تم تحديث نوع الحساب بنجاح');
      } else {
        const id = await dbService.add('account_types', { ...formData, company_id: user.company_id });
        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة نوع حساب', `إضافة نوع حساب جديد: ${formData.name}`, 'account_types', id);
        showNotification('تم إضافة نوع الحساب بنجاح');
      }
      closeModal();
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء الحفظ', 'error');
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
      showNotification('تم حذف نوع الحساب بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء الحذف', 'error');
    }
  };

  const openModal = (type?: AccountType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        code: type.code,
        name: type.name,
        statement_type: type.statement_type,
        classification: type.classification || (type.statement_type === 'income_statement' ? 'revenue' : 'asset')
      });
    } else {
      setEditingType(null);
      setFormData({
        code: '',
        name: '',
        statement_type: 'balance_sheet',
        classification: 'asset'
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">أنواع الحسابات</h2>
          <p className="text-zinc-500 text-sm">تعريف أنواع الحسابات وتصنيفها (ميزانية / قائمة دخل).</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setActivityLogDocumentId(undefined);
              setIsActivityLogOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95"
            title="سجل النشاط"
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

      <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث باسم النوع أو الكود..."
            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-20 bg-zinc-100 animate-pulse rounded-2xl" />)
        ) : filteredTypes.map(type => (
          <div key={type.id} className="group bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all duration-300 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20">
                <PieChart size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">{type.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">{type.code}</span>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    type.statement_type === 'balance_sheet' ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50'
                  }`}>
                    {type.statement_type === 'balance_sheet' ? 'الميزانية' : 'قائمة الدخل'}
                  </span>
                  <span className="inline-block text-[10px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {type.classification === 'asset' ? 'أصل' : 
                     type.classification === 'liability_equity' ? 'التزام/حقوق ملكية' :
                     type.classification === 'revenue' ? 'إيراد' :
                     type.classification === 'cost' ? 'تكلفة' : 'مصروف'}
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
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-lg md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-xl font-bold text-zinc-900">{editingType ? 'تعديل نوع حساب' : 'إضافة نوع حساب جديد'}</h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 bg-emerald-50/50 border-b border-emerald-100">
              <div className="flex items-center gap-2 mb-3 text-emerald-700 font-bold text-sm">
                <Sparkles size={18} />
                <span>الإدخال الذكي (AI)</span>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="مثال: أصول متداولة تابعة للميزانية بكود 11"
                  className="flex-1 px-4 py-2 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAiParse()}
                />
                <button 
                  onClick={handleAiParse}
                  disabled={isAiParsing || !aiText.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isAiParsing ? 'جاري التحليل...' : 'تحليل'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5 flex-1 overflow-y-auto">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">كود النوع</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <input 
                      required
                      type="text" 
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="مثال: 11، 21، 31"
                      value={formData.code}
                      onChange={(e) => setFormData({...formData, code: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم النوع</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <input 
                      required
                      type="text" 
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="مثال: أصول متداولة، خصوم طويلة الأجل"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تابع لـ</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
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
                    <option value="balance_sheet">الميزانية العمومية</option>
                    <option value="income_statement">قائمة الدخل</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">التصنيف</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                    value={formData.classification}
                    onChange={(e) => setFormData({...formData, classification: e.target.value as any})}
                  >
                    {formData.statement_type === 'balance_sheet' ? (
                      <>
                        <option value="asset">أصل</option>
                        <option value="liability_equity">التزام / حقوق ملكية</option>
                      </>
                    ) : (
                      <>
                        <option value="revenue">إيراد</option>
                        <option value="cost">تكلفة</option>
                        <option value="expense">مصروف</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  {editingType ? 'تحديث البيانات' : 'حفظ النوع'}
                </button>
                <button 
                  type="button"
                  onClick={closeModal}
                  className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">تأكيد الحذف</h3>
            <p className="text-zinc-500 mb-6">هل أنت متأكد من رغبتك في حذف نوع الحساب هذا؟ لا يمكن التراجع عن هذا الإجراء.</p>
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
