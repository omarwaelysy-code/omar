import React, { useState } from 'react';
import { X, RotateCcw, AlertCircle } from 'lucide-react';
import { IssuedCheque } from '../../types';
import { issuedChequeService } from '../../services/issuedChequeService';
import { useNotification } from '../../contexts/NotificationContext';

interface ChequeReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cheque: IssuedCheque | null;
}

export const ChequeReturnModal: React.FC<ChequeReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cheque
}) => {
  const { showSuccess, showError } = useNotification();
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('عدم كفاية الرصيد');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !cheque) return null;

  const returnReasonsList = [
    'عدم كفاية الرصيد',
    'اختلاف في التوقيع',
    'خطأ في صياغة التاريخ أو المبلغ',
    'الشيك متقادم / منتهي الصلاحية',
    'إيقاف الصرف بناء على طلب الساحب',
    'سبب آخر'
  ];

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === 'سبب آخر' ? customReason.trim() : reason;
    if (!finalReason) {
      showError('يرجى تحديد أو إدخال سبب ارتداد الشيك.');
      return;
    }

    setLoading(true);
    try {
      await issuedChequeService.returnCheque(cheque.id, returnDate, finalReason);
      showSuccess('تم تسجيل ارتداد الشيك وإعادة إثبات مديونية المورد بنجاح.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error returning cheque:', err);
      showError(err.message || 'فشل في تسجيل ارتداد الشيك.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir="rtl">
        
        {/* Header */}
        <div className="px-6 py-5 bg-rose-50/50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تسجيل ارتداد الشيك من البنك
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إلغاء ورقة الدفع وإعادة إثبات مديونية المورد
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
        <form onSubmit={handleConfirmReturn} className="p-6 space-y-4">
          
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-500">
              <span>رقم الشيك:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{cheque.cheque_number}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>المورد:</span>
              <span className="font-bold text-slate-900 dark:text-white">{cheque.supplier_name || cheque.payee_name}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>المبلغ:</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                {Number(cheque.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              تاريخ الارتداد <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm font-mono transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              سبب الارتداد <span className="text-rose-500">*</span>
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
            >
              {returnReasonsList.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {reason === 'سبب آخر' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                توضيح السبب بالتفصيل <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="اكتب سبب ارتداد الشيك..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
              />
            </div>
          )}

          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-300 text-[11px] leading-relaxed">
            ⚠️ <strong>الأثر المحاسبي:</strong> سيتم إنشاء قيد ارتداد (من حـ/ أوراق الدفع إلى حـ/ المورد) لإلغاء ورقة الدفع وإعادة تعليق المبلغ على حساب المورد.
          </div>

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
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{loading ? 'جاري التسجيل...' : 'تأكيد الارتداد'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
