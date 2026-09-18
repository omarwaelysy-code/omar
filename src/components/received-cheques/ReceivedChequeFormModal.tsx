import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Save, Plus, Trash2, Calendar, User, FileText, Paperclip, 
  CheckCircle2, ShieldCheck, Layers, Building2, AlertCircle, 
  ArrowLeft, RefreshCw, Hash, DollarSign
} from 'lucide-react';
import { ReceivedCheque, Customer, PaymentMethod, Account, IssuedChequeAttachment } from '../../types';
import { receivedChequeService } from '../../services/receivedChequeService';
import { dbService } from '../../services/dbService';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { tafqeetAr } from '../../utils/tafqeet';
import { formatNumber } from '../../utils/formatUtils';
import { EGYPTIAN_BANKS_DATA } from '../../data/egyptianBanks';

interface ChequeRow {
  id: string;
  cheque_number: string;
  amount: string;
  due_date: string;
  is_crossed: boolean;
  is_not_negotiable: boolean;
  bank_name: string;
}

interface InvoiceSettlementRow {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  open_amount: number;
  settled_amount: number;
}

interface ReceivedChequeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customers: Customer[];
  paymentMethods: PaymentMethod[];
  accounts?: Account[];
  inline?: boolean;
  initialChequeType?: 'customer' | 'other';
  mode?: 'CUSTOMER' | 'OTHER' | 'customer' | 'other';
  chequeToEdit?: ReceivedCheque | null;
}

