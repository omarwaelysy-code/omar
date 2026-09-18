import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Save, Plus, Trash2, Calendar, User, FileText, Paperclip, 
  CheckCircle2, ShieldCheck, Layers, Building2, AlertCircle, 
  ArrowLeft, RefreshCw, Hash, DollarSign, Coins, TrendingUp,
  Eye, Download
} from 'lucide-react';
import { ReceivedCheque, Customer, PaymentMethod, Account, IssuedChequeAttachment, Currency, ExchangeRate, Company } from '../../types';
import { receivedChequeService } from '../../services/receivedChequeService';
import { dbService, apiRequest } from '../../services/dbService';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { tafqeetAr } from '../../utils/tafqeet';
import { formatNumber } from '../../utils/formatUtils';
import { EGYPTIAN_BANKS_DATA, BankLogoBadge, EgyptianBank } from '../../data/egyptianBanks';
import { AttachmentPreviewModal, ChequeAttachmentData } from '../common/AttachmentPreviewModal';

interface ChequeRow {
  id: string;
  cheque_number: string;
  amount: string;
  due_date: string;
  is_crossed: boolean;
  is_not_negotiable: boolean;
  bank_name: string;
  attachment?: IssuedChequeAttachment;
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

  // Attachment Preview Modal State
  const [previewAttachment, setPreviewAttachment] = useState<ChequeAttachmentData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Currencies & Exchange Rate from Currency Management (System-only)
  const [company, setCompany] = useState<Company | null>(null);
  const [companyCurrencies, setCompanyCurrencies] = useState<Currency[]>([]);
  const [currency, setCurrency] = useState<string>('EGP');
  const [exchangeRate, setExchangeRate] = useState<string>('1.0');
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false);

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

  // Load Currencies & Company from DB (Only system registered currencies)
  useEffect(() => {
    if (!user?.company_id) return;
    Promise.all([
      dbService.list<Currency>('currencies', user.company_id),
      dbService.get<Company>('companies', user.company_id)
    ])
      .then(([currs, comp]) => {
        if (Array.isArray(currs)) {
          setCompanyCurrencies(currs.filter(c => c.is_active !== false));
        }
        if (comp) {
          setCompany(comp);
          const baseCurr = (comp.settings?.currency || (comp as any)?.currency || 'EGP').toUpperCase();
          if (!currency || currency === 'EGP') {
            setCurrency(baseCurr);
          }
        }
      })
      .catch(err => console.error('Error fetching currencies/company:', err));
  }, [user?.company_id]);

  // ONLY currencies registered in the system (إدارة العملات)
  const availableCurrencies = useMemo(() => {
    const baseCode = (company?.settings?.currency || (company as any)?.currency || 'EGP').toUpperCase();
    const baseItem = {
      id: 'base',
      code: baseCode,
      nameAr: baseCode === 'EGP' ? 'جنيه مصري' : baseCode,
      symbol: baseCode === 'EGP' ? 'ج.م' : baseCode
    };

    const list = [baseItem];

    (companyCurrencies || [])
      .filter(c => c && c.code && c.is_active !== false)
      .forEach(c => {
        const code = c.code.toUpperCase();
        if (code !== baseCode && !list.some(x => x.code === code)) {
          list.push({
            id: c.id,
            code,
            nameAr: c.name_ar || (c as any).name || c.code,
            symbol: c.symbol || code
          });
        }
      });

    return list;
  }, [companyCurrencies, company]);

  const selectedCurrency = useMemo(() => {
    return availableCurrencies.find(c => c.code.toUpperCase() === currency.toUpperCase()) || {
      code: currency,
      nameAr: currency,
      symbol: currency === 'EGP' ? 'ج.م' : currency
    };
  }, [availableCurrencies, currency]);

  // Handle currency change & fetch exchange rate (System rate auto, user can edit manually)
  const handleCurrencyChange = async (newCurr: string) => {
    setCurrency(newCurr);
    const baseCode = (company?.settings?.currency || (company as any)?.currency || 'EGP').toUpperCase();
    if (newCurr.toUpperCase() === baseCode) {
      setExchangeRate('1.0');
      return;
    }

    setLoadingExchangeRate(true);
    try {
      const matched = availableCurrencies.find(c => c.code.toUpperCase() === newCurr.toUpperCase());
      if (matched?.id && matched.id !== 'base') {
        // 1. Check manual rates in exchange_rates
        const rates = await dbService.list<ExchangeRate>('exchange_rates', {
          currency_id: matched.id,
          company_id: user?.company_id,
          _limit: 1,
          _sort: 'rate_date',
          _order: 'desc'
        });
        if (rates && rates.length > 0 && Number(rates[0].exchange_rate) > 0) {
          setExchangeRate(String(Number(rates[0].exchange_rate)));
          return;
        }

        // 2. Check automated live system rates in currency_rates
        try {
          const autoRates = await apiRequest<Array<{
            currency_id: string;
            rate: number | null;
            rate_date: string | null;
          }>>(`/currency-rates/latest?company_id=${user?.company_id}`);
          const found = autoRates?.find(r => r.currency_id === matched.id && Number(r.rate) > 0);
          if (found && Number(found.rate) > 0) {
            setExchangeRate(String(Number(found.rate)));
            return;
          }
        } catch {
          // ignore
        }
      }
      setExchangeRate('1.0');
    } catch (err) {
      console.error('Error fetching exchange rate:', err);
      setExchangeRate('1.0');
    } finally {
      setLoadingExchangeRate(false);
    }
  };

  // Initialize defaults
  useEffect(() => {
    const effective = mode ? (mode.toLowerCase() as 'customer' | 'other') : initialChequeType;
    setChequeType(effective);
    if (!debitAccountId && notesReceivableAccounts.length > 0) {
      setDebitAccountId(notesReceivableAccounts[0].id);
    }
  }, [initialChequeType, mode, notesReceivableAccounts]);

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

  // Load Sales Invoices when Customer changes
  useEffect(() => {
    if (!customerId || chequeType !== 'customer' || !user?.company_id) {
      setSalesInvoices([]);
      setSettlementRows([]);
      return;
    }

    const fetchInvoices = async () => {
      try {
        const invs = await dbService.list<any>('invoices', { customer_id: customerId });
        const openInvs = (invs || []).filter(inv => {
          const total = Number(inv.total_amount || inv.total || 0);
          const paid = Number(inv.paid_amount || 0);
          const open = total - paid;
          return open > 0.01 && inv.status !== 'cancelled';
        });

        setSalesInvoices(openInvs);
        setSettlementRows(openInvs.map(inv => ({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number || inv.serial_number || inv.id,
          invoice_date: inv.invoice_date || inv.date || '',
          total_amount: Number(inv.total_amount || inv.total || 0),
          open_amount: Number(inv.total_amount || inv.total || 0) - Number(inv.paid_amount || 0),
          settled_amount: 0
        })));
      } catch (err) {
        console.error('Error fetching sales invoices:', err);
      }
    };

    fetchInvoices();
  }, [customerId, chequeType, user?.company_id]);

  // Total amount from dynamic cheques
  const totalChequesAmount = useMemo(() => {
    return chequeRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  }, [chequeRows]);

  // Total equivalent in system currency (EGP)
  const numRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 1.0;
  const totalEquivalentAmount = useMemo(() => {
    return totalChequesAmount * numRate;
  }, [totalChequesAmount, numRate]);

  const isForeign = currency !== 'EGP' && numRate !== 1;

  // Auto-distribute cheques amount over open sales invoices
  const handleAutoDistribute = () => {
    let remaining = totalChequesAmount;
    setSettlementRows(prev => prev.map(row => {
      if (remaining <= 0) {
        return { ...row, settled_amount: 0 };
      }
      const canPay = Math.min(row.open_amount, remaining);
      remaining -= canPay;
      return { ...row, settled_amount: Number(canPay.toFixed(2)) };
    }));
  };

  // Row operations
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

  const handleRemoveChequeRow = (id: string) => {
    if (chequeRows.length === 1) {
      showError(isAr ? 'يجب أن يحتوي الإيصال على شيك واحد على الأقل.' : 'Must keep at least one cheque.');
      return;
    }
    setChequeRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateChequeRow = (id: string, field: keyof ChequeRow, val: any) => {
    setChequeRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  // Row-level Attachment upload & handlers
  const handleRowFileUpload = (rowId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newAtt: IssuedChequeAttachment = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: reader.result as string,
        uploaded_at: new Date().toISOString()
      };
      setChequeRows(prev => prev.map(r => r.id === rowId ? { ...r, attachment: newAtt } : r));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveRowAttachment = (rowId: string) => {
    setChequeRows(prev => prev.map(r => r.id === rowId ? { ...r, attachment: undefined } : r));
  };

  const handlePreviewAttachment = (att: ChequeAttachmentData) => {
    setPreviewAttachment(att);
    setIsPreviewOpen(true);
  };

  const handleDirectDownload = (att: ChequeAttachmentData) => {
    if (!att?.url) return;
    try {
      const a = document.createElement('a');
      a.href = att.url;
      a.download = att.name || 'cheque_document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      window.open(att.url, '_blank');
    }
  };

  // Global Attachment upload (Receipt envelope)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAtt: IssuedChequeAttachment = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: reader.result as string,
          uploaded_at: new Date().toISOString()
        };
        setAttachments(prev => [...prev, newAtt]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (chequeType === 'customer' && !customerId) {
      setValidationError(isAr ? 'يرجى اختيار العميل أولاً.' : 'Please select a customer.');
      return;
    }

    if (chequeType === 'other' && !payerName.trim()) {
      setValidationError(isAr ? 'يرجى كتابة اسم الجهة المسددة / الساحب.' : 'Please enter payer name.');
      return;
    }

    const invalidCheque = chequeRows.find(r => !r.cheque_number.trim() || !(parseFloat(r.amount) > 0));
    if (invalidCheque) {
      setValidationError(isAr ? 'يرجى إدخال رقم ومبلغ صحيح لكل شيك في الجدول.' : 'Please enter valid cheque number and amount for all rows.');
      return;
    }

    setLoading(true);
    try {
      const selectedCustomer = customers.find(c => c.id === customerId);
      const selectedDebitAcc = notesReceivableAccounts.find(a => a.id === debitAccountId);
      const selectedCreditAcc = accounts.find(a => a.id === creditAccountId);

      const res = await receivedChequeService.receiveCheques({
        receipt_number: receiptNumber,
        cheque_type: chequeType,
        customer_id: customerId || undefined,
        customer_name: selectedCustomer?.name || undefined,
        receive_date: receiveDate,
        currency,
        exchange_rate: numRate,
        debit_account_id: debitAccountId || undefined,
        debit_account_name: selectedDebitAcc?.name || undefined,
        credit_account_id: creditAccountId || undefined,
        credit_account_name: selectedCreditAcc?.name || undefined,
        purpose: purpose || undefined,
        notes: notes || undefined,
        attachments,
        settlement_details: settlementRows.filter(r => r.settled_amount > 0),
        cheques: chequeRows.map(r => ({
          cheque_number: r.cheque_number.trim(),
          amount: parseFloat(r.amount) || 0,
          due_date: r.due_date,
          is_crossed: r.is_crossed,
          is_not_negotiable: r.is_not_negotiable,
          bank_name: r.bank_name,
          attachment: r.attachment || undefined,
          attachments: r.attachment ? [r.attachment] : undefined
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
    <div className={inline ? "w-full" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto"} dir={dir}>
      
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-lg shadow-md shadow-blue-500/20">
            📥
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {chequeType === 'customer' 
                ? (isAr ? 'حافظة استلام شيكات من عميل' : 'Receive Customer Cheques')
                : (isAr ? 'حافظة استلام شيك (أوراق قبض أخرى)' : 'Receive Other Cheque')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {chequeType === 'customer'
                ? (isAr ? 'استلام شيكات متعددة، تسوية فواتير المبيعات، وإثبات قيود أوراق القبض' : 'Multi-cheque receipt from customer with invoice settlements')
                : (isAr ? 'استلام شيكات من جهات أخرى أو إيرادات متنوعة' : 'Receive cheques from non-customer entities')}
            </p>
          </div>
        </div>

        {!inline && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {validationError && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Basic Header Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/75 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
          
          {/* Receipt / Portfolio Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'رقم الحافظة / الإيصال' : 'Receipt #'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                placeholder="RCV-YYYY-MM-000001"
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className={`absolute ${isAr ? 'left-2.5' : 'right-2.5'} top-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 font-bold`}>
                AUTO
              </span>
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
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Customer (if customer) OR Payer (if other) */}
          {chequeType === 'customer' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'العميل' : 'Customer'} <span className="text-rose-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                required
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">{isAr ? '-- اختر العميل --' : '-- Select Customer --'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} - ` : ''}{c.name}
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
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          {/* Notes Receivable Account */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'حساب أوراق القبض' : 'Notes Receivable Account'}
            </label>
            <select
              value={debitAccountId}
              onChange={e => setDebitAccountId(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">{isAr ? '-- الحساب الافتراضي لأوراق القبض --' : '-- Default Notes Receivable --'}</option>
              {notesReceivableAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>
              ))}
            </select>
          </div>

          {/* Currency Selector (Requirement 1) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-blue-600" />
                {isAr ? 'عملة الشيكات' : 'Currency'}
              </span>
              {isForeign && (
                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded">
                  {isAr ? 'عملة أجنبية' : 'Foreign'}
                </span>
              )}
            </label>
            <select
              value={currency}
              onChange={e => handleCurrencyChange(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              {availableCurrencies.map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.nameAr} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Exchange Rate (Requirement 1) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>{isAr ? 'سعر الصرف (مقابل ج.م)' : 'Exchange Rate'}</span>
              {loadingExchangeRate && <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value)}
                disabled={currency === 'EGP'}
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400"
              />
              {isForeign && (
                <span className={`absolute ${isAr ? 'left-3' : 'right-3'} top-2 text-[10px] text-slate-400 font-mono`}>
                  1 {currency} = {exchangeRate} ج.م
                </span>
              )}
            </div>
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
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">{isAr ? '-- اختر الحساب الدائن من الشجرة القائمة --' : '-- Select Existing Credit Account --'}</option>
                {generalCreditAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Purpose / Statement */}
          <div className={chequeType === 'other' ? "sm:col-span-2" : "sm:col-span-2"}>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'بيان / غرض الاستلام' : 'Purpose / Statement'}
            </label>
            <input
              type="text"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder={isAr ? 'اكتب بياناً مختصراً عن الغرض من استلام الشيكات...' : 'Brief purpose of cheque receipt...'}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Section 2: Table of Received Cheques (Requirement 2 & 3) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة شيك آخر' : 'Add Another Cheque'}</span>
            </button>
          </div>

          {/* Clean table: No boxes around text, seamless grid with Bank Logo */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3 min-w-[150px]">{isAr ? 'رقم الشيك' : 'Cheque No.'} <span className="text-rose-500">*</span></th>
                  <th className="py-3 px-3 min-w-[140px] text-left">
                    {isAr ? `مبلغ الشيك (${selectedCurrency.symbol})` : `Amount (${selectedCurrency.symbol})`} <span className="text-rose-500">*</span>
                  </th>
                  <th className="py-3 px-3 min-w-[140px]">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'} <span className="text-rose-500">*</span></th>
                  <th className="py-3 px-3 w-16 text-center">{isAr ? 'لوجو' : 'Logo'}</th>
                  <th className="py-3 px-3 min-w-[200px]">{isAr ? 'البنك المسحوب عليه' : 'Drawee Bank'}</th>
                  <th className="py-3 px-3 min-w-[150px] text-center">{isAr ? 'صورة / مستند الشيك' : 'Cheque Attachment'}</th>
                  <th className="py-3 px-3 w-20 text-center">{isAr ? 'مسطر' : 'Crossed'}</th>
                  <th className="py-3 px-3 w-24 text-center">{isAr ? 'غير قابل للتداول' : 'Not Negotiable'}</th>
                  <th className="py-3 px-3 w-14 text-center">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {chequeRows.map((row, idx) => {
                  const matchedBank = EGYPTIAN_BANKS_DATA.find(b => 
                    b.nameAr === row.bank_name || 
                    b.nameEn === row.bank_name ||
                    (row.bank_name && b.nameAr && row.bank_name.includes(b.nameAr)) ||
                    (row.bank_name && b.nameAr && b.nameAr.includes(row.bank_name))
                  );

                  return (
                    <tr key={row.id} className="hover:bg-blue-50/20 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                      
                      {/* Cheque Number - Plain borderless cell input */}
                      <td className="py-1 px-2 border-r border-slate-100 dark:border-slate-800/60">
                        <input
                          type="text"
                          value={row.cheque_number}
                          onChange={e => handleUpdateChequeRow(row.id, 'cheque_number', e.target.value)}
                          placeholder="000123456"
                          required
                          className="w-full bg-transparent border-0 px-2 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-300 placeholder:font-normal focus:bg-blue-50/50 dark:focus:bg-blue-900/20 focus:outline-none rounded transition-colors"
                        />
                      </td>

                      {/* Amount - Plain borderless cell input */}
                      <td className="py-1 px-2 border-r border-slate-100 dark:border-slate-800/60">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={row.amount}
                          onChange={e => handleUpdateChequeRow(row.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          required
                          className="w-full bg-transparent border-0 px-2 py-1.5 text-xs font-mono font-black text-slate-900 dark:text-white text-left placeholder:text-slate-300 focus:bg-blue-50/50 dark:focus:bg-blue-900/20 focus:outline-none rounded transition-colors"
                        />
                      </td>

                      {/* Due Date - Plain borderless cell input */}
                      <td className="py-1 px-2 border-r border-slate-100 dark:border-slate-800/60">
                        <input
                          type="date"
                          value={row.due_date}
                          onChange={e => handleUpdateChequeRow(row.id, 'due_date', e.target.value)}
                          required
                          className="w-full bg-transparent border-0 px-2 py-1.5 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 focus:bg-blue-50/50 dark:focus:bg-blue-900/20 focus:outline-none rounded transition-colors"
                        />
                      </td>

                      {/* Bank Logo Column (Requirement 3) */}
                      <td className="py-1 px-2 text-center border-r border-slate-100 dark:border-slate-800/60">
                        {matchedBank ? (
                          <BankLogoBadge bank={matchedBank} size="sm" className="mx-auto shadow-xs" />
                        ) : (
                          <div className="w-7 h-7 mx-auto rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs">
                            🏦
                          </div>
                        )}
                      </td>

                      {/* Drawee Bank - Clean borderless dropdown */}
                      <td className="py-1 px-2 border-r border-slate-100 dark:border-slate-800/60">
                        <select
                          value={row.bank_name}
                          onChange={e => handleUpdateChequeRow(row.id, 'bank_name', e.target.value)}
                          className="w-full bg-transparent border-0 px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:bg-blue-50/50 dark:focus:bg-blue-900/20 focus:outline-none rounded cursor-pointer transition-colors"
                        >
                          {EGYPTIAN_BANKS_DATA.map(b => (
                            <option key={b.code} value={b.nameAr} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-1">
                              {b.nameAr}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Cheque Attachment Column */}
                      <td className="py-1 px-2 text-center border-r border-slate-100 dark:border-slate-800/60">
                        {row.attachment ? (
                          <div className="inline-flex items-center gap-1.5 p-1 px-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/60 text-xs">
                            <button
                              type="button"
                              onClick={() => handlePreviewAttachment(row.attachment!)}
                              className="flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 transition-colors cursor-pointer truncate max-w-[100px]"
                              title={isAr ? `معاينة ${row.attachment.name}` : `Preview ${row.attachment.name}`}
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                              <span className="truncate">{row.attachment.name}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDirectDownload(row.attachment!)}
                              className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded text-blue-700 dark:text-blue-300 transition-colors cursor-pointer"
                              title={isAr ? 'تحميل المرفق' : 'Download'}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveRowAttachment(row.id)}
                              className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                              title={isAr ? 'حذف المرفق' : 'Remove'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-900/20 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">
                            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                            <span>{isAr ? 'إرفاق مستند/صورة' : 'Attach'}</span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf,.doc,.docx"
                              onChange={e => handleRowFileUpload(row.id, e)}
                            />
                          </label>
                        )}
                      </td>

                      {/* Crossed */}
                      <td className="py-1 px-2 text-center border-r border-slate-100 dark:border-slate-800/60">
                        <input
                          type="checkbox"
                          checked={row.is_crossed}
                          onChange={e => handleUpdateChequeRow(row.id, 'is_crossed', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded cursor-pointer accent-blue-600"
                        />
                      </td>

                      {/* Not Negotiable */}
                      <td className="py-1 px-2 text-center border-r border-slate-100 dark:border-slate-800/60">
                        <input
                          type="checkbox"
                          checked={row.is_not_negotiable}
                          onChange={e => handleUpdateChequeRow(row.id, 'is_not_negotiable', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded cursor-pointer accent-blue-600"
                        />
                      </td>

                      {/* Delete Row Action */}
                      <td className="py-1 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveChequeRow(row.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                          title={isAr ? 'حذف الشيك' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Total Amount, Tafqeet & System Currency Equivalent Bar */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                {isAr ? 'إجمالي مبالغ الشيكات كتابةً (تفقيط)' : 'Total in Words'}
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {totalChequesAmount > 0 ? tafqeetAr(totalChequesAmount, currency) : (isAr ? 'صفر' : 'Zero')}
              </p>
              {isForeign && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                  ({isAr ? 'يعادل بالجنيه المصري:' : 'EGP Equivalent:'} {tafqeetAr(totalEquivalentAmount, 'EGP')})
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-5 text-right">
              <div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                  {isAr ? 'إجمالي قيمة الشيكات' : 'Total Cheques'}
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {formatNumber(totalChequesAmount)} {selectedCurrency.symbol}
                </span>
              </div>

              {isForeign && (
                <div className="pr-4 border-r border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block mb-0.5">
                    {isAr ? 'المعادل بعملة النظام (ج.م)' : 'System Equivalent (EGP)'}
                  </span>
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                    {formatNumber(totalEquivalentAmount)} ج.م
                  </span>
                </div>
              )}
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
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
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
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                      <th className="p-3">{isAr ? 'تاريخ الفاتورة' : 'Invoice Date'}</th>
                      <th className="p-3 text-left">{isAr ? 'إجمالي الفاتورة' : 'Total'}</th>
                      <th className="p-3 text-left">{isAr ? 'المتبقي المستحق' : 'Remaining'}</th>
                      <th className="p-3 min-w-[140px] text-left">{isAr ? 'المسدد بالشيكات' : 'To Settle'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {settlementRows.map((row, idx) => (
                      <tr key={row.invoice_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{row.invoice_number}</td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{row.invoice_date ? String(row.invoice_date).slice(0, 10) : '-'}</td>
                        <td className="p-3 font-mono text-slate-800 dark:text-slate-200 text-left">{formatNumber(row.total_amount)} {selectedCurrency.symbol}</td>
                        <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400 text-left">{formatNumber(row.open_amount)} {selectedCurrency.symbol}</td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800/60">
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
                            className="w-full bg-transparent border-0 px-2 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:bg-blue-50/50 dark:focus:bg-blue-900/20 focus:outline-none rounded transition-colors text-left"
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
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <span className="text-slate-600 dark:text-slate-400">
                    {isAr ? 'المسدد من الفواتير:' : 'Total Settled:'} <strong className="text-slate-900 dark:text-white font-mono">{formatNumber(settlementRows.reduce((s, r) => s + r.settled_amount, 0))} {selectedCurrency.symbol}</strong>
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {isAr ? 'المتبقي كدفعة مقدمة / رصيد:' : 'Remaining Advance:'} <strong className="text-blue-600 dark:text-blue-400 font-mono">{formatNumber(Math.max(0, totalChequesAmount - settlementRows.reduce((s, r) => s + r.settled_amount, 0)))} {selectedCurrency.symbol}</strong>
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
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium p-3 rounded-2xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'إرفاق صور الشيكات أو المستندات' : 'Attach Cheque Images / Files'}
            </label>
            <div className="p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 text-center">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
                <Paperclip className="w-3.5 h-3.5 text-blue-600" />
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
                    <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-[11px] font-bold border border-blue-200 dark:border-blue-800">
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
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isAr ? 'حفظ واستلام الشيكات' : 'Save & Receive Cheques'}</span>
          </button>
        </div>

      </form>

      {/* Attachment Preview & Download Modal */}
      <AttachmentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        attachment={previewAttachment}
      />
    </div>
  );

  return inline ? contentBox : (isOpen ? <div className={containerClasses}>{contentBox}</div> : null);
};
