import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, AlertCircle, Calendar, DollarSign, Building2, User, FileText, Paperclip, Trash2, ArrowLeft } from 'lucide-react';
import { IssuedCheque, Supplier, PaymentMethod, IssuedChequeAttachment, Account } from '../../types';
import { issuedChequeService } from '../../services/issuedChequeService';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

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

  const [chequeNumber, setChequeNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [payeeName, setPayeeName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<IssuedChequeAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Filter bank payment methods only
  const bankAccounts = useMemo(() => {
    return paymentMethods.filter(p => p.type === 'bank' || Boolean(p.bank_name));
  }, [paymentMethods]);

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
      setBankAccountId(chequeToEdit.bank_account_id || '');
      setAmount(chequeToEdit.amount ? String(chequeToEdit.amount) : '');
      setIssueDate(chequeToEdit.issue_date ? chequeToEdit.issue_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setDueDate(chequeToEdit.due_date ? chequeToEdit.due_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setPayeeName(chequeToEdit.payee_name || '');
      setDescription(chequeToEdit.description || '');
      setNotes(chequeToEdit.notes || '');
      setAttachments(Array.isArray(chequeToEdit.attachments) ? chequeToEdit.attachments : []);
    } else {
      setChequeNumber('');
      setSupplierId('');
      setCreditAccountId(defaultCreditAcc?.id || '');
      setBankAccountId(bankAccounts[0]?.id || '');
      setAmount('');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setDueDate(new Date().toISOString().slice(0, 10));
      setPayeeName('');
      setDescription('');
      setNotes('');
      setAttachments([]);
    }
    setValidationError('');
  }, [chequeToEdit, isOpen, defaultCreditAcc, bankAccounts]);

  // When supplier changes, auto-populate payee name if empty
  const handleSupplierChange = (sId: string) => {
    setSupplierId(sId);
    const supp = suppliers.find(s => s.id === sId);
    if (supp && !payeeName) {
      setPayeeName(supp.name);
    }
  };

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
      setValidationError('يرجى إدخال رقم الشيك الفعلي.');
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
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }
    if (!issueDate) {
      setValidationError('يرجى إدخال تاريخ التحرير والإصدار.');
      return;
    }
    if (!dueDate) {
      setValidationError('يرجى إدخال تاريخ الاستحقاق.');
      return;
    }
    if (dueDate < issueDate) {
      setValidationError('تاريخ الاستحقاق لا يمكن أن يكون قبل تاريخ التحرير.');
      return;
    }

    const selectedBank = paymentMethods.find(p => p.id === bankAccountId);
    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    const selectedCreditAcc = accounts.find(a => a.id === creditAccountId);

    setLoading(true);
    try {
      const chequeData: Partial<IssuedCheque> = {
        cheque_number: chequeNumber.trim(),
        supplier_id: supplierId,
        supplier_name: selectedSupplier?.name || '',
        bank_account_id: bankAccountId,
        bank_name: selectedBank?.name || selectedBank?.bank_name || '',
        account_number: selectedBank?.account_number || '',
        credit_account_id: creditAccountId,
        credit_account_name: selectedCreditAcc?.name || 'أوراق دفع - شيكات صادرة',
        amount: numAmount,
        currency: 'EGP',
        exchange_rate: 1.0,
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
    <div className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-full ${inline ? 'rounded-2xl shadow-sm' : 'max-w-4xl rounded-2xl shadow-2xl'} overflow-hidden animate-in fade-in duration-200`} dir="rtl">
      
      {/* Header - Compact */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base">
            🏦
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {chequeToEdit ? 'تعديل مسودة الشيك الصادر' : 'تحرير وإضافة شيك صادر جديد'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              تسجيل بيانات الشيك البنكي وربط حساب المورد والحساب الدائن المحاسبي
            </p>
          </div>
        </div>
        {inline ? (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
          >
            <span>الرجوع للقائمة</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Form Body - Compact & Dense */}
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        
        {validationError && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Row 1: Basic Cheque Data (4 Columns on Desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Cheque Number */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              رقم الشيك المطبوع <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: 00045892"
              value={chequeNumber}
              onChange={e => setChequeNumber(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs font-bold font-mono transition-all"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              مبلغ الشيك (ج.م) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-1.5 pl-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs font-bold font-mono transition-all"
              />
              <span className="absolute left-2.5 top-1.5 text-[10px] text-slate-400 font-bold">EGP</span>
            </div>
          </div>

          {/* Issue Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              تاريخ التحرير والإصدار <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={issueDate}
              onChange={e => setIssueDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs font-mono transition-all"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              تاريخ الاستحقاق والصرف <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs font-mono transition-all"
            />
          </div>
        </div>

        {/* Row 2: Parties & Accounts (3 Columns on Desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Supplier Selection (Debit Side) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              المورد المستفيد (المدين) <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={supplierId}
              onChange={e => handleSupplierChange(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs transition-all"
            >
              <option value="">-- اختر المورد --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Credit Account Selection (Credit Side - أوراق الدفع / شيكات صادرة) */}
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
            {notesPayableAccounts.length === 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium leading-tight">
                ⚠️ يرجى إضافة حساب استخدامه "أوراق دفع" من شجرة الحسابات (قسم أوراق الدفع والموردين).
              </p>
            )}
          </div>

          {/* Bank Account Selection ( المسحوب عليه) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              الحساب البنكي المسحوب عليه <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={bankAccountId}
              onChange={e => setBankAccountId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs transition-all"
            >
              <option value="">-- اختر الحساب البنكي --</option>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.bank_name ? `- ${b.bank_name}` : ''} {b.account_number ? `(${b.account_number})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Payee Name & Description (2 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              اسم المستفيد المكتوب على الشيك
            </label>
            <input
              type="text"
              placeholder="يصرف للمستفيد الأول: ..."
              value={payeeName}
              onChange={e => setPayeeName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs transition-all"
            />
          </div>

          <div>
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

        {/* Row 4: Notes & Attachments (2 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              صورة الشيك / المرفقات
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
                <span>اضغط لرفع صورة الشيك أو المستند المؤيد (حتى 10MB)</span>
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

        {/* Modal Footer - Compact */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{loading ? 'جاري الحفظ...' : chequeToEdit ? 'حفظ التعديلات' : 'حفظ الشيك'}</span>
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
