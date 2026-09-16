import React, { useState } from 'react';
import { X, Calendar, AlertCircle, Clock } from 'lucide-react';
import { IssuedCheque } from '../../types';
import { issuedChequeService } from '../../services/issuedChequeService';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface ChequePostponeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cheque: IssuedCheque | null;
}

export const ChequePostponeModal: React.FC<ChequePostponeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cheque
}) => {
  const { showSuccess, showError } = useNotification();
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  const [newDueDate, setNewDueDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !cheque) return null;

  const currentDueDate = cheque.due_date ? String(cheque.due_date).slice(0, 10) : '';

  const handleConfirmPostpone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDueDate) {
      showError(isAr ? 'يرجى تحديد تاريخ الاستحقاق الجديد.' : 'Please specify the new due date.');
      return;
    }
    if (newDueDate <= currentDueDate) {
      showError(isAr ? 'تاريخ الاستحقاق الجديد يجب أن يكون بعد التاريخ الحالي.' : 'New due date must be after current due date.');
      return;
    }

    setLoading(true);
    try {
      await issuedChequeService.postponeCheque(cheque.id, newDueDate, reason);
      showSuccess(isAr ? `تم تأجيل استحقاق الشيك إلى ${newDueDate} بنجاح.` : `Cheque due date postponed to ${newDueDate} successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error postponing cheque:', err);
      showError(err.message || (isAr ? 'فشل في تأجيل تاريخ الشيك.' : 'Failed to postpone cheque.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir={dir}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? 'تأجيل استحقاق الشيك' : 'Postpone Cheque Due Date'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'تمديد ميعاد الصرف وتوثيق سبب التأجيل' : 'Extend payment due date and record reason'}
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
        <form onSubmit={handleConfirmPostpone} className="p-6 space-y-4">
          
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-500">
              <span>{isAr ? 'رقم الشيك:' : 'Cheque #:'}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{cheque.cheque_number}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>{isAr ? 'المبلغ:' : 'Amount:'}</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {Number(cheque.amount).toLocaleString(isAr ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2 })} {cheque.currency || (isAr ? 'ج.م' : 'EGP')}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>{isAr ? 'تاريخ الاستحقاق الحالي:' : 'Current Due Date:'}</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{currentDueDate}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'تاريخ الاستحقاق الجديد' : 'New Due Date'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              min={currentDueDate}
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm font-mono transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'سبب التأجيل' : 'Postponement Reason'}
            </label>
            <textarea
              rows={2}
              required
              placeholder={isAr ? "مثال: الاتفاق مع المورد على مد أجل السداد / تأخر تدفقات نقدية..." : "E.g. Agreement with supplier / cash flow adjustment..."}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all resize-none"
            />
          </div>

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
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>{loading ? (isAr ? 'جاري التأجيل...' : 'Postponing...') : (isAr ? 'تأكيد التأجيل' : 'Confirm Postpone')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
