import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, DollarSign, Building2, Calendar } from 'lucide-react';
import { IssuedCheque } from '../../types';
import { issuedChequeService } from '../../services/issuedChequeService';
import { useNotification } from '../../contexts/NotificationContext';

interface ChequePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cheque: IssuedCheque | null;
}

export const ChequePaymentModal: React.FC<ChequePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cheque
}) => {
  const { showSuccess, showError } = useNotification();
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !cheque) return null;

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await issuedChequeService.payCheque(cheque.id, paymentDate, notes);
      showSuccess('تم تسجيل صرف وسداد الشيك وترحيل قيد البنك بنجاح.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error clearing cheque:', err);
      showError(err.message || 'فشل في تسجيل صرف الشيك.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir="rtl">
        
        {/* Header */}
        <div className="px-6 py-5 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تسجيل صرف وسداد الشيك
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                خصم قيمة الشيك من رصيد الحساب البنكي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirmPay} className="p-6 space-y-4">
          
          {/* Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-500">
              <span>رقم الشيك:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{cheque.cheque_number}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>المورد المستفيد:</span>
              <span className="font-bold text-slate-900 dark:text-white">{cheque.supplier_name || cheque.payee_name}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>البنك المسحوب عليه:</span>
              <span className="font-bold text-slate-900 dark:text-white">{cheque.bank_name}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">المبلغ المطلوب خصمه:</span>
              <span className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
                {Number(cheque.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              تاريخ الخصم والصرف الفعلي من البنك <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-mono transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ملاحظات عملية السداد
            </label>
            <input
              type="text"
              placeholder="مثال: خصم وفق كشف حساب البنك لشهر ..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
            ⚠️ <strong>ملاحظة محاسبية:</strong> سيتم إنشاء قيد يومية آلياً (من حـ/ أوراق الدفع إلى حـ/ البنك) وتحديث حالة الشيك إلى <strong>مدفوع</strong>.
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'جاري التأكيد...' : 'تأكيد السداد والخصم'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
