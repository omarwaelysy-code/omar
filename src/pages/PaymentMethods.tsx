import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { PaymentMethod, Account } from '../types';
import { Search, Plus, Trash2, Edit2, X, CreditCard, Wallet, Calendar, Hash, History, Layers } from 'lucide-react';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';

export const PaymentMethods: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    counter_account_id: ''
  });

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setMethods);
      
      const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data);
      });

      setLoading(false);
      return () => {
        unsub();
        unsubscribeAccounts();
      };
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const selectedAccount = accounts.find(a => a.id === formData.account_id);
      const dataToSave = {
        ...formData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };

      if (editingMethod) {
        const fieldsToTrack = [
          { field: 'code', label: 'الكود' },
          { field: 'name', label: 'الاسم' },
          { field: 'opening_balance', label: 'الرصيد الافتتاحي' },
          { field: 'opening_balance_date', label: 'تاريخ الرصيد' },
          { field: 'account_name', label: 'الحساب المحاسبي' },
          { field: 'counter_account_id', label: 'حساب الطرف الآخر' }
        ];
        await dbService.updateWithLog(
          'payment_methods', 
          editingMethod.id, 
          dataToSave,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل طريقة دفع',
          'payment_methods',
          fieldsToTrack
        );

        // Always handle journal entry to ensure consistency
        await dbService.deleteJournalEntryByReference(editingMethod.id, user.company_id);

        if (formData.opening_balance !== 0) {
          const absBalance = Math.abs(formData.opening_balance);
          const isNegative = formData.opening_balance < 0;
          const counterAccount = accounts.find(a => a.id === formData.counter_account_id);

          await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: formData.opening_balance_date,
            description: `رصيد افتتاحي لطريقة الدفع: ${formData.name}`,
            reference_id: editingMethod.id,
            reference_type: 'opening_balance',
            items: [
              {
                account_id: formData.account_id,
                account_name: selectedAccount?.name || '',
                debit: isNegative ? 0 : absBalance,
                credit: isNegative ? absBalance : 0,
                description: 'رصيد افتتاحي'
              },
              {
                account_id: formData.counter_account_id,
                account_name: counterAccount?.name || 'حساب الميزانية الافتتاحية',
                debit: isNegative ? absBalance : 0,
                credit: isNegative ? 0 : absBalance,
                description: `رصيد افتتاحي لطريقة الدفع: ${formData.name}`
              }
            ],
            total_debit: absBalance,
            total_credit: absBalance,
            created_at: new Date().toISOString(),
            created_by: user.id
          });
        }
      } else {
        const id = await dbService.add('payment_methods', dataToSave);
        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة: ${formData.name}`, 'payment_methods', id);

        // Create initial opening balance entry
        if (formData.opening_balance !== 0) {
          const absBalance = Math.abs(formData.opening_balance);
          const isNegative = formData.opening_balance < 0;
          const counterAccount = accounts.find(a => a.id === formData.counter_account_id);

          await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: formData.opening_balance_date,
            description: `رصيد افتتاحي لطريقة الدفع: ${formData.name}`,
            reference_id: id,
            reference_type: 'opening_balance',
            items: [
              {
                account_id: formData.account_id,
                account_name: selectedAccount?.name || '',
                debit: isNegative ? 0 : absBalance,
                credit: isNegative ? absBalance : 0,
                description: 'رصيد افتتاحي'
              },
              {
                account_id: formData.counter_account_id,
                account_name: counterAccount?.name || 'حساب الميزانية الافتتاحية',
                debit: isNegative ? absBalance : 0,
                credit: isNegative ? 0 : absBalance,
                description: `رصيد افتتاحي لطريقة الدفع: ${formData.name}`
              }
            ],
            total_debit: absBalance,
            total_credit: absBalance,
            created_at: new Date().toISOString(),
            created_by: user.id
          });
        }
      }
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (id: string) => {
    setMethodToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!methodToDelete || !user) return;
    try {
      const method = methods.find(m => m.id === methodToDelete);
      
      // Delete associated journal entry first
      await dbService.deleteJournalEntryByReference(methodToDelete, user.company_id);
      
      await dbService.delete('payment_methods', methodToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف طريقة دفع', `حذف طريقة دفع: ${method?.name}`, 'payment_methods', methodToDelete);
      showNotification('تم حذف طريقة الدفع بنجاح', 'success');
      setIsDeleteModalOpen(false);
      setMethodToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حذف طريقة الدفع', 'error');
    }
  };

  const openModal = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method);
      setFormData({
        code: method.code,
        name: method.name,
        opening_balance: method.opening_balance,
        opening_balance_date: method.opening_balance_date || new Date().toISOString().slice(0, 10),
        account_id: method.account_id || '',
        counter_account_id: method.counter_account_id || ''
      });
    } else {
      setEditingMethod(null);
      setFormData({
        code: '',
        name: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: '',
        counter_account_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMethod(null);
  };

  const filteredMethods = methods.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">طرق السداد</h2>
          <p className="text-zinc-500">إدارة الخزائن، الحسابات البنكية، وطرق الدفع المختلفة.</p>
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
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            إضافة طريقة سداد جديدة
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث باسم الطريقة أو الكود..."
            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-44 bg-zinc-100 animate-pulse rounded-3xl" />)
        ) : filteredMethods.map(method => (
          <div key={method.id} className="group bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 relative overflow-hidden">
            <div className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-emerald-500/20">
                  <CreditCard size={24} />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setActivityLogDocumentId(method.id);
                      setIsActivityLogOpen(true);
                    }}
                    className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                    title="سجل النشاط"
                  >
                    <History size={18} />
                  </button>
                  <button onClick={() => openModal(method)} className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(method.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-zinc-900">{method.name}</h3>
                <span className="inline-block text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider">{method.code}</span>
                <div className="flex items-center gap-2 text-zinc-900 font-bold pt-3 border-t border-zinc-50 mt-2">
                  <Wallet size={16} className="text-emerald-500" />
                  <span>الرصيد: {(method.opening_balance || 0).toLocaleString()} ج.م</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`bg-white w-full h-full md:h-auto ${editingMethod ? 'md:max-w-6xl' : 'md:max-w-2xl'} md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>
            <div className="p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-xl font-bold text-zinc-900">{editingMethod ? 'تعديل طريقة سداد' : 'إضافة طريقة سداد جديدة'}</h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            
              {/* Form and Activity Log Container */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <form onSubmit={handleSubmit} className="p-8 space-y-5 flex-1 overflow-y-auto">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">كود الطريقة</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          required
                          type="text" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="مثال: CASH-01، BANK-01"
                          value={formData.code}
                          onChange={(e) => setFormData({...formData, code: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم الطريقة / الخزينة</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="مثال: الخزينة الرئيسية، بنك مصر..."
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الرصيد الافتتاحي</label>
                        <div className="relative">
                          <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                          <input 
                            type="number" 
                            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            value={formData.opening_balance}
                            onChange={(e) => setFormData({...formData, opening_balance: Number(e.target.value)})}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                          <input 
                            type="date" 
                            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            value={formData.opening_balance_date}
                            onChange={(e) => setFormData({...formData, opening_balance_date: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={formData.account_id}
                        onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                      >
                        <option value="">اختر الحساب...</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {formData.opening_balance !== 0 && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حساب الطرف الآخر (للرصيد الافتتاحي)</label>
                          <select
                            required
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all border-emerald-200 bg-emerald-50/30"
                            value={formData.counter_account_id}
                            onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}
                          >
                            <option value="">اختر حساب الطرف الآخر...</option>
                            {accounts.map(account => (
                              <option key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {formData.counter_account_id && (
                          <JournalEntryPreview 
                            title="معاينة قيد الرصيد الافتتاحي"
                            items={[
                              {
                                account_name: accounts.find(a => a.id === formData.account_id)?.name || 'حساب طريقة الدفع',
                                debit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                credit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                description: 'رصيد افتتاحي'
                              },
                              {
                                account_name: accounts.find(a => a.id === formData.counter_account_id)?.name || 'حساب الطرف الآخر',
                                debit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                credit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                description: `رصيد افتتاحي لطريقة الدفع: ${formData.name}`
                              }
                            ]}
                          />
                        )}
                      </div>
                    )}
                </div>
                <div className="pt-4 flex gap-3">
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      {editingMethod ? 'تحديث البيانات' : 'حفظ الطريقة'}
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

                <div className="hidden md:block w-80 border-r border-zinc-100 bg-zinc-50/30">
                  <InlineActivityLog category="payment_methods" documentId={editingMethod?.id} />
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">تأكيد الحذف</h3>
            <p className="text-zinc-500 mb-6">هل أنت متأكد من رغبتك في حذف طريقة السداد هذه؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setMethodToDelete(null);
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
        category="payment_methods"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
