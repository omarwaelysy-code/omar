import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Save, AlertCircle, Calendar, DollarSign, Building2, User, 
  FileText, Paperclip, Trash2, ArrowLeft, CheckCircle2, ShieldCheck, 
  Layers, Landmark, RefreshCw, Hash, Stamp
} from 'lucide-react';
import { IssuedCheque, Supplier, PaymentMethod, IssuedChequeAttachment, Account } from '../../types';
import { issuedChequeService } from '../../services/issuedChequeService';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { tafqeetAr } from '../../utils/tafqeet';

interface ChequeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  chequeToEdit?: IssuedCheque | null;
  suppliers: Supplier[];
  paymentMethods: PaymentMethod[];
  accounts?: Account[];
  inline?: boolean;
}

const SUPPORTED_CURRENCIES = [
  { code: 'EGP', nameAr: 'جنيه مصري', symbol: 'ج.م' },
  { code: 'USD', nameAr: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', nameAr: 'يورو أوروبي', symbol: '€' },
  { code: 'SAR', nameAr: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', nameAr: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'KWD', nameAr: 'دينار كويتي', symbol: 'د.ك' },
  { code: 'QAR', nameAr: 'ريال قطري', symbol: 'ر.ق' },
  { code: 'GBP', nameAr: 'جنيه إسترليني', symbol: '£' },
];

export const ChequeFormModal: React.FC<ChequeFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  chequeToEdit,
  suppliers,
  paymentMethods,
  accounts = [],
  inline = false
}) => {
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [chequeNumber, setChequeNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [exchangeRate, setExchangeRate] = useState('1.0');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [payeeName, setPayeeName] = useState('');
  const [isCrossed, setIsCrossed] = useState(true);
  const [signatoryName, setSignatoryName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<IssuedChequeAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Valid account usages for "النقدية والبنوك والوسائل المالية"
  const validCashUsages = ['cash', 'petty_cash', 'bank', 'wallet', 'credit_card', 'debit_card', 'main_cash'];

  // Categorize financial methods with Banks first as default
  const { bankOptions, cashOptions } = useMemo(() => {
    type FinancialAccountOption = { id: string; name: string; bankName?: string; accNo?: string; type: string; currency: string; isBank: boolean };
    const banks: FinancialAccountOption[] = [];
    const cash: FinancialAccountOption[] = [];

    paymentMethods.forEach(p => {
      const isBank = p.type === 'bank' || Boolean(p.bank_name);
      const item = {
        id: p.id,
        name: p.name,
        bankName: p.bank_name || p.name,
        accNo: p.account_number,
        type: p.type,
        currency: p.currency || 'EGP',
        isBank
      };
      if (isBank) {
        banks.push(item);
      } else {
        cash.push(item);
      }
    });

    // Also include accounts directly if not in paymentMethods
    accounts.forEach(a => {
      if (validCashUsages.includes(a.account_usage || '')) {
        const inPm = paymentMethods.some(pm => pm.account_id === a.id || pm.id === a.id);
        if (!inPm) {
          const isBank = a.account_usage === 'bank';
          const item = {
            id: a.id,
            name: `${a.code ? `${a.code} - ` : ''}${a.name}`,
            bankName: a.name,
            accNo: '',
            type: a.account_usage || 'cash',
            currency: 'EGP',
            isBank
          };
          if (isBank) {
            banks.push(item);
          } else {
            cash.push(item);
          }
        }
      }
    });

    return { bankOptions: banks, cashOptions: cash };
  }, [paymentMethods, accounts]);

  // Selected Bank / Account Object
  const selectedFinancialAccount = useMemo(() => {
    const all = [...bankOptions, ...cashOptions];
    return all.find(a => a.id === bankAccountId) || bankOptions[0] || null;
  }, [bankOptions, cashOptions, bankAccountId]);

  // Keep currency in sync with selected financial account (payment method)
  useEffect(() => {
    if (selectedFinancialAccount?.currency) {
      setCurrency(selectedFinancialAccount.currency);
    }
  }, [selectedFinancialAccount]);

  // Restrict selectable credit accounts ONLY to accounts with usage 'notes_payable'
  const notesPayableAccounts = useMemo(() => {
    return accounts
      .filter(a => 
        a.account_usage === 'notes_payable' || 
        a.name?.includes('أوراق دفع') || 
        a.name?.includes('اوراق دفع') ||
        a.name?.includes('أوراق الدفع') ||
        a.name?.includes('اوراق الدفع')
      )
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [accounts]);

  const defaultCreditAcc = useMemo(() => {
    return notesPayableAccounts[0] || null;
  }, [notesPayableAccounts]);

  useEffect(() => {
    if (chequeToEdit) {
      setChequeNumber(chequeToEdit.cheque_number || '');
      setSupplierId(chequeToEdit.supplier_id || '');
      setCreditAccountId(chequeToEdit.credit_account_id || defaultCreditAcc?.id || '');
      setBankAccountId(chequeToEdit.bank_account_id || bankOptions[0]?.id || '');
      setAmount(chequeToEdit.amount ? Number(chequeToEdit.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
      setCurrency(chequeToEdit.currency || selectedFinancialAccount?.currency || 'EGP');
      setExchangeRate(chequeToEdit.exchange_rate ? String(chequeToEdit.exchange_rate) : '1.0');
      setIssueDate(chequeToEdit.issue_date ? chequeToEdit.issue_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setDueDate(chequeToEdit.due_date ? chequeToEdit.due_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setPayeeName(chequeToEdit.payee_name || '');
      setSignatoryName((chequeToEdit as any).signatory_name || user?.username || 'المفوض بالتوقيع');
      setDescription(chequeToEdit.description || '');
      setNotes(chequeToEdit.notes || '');
      setAttachments(Array.isArray(chequeToEdit.attachments) ? chequeToEdit.attachments : []);
    } else {
      setChequeNumber('');
      setSupplierId('');
      setCreditAccountId(defaultCreditAcc?.id || '');
      setBankAccountId(bankOptions[0]?.id || '');
      setAmount('');
      setCurrency(selectedFinancialAccount?.currency || 'EGP');
      setExchangeRate('1.0');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setDueDate(new Date().toISOString().slice(0, 10));
      setPayeeName('');
      setSignatoryName(user?.username || 'المفوض بالتوقيع');
      setDescription('');
      setNotes('');
      setAttachments([]);
    }
    setValidationError('');
  }, [chequeToEdit, isOpen, defaultCreditAcc, bankOptions, user]);

  // When supplier changes, auto-populate payee name if empty
  const handleSupplierChange = (sId: string) => {
    setSupplierId(sId);
    const supp = suppliers.find(s => s.id === sId);
    if (supp) {
      setPayeeName(supp.name);
    }
  };

  // Monetary & Conversion Computations
  const numAmount = useMemo(() => {
    const raw = typeof amount === 'string' ? amount.replace(/,/g, '') : String(amount || 0);
    const parsed = parseFloat(raw);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [amount]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = val.replace(/,/g, '');
    if (clean === '' || clean === '.') {
      setAmount(clean);
      return;
    }
    if (!/^\d*\.?\d*$/.test(clean)) return;

    const parts = clean.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formatted = parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
    setAmount(formatted);
  };

  const handleAmountBlur = () => {
    if (!amount) return;
    const clean = amount.replace(/,/g, '');
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0) {
      setAmount(num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  const numExchangeRate = useMemo(() => {
    const parsed = parseFloat(exchangeRate);
    return isNaN(parsed) || parsed <= 0 ? 1.0 : parsed;
  }, [exchangeRate]);

  const isForeign = currency !== 'EGP';
  const equivalentInEgp = useMemo(() => {
    return isForeign ? numAmount * numExchangeRate : numAmount;
  }, [numAmount, numExchangeRate, isForeign]);

  // Live Arabic Tafqeet in words
  const tafqeetWords = useMemo(() => {
    if (numAmount === 0) return 'فقط صفر لا غير';
    return tafqeetAr(numAmount, currency);
  }, [numAmount, currency]);

  // Egyptian Pound Equivalent Tafqeet (when foreign)
  const egpTafqeetWords = useMemo(() => {
    if (!isForeign || equivalentInEgp === 0) return '';
    return tafqeetAr(equivalentInEgp, 'EGP');
  }, [isForeign, equivalentInEgp]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        showError('حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)');
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const newAttachment: IssuedChequeAttachment = {
          id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: file.name,
          size: file.size,
          type: file.type,
          url: reader.result as string,
          uploaded_at: new Date().toISOString()
        };
        setAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (attId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!chequeNumber.trim()) {
      setValidationError('يرجى إدخال رقم الشيك الفعلي المطبوع.');
      return;
    }
    if (!supplierId) {
      setValidationError('يرجى اختيار المورد المستفيد.');
      return;
    }
    if (!creditAccountId) {
      setValidationError('يرجى اختيار الحساب الدائن (أوراق الدفع).');
      return;
    }
    if (!bankAccountId) {
      setValidationError('يرجى اختيار الحساب البنكي المسحوب عليه الشيك.');
      return;
    }
    if (numAmount <= 0) {
      setValidationError('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }
    if (isForeign && numExchangeRate <= 0) {
      setValidationError('يرجى إدخال سعر صرف صحيح أكبر من الصفر.');
      return;
    }
    if (!issueDate) {
      setValidationError('يرجى إدخال تاريخ التحرير والإصدار.');
      return;
    }
    if (!dueDate) {
      setValidationError('يرجى إدخال تاريخ الاستحقاق والصرف.');
      return;
    }
    if (dueDate < issueDate) {
      setValidationError('تاريخ الاستحقاق لا يمكن أن يكون قبل تاريخ التحرير.');
      return;
    }

    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    const selectedCreditAcc = accounts.find(a => a.id === creditAccountId);

    setLoading(true);
    try {
      const chequeData: Partial<IssuedCheque> = {
        cheque_number: chequeNumber.trim(),
        supplier_id: supplierId,
        supplier_name: selectedSupplier?.name || '',
        bank_account_id: bankAccountId,
        bank_name: selectedFinancialAccount?.bankName || selectedFinancialAccount?.name || 'بنك مصر',
        account_number: selectedFinancialAccount?.accNo || '',
        credit_account_id: creditAccountId,
        credit_account_name: selectedCreditAcc?.name || 'أوراق دفع - شيكات صادرة',
        amount: numAmount,
        currency: currency,
        exchange_rate: isForeign ? numExchangeRate : 1.0,
        issue_date: issueDate,
        due_date: dueDate,
        payee_name: payeeName.trim() || selectedSupplier?.name || '',
        description: description.trim(),
        notes: notes.trim(),
        attachments: attachments
      };

      if (chequeToEdit) {
        await issuedChequeService.update(chequeToEdit.id, chequeData);
        showSuccess('تم تحديث بيانات الشيك بنجاح.');
      } else {
        await issuedChequeService.create(chequeData);
        showSuccess('تم حفظ مسودة الشيك الصادر بنجاح.');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving cheque:', err);
      showError(err.message || 'حدث خطأ أثناء حفظ الشيك.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formContent = (
    <div className={`bg-slate-100/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 w-full ${inline ? 'rounded-2xl shadow-sm' : 'max-w-5xl rounded-3xl shadow-2xl'} overflow-hidden animate-in fade-in duration-200`} dir="rtl">
      
      {/* Top Header Controls */}
      <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            🏦
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
              {chequeToEdit ? 'تعديل مسودة الشيك الصادر' : 'تحرير وإصدار شيك بنكي جديد'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              نموذج الشيك البنكي الرسمي المعتمد مع التفقيط التلقائي وإدارة العملات
            </p>
          </div>
        </div>
        {inline ? (
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-xs"
          >
            <span>الرجوع للقائمة</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
        
        {validationError && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* REAL BANK CHEQUE CONTAINER (محاكاة الشيك البنكي الحقيقي)                 */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl border-2 border-emerald-800/30 dark:border-emerald-700/50 bg-[#faf8f2] dark:bg-slate-900 p-4 sm:p-6 shadow-xl overflow-hidden">
          
          {/* Subtle Security Background Watermark Pattern */}
          <div 
            className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05] pointer-events-none" 
            style={{ 
              backgroundImage: 'radial-gradient(#065f46 1px, transparent 1px), radial-gradient(#047857 1px, #faf8f2 1px)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px'
            }}
          />

          {/* Inner Security Hairline Frame */}
          <div className="absolute inset-2 sm:inset-3 border border-emerald-900/15 dark:border-emerald-500/20 rounded-xl pointer-events-none" />

          {/* Optional Crossing Lines "//" Stamp */}
          {isCrossed && (
            <div className="absolute top-2 left-2 sm:top-3 sm:left-4 z-10 pointer-events-none select-none">
              <div className="w-16 h-12 relative">
                <div className="absolute w-[2px] h-14 bg-slate-700 dark:bg-slate-300 rotate-45 top-[-4px] left-3 opacity-80" />
                <div className="absolute w-[2px] h-14 bg-slate-700 dark:bg-slate-300 rotate-45 top-[-4px] left-6 opacity-80" />
              </div>
            </div>
          )}

          <div className="relative z-10 space-y-4 sm:space-y-5">
            
            {/* 1. CHEQUE HEADER BAR: Cheque No & Due Date (Right) | Bank Details (Left) */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-emerald-900/20 dark:border-emerald-700/30 pb-3">
              
              {/* Header Right in RTL: Cheque Number & Due Date Slots + Crossing Toggle */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Due Date Box (تاريخ الاستحقاق والصرف / DATE) */}
                <div className="bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-inner">
                  <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-slate-400">
                    <span>تاريخ الاستحقاق</span>
                    <span className="font-sans uppercase">DATE</span>
                  </div>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="bg-transparent text-slate-900 dark:text-white font-mono font-bold text-xs outline-none cursor-pointer"
                  />
                </div>

                {/* Cheque Number Slot */}
                <div className="bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-inner">
                  <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-slate-400">
                    <span>شيك رقم</span>
                    <span className="font-sans uppercase">CHEQUE NO.</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="000128507578"
                    value={chequeNumber}
                    onChange={e => setChequeNumber(e.target.value)}
                    className="w-32 bg-transparent text-slate-900 dark:text-white font-mono font-black text-xs outline-none tracking-widest"
                  />
                </div>

                {/* Crossed Check Toggle */}
                <button
                  type="button"
                  onClick={() => setIsCrossed(!isCrossed)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 ${
                    isCrossed 
                      ? 'bg-slate-800 text-white border-slate-900 shadow-xs' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="تفعيل أو إلغاء تسطير الشيك"
                >
                  <Stamp className="w-3 h-3" />
                  <span>{isCrossed ? 'تسطير: غير قابل للتداول ✓' : 'بدون تسطير'}</span>
                </button>
              </div>

              {/* Header Left in RTL: Bank Selection & Details */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-700/10 text-emerald-800 dark:text-emerald-400 flex items-center justify-center text-xl border border-emerald-700/20">
                  🏦
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-emerald-900 dark:text-emerald-300 tracking-tight">
                      {selectedFinancialAccount?.bankName || selectedFinancialAccount?.name || 'بنك مصر'}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {selectedFinancialAccount?.isBank ? 'بنك تجاري' : 'خزينة مالية'}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {selectedFinancialAccount?.accNo ? `حساب: #${selectedFinancialAccount.accNo}` : 'فرع المعاملات والشركات'}
                  </p>
                </div>
              </div>

            </div>

            {/* 2. CHEQUE BODY LINES */}
            <div className="space-y-4 pt-1">
              
              {/* Row 1: Pay to the Order of (ادفعوا بموجب هذا الشيك لأمر) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Right: Arabic Label */}
                <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 whitespace-nowrap font-serif">
                  ادفعوا بموجب هذا الشيك لأمر:
                </span>
                
                {/* Middle: Payee inputs */}
                <div className="flex-1 flex flex-col sm:flex-row items-center gap-2">
                  {/* Supplier Select */}
                  <div className="w-full sm:w-2/5">
                    <select
                      required
                      value={supplierId}
                      onChange={e => handleSupplierChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-emerald-600 shadow-xs"
                    >
                      <option value="">-- اختر المورد المستفيد --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.code ? `(${s.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Beneficiary Name on Cheque (Drawn line) */}
                  <div className="w-full sm:w-3/5 relative">
                    <input
                      type="text"
                      placeholder="اسم المستفيد المكتوب نصاً على الشيك..."
                      value={payeeName}
                      onChange={e => setPayeeName(e.target.value)}
                      className="w-full bg-transparent border-b-2 border-slate-700 dark:border-slate-400 px-2 py-1 text-sm sm:text-base font-black text-slate-900 dark:text-white outline-none placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </div>
                </div>

                {/* Left: English Translation */}
                <div className="hidden sm:block text-left text-[10px] text-slate-400 font-sans font-medium whitespace-nowrap leading-tight shrink-0 select-none">
                  <div>Against This Cheque</div>
                  <div>Pay to the order of</div>
                </div>
              </div>

              {/* Row 2: The Sum of (مبلغاً وقدره) & Amount Box */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pt-1">
                
                {/* Right in RTL: "مبلغاً وقدره:" + Amount Box */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 whitespace-nowrap font-serif">
                    مبلغاً وقدره:
                  </span>

                  {/* Amount Box (# 500,000.89 (ج.م) EGP #) */}
                  <div className="bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-500 rounded-xl p-1.5 shadow-md flex items-center gap-2">
                    {/* Fixed currency badge from payment method - non-editable */}
                    <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-black text-emerald-800 dark:text-emerald-300 select-none">
                      {currency === 'EGP' ? '(ج.م) EGP' : currency}
                    </div>

                    <span className="text-sm font-mono font-black text-slate-400">#</span>
                    
                    {/* Amount Input with comma format 500,000.89 and without spin arrows */}
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={handleAmountChange}
                      onBlur={handleAmountBlur}
                      className="w-32 sm:w-40 text-left px-1.5 py-0.5 bg-transparent font-mono font-black text-base sm:text-lg text-slate-900 dark:text-white outline-none tracking-tight [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />

                    <span className="text-sm font-mono font-black text-slate-400">#</span>
                  </div>
                </div>

                {/* Middle in RTL: Tafqeet Line */}
                <div className="flex-1 w-full space-y-1">
                  <div className="border-b-2 border-slate-700 dark:border-slate-400 px-2 py-1 min-h-[38px] flex items-center">
                    <span className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-200 font-serif leading-relaxed">
                      {tafqeetWords}
                    </span>
                  </div>

                  {/* If foreign currency, show the Egyptian Pound Equivalent Tafqeet */}
                  {isForeign && (
                    <div className="pr-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                      المعادل بالمصري: <span className="underline decoration-emerald-500/50">{egpTafqeetWords}</span>
                    </div>
                  )}
                </div>

                {/* Left in RTL: English Translation */}
                <div className="hidden sm:block text-left text-[11px] sm:text-xs text-slate-400 font-sans font-medium whitespace-nowrap shrink-0 select-none">
                  The sum of
                </div>

              </div>

              {/* 3. MULTI-CURRENCY CONVERSION PANEL (When Foreign Currency Selected) */}
              {isForeign && (
                <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                      $
                    </span>
                    <div>
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">
                        معاملات العملات الأجنبية وسعر الصرف
                      </span>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        سيتم حفظ الشيك بقيمته الأجنبية مع توثيق المعادل المصري المحاسبي
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                        سعر الصرف (مقابل ج.م) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        required
                        value={exchangeRate}
                        onChange={e => setExchangeRate(e.target.value)}
                        placeholder="50.00"
                        className="w-24 px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <div className="text-left pl-2">
                      <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        المعادل بالجنيه المصري:
                      </span>
                      <span className="font-mono font-black text-sm text-emerald-800 dark:text-emerald-300">
                        {equivalentInEgp.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. CHEQUE BOTTOM ROW: Crossing Stamp (Right) | Cheque Notice (Center) | Signatory & Signature (Left) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-emerald-900/10 dark:border-emerald-700/20">
                {/* Right in RTL: Crossing Stamp Box */}
                <div className="min-w-[140px]">
                  {isCrossed ? (
                    <div className="inline-block px-3 py-1 border-2 border-slate-800 dark:border-slate-300 rounded font-black text-xs text-slate-800 dark:text-slate-200 tracking-wider bg-white/80 dark:bg-slate-900/80 shadow-xs select-none">
                      غير قابل للتداول
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">شيك قابل للصرف المباشر</span>
                  )}
                </div>

                {/* Center: Cheque Warning Note */}
                <div className="text-[10px] text-slate-400 font-medium text-center select-none">
                  (( نرجو عدم الكتابة أو وضع أختام على هذا الجزء أو خلفه ))
                </div>

                {/* Left in RTL: Signatory & Signature */}
                <div className="flex items-center gap-4 text-left sm:text-left shrink-0">
                  <div className="text-right sm:text-right">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <span>اسم الموقع</span>
                      <span className="font-sans font-normal text-[9px]">/ Signatory Name</span>
                    </div>
                    <input
                      type="text"
                      value={signatoryName}
                      onChange={e => setSignatoryName(e.target.value)}
                      placeholder="المفوض بالتوقيع"
                      className="bg-transparent border-b border-dashed border-slate-400 dark:border-slate-500 text-xs font-black text-slate-800 dark:text-slate-200 py-0.5 outline-none w-32"
                    />
                  </div>

                  <div className="text-right sm:text-right">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <span>التوقيع</span>
                      <span className="font-sans font-normal text-[9px]">/ Signature</span>
                    </div>
                    <div className="w-24 h-6 border-b-2 border-slate-700 dark:border-slate-400 flex items-center justify-center text-slate-400 text-xs font-serif italic">
                      ✓ معتمد
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* ACCOUNTING & SUPPORTING CONTROLS (ربط الحسابات المحاسبية والمرفقات)         */}
        {/* ========================================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>التوجيه المحاسبي والبيانات المتممة للشيك</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            
            {/* Bank Account Selection (Requirement 1: Cash/Banks usage with Bank as default) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>الحساب المسحوب عليه (النقدية والبنوك) <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-emerald-600 font-bold">البنك الافتراضي</span>
              </label>
              <select
                required
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              >
                <optgroup label="الحسابات البنكية (الافتراضي)">
                  {bankOptions.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.accNo ? `(#${b.accNo})` : ''}
                    </option>
                  ))}
                </optgroup>
                {cashOptions.length > 0 && (
                  <optgroup label="الخزائن والنقدية والوسائل المالية الأخرى">
                    {cashOptions.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Credit Account Selection (أوراق الدفع) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                الحساب الدائن (أوراق الدفع) <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={creditAccountId}
                onChange={e => setCreditAccountId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs font-semibold transition-all"
              >
                <option value="">
                  {notesPayableAccounts.length === 0
                    ? '-- لا يوجد حساب أوراق دفع مُعرّف --'
                    : '-- اختر حساب أوراق الدفع --'}
                </option>
                {notesPayableAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code ? `${acc.code} - ` : ''}{acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Issue / Registration Date (تاريخ التحرير والتسجيل) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ التحرير والتسجيل <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Description / Purpose (البيان / الغرض من الصرف) */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                البيان / الغرض من الصرف
              </label>
              <input
                type="text"
                placeholder="سداد دفعة تحت الحساب / سداد فاتورة توريد رقم ..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs transition-all"
              />
            </div>

          </div>

          {/* Row: Notes & Attachments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                ملاحظات إضافية
              </label>
              <textarea
                rows={2}
                placeholder="أي ملاحظات داخلية خاصة بالإدارة المالية..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                صورة الشيك / المرفقات المؤيدة
              </label>
              <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-center hover:border-emerald-500 transition-colors">
                <input
                  type="file"
                  id="cheque-attachments-input"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="cheque-attachments-input"
                  className="cursor-pointer flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600"
                >
                  <Paperclip className="w-4 h-4 text-emerald-600" />
                  <span>اضغط لرفع صورة الشيك البنكي أو المستند (حتى 10MB)</span>
                </label>

                {/* Uploaded attachments preview */}
                {attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {attachments.map(att => (
                      <div
                        key={att.id}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px]"
                      >
                        <span className="truncate max-w-[120px]">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Accounting Alert */}
          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>الأثر المالي:</strong> عند اعتماد وإصدار الشيك، يتم إنشاء قيد يومية آلياً: 
              <span className="font-mono mx-1 font-bold">من حـ/ {suppliers.find(s => s.id === supplierId)?.name || 'المورد'} إلى حـ/ {accounts.find(a => a.id === creditAccountId)?.name || 'أوراق الدفع'}</span> 
              بمبلغ {Number(isForeign ? equivalentInEgp : numAmount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م.
            </span>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'جاري الحفظ...' : chequeToEdit ? 'حفظ تعديلات الشيك' : 'حفظ الشيك الصادر'}</span>
          </button>
        </div>

      </form>
    </div>
  );

  if (inline) {
    return formContent;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
      {formContent}
    </div>
  );
};
