import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Supplier, Account, JournalEntry, JournalEntryItem } from '../types';
import { Search, Plus, Trash2, X, Tag, Truck, Calendar, Save, Wallet, CreditCard, History, BookOpen, Phone, Mail, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { SmartAIInput } from '../components/SmartAIInput';
import { ActivityLog } from '../types';

export const SupplierDiscounts: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const [discountToDelete, setDiscountToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newSupplier, setNewSupplier] = useState({ 
    name: '', 
    mobile: '', 
    address: '', 
    email: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: ''
  });
  
  const [discountData, setDiscountData] = useState({
    supplier_id: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    account_id: '',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubDiscounts = dbService.subscribe<any>('supplier_discounts', user.company_id, setDiscounts);
      
      const fetchSettings = async () => {
        const docs = await dbService.getDocsByFilter<any>('settings', user.company_id, [
          { field: 'type', operator: '==', value: 'discount_settings' }
        ]);
        if (docs.length > 0) {
          setSettings(docs[0]);
          setDiscountData(prev => ({ ...prev, account_id: docs[0].supplier_discount_account_id || '' }));
        }
      };

      fetchSettings();
      setLoading(false);
      return () => {
        unsubSuppliers();
        unsubAccounts();
        unsubDiscounts();
      };
    }
  }, [user]);

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    const generatePreview = () => {
      if (discountData.amount <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const supplier = suppliers.find(s => s.id === discountData.supplier_id);
      const discount_number = 'SDISC-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة خصم مورد',
        details: `إضافة خصم جديد من المورد ${supplier?.name || '...'} بمبلغ ${discountData.amount.toLocaleString()}`,
        timestamp: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Supplier
      let debitAccountId = supplier?.account_id || '';
      let debitAccountName = supplier?.account_name || '';
      
      if (!debitAccountId) {
        const fallbackAccount = accounts.find(a => a.name.includes('موردين'));
        debitAccountId = fallbackAccount?.id || 'suppliers_account_default';
        debitAccountName = fallbackAccount?.name || 'حساب الموردين (افتراضي)';
      }

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: discountData.amount,
        credit: 0,
        description: `خصم مكتسب رقم ${discount_number} - ${supplier?.name || '...'}`
      });

      // Credit: Selected Account (or Purchase Discount Account)
      const creditAccount = accounts.find(a => a.id === discountData.account_id) || 
                           accounts.find(a => a.name.includes('خصم مكتسب') || a.name.includes('خصومات مشتريات'));
      const creditAccountId = creditAccount?.id || 'purchase_discount_account_default';
      const creditAccountName = creditAccount?.name || 'حساب الخصم المكتسب (افتراضي)';

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: discountData.amount,
        description: `خصم مكتسب رقم ${discount_number} - ${supplier?.name || '...'}`
      });

      setPreviewJournalEntry({
        id: 'preview',
        date: discountData.date,
        reference_number: discount_number,
        reference_id: 'preview',
        reference_type: 'supplier_discount',
        description: `قيد خصم مكتسب رقم ${discount_number}`,
        items: journalItems,
        total_debit: discountData.amount,
        total_credit: discountData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, discountData, user, suppliers, accounts]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `SUPP-${Date.now().toString().slice(-6)}`;
      const selectedAccount = accounts.find(a => a.id === newSupplier.account_id);
      const dataToSave = {
        ...newSupplier,
        code,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };
      const id = await dbService.add('suppliers', dataToSave);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مورد', `إضافة مورد جديد من شاشة الخصومات: ${newSupplier.name}`, ['suppliers', 'discounts']);
      
      setDiscountData({ ...discountData, supplier_id: id });
      setIsSupplierModalOpen(false);
      setNewSupplier({ 
        name: '', 
        mobile: '', 
        address: '', 
        email: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: ''
      });
      showNotification('تم إضافة المورد بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة المورد', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (discountData.amount <= 0) {
      showNotification('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === discountData.supplier_id);
      const number = `SDISC-${Date.now().toString().slice(-6)}`;
      
      const data = {
        ...discountData,
        supplier_name: supplier?.name || '',
        number,
        company_id: user.company_id
      };

      const id = await dbService.add('supplier_discounts', data);

      // Success notification and modal close early
      showNotification('تم إضافة الخصم بنجاح', 'success');
      setDiscountData({
        supplier_id: '',
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        account_id: settings?.supplier_discount_account_id || '',
        notes: ''
      });
      setIsModalOpen(false);

      // Background post-save hooks
      try {
        // Create Journal Entry
        const journalItems: JournalEntryItem[] = [];

        // Debit: Supplier Account
        let debitAccountId = supplier?.account_id || '';
        let debitAccountName = supplier?.account_name || '';

        if (!debitAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('موردين'));
          debitAccountId = fallbackAccount?.id || 'suppliers_account_default';
          debitAccountName = fallbackAccount?.name || 'حساب الموردين (افتراضي)';
        }

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: discountData.amount,
          credit: 0,
          description: `خصم مكتسب من المورد: ${supplier?.name} - رقم ${number}`,
          supplier_id: discountData.supplier_id,
          supplier_name: supplier?.name
        });

        // Credit: Selected Account
        const discountAccount = accounts.find(a => a.id === discountData.account_id) || 
                                accounts.find(a => a.name.includes('خصم مكتسب') || a.name.includes('خصومات مكتسبة'));
        const creditAccountId = discountAccount?.id || 'discount_received_default';
        const creditAccountName = discountAccount?.name || 'حساب الخصم المكتسب (افتراضي)';

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: discountData.amount,
          description: `خصم مكتسب رقم ${number}`
        });

        if (journalItems.length > 0) {
          const journalEntry: Omit<JournalEntry, 'id'> = {
            date: discountData.date,
            reference_number: number,
            reference_id: id,
            reference_type: 'supplier_discount',
            description: `قيد خصم مكتسب رقم ${number}`,
            items: journalItems,
            total_debit: discountData.amount,
            total_credit: discountData.amount,
            company_id: user.company_id,
            created_at: new Date().toISOString(),
            created_by: user.id
          };
          await dbService.createJournalEntry(journalEntry);
        }

        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة خصم مورد', `إضافة خصم للمورد: ${supplier?.name} بمبلغ: ${discountData.amount}`, 'supplier_discounts', id);
      } catch (postError) {
        console.error('Post-save operations failed:', postError);
      }
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حفظ البيانات', 'error');
    }

  };

  const handleDelete = (id: string) => {
    setDiscountToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!discountToDelete || !user) return;
    try {
      const disc = discounts.find(d => d.id === discountToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(discountToDelete, user.company_id);
      
      await dbService.delete('supplier_discounts', discountToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف خصم مورد', `حذف خصم للمورد: ${disc?.supplier_name} بمبلغ: ${disc?.amount}`);
      setIsDeleteModalOpen(false);
      setDiscountToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredDiscounts = discounts.filter(d => 
    d.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">خصم الموردين</h2>
          <p className="text-zinc-500">إدارة الخصومات المكتسبة من الموردين.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-zinc-200 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <History size={20} />
            سجل النشاط
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-[rgba(245,158,11,0.2)]"
          >
            <Plus size={20} />
            إضافة خصم من مورد
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="البحث عن خصومات..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-[rgba(244,244,245,0.5)] text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">المورد</th>
                <th className="px-6 py-4 font-bold">التاريخ</th>
                <th className="px-6 py-4 font-bold">المبلغ</th>
                <th className="px-6 py-4 font-bold">ملاحظات</th>
                <th className="px-6 py-4 font-bold text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredDiscounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد خصومات حالياً</td>
                </tr>
              ) : filteredDiscounts.map((discount) => (
                <tr key={discount.id} className="hover:bg-[rgba(244,244,245,0.5)] transition-colors group">
                  <td className="px-6 py-4 font-bold text-zinc-900">{discount.supplier_name}</td>
                  <td className="px-6 py-4 text-zinc-500">{discount.date}</td>
                  <td className="px-6 py-4 font-bold text-amber-600">{discount.amount.toLocaleString()} ج.م</td>
                  <td className="px-6 py-4 text-zinc-500 text-sm">{discount.notes || '-'}</td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setActivityLogDocumentId(discount.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                        title="سجل النشاط"
                      >
                        <History size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(discount.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-50">
          {filteredDiscounts.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-400 italic">لا توجد خصومات حالياً</div>
          ) : filteredDiscounts.map((discount) => (
            <div key={discount.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-zinc-900 text-lg">{discount.supplier_name}</div>
                  <div className="text-zinc-500 text-sm flex items-center gap-1">
                    <Calendar size={14} />
                    {discount.date}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-amber-600 text-lg">{discount.amount.toLocaleString()} ج.م</div>
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button 
                      onClick={() => {
                        setActivityLogDocumentId(discount.id);
                        setIsActivityLogOpen(true);
                      }}
                      className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                      title="سجل النشاط"
                    >
                      <History size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(discount.id)}
                      className="p-2 text-red-500 bg-red-50 rounded-xl transition-all inline-flex items-center justify-center"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
              {discount.notes && (
                <div className="bg-zinc-50 p-3 rounded-xl text-zinc-600 text-sm italic">
                  {discount.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[rgba(24,24,27,0.6)] backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4 overflow-y-auto">
          <div className="bg-white rounded-none md:rounded-3xl w-full max-w-5xl min-h-screen md:min-h-0 shadow-2xl animate-in zoom-in-95 duration-200 my-auto flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-bold text-zinc-900 italic serif">إضافة خصم من مورد</h3>
                <button 
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showSidePanel ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'}`}
                >
                  <History size={14} />
                  {showSidePanel ? 'إخفاء القيد والسجل' : 'قيد اليومية'}
                </button>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full relative">
              {/* Side Panel for Activity Log and Journal Entry */}
              <AnimatePresence>
                {showSidePanel && (
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="absolute inset-y-0 left-0 z-50 w-full lg:w-80 shadow-2xl lg:shadow-none lg:relative lg:inset-auto"
                  >
                    <div className="h-full bg-white border-r border-zinc-100 flex flex-col">
                      <div className="p-4 border-b border-zinc-100 flex items-center justify-between lg:hidden">
                        <h3 className="font-bold text-zinc-900">سجل النشاط والقيد</h3>
                        <button onClick={() => setShowSidePanel(false)} className="p-2 text-zinc-400 hover:text-zinc-600">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <TransactionSidePanel 
                          category="supplier_discounts" 
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="flex-1 p-6 md:p-8 space-y-6 pb-24 md:pb-8 overflow-y-auto">
                <SmartAIInput 
                  onDataExtracted={(data) => {
                    if (data.supplierName) {
                      const supplier = suppliers.find(s => s.name.includes(data.supplierName!) || data.supplierName!.includes(s.name));
                      if (supplier) {
                        setDiscountData(prev => ({ ...prev, supplier_id: supplier.id }));
                      }
                    }
                    if (data.amount) setDiscountData(prev => ({ ...prev, amount: data.amount! }));
                    if (data.date) setDiscountData(prev => ({ ...prev, date: data.date! }));
                    if (data.description || data.notes) setDiscountData(prev => ({ ...prev, notes: data.description || data.notes || '' }));
                  }}
                  transactionType="discount"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">المورد</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <select 
                      required
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all appearance-none"
                      value={discountData.supplier_id}
                      onChange={(e) => {
                        if (e.target.value === 'new') {
                          setIsSupplierModalOpen(true);
                        } else {
                          setDiscountData({...discountData, supplier_id: e.target.value});
                        }
                      }}
                    >
                      <option value="">اختر المورد...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                      <option value="new" className="font-bold text-amber-600">+ إضافة مورد جديد...</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">التاريخ</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <input 
                      required
                      type="date" 
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      value={discountData.date}
                      onChange={(e) => setDiscountData({...discountData, date: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">قيمة الخصم</label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      placeholder="0.00"
                      value={discountData.amount || ''}
                      onChange={(e) => setDiscountData({...discountData, amount: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">الحساب المالي (الخصم)</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <select 
                      required
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all appearance-none"
                      value={discountData.account_id}
                      onChange={(e) => setDiscountData({...discountData, account_id: e.target.value})}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">ملاحظات</label>
                <textarea 
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none"
                  placeholder="سبب الخصم أو أي ملاحظات إضافية..."
                  value={discountData.notes}
                  onChange={(e) => setDiscountData({...discountData, notes: e.target.value})}
                />
              </div>

              <div className="flex justify-end pt-6 border-t border-zinc-100">
                <button 
                  type="submit"
                  className="flex items-center gap-3 px-12 py-4 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-xl shadow-[rgba(245,158,11,0.2)] active:scale-95"
                >
                  <Save size={24} />
                  حفظ الخصم
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}

      {/* Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة مورد جديد</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleAddSupplier} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم المورد</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                        value={newSupplier.name}
                        onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="tel"
                        pattern="[0-9]{11,}"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all text-left"
                        value={newSupplier.mobile}
                        onChange={(e) => setNewSupplier({ ...newSupplier, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all text-left"
                        value={newSupplier.email}
                        onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      rows={2}
                      value={newSupplier.address}
                      onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رصيد أول</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                          value={newSupplier.opening_balance}
                          onChange={(e) => setNewSupplier({ ...newSupplier, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="date" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                          value={newSupplier.opening_balance_date}
                          onChange={(e) => setNewSupplier({ ...newSupplier, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      value={newSupplier.account_id}
                      onChange={(e) => setNewSupplier({ ...newSupplier, account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    حفظ المورد
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">تأكيد الحذف</h3>
            <p className="text-zinc-500 mb-6">هل أنت متأكد من رغبتك في حذف هذا الخصم؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDiscountToDelete(null);
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
        category="supplier_discounts"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
