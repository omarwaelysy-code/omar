import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { dbService } from '../services/dbService';
import { Account, Customer, Supplier, JournalEntry, JournalEntryItem } from '../types';
import { Plus, Trash2, Save, AlertCircle, CheckCircle2, ArrowRightLeft, User, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '../utils/formatUtils';

export const CreateJournalEntry: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSupplier] = useState<Supplier[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference_number: '',
    items: [
      { account_id: '', account_name: '', debit: 0, credit: 0, description: '', sub_account_id: '', sub_account_type: undefined },
      { account_id: '', account_name: '', debit: 0, credit: 0, description: '', sub_account_id: '', sub_account_type: undefined }
    ]
  });

  // Dynamic Sub-account Options
  const subAccounts = [
    ...customers.map(c => ({ id: c.id, name: c.name, type: 'customer' as const, label: `عميل: ${c.name}` })),
    ...suppliers.map(s => ({ id: s.id, name: s.name, type: 'supplier' as const, label: `مورد: ${s.name}` })),
    ...paymentMethods.map(p => ({ id: p.id, name: p.name, type: 'payment_method' as const, label: `خزينة/بنك: ${p.name}` }))
  ];

  useEffect(() => {
    if (user) {
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSupplier);
      const unsubPMs = dbService.subscribe<any>('payment_methods', user.company_id, setPaymentMethods);
      setLoading(false);
      return () => {
        unsubAccounts();
        unsubCustomers();
        unsubSuppliers();
        unsubPMs();
      };
    }
  }, [user]);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { account_id: '', account_name: '', debit: 0, credit: 0, description: '', sub_account_id: '', sub_account_type: undefined }]
    } as any);
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
      newItems[index].sub_account_id = '';
      newItems[index].sub_account_type = undefined;
      newItems[index].customer_id = '';
      newItems[index].supplier_id = '';
      
      console.log(`[ERP] Account Selected: ${account?.name}, Required Sub: ${account?.required_sub_account}`);
    }

    if (field === 'sub_account_id') {
       const subAccount = subAccounts.find(s => s.id === value);
       newItems[index].sub_account_type = subAccount?.type;
       
       // Maintain backward compatibility for columns
       if (subAccount?.type === 'customer') {
          newItems[index].customer_id = subAccount.id;
          newItems[index].supplier_id = '';
       } else if (subAccount?.type === 'supplier') {
          newItems[index].customer_id = '';
          newItems[index].supplier_id = subAccount.id;
       } else {
          newItems[index].customer_id = '';
          newItems[index].supplier_id = '';
       }
       
       console.log(`[ERP] Sub-account Selected: ${subAccount?.name}, Type: ${subAccount?.type}`);
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
      const item = formData.items[i] as any;
      const account = accounts.find(a => a.id === item.account_id);
      if (account) {
        if (account.required_sub_account && !item.sub_account_id) {
          showNotification(`يرجى اختيار الحساب الفرعي في السطر رقم ${i + 1}`, 'error');
          return;
        }
      }
    }

    setIsSubmitting(true);
    console.log('[ERP] Submitting Journal Entry:', JSON.stringify(formData, null, 2));
    
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
        items: formData.items.map((item: any) => ({
          account_id: item.account_id,
          account_name: item.account_name,
          debit: Number(item.debit) || 0,
          credit: Number(item.credit) || 0,
          description: item.description || formData.description,
          customer_id: item.customer_id || undefined,
          customer_name: customers.find(c => c.id === item.customer_id)?.name || undefined,
          supplier_id: item.supplier_id || undefined,
          supplier_name: suppliers.find(s => s.id === item.supplier_id)?.name || undefined,
          sub_account_id: item.sub_account_id || undefined,
          sub_account_type: item.sub_account_type || undefined
        }))
      };

      const id = await dbService.add('journal_entries', journalEntry);
      console.log('[ERP] Journal Entry Saved Successfully. ID:', id);

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة قيد يومية', `إضافة قيد يومية يدوي رقم: ${id}`, 'journal_entries', id);
      
      showNotification('تم حفظ قيد اليومية بنجاح', 'success');
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        items: [
          { account_id: '', account_name: '', debit: 0, credit: 0, description: '', sub_account_id: '', sub_account_type: undefined },
          { account_id: '', account_name: '', debit: 0, credit: 0, description: '', sub_account_id: '', sub_account_type: undefined }
        ]
      } as any);
    } catch (error) {
      console.error(error);
      showNotification('حدث خطأ أثناء حفظ القيد', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsSubAccount = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.required_sub_account || false;
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
                <tr className="text-right border-b border-zinc-100 uppercase tracking-widest text-[10px]">
                  <th className="py-4 px-2 font-black text-zinc-400 w-1/4">الحساب</th>
                  <th className="py-4 px-2 font-black text-zinc-400 w-32 text-center">مدين</th>
                  <th className="py-4 px-2 font-black text-zinc-400 w-32 text-center">دائن</th>
                  <th className="py-4 px-2 font-black text-zinc-400">البيان</th>
                  <th className="py-4 px-2 font-black text-zinc-400 w-10"></th>
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
                      
                      {needsSubAccount(item.account_id) && (
                        <div className="relative animate-in slide-in-from-top-2 duration-200">
                          <User className="absolute right-3 top-2.5 text-emerald-500" size={16} />
                          <select
                            required
                            className="w-full pr-10 pl-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-emerald-700"
                            value={item.sub_account_id}
                            onChange={(e) => updateItem(index, 'sub_account_id', e.target.value)}
                          >
                            <option value="">اختر الحساب الفرعي...</option>
                            {subAccounts.map(sa => (
                              <option key={sa.id} value={sa.id}>{sa.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-2">
                      <input
                        type="number"
                        step="any"
                        className="w-full px-3 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-emerald-600 text-center shadow-sm"
                        value={item.debit || ''}
                        onChange={(e) => updateItem(index, 'debit', e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                    <td className="py-4 px-2">
                      <input
                        type="number"
                        step="any"
                        className="w-full px-3 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-red-600 text-center shadow-sm"
                        value={item.credit || ''}
                        onChange={(e) => updateItem(index, 'credit', e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                    <td className="py-4 px-2">
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm shadow-sm"
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
                <p className="text-xl font-black text-emerald-600">{formatNumber(totalDebit)}</p>
              </div>
              <div className="w-px h-8 bg-zinc-200" />
              <div className="text-center">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">إجمالي الدائن</p>
                <p className="text-xl font-black text-red-600">{formatNumber(totalCredit)}</p>
              </div>
              <div className="w-px h-8 bg-zinc-200" />
              <div className="text-center">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">الفرق</p>
                <p className={`text-xl font-black ${difference === 0 ? 'text-emerald-500' : 'text-emerald-500'}`}>
                  {formatNumber(difference)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          {difference !== 0 && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl text-sm font-bold animate-pulse">
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
