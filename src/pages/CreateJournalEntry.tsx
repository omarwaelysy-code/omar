import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { dbService } from '../services/dbService';
import { Account, Customer, Supplier, JournalEntry, JournalEntryItem } from '../types';
import { Plus, Trash2, Save, AlertCircle, CheckCircle2, ArrowRightLeft, User, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const CreateJournalEntry: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSupplier] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    items: [
      { account_id: '', account_name: '', debit: 0, credit: 0, description: '', customer_id: '', supplier_id: '' },
      { account_id: '', account_name: '', debit: 0, credit: 0, description: '', customer_id: '', supplier_id: '' }
    ]
  });

  useEffect(() => {
    if (user) {
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSupplier);
      setLoading(false);
      return () => {
        unsubAccounts();
        unsubCustomers();
        unsubSuppliers();
      };
    }
  }, [user]);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { account_id: '', account_name: '', debit: 0, credit: 0, description: '', customer_id: '', supplier_id: '' }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 2) {
      showNotification('يجب أن يحتوي القيد على سطرين على الأقل', 'error');
      return;
    }
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items] as any;
    newItems[index][field] = value;

    if (field === 'account_id') {
      const account = accounts.find(a => a.id === value);
      newItems[index].account_name = account?.name || '';
      // Reset entity selections when account changes
      newItems[index].customer_id = '';
      newItems[index].supplier_id = '';
    }

    setFormData({ ...formData, items: newItems });
  };

  const totalDebit = formData.items.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
  const totalCredit = formData.items.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (totalDebit === 0 || totalCredit === 0) {
      showNotification('يجب إدخال مبالغ في القيد', 'error');
      return;
    }

    if (totalDebit !== totalCredit) {
      showNotification('القيد غير متزن (إجمالي المدين يجب أن يساوي إجمالي الدائن)', 'error');
      return;
    }

    // Validate customer/supplier selection
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      const account = accounts.find(a => a.id === item.account_id);
      if (account) {
        if (account.name.includes('عملاء') && !item.customer_id) {
          showNotification(`يرجى اختيار العميل في السطر رقم ${i + 1}`, 'error');
          return;
        }
        if (account.name.includes('موردين') && !item.supplier_id) {
          showNotification(`يرجى اختيار المورد في السطر رقم ${i + 1}`, 'error');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const journalEntry: Omit<JournalEntry, 'id'> = {
        date: formData.date,
        description: formData.description,
        reference_id: 'manual',
        reference_type: 'manual',
        total_debit: totalDebit,
        total_credit: totalCredit,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id,
        items: formData.items.map(item => ({
          account_id: item.account_id,
          account_name: item.account_name,
          debit: Number(item.debit) || 0,
          credit: Number(item.credit) || 0,
          description: item.description || formData.description,
          customer_id: item.customer_id || undefined,
          customer_name: customers.find(c => c.id === item.customer_id)?.name || undefined,
          supplier_id: item.supplier_id || undefined,
          supplier_name: suppliers.find(s => s.id === item.supplier_id)?.name || undefined
        }))
      };

      const id = await dbService.add('journal_entries', journalEntry);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة قيد يومية', `إضافة قيد يومية يدوي رقم: ${id}`, 'journal_entries', id);
      
      showNotification('تم حفظ قيد اليومية بنجاح', 'success');
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        items: [
          { account_id: '', account_name: '', debit: 0, credit: 0, description: '', customer_id: '', supplier_id: '' },
          { account_id: '', account_name: '', debit: 0, credit: 0, description: '', customer_id: '', supplier_id: '' }
        ]
      });
    } catch (error) {
      console.error(error);
      showNotification('حدث خطأ أثناء حفظ القيد', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCustomerAccount = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name.includes('عملاء');
  };

  const isSupplierAccount = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name.includes('موردين');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">إضافة قيد يومية</h2>
          <p className="text-zinc-500 text-sm">تسجيل القيود المحاسبية اليدوية في النظام.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-zinc-700 mr-1">تاريخ القيد</label>
              <input
                required
                type="date"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-zinc-700 mr-1">البيان العام</label>
              <input
                required
                type="text"
                placeholder="وصف مختصر للقيد..."
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <div className="overflow-x-auto -mx-8 px-8">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="text-right border-b border-zinc-100">
                  <th className="py-4 px-2 font-black text-zinc-400 text-xs uppercase tracking-wider w-1/4">الحساب</th>
                  <th className="py-4 px-2 font-black text-zinc-400 text-xs uppercase tracking-wider w-1/6">مدين</th>
                  <th className="py-4 px-2 font-black text-zinc-400 text-xs uppercase tracking-wider w-1/6">دائن</th>
                  <th className="py-4 px-2 font-black text-zinc-400 text-xs uppercase tracking-wider">البيان</th>
                  <th className="py-4 px-2 font-black text-zinc-400 text-xs uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {formData.items.map((item, index) => (
                  <tr key={index} className="group hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4 px-2 space-y-2">
                      <select
                        required
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        value={item.account_id}
                        onChange={(e) => updateItem(index, 'account_id', e.target.value)}
                      >
                        <option value="">اختر الحساب...</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>{account.name} ({account.code})</option>
                        ))}
                      </select>
                      
                      {isCustomerAccount(item.account_id) && (
                        <div className="relative animate-in slide-in-from-top-2 duration-200">
                          <User className="absolute right-3 top-2.5 text-emerald-500" size={16} />
                          <select
                            required
                            className="w-full pr-10 pl-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-emerald-700"
                            value={item.customer_id}
                            onChange={(e) => updateItem(index, 'customer_id', e.target.value)}
                          >
                            <option value="">اختر العميل...</option>
                            {customers.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {isSupplierAccount(item.account_id) && (
                        <div className="relative animate-in slide-in-from-top-2 duration-200">
                          <Truck className="absolute right-3 top-2.5 text-blue-500" size={16} />
                          <select
                            required
                            className="w-full pr-10 pl-3 py-2 bg-blue-50 border border-blue-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-blue-700"
                            value={item.supplier_id}
                            onChange={(e) => updateItem(index, 'supplier_id', e.target.value)}
                          >
                            <option value="">اختر المورد...</option>
                            {suppliers.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-2">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-emerald-600"
                        value={item.debit || ''}
                        onChange={(e) => updateItem(index, 'debit', e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                    <td className="py-4 px-2">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-red-600"
                        value={item.credit || ''}
                        onChange={(e) => updateItem(index, 'credit', e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                    <td className="py-4 px-2">
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        placeholder="بيان السطر..."
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                    </td>
                    <td className="py-4 px-2">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-zinc-100">
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
            >
              <Plus size={20} />
              إضافة سطر جديد
            </button>

            <div className="flex items-center gap-8 bg-zinc-50 px-8 py-4 rounded-3xl border border-zinc-100">
              <div className="text-center">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">إجمالي المدين</p>
                <p className="text-xl font-black text-emerald-600">{totalDebit.toLocaleString()}</p>
              </div>
              <div className="w-px h-8 bg-zinc-200" />
              <div className="text-center">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">إجمالي الدائن</p>
                <p className="text-xl font-black text-red-600">{totalCredit.toLocaleString()}</p>
              </div>
              <div className="w-px h-8 bg-zinc-200" />
              <div className="text-center">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">الفرق</p>
                <p className={`text-xl font-black ${difference === 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                  {difference.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          {difference !== 0 && (
            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-4 py-2 rounded-xl text-sm font-bold animate-pulse">
              <AlertCircle size={18} />
              <span>القيد غير متزن حالياً</span>
            </div>
          )}
          {difference === 0 && totalDebit > 0 && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl text-sm font-bold">
              <CheckCircle2 size={18} />
              <span>القيد متزن وجاهز للحفظ</span>
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting || difference !== 0 || totalDebit === 0}
            className="flex items-center gap-2 px-10 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            حفظ قيد اليومية
          </button>
        </div>
      </form>
    </div>
  );
};
