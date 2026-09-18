import React, { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { ReceivedCheque } from '../../types';
import { receivedChequeService } from '../../services/receivedChequeService';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReceivedChequeReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cheque: ReceivedCheque | null;
}

export const ReceivedChequeReturnModal: React.FC<ReceivedChequeReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cheque
}) => {
  const { showSuccess, showError } = useNotification();
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(isAr ? 'عدم كفاية الرصيد' : 'Insufficient Funds');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !cheque) return null;

  const returnReasonsList = isAr ? [
    'عدم كفاية الرصيد',
    'اختلاف في التوقيع',
    'خطأ في صياغة التاريخ أو المبلغ',
    'الشيك متقادم / منتهي الصلاحية',
    'إيقاف الصرف من قبل الساحب',
    'الحساب مغلق أو مجمد',
    'سبب آخر'
  ] : [
    'Insufficient Funds',
    'Signature Mismatch',
    'Date or Amount Error',
    'Cheque Expired / Stale',
    'Stop Payment by Drawer',
    'Account Closed or Frozen',
    'Other Reason'
  ];

  const otherReasonLabel = isAr ? 'سبب آخر' : 'Other Reason';

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === otherReasonLabel ? customReason.trim() : reason;
    if (!finalReason) {
      showError(isAr ? 'يرجى تحديد أو إدخال سبب ارتداد الشيك.' : 'Please specify or enter the cheque return reason.');
      return;
    }

    setLoading(true);
    try {
      await receivedChequeService.returnCheque(cheque.id, returnDate, finalReason);
      showSuccess(isAr ? 'تم تسجيل ارتداد الشيك الوارد وإعادة إثبات مديونية العميل بنجاح.' : 'Cheque return recorded and customer balance re-established successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error returning cheque:', err);
      showError(err.message || (isAr ? 'فشل في تسجيل ارتداد الشيك.' : 'Failed to record cheque return.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir={dir}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-rose-50/50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? 'تسجيل ارتداد الشيك الوارد' : 'Record Received Cheque Bounce / Return'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'ارتداد الشيك من البنك المسحوب عليه وإعادة إثبات المديونية' : 'Cheque bounced by drawee bank and customer debt re-established'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirmReturn} className="p-6 space-y-4">
          
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-500">
              <span>{isAr ? 'رقم الشيك:' : 'Cheque #:'}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{cheque.cheque_number}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>{isAr ? 'العميل / الساحب:' : 'Customer / Payer:'}</span>
              <span className="font-bold text-slate-900 dark:text-white">{cheque.customer_name || cheque.payer_name}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>{isAr ? 'البنك المسحوب عليه:' : 'Drawee Bank:'}</span>
              <span className="font-bold text-slate-900 dark:text-white">{cheque.drawee_bank || '-'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>{isAr ? 'المبلغ:' : 'Amount:'}</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                {Number(cheque.amount).toLocaleString(isAr ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2 })} {cheque.currency || (isAr ? 'ج.م' : 'EGP')}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'تاريخ الارتداد' : 'Return Date'} <span className="text-rose-500">*</span>
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
              {isAr ? 'سبب الارتداد' : 'Return Reason'} <span className="text-rose-500">*</span>
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

          {reason === otherReasonLabel && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'توضيح السبب بالتفصيل' : 'Detailed Explanation'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={isAr ? "اكتب سبب ارتداد الشيك..." : "Enter cheque return reason..."}
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
              />
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{loading ? (isAr ? 'جاري التسجيل...' : 'Recording...') : (isAr ? 'تأكيد تسجيل الارتداد' : 'Confirm Return')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
