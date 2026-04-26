import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { TransactionManager } from '../services/TransactionManager';
import { CashTransferSchema, JournalEntrySchema } from '../lib/schemas';
import { CashTransfer, PaymentMethod, JournalEntry, JournalEntryItem, Account, ActivityLog } from '../types';
import { 
  Search, Plus, Trash2, X, ArrowLeftRight, Pencil, 
  Download, Eye, FileText, History, Printer, 
  Wallet, Calendar, Hash, Layers, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { SmartAIInput } from '../components/SmartAIInput';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';

export const CashTransfers: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [transfers, setTransfers] = useState<CashTransfer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<CashTransfer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState<string | null>(null);
  const [viewTransfer, setViewTransfer] = useState<CashTransfer | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const transferRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Add Payment Method Modal State
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [paymentMethodFormData, setPaymentMethodFormData] = useState({
    code: '',
    name: '',
    type: 'cash' as 'cash' | 'bank' | 'wallet',
    account_id: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    counter_account_id: '',
    details: ''
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    from_payment_method_id: '',
    to_payment_method_id: '',
    description: ''
  });

  useEffect(() => {
    if (user) {
      const unsubTransfers = dbService.subscribe<CashTransfer>('cash_transfers', user.company_id, setTransfers);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      
      setLoading(false);
      return () => {
        unsubTransfers();
        unsubPM();
        unsubAccounts();
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
      if (formData.amount <= 0 || !formData.from_payment_method_id || !formData.to_payment_method_id) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const fromPM = paymentMethods.find(pm => pm.id === formData.from_payment_method_id);
      const toPM = paymentMethods.find(pm => pm.id === formData.to_payment_method_id);

      if (!fromPM || !toPM) return;

      const journalItems: JournalEntryItem[] = [
        {
          account_id: toPM.account_id || '',
          account_name: toPM.account_name || toPM.name,
          debit: formData.amount,
          credit: 0,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${formData.description ? ': ' + formData.description : ''}`
        },
        {
          account_id: fromPM.account_id || '',
          account_name: fromPM.account_name || fromPM.name,
          debit: 0,
          credit: formData.amount,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${formData.description ? ': ' + formData.description : ''}`
        }
      ];

      setPreviewJournalEntry({
        id: 'preview',
        date: formData.date,
        description: `قيد تحويل نقدية${formData.description ? ': ' + formData.description : ''}`,
        reference_id: editingTransfer?.id || 'new',
        reference_type: 'cash_transfer',
        items: journalItems,
        total_debit: formData.amount,
        total_credit: formData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });

      setPreviewActivityLog({
        action: editingTransfer ? 'تعديل تحويل نقدية' : 'إضافة تحويل نقدية',
        details: `تحويل مبلغ ${formData.amount} من ${fromPM.name} إلى ${toPM.name}`,
        category: ['cash_transfers', 'journal_entries']
      });
    };

    generatePreview();
  }, [isModalOpen, formData, user, paymentMethods, editingTransfer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.from_payment_method_id === formData.to_payment_method_id) {
      showNotification('لا يمكن التحويل لنفس الخزينة', 'error');
      return;
    }

    if (formData.amount <= 0) {
      showNotification('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    try {
      const fromPM = paymentMethods.find(pm => pm.id === formData.from_payment_method_id);
      const toPM = paymentMethods.find(pm => pm.id === formData.to_payment_method_id);

      if (!fromPM || !toPM) {
        showNotification('يرجى اختيار الخزائن بشكل صحيح', 'error');
        return;
      }

      const data = {
        date: formData.date,
        amount: formData.amount,
        description: formData.description,
        from_payment_method_id: formData.from_payment_method_id,
        to_payment_method_id: formData.to_payment_method_id,
        from_payment_method_name: fromPM?.name || '',
        to_payment_method_name: toPM?.name || '',
        company_id: user.company_id,
        created_at: editingTransfer ? editingTransfer.created_at : new Date().toISOString(),
        created_by: editingTransfer ? editingTransfer.created_by : user.id
      };

      const journalItems = [
        {
          account_id: toPM.account_id || '',
          account_name: toPM.account_name || toPM.name || '',
          debit: formData.amount,
          credit: 0,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${formData.description ? ': ' + formData.description : ''}`
        },
        {
          account_id: fromPM.account_id || '',
          account_name: fromPM.account_name || fromPM.name || '',
          debit: 0,
          credit: formData.amount,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${formData.description ? ': ' + formData.description : ''}`
        }
      ];

      const journalEntryData = {
        date: formData.date,
        description: `قيد تحويل نقدية${formData.description ? ': ' + formData.description : ''}`,
        reference_type: 'cash_transfer',
        items: journalItems,
        total_debit: formData.amount,
        total_credit: formData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingTransfer) {
        await dbService.deleteJournalEntryByReference(editingTransfer.id, user.company_id);
      }

      await TransactionManager.saveWithAccounting(
        'cash_transfers',
        data,
        CashTransferSchema,
        journalEntryData,
        JournalEntrySchema
      );

      setIsModalOpen(false);
      setEditingTransfer(null);
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        from_payment_method_id: '',
        to_payment_method_id: '',
        description: ''
      });
      showNotification(editingTransfer ? 'تم تحديث التحويل بنجاح' : 'تم إضافة التحويل بنجاح', 'success');

      if (!editingTransfer) {
        dbService.logActivity(
          user.id,
          user.username,
          user.company_id,
          'إضافة تحويل نقدية',
          `تحويل مبلغ ${formData.amount} من ${fromPM.name} إلى ${toPM.name}`,
          ['cash_transfers', 'journal_entries']
        );
      }
    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || 'حدث خطأ أثناء حفظ التحويل', 'error');
    }
  };

  const handleDelete = async () => {
    if (!transferToDelete || !user) return;
    try {
      await dbService.delete('cash_transfers', transferToDelete);
      await dbService.deleteJournalEntryByReference(transferToDelete, user.company_id);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف تحويل نقدية', `حذف عملية تحويل نقدية رقم ${transferToDelete}`, ['cash_transfers', 'journal_entries']);
      setIsDeleteModalOpen(false);
      setTransferToDelete(null);
      showNotification('تم حذف التحويل بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حذف التحويل', 'error');
    }
  };

  const handlePaymentMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const selectedAccount = accounts.find(a => a.id === paymentMethodFormData.account_id);
      const pmId = await dbService.add('payment_methods', {
        ...paymentMethodFormData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      });
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من شاشة التحويلات: ${paymentMethodFormData.name}`, ['payment_methods', 'cash_transfers'], pmId);
      
      // Create journal entry for opening balance if not zero
      if (paymentMethodFormData.opening_balance !== 0 && paymentMethodFormData.account_id && paymentMethodFormData.counter_account_id) {
        const absBalance = Math.abs(paymentMethodFormData.opening_balance);
        const isNegative = paymentMethodFormData.opening_balance < 0;
        const counterAccount = accounts.find(a => a.id === paymentMethodFormData.counter_account_id);

        await dbService.add('journal_entries', {
          company_id: user.company_id,
          date: paymentMethodFormData.opening_balance_date,
          description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`,
          reference_id: pmId,
          reference_type: 'opening_balance',
          items: [
            {
              account_id: paymentMethodFormData.account_id,
              account_name: selectedAccount?.name || '',
              debit: isNegative ? 0 : absBalance,
              credit: isNegative ? absBalance : 0,
              description: 'رصيد افتتاحي'
            },
            {
              account_id: paymentMethodFormData.counter_account_id,
              account_name: counterAccount?.name || 'حساب الميزانية الافتتاحية',
              debit: isNegative ? absBalance : 0,
              credit: isNegative ? 0 : absBalance,
              description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`
            }
          ],
          total_debit: absBalance,
          total_credit: absBalance,
          created_at: new Date().toISOString(),
          created_by: user.id
        });
      }

      setIsPaymentMethodModalOpen(false);
      setPaymentMethodFormData({
        code: '',
        name: '',
        type: 'cash',
        account_id: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        counter_account_id: '',
        details: ''
      });
      showNotification('تم إضافة الخزينة بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة الخزينة', 'error');
    }
  };

  const filteredTransfers = transfers.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.from_payment_method_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.to_payment_method_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToPDF = async (transfer: CashTransfer) => {
    // Logic for single transfer PDF if needed
  };

  const handleExportExcel = () => {
    const headers = {
      'date': 'التاريخ',
      'from_payment_method_name': 'من خزينة',
      'to_payment_method_name': 'إلى خزينة',
      'amount': 'المبلغ',
      'description': 'الوصف'
    };
    const formattedData = formatDataForExcel(filteredTransfers, headers);
    exportToExcel(formattedData, { filename: 'Cash_Transfers', sheetName: 'تحويلات النقدية' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Cash_Transfers', 
        orientation: 'landscape',
        reportTitle: 'تقرير تحويلات النقدية'
      });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">جاري التحميل...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <ArrowLeftRight size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">التحويل بين الخزائن</h2>
            <p className="text-zinc-500 font-medium">إدارة عمليات تحويل النقدية بين الخزائن والحسابات البنكية</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons 
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
          />
          <button 
            onClick={() => {
              setEditingTransfer(null);
              setFormData({
                date: new Date().toISOString().slice(0, 10),
                amount: 0,
                from_payment_method_id: '',
                to_payment_method_id: '',
                description: ''
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            <span>تحويل جديد</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input 
              type="text" 
              placeholder="بحث في التحويلات..." 
              className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto" ref={tableRef}>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100">التاريخ</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100">من خزينة</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100">إلى خزينة</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100">المبلغ</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100">الوصف</th>
                <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredTransfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4 text-zinc-900 font-bold">{transfer.date}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                        <Wallet size={16} />
                      </div>
                      <span className="text-zinc-700 font-bold">{transfer.from_payment_method_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                        <Wallet size={16} />
                      </div>
                      <span className="text-zinc-700 font-bold">{transfer.to_payment_method_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-600 font-black">{transfer.amount.toLocaleString()} ج.م</span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 font-medium max-w-xs truncate">{transfer.description}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setViewTransfer(transfer);
                          setShowSidePanel(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                        title="عرض التفاصيل"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingTransfer(transfer);
                          setFormData({
                            date: transfer.date,
                            amount: transfer.amount,
                            from_payment_method_id: transfer.from_payment_method_id,
                            to_payment_method_id: transfer.to_payment_method_id,
                            description: transfer.description
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                        title="تعديل"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          setTransferToDelete(transfer.id);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="حذف"
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
      </div>

      {/* Add/Edit Transfer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                    <ArrowLeftRight size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">
                    {editingTransfer ? 'تعديل عملية تحويل' : 'عملية تحويل نقدية جديدة'}
                  </h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto">
                  <SmartAIInput 
                    onDataExtracted={(data) => {
                      if (data.amount) setFormData(prev => ({ ...prev, amount: data.amount! }));
                      if (data.date) setFormData(prev => ({ ...prev, date: data.date! }));
                      if (data.description) setFormData(prev => ({ ...prev, description: data.description! }));
                      if (data.fromAccount) {
                        const pm = paymentMethods.find(p => p.name.includes(data.fromAccount!) || data.fromAccount!.includes(p.name));
                        if (pm) setFormData(prev => ({ ...prev, from_payment_method_id: pm.id }));
                      }
                      if (data.toAccount) {
                        const pm = paymentMethods.find(p => p.name.includes(data.toAccount!) || data.toAccount!.includes(p.name));
                        if (pm) setFormData(prev => ({ ...prev, to_payment_method_id: pm.id }));
                      }
                    }}
                    transactionType="cash_transfer"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">التاريخ</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          required
                          type="date" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">المبلغ</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          min="0.01"
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-black text-emerald-600"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">من خزينة (المصدر)</label>
                        <button 
                          type="button"
                          onClick={() => setIsPaymentMethodModalOpen(true)}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <Plus size={12} />
                          إضافة خزينة
                        </button>
                      </div>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <select
                          required
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none font-bold"
                          value={formData.from_payment_method_id}
                          onChange={(e) => setFormData({ ...formData, from_payment_method_id: e.target.value })}
                        >
                          <option value="">اختر الخزينة المصدر...</option>
                          {paymentMethods.map(pm => (
                            <option key={pm.id} value={pm.id}>{pm.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">إلى خزينة (الوجهة)</label>
                        <button 
                          type="button"
                          onClick={() => setIsPaymentMethodModalOpen(true)}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <Plus size={12} />
                          إضافة خزينة
                        </button>
                      </div>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <select
                          required
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none font-bold"
                          value={formData.to_payment_method_id}
                          onChange={(e) => setFormData({ ...formData, to_payment_method_id: e.target.value })}
                        >
                          <option value="">اختر الخزينة الوجهة...</option>
                          {paymentMethods.map(pm => (
                            <option key={pm.id} value={pm.id}>{pm.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">الوصف</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <textarea 
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                  </div>

                  {previewJournalEntry && (
                    <JournalEntryPreview 
                      title="معاينة قيد التحويل"
                      items={previewJournalEntry.items}
                    />
                  )}

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Save size={20} />
                      <span>{editingTransfer ? 'تحديث التحويل' : 'حفظ التحويل'}</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>

                <div className="hidden md:block w-80 border-r border-zinc-100 bg-zinc-50/30 overflow-hidden">
                  <TransactionSidePanel 
                    documentId={editingTransfer?.id} 
                    category="cash_transfers"
                    previewJournalEntry={previewJournalEntry}
                    previewActivityLog={previewActivityLog}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">حذف التحويل؟</h3>
              <p className="text-zinc-500 mb-8 font-medium">هل أنت متأكد من حذف هذه العملية؟ سيتم حذف القيد المحاسبي المرتبط بها أيضاً.</p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all active:scale-95"
                >
                  نعم، احذف
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Payment Method Modal (Treasury) */}
      <AnimatePresence>
        {isPaymentMethodModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-zinc-900">إضافة خزينة جديدة</h3>
                <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
              </div>
              
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <form onSubmit={handlePaymentMethodSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">كود الخزينة</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input
                          required
                          type="text"
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                          value={paymentMethodFormData.code}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, code: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">اسم الخزينة</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input
                          required
                          type="text"
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                          value={paymentMethodFormData.name}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">النوع</label>
                      <div className="relative">
                        <Layers className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <select
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none font-bold"
                          value={paymentMethodFormData.type}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, type: e.target.value as any })}
                        >
                          <option value="cash">نقدي (خزينة)</option>
                          <option value="bank">بنكي</option>
                          <option value="wallet">محفظة إلكترونية</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">الحساب المحاسبي</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                        value={paymentMethodFormData.account_id}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, account_id: e.target.value })}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">الرصيد الافتتاحي</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                          value={paymentMethodFormData.opening_balance}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">تاريخ الرصيد</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="date" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                          value={paymentMethodFormData.opening_balance_date}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {paymentMethodFormData.opening_balance !== 0 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">حساب الطرف الآخر (للرصيد الافتتاحي)</label>
                        <select
                          required
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all border-emerald-200 bg-emerald-50/30 font-bold"
                          value={paymentMethodFormData.counter_account_id}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, counter_account_id: e.target.value })}
                        >
                          <option value="">اختر حساب الطرف الآخر...</option>
                          {accounts.map(account => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {paymentMethodFormData.counter_account_id && paymentMethodFormData.account_id && (
                        <JournalEntryPreview 
                          title="معاينة قيد الرصيد الافتتاحي"
                          items={[
                            {
                              account_name: accounts.find(a => a.id === paymentMethodFormData.account_id)?.name || 'حساب طريقة الدفع',
                              debit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                              credit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                              description: 'رصيد افتتاحي'
                            },
                            {
                              account_name: accounts.find(a => a.id === paymentMethodFormData.counter_account_id)?.name || 'حساب الطرف الآخر',
                              debit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                              credit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                              description: `رصيد افتتاحي للخزينة: ${paymentMethodFormData.name}`
                            }
                          ]}
                        />
                      )}
                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      حفظ الخزينة
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsPaymentMethodModalOpen(false)}
                      className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Side Panel for View */}
      <AnimatePresence>
        {showSidePanel && viewTransfer && (
          <div className="fixed inset-0 z-[110] flex justify-end bg-zinc-900/20 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">تفاصيل عملية التحويل</h3>
                <button onClick={() => setShowSidePanel(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="flex items-center justify-between p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                  <div>
                    <p className="text-sm font-bold text-zinc-500 uppercase tracking-tighter mb-1">المبلغ المحول</p>
                    <p className="text-3xl font-black text-emerald-600">{viewTransfer.amount.toLocaleString()} ج.م</p>
                  </div>
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                    <ArrowLeftRight size={32} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">من خزينة</p>
                    <p className="font-bold text-zinc-900">{viewTransfer.from_payment_method_name}</p>
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">إلى خزينة</p>
                    <p className="font-bold text-zinc-900">{viewTransfer.to_payment_method_name}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-zinc-600">
                    <Calendar size={18} className="text-zinc-400" />
                    <span className="font-bold">التاريخ: {viewTransfer.date}</span>
                  </div>
                  <div className="flex items-start gap-3 text-zinc-600">
                    <FileText size={18} className="text-zinc-400 mt-1" />
                    <div className="flex-1">
                      <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">الوصف</p>
                      <p className="font-medium leading-relaxed">{viewTransfer.description}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-100">
                  <h4 className="text-sm font-black text-zinc-900 mb-4 flex items-center gap-2">
                    <History size={16} className="text-emerald-500" />
                    سجل الحركات المرتبطة
                  </h4>
                  <InlineActivityLog category="cash_transfers" documentId={viewTransfer.id} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
