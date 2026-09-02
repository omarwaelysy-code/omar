import React, { useState } from 'react';
import { X, Ban, AlertCircle } from 'lucide-react';
import { IssuedCheque } from '../../types';
import { issuedChequeService } from '../../services/issuedChequeService';
import { useNotification } from '../../contexts/NotificationContext';

interface ChequeCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cheque: IssuedCheque | null;
}

export const ChequeCancelModal: React.FC<ChequeCancelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cheque
}) => {
  const { showSuccess, showError } = useNotification();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !cheque) return null;

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showError('يرجى توضيح سبب إلغاء الشيك.');
      return;
    }

    setLoading(true);
    try {
      await issuedChequeService.cancelCheque(cheque.id, reason.trim());
      showSuccess('تم إلغاء الشيك وعكس أي أثر محاسبي له بنجاح.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error cancelling cheque:', err);
      showError(err.message || 'فشل في إلغاء الشيك.');
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
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                إلغاء الشيك الصادر
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إلغاء الشيك وعكس القيود المحاسبية المرتبطة به
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
        <form onSubmit={handleConfirmCancel} className="p-6 space-y-4">
          
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
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {Number(cheque.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              سبب الإلغاء <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="مثال: خطأ في تحرير الشيك / استبدال بطريقة دفع أخرى / إلغاء المعاملة..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
            ⚠️ <strong>تنبيه:</strong> سيتم تحويل حالة الشيك إلى <strong>ملغى</strong>، وإذا كان الشيك قد تم إصداره مسبقاً، فسيتم إنشاء قيد عكسي لقيد الإصدار تلقائياً.
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              تراجع
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Ban className="w-4 h-4" />
              <span>{loading ? 'جاري الإلغاء...' : 'تأكيد إلغاء الشيك'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
