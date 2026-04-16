import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Customer, Account, JournalEntry, JournalEntryItem } from '../types';
import { Search, Plus, Trash2, X, Tag, User, Calendar, Save, Wallet, CreditCard, History, BookOpen, Phone, Mail, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { SmartAIInput } from '../components/SmartAIInput';
import { ActivityLog } from '../types';

export const CustomerDiscounts: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const [discountToDelete, setDiscountToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    mobile: '', 
    address: '', 
    email: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: ''
  });
  
  const [discountData, setDiscountData] = useState({
    customer_id: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    account_id: '',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubDiscounts = dbService.subscribe<any>('customer_discounts', user.company_id, setDiscounts);
      
      const fetchSettings = async () => {
        const docs = await dbService.getDocsByFilter<any>('settings', user.company_id, [
          { field: 'type', operator: '==', value: 'discount_settings' }
        ]);
        if (docs.length > 0) {
          setSettings(docs[0]);
          setDiscountData(prev => ({ ...prev, account_id: docs[0].customer_discount_account_id || '' }));
        }
      };

      fetchSettings();
      setLoading(false);
      return () => {
        unsubCustomers();
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

      const customer = customers.find(c => c.id === discountData.customer_id);
      const discount_number = 'CDISC-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة خصم عميل',
        details: `إضافة خصم جديد للعميل ${customer?.name || '...'} بمبلغ ${discountData.amount.toLocaleString()}`,
        timestamp: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Selected Account (or Sales Discount Account)
      const debitAccount = accounts.find(a => a.id === discountData.account_id) || 
                          accounts.find(a => a.name.includes('خصم مسموح به') || a.name.includes('خصومات مبيعات'));
      const debitAccountId = debitAccount?.id || 'sales_discount_account_default';
      const debitAccountName = debitAccount?.name || 'حساب الخصم المسموح به (افتراضي)';

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: discountData.amount,
        credit: 0,
        description: `خصم مسموح به رقم ${discount_number} - ${customer?.name || '...'}`
      });

      // Credit: Customer
      let creditAccountId = customer?.account_id || '';
      let creditAccountName = customer?.account_name || '';
      
      if (!creditAccountId) {
        const fallbackAccount = accounts.find(a => a.name.includes('عملاء'));
        creditAccountId = fallbackAccount?.id || 'customers_account_default';
        creditAccountName = fallbackAccount?.name || 'حساب العملاء (افتراضي)';
      }

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: discountData.amount,
        description: `خصم مسموح به رقم ${discount_number} - ${customer?.name || '...'}`
      });

      setPreviewJournalEntry({
        id: 'preview',
        date: discountData.date,
        reference_number: discount_number,
        reference_id: 'preview',
        reference_type: 'customer_discount',
        description: `قيد خصم مسموح به رقم ${discount_number}`,
        items: journalItems,
        total_debit: discountData.amount,
        total_credit: discountData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, discountData, user, customers, accounts]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `CUST-${Date.now().toString().slice(-6)}`;
      const selectedAccount = accounts.find(a => a.id === newCustomer.account_id);
      const dataToSave = {
        ...newCustomer,
        code,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };
      const id = await dbService.add('customers', dataToSave);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة عميل', `إضافة عميل جديد من شاشة الخصومات: ${newCustomer.name}`, ['customers', 'discounts']);
      
      setDiscountData({ ...discountData, customer_id: id });
      setIsCustomerModalOpen(false);
      setNewCustomer({ 
        name: '', 
        mobile: '', 
        address: '', 
        email: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: ''
      });
      showNotification('تم إضافة العميل بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة العميل', 'error');
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
      const customer = customers.find(c => c.id === discountData.customer_id);
      const number = `CDISC-${Date.now().toString().slice(-6)}`;
      
      const data = {
        ...discountData,
        customer_name: customer?.name || '',
        number,
        company_id: user.company_id
      };

      const id = await dbService.add('customer_discounts', data);

      // Create Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Selected Account
      const discountAccount = accounts.find(a => a.id === discountData.account_id) || 
                              accounts.find(a => a.name.includes('خصم مسموح به') || a.name.includes('خصومات مسموح بها'));
      const debitAccountId = discountAccount?.id || 'discount_allowed_default';
      const debitAccountName = discountAccount?.name || 'حساب الخصم المسموح به (افتراضي)';

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: discountData.amount,
        credit: 0,
        description: `خصم مسموح به للعميل: ${customer?.name} - رقم ${number}`
      });

      // Credit: Customer Account
      let creditAccountId = customer?.account_id || '';
      let creditAccountName = customer?.account_name || '';

      if (!creditAccountId) {
        const fallbackAccount = accounts.find(a => a.name.includes('عملاء'));
        creditAccountId = fallbackAccount?.id || 'customers_account_default';
        creditAccountName = fallbackAccount?.name || 'حساب العملاء (افتراضي)';
      }

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: discountData.amount,
        description: `خصم مسموح به رقم ${number}`,
        customer_id: discountData.customer_id,
        customer_name: customer?.name
      });

      if (journalItems.length > 0) {
        const journalEntry: Omit<JournalEntry, 'id'> = {
          date: discountData.date,
          reference_number: number,
          reference_id: id,
          reference_type: 'customer_discount',
          description: `قيد خصم مسموح به رقم ${number}`,
          items: journalItems,
          total_debit: discountData.amount,
          total_credit: discountData.amount,
          company_id: user.company_id,
          created_at: new Date().toISOString(),
          created_by: user.id
        };
        await dbService.createJournalEntry(journalEntry);
      }

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة خصم عميل', `إضافة خصم للعميل: ${customer?.name} بمبلغ: ${discountData.amount}`, 'customer_discounts', id);
      
      showNotification('تم حفظ الخصم بنجاح');
      setDiscountData({
        customer_id: '',
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        account_id: settings?.customer_discount_account_id || '',
        notes: ''
      });
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء الاتصال بالخادم', 'error');
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
      
      await dbService.delete('customer_discounts', discountToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف خصم عميل', `حذف خصم للعميل: ${disc?.customer_name} بمبلغ: ${disc?.amount}`);
      setIsDeleteModalOpen(false);
      setDiscountToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredDiscounts = discounts.filter(d => 
    d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">خصم العملاء</h2>
          <p className="text-zinc-500">إدارة الخصومات الممنوحة للعملاء.</p>
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
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-[rgba(16,185,129,0.2)]"
          >
            <Plus size={20} />
            إضافة خصم لعميل
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
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-[rgba(244,244,245,0.5)] text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">العميل</th>
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
                  <td className="px-6 py-4 font-bold text-zinc-900">{discount.customer_name}</td>
                  <td className="px-6 py-4 text-zinc-500">{discount.date}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">{discount.amount.toLocaleString()} ج.م</td>
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
                  <div className="font-bold text-zinc-900 text-lg">{discount.customer_name}</div>
                  <div className="text-zinc-500 text-sm flex items-center gap-1">
                    <Calendar size={14} />
                    {discount.date}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-emerald-600 text-lg">{discount.amount.toLocaleString()} ج.م</div>
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
                <h3 className="text-2xl font-bold text-zinc-900 italic serif">إضافة خصم لعميل</h3>
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
                          category="customer_discounts" 
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
                    if (data.customerName) {
                      const customer = customers.find(c => c.name.includes(data.customerName!) || data.customerName!.includes(c.name));
                      if (customer) {
                        setDiscountData(prev => ({ ...prev, customer_id: customer.id }));
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
                  <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">العميل</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <select 
                      required
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                      value={discountData.customer_id}
                      onChange={(e) => {
                        if (e.target.value === 'new') {
                          setIsCustomerModalOpen(true);
                        } else {
                          setDiscountData({...discountData, customer_id: e.target.value});
                        }
                      }}
                    >
                      <option value="">اختر العميل...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                      <option value="new" className="font-bold text-emerald-600">+ إضافة عميل جديد...</option>
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
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
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
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                  placeholder="سبب الخصم أو أي ملاحظات إضافية..."
                  value={discountData.notes}
                  onChange={(e) => setDiscountData({...discountData, notes: e.target.value})}
                />
              </div>

              <div className="flex justify-end pt-6 border-t border-zinc-100">
                <button 
                  type="submit"
                  className="flex items-center gap-3 px-12 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-[rgba(16,185,129,0.2)] active:scale-95"
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

      {/* Add Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة عميل جديد</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleAddCustomer} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم العميل</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
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
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        value={newCustomer.mobile}
                        onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={2}
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رصيد أول</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={newCustomer.opening_balance}
                          onChange={(e) => setNewCustomer({ ...newCustomer, opening_balance: Number(e.target.value) })}
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
                          value={newCustomer.opening_balance_date}
                          onChange={(e) => setNewCustomer({ ...newCustomer, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newCustomer.account_id}
                      onChange={(e) => setNewCustomer({ ...newCustomer, account_id: e.target.value })}
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
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ العميل
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
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
        category="customer_discounts"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
