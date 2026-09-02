import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Calendar, DollarSign, Building2, User, FileText, Paperclip, Trash2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { IssuedCheque, Supplier, PaymentMethod, IssuedChequeAttachment } from '../../types';
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
  inline?: boolean;
}

export const ChequeFormModal: React.FC<ChequeFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  chequeToEdit,
  suppliers,
  paymentMethods,
  inline = false
}) => {
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();

  const [chequeNumber, setChequeNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
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
  const bankAccounts = paymentMethods.filter(p => p.type === 'bank' || Boolean(p.bank_name));

  useEffect(() => {
    if (chequeToEdit) {
      setChequeNumber(chequeToEdit.cheque_number || '');
      setSupplierId(chequeToEdit.supplier_id || '');
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
  }, [chequeToEdit, isOpen]);

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

    setLoading(true);
    try {
      const chequeData: Partial<IssuedCheque> = {
        cheque_number: chequeNumber.trim(),
        supplier_id: supplierId,
        supplier_name: selectedSupplier?.name || '',
        bank_account_id: bankAccountId,
        bank_name: selectedBank?.name || selectedBank?.bank_name || '',
        account_number: selectedBank?.account_number || '',
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
    <div className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-full ${inline ? 'rounded-3xl shadow-sm' : 'max-w-3xl rounded-3xl shadow-2xl'} overflow-hidden animate-in fade-in duration-200`} dir="rtl">
      
      {/* Header */}
      <div className="px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl">
            🏦
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {chequeToEdit ? 'تعديل مسودة الشيك الصادر' : 'تحرير وإضافة شيك صادر جديد'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تسجيل بيانات الشيك البنكي الصادر للمورد مع ربط الحسابات المحاسبية
            </p>
          </div>
        </div>
        {inline ? (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
          >
            <span>الرجوع للقائمة</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {validationError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Cheque Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                رقم الشيك المطبوع <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثال: 00045892"
                  value={chequeNumber}
                  onChange={e => setChequeNumber(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-bold font-mono transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">الرقم المطبوع على الشيك الفعلي من دفتر الشيكات</p>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-bold font-mono transition-all"
                />
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">EGP</span>
              </div>
            </div>

            {/* Supplier Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                المورد المستفيد <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={supplierId}
                onChange={e => handleSupplierChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
              >
                <option value="">-- اختر المورد --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Bank Account Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                الحساب البنكي المسحوب عليه <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
              >
                <option value="">-- اختر الحساب البنكي --</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.bank_name ? `- ${b.bank_name}` : ''} {b.account_number ? `(${b.account_number})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Issue Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                تاريخ التحرير والإصدار <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-mono transition-all"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                تاريخ الاستحقاق والصرف <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-mono transition-all"
              />
            </div>

            {/* Payee Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                اسم المستفيد المكتوب على الشيك
              </label>
              <input
                type="text"
                placeholder="يصرف للمستفيد الأول: ..."
                value={payeeName}
                onChange={e => setPayeeName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
              />
            </div>

            {/* Description & Purpose */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                البيان / الغرض من الصرف
              </label>
              <input
                type="text"
                placeholder="سداد دفعة تحت الحساب / سداد فاتورة توريد رقم ..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ملاحظات إضافية
              </label>
              <textarea
                rows={2}
                placeholder="أي ملاحظات داخلية خاصة بالإدارة المالية..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all resize-none"
              />
            </div>

            {/* Attachments Upload */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                صورة الشيك / المرفقات
              </label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center hover:border-emerald-500/50 transition-colors">
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
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center">
                    <Paperclip className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    اضغط لرفع صورة الشيك أو المستندات المؤيدة
                  </span>
                  <span className="text-[11px] text-slate-400">يدعم الصور وملفات PDF حتى 10MB</span>
                </label>

                {/* Uploaded attachments preview */}
                {attachments.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {attachments.map(att => (
                      <div
                        key={att.id}
                        className="relative group rounded-xl border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-800/80 flex items-center gap-2"
                      >
                        {att.type.startsWith('image/') ? (
                          <img src={att.url} alt={att.name} className="w-9 h-9 object-cover rounded-lg" />
                        ) : (
                          <FileText className="w-9 h-9 text-slate-400 p-1" />
                        )}
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{att.name}</p>
                          <p className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {formContent}
    </div>
  );
};