export const ReceivedChequeFormModal: React.FC<ReceivedChequeFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customers,
  paymentMethods,
  accounts = [],
  inline = false,
  initialChequeType = 'customer',
  mode,
  chequeToEdit
}) => {
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  const defaultType = mode ? (mode.toLowerCase() as 'customer' | 'other') : initialChequeType;
  const [chequeType, setChequeType] = useState<'customer' | 'other'>(defaultType);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [payerName, setPayerName] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<IssuedChequeAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Table of cheques
  const [chequeRows, setChequeRows] = useState<ChequeRow[]>([
    {
      id: crypto.randomUUID(),
      cheque_number: '',
      amount: '',
      due_date: new Date().toISOString().slice(0, 10),
      is_crossed: true,
      is_not_negotiable: true,
      bank_name: EGYPTIAN_BANKS_DATA[0]?.nameAr || 'البنك الأهلي المصري'
    }
  ]);

  // Sales Invoices & Customer Settlements
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [settlementRows, setSettlementRows] = useState<InvoiceSettlementRow[]>([]);

  // Existing Accounts from chart of accounts (NO NEW ACCOUNTS CREATED)
  const notesReceivableAccounts = useMemo(() => {
    return accounts.filter(a => 
      a.account_usage === 'notes_receivable' ||
      a.name?.includes('أوراق قبض') ||
      a.name?.includes('اوراق قبض') ||
      a.code === '110202'
    ).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [accounts]);

  const customerAccounts = useMemo(() => {
    return accounts.filter(a => 
      a.account_usage === 'customer' ||
      a.account_usage === 'accounts_receivable' ||
      a.name?.includes('عملاء') ||
      a.code === '110201'
    ).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [accounts]);

  const generalCreditAccounts = useMemo(() => {
    return accounts.filter(a => {
      const usage = a.account_usage || '';
      return usage !== 'notes_receivable' && usage !== 'bank' && usage !== 'main_cash';
    }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [accounts]);

  // Initialize defaults
  useEffect(() => {
    setChequeType(initialChequeType);
    if (!debitAccountId && notesReceivableAccounts.length > 0) {
      setDebitAccountId(notesReceivableAccounts[0].id);
    }
  }, [initialChequeType, notesReceivableAccounts]);

  // Generate sequence number on mount or date change
  useEffect(() => {
    if (!user?.company_id || chequeToEdit) return;
    const parts = receiveDate.split('-');
    const period = `${parts[0]}-${parts[1] || '01'}`;

    dbService.getNextSequence('received_cheques', receiveDate)
      .then(seq => setReceiptNumber(seq))
      .catch(() => {
        setReceiptNumber(`RCV-${period}-000001`);
      });
  }, [user?.company_id, receiveDate, chequeToEdit]);

  // Load unpaid sales invoices when customer is selected
  useEffect(() => {
    if (!user?.company_id || !customerId || chequeType !== 'customer') {
      setSalesInvoices([]);
      setSettlementRows([]);
      return;
    }

    const unsub = dbService.subscribe<any>('invoices', user.company_id, (allInvs) => {
      const custInvs = (allInvs || []).filter(inv => 
        inv.customer_id === customerId && 
        inv.status !== 'CANCELLED' &&
        inv.payment_status !== 'PAID'
      );
      setSalesInvoices(custInvs);

      // Create settlement rows with open amount > 0.01
      const rows: InvoiceSettlementRow[] = custInvs.map(inv => {
        const total = Number(inv.total_amount || inv.grand_total) || 0;
        const paid = Number(inv.paid_amount) || 0;
        const open = Math.max(0, total - paid);
        return {
          invoice_id: inv.id,
          invoice_number: inv.invoice_number || inv.id?.slice(0, 8),
          invoice_date: inv.date || inv.invoice_date || '',
          total_amount: total,
          open_amount: open,
          settled_amount: 0
        };
      }).filter(r => r.open_amount > 0.01);

      setSettlementRows(rows);
    });

    return () => unsub();
  }, [user?.company_id, customerId, chequeType]);

  // Calculate totals
  const totalChequesAmount = useMemo(() => {
    return chequeRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  }, [chequeRows]);

  const totalSettledAmount = useMemo(() => {
    return settlementRows.reduce((sum, r) => sum + (Number(r.settled_amount) || 0), 0);
  }, [settlementRows]);

  const remainingToSettle = useMemo(() => {
    return Math.max(0, totalChequesAmount - totalSettledAmount);
  }, [totalChequesAmount, totalSettledAmount]);

  // Add new cheque row
  const handleAddChequeRow = () => {
    setChequeRows(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        cheque_number: '',
        amount: '',
        due_date: receiveDate,
        is_crossed: true,
        is_not_negotiable: true,
        bank_name: EGYPTIAN_BANKS_DATA[0]?.nameAr || 'البنك الأهلي المصري'
      }
    ]);
  };

  // Remove cheque row
  const handleRemoveChequeRow = (id: string) => {
    if (chequeRows.length <= 1) {
      showError(isAr ? 'يجب إبقاء شيك واحد على الأقل في الحافظة' : 'At least one cheque row is required');
      return;
    }
    setChequeRows(prev => prev.filter(r => r.id !== id));
  };

  // Update cheque row field
  const handleUpdateChequeRow = (id: string, field: keyof ChequeRow, value: any) => {
    setChequeRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Auto-distribute cheques amount over open sales invoices
  const handleAutoDistribute = () => {
    let unallocated = totalChequesAmount;
    setSettlementRows(prev => prev.map(row => {
      if (unallocated <= 0) return { ...row, settled_amount: 0 };
      const settleAmount = Math.min(row.open_amount, unallocated);
      unallocated -= settleAmount;
      return { ...row, settled_amount: Number(settleAmount.toFixed(2)) };
    }));
  };

  // Handle Attachment Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            type: file.type,
            url: reader.result as string,
            uploaded_at: new Date().toISOString()
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (chequeType === 'customer' && !customerId) {
      setValidationError(isAr ? 'يرجى اختيار العميل أولاً.' : 'Please select a customer.');
      return;
    }

    if (chequeType === 'other' && !payerName && !creditAccountId) {
      setValidationError(isAr ? 'يرجى كتابة اسم الجهة المسددة أو اختيار الحساب الدائن.' : 'Please enter payer name or select credit account.');
      return;
    }

    // Validate rows
    for (let i = 0; i < chequeRows.length; i++) {
      const r = chequeRows[i];
      if (!r.cheque_number.trim()) {
        setValidationError(isAr ? `يرجى إدخال رقم الشيك في السطر رقم (${i + 1}).` : `Cheque number is required at row ${i + 1}.`);
        return;
      }
      const val = parseFloat(r.amount);
      if (!val || val <= 0) {
        setValidationError(isAr ? `مبلغ الشيك في السطر رقم (${i + 1}) غير صحيح.` : `Invalid cheque amount at row ${i + 1}.`);
        return;
      }
      if (!r.due_date) {
        setValidationError(isAr ? `تاريخ استحقاق الشيك في السطر رقم (${i + 1}) مطلوب.` : `Due date is required at row ${i + 1}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const selectedCustomer = customers.find(c => c.id === customerId);
      const selectedDebitAccount = accounts.find(a => a.id === debitAccountId);
      const selectedCreditAccount = accounts.find(a => a.id === creditAccountId);

      // Active settlements
      const activeSettlements = settlementRows
        .filter(s => s.settled_amount > 0)
        .map(s => ({
          invoice_id: s.invoice_id,
          invoice_number: s.invoice_number,
          settled_amount: s.settled_amount
        }));

      const res = await receivedChequeService.receiveCheques({
        receipt_number: receiptNumber,
        cheque_type: chequeType,
        customer_id: customerId || undefined,
        customer_name: selectedCustomer?.name || payerName || undefined,
        receive_date: receiveDate,
        debit_account_id: debitAccountId || undefined,
        debit_account_name: selectedDebitAccount?.name || undefined,
        credit_account_id: creditAccountId || selectedCustomer?.account_id || undefined,
        credit_account_name: selectedCreditAccount?.name || selectedCustomer?.account_name || undefined,
        purpose: purpose || (isAr ? `استلام شيكات حافظة ${receiptNumber}` : `Received cheques ${receiptNumber}`),
        notes: notes || undefined,
        attachments: attachments,
        settlement_details: activeSettlements,
        cheques: chequeRows.map(r => ({
          cheque_number: r.cheque_number.trim(),
          amount: parseFloat(r.amount),
          due_date: r.due_date,
          is_crossed: r.is_crossed,
          is_not_negotiable: r.is_not_negotiable,
          bank_name: r.bank_name
        }))
      });

      showSuccess((res as any).message || (isAr ? 'تم استلام الشيكات وحفظ الحافظة بنجاح.' : 'Cheques received successfully.'));
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting received cheques:', err);
      showError(err.message || (isAr ? 'حدث خطأ أثناء حفظ الشيكات.' : 'Error saving received cheques.'));
    } finally {
      setLoading(false);
    }
  };

  const containerClasses = inline
    ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-6"
    : "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto";

  const contentBox = (
    <div className={inline ? "w-full" : "bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden flex flex-col max-h-[92vh]"} dir={dir}>
      
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {chequeType === 'customer' 
                ? (isAr ? 'استلام شيكات من عميل' : 'Receive Cheques from Customer')
                : (isAr ? 'استلام شيك (جهات أخرى / أوراق قبض عامة)' : 'Receive General Cheque')}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr ? 'توثيق الحافظة، بيانات الشيكات المسحوبة، وتسويات مديونية العميل' : 'Document receipt, drawee cheques, and customer settlements'}
            </p>
          </div>
        </div>

        {/* Cheque Type Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setChequeType('customer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chequeType === 'customer'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{isAr ? 'شيكات عميل' : 'Customer'}</span>
            </button>
            <button
              type="button"
              onClick={() => setChequeType('other')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chequeType === 'other'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{isAr ? 'جهات أخرى' : 'Other Parties'}</span>
            </button>
          </div>

          {!inline && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
        
        {validationError && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800/40">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Section 1: Basic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800">
          
          {/* Automatic Receipt Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'رقم الحافظة / الإيصال' : 'Receipt No.'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={receiptNumber}
                readOnly
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-mono font-bold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 select-all"
              />
              <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-semibold uppercase">Auto</span>
            </div>
          </div>

          {/* Receive Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'تاريخ الاستلام' : 'Receive Date'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={receiveDate}
              onChange={e => setReceiveDate(e.target.value)}
              required
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          {/* Customer / Payer */}
          {chequeType === 'customer' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'العميل' : 'Customer'} <span className="text-rose-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                required
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="">{isAr ? '-- اختر العميل --' : '-- Select Customer --'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'الجهة المسددة / الساحب' : 'Payer / Issuer Name'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={payerName}
                onChange={e => setPayerName(e.target.value)}
                placeholder={isAr ? 'اسم الجهة أو الشخص' : 'Payer Name'}
                required
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          {/* Debit Account (أوراق قبض من الدليل القائم) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'حساب أوراق القبض' : 'Notes Receivable Account'}
            </label>
            <select
              value={debitAccountId}
              onChange={e => setDebitAccountId(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="">{isAr ? '-- الحساب الافتراضي لأوراق القبض --' : '-- Default Notes Receivable --'}</option>
              {notesReceivableAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>
              ))}
            </select>
          </div>

          {/* General Credit Account (for other cheques) */}
          {chequeType === 'other' && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'الحساب الدائن (طبيعة الإيراد أو الالتزام)' : 'Credit Account'}
              </label>
              <select
                value={creditAccountId}
                onChange={e => setCreditAccountId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">{isAr ? '-- اختر الحساب الدائن من الشجرة القائمة --' : '-- Select Existing Credit Account --'}</option>
                {generalCreditAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Purpose / Statement */}
          <div className={chequeType === 'other' ? "sm:col-span-2" : "sm:col-span-2 lg:col-span-4"}>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'بيان / غرض الاستلام' : 'Purpose / Statement'}
            </label>
            <input
              type="text"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder={isAr ? 'اكتب بياناً مختصراً عن الغرض من استلام الشيكات...' : 'Brief purpose of cheque receipt...'}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>

        {/* Section 2: Table of Received Cheques */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'جدول بيانات الشيكات المستلمة' : 'Received Cheques Table'}
              </h3>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                {chequeRows.length} {isAr ? 'شيك' : 'Cheques'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddChequeRow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800/50 hover:bg-teal-100 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة شيك آخر' : 'Add Another Cheque'}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 min-w-[150px]">{isAr ? 'رقم الشيك' : 'Cheque No.'} <span className="text-rose-500">*</span></th>
                  <th className="p-3 min-w-[140px]">{isAr ? 'مبلغ الشيك (ج.م)' : 'Amount (EGP)'} <span className="text-rose-500">*</span></th>
                  <th className="p-3 min-w-[140px]">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'} <span className="text-rose-500">*</span></th>
                  <th className="p-3 min-w-[180px]">{isAr ? 'البنك المسحوب عليه' : 'Drawee Bank'}</th>
                  <th className="p-3 w-24 text-center">{isAr ? 'مسطر' : 'Crossed'}</th>
                  <th className="p-3 w-28 text-center">{isAr ? 'غير قابل للتداول' : 'Not Negotiable'}</th>
                  <th className="p-3 w-14 text-center">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {chequeRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                    
                    {/* Cheque Number */}
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.cheque_number}
                        onChange={e => handleUpdateChequeRow(row.id, 'cheque_number', e.target.value)}
                        placeholder="000123456"
                        required
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                      />
                    </td>

                    {/* Amount */}
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={row.amount}
                        onChange={e => handleUpdateChequeRow(row.id, 'amount', e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none text-left"
                      />
                    </td>

                    {/* Due Date */}
                    <td className="p-2">
                      <input
                        type="date"
                        value={row.due_date}
                        onChange={e => handleUpdateChequeRow(row.id, 'due_date', e.target.value)}
                        required
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                      />
                    </td>

                    {/* Drawee Bank */}
                    <td className="p-2">
                      <select
                        value={row.bank_name}
                        onChange={e => handleUpdateChequeRow(row.id, 'bank_name', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                      >
                        {EGYPTIAN_BANKS_DATA.map(b => (
                          <option key={b.code} value={b.nameAr}>{b.nameAr}</option>
                        ))}
                      </select>
                    </td>

                    {/* Crossed */}
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.is_crossed}
                        onChange={e => handleUpdateChequeRow(row.id, 'is_crossed', e.target.checked)}
                        className="w-4 h-4 text-teal-600 rounded cursor-pointer accent-teal-600"
                      />
                    </td>

                    {/* Not Negotiable */}
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.is_not_negotiable}
                        onChange={e => handleUpdateChequeRow(row.id, 'is_not_negotiable', e.target.checked)}
                        className="w-4 h-4 text-teal-600 rounded cursor-pointer accent-teal-600"
                      />
                    </td>

                    {/* Delete Row Action */}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveChequeRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total Amount & Tafqeet Bar */}
          <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 block mb-0.5">
                {isAr ? 'إجمالي مبالغ الشيكات كتابةً (تفقيط)' : 'Total in Words'}
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {totalChequesAmount > 0 ? tafqeetAr(totalChequesAmount) : (isAr ? 'صفر جنيه مصري لا غير' : 'Zero')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                {isAr ? 'إجمالي قيمة الشيكات' : 'Total Cheques Amount'}
              </span>
              <span className="text-base font-black text-teal-700 dark:text-teal-300 font-mono">
                {formatNumber(totalChequesAmount)} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Sales Invoice Settlements (Only for Customer Cheques) */}
        {chequeType === 'customer' && customerId && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr ? 'جدول تسويات فواتير المبيعات والحركات المدينة للعميل' : 'Customer Sales Invoices & Debit Movements'}
                </h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                  {settlementRows.length} {isAr ? 'حركة مفتوحة' : 'Open'}
                </span>
              </div>

              {settlementRows.length > 0 && totalChequesAmount > 0 && (
                <button
                  type="button"
                  onClick={handleAutoDistribute}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'توزيع تلقائي للمبلغ' : 'Auto Distribute'}</span>
                </button>
              )}
            </div>

            {settlementRows.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                {isAr ? 'لا توجد فواتير مبيعات معلقة أو متبقيات مديونية لهذا العميل حالياً.' : 'No open sales invoices for this customer.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">{isAr ? 'رقم الفاتورة / الحركة' : 'Invoice / Ref'}</th>
                      <th className="p-3">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="p-3">{isAr ? 'إجمالي الفاتورة' : 'Total Amount'}</th>
                      <th className="p-3">{isAr ? 'المبلغ المتبقي' : 'Open Balance'}</th>
                      <th className="p-3 min-w-[150px]">{isAr ? 'المسدد بالشيكات' : 'Settled by Cheques'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {settlementRows.map((row, idx) => (
                      <tr key={row.invoice_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{row.invoice_number}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{row.invoice_date?.slice(0, 10) || '-'}</td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{formatNumber(row.total_amount)}</td>
                        <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">{formatNumber(row.open_amount)}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={row.open_amount}
                            value={row.settled_amount || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setSettlementRows(prev => prev.map(r => r.invoice_id === row.invoice_id ? { ...r, settled_amount: Math.min(row.open_amount, val) } : r));
                            }}
                            placeholder="0.00"
                            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-left"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Settlements Summary */}
            {settlementRows.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <span className="text-slate-600 dark:text-slate-400">
                    {isAr ? 'المسدد من الفواتير:' : 'Total Settled:'} <strong className="text-slate-900 dark:text-white font-mono">{formatNumber(totalSettledAmount)} ج.م</strong>
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {isAr ? 'المتبقي كدفعة مقدمة / رصيد:' : 'Remaining Advance:'} <strong className="text-teal-600 dark:text-teal-400 font-mono">{formatNumber(remainingToSettle)} ج.م</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Notes and Attachments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'ملاحظات إضافية' : 'Additional Notes'}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder={isAr ? 'أي تعليمات أو ملاحظات إضافية بخصوص الشيكات...' : 'Any additional instructions...'}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium p-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'إرفاق صور الشيكات أو المستندات' : 'Attach Cheque Images / Files'}
            </label>
            <div className="p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 text-center">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
                <Paperclip className="w-3.5 h-3.5 text-teal-600" />
                <span>{isAr ? 'اختر ملفات الشيكات' : 'Choose Files'}</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,.pdf"
                />
              </label>
              
              {attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 text-[11px] font-bold border border-teal-200 dark:border-teal-800">
                      <span className="max-w-[120px] truncate">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          {!inline && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isAr ? 'حفظ واستلام الشيكات' : 'Save & Receive Cheques'}</span>
          </button>
        </div>

      </form>
    </div>
  );

  return inline ? contentBox : (isOpen ? <div className={containerClasses}>{contentBox}</div> : null);
};
