import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Building2, Calendar } from 'lucide-react';
import { ReceivedCheque, PaymentMethod } from '../../types';
import { receivedChequeService } from '../../services/receivedChequeService';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatNumber } from '../../utils/formatUtils';

interface ReceivedChequeCollectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cheque: ReceivedCheque | null;
  paymentMethods?: PaymentMethod[];
}

export const ReceivedChequeCollectModal: React.FC<ReceivedChequeCollectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cheque,
  paymentMethods = []
}) => {
  const { showSuccess, showError } = useNotification();
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cheque) {
      setCollectionDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      if (paymentMethods.length > 0 && !selectedAccountId) {
        setSelectedAccountId(paymentMethods[0].id);
      }
    }
  }, [cheque, isOpen, paymentMethods]);

  if (!isOpen || !cheque) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      showError(isAr ? 'يرجى اختيار حساب البنك أو الخزينة المودع بها الشيك.' : 'Please select a deposit bank or cash account.');
      return;
    }

    setLoading(true);
    try {
      await receivedChequeService.collectCheque(cheque.id, selectedAccountId, collectionDate, notes);
      showSuccess(isAr ? 'تم تسجيل تحصيل الشيك وإيداعه بنجاح.' : 'Cheque collected and deposited successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error collecting received cheque:', err);
      showError(err.message || (isAr ? 'فشل في تسجيل تحصيل الشيك.' : 'Failed to collect cheque.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm" dir={dir}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'تحصيل وإيداع الشيك الوارد' : 'Collect & Deposit Cheque'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr ? `شيك رقم: ${cheque.cheque_number}` : `Cheque #${cheque.cheque_number}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Cheque Brief Summary */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{isAr ? 'العميل / الجهة:' : 'From:'}</span>
              <span className="font-bold text-slate-900 dark:text-white">{cheque.customer_name || cheque.payer_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{isAr ? 'البنك المسحوب عليه:' : 'Drawee Bank:'}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{cheque.bank_name || '-'}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 font-bold">{isAr ? 'المبلغ المراد تحصيله:' : 'Amount:'}</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatNumber(cheque.amount)} ج.م
              </span>
            </div>
          </div>

          {/* Deposit Account */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'إيداع في حساب البنك / الخزينة' : 'Deposit Into (Bank/Cash)'} <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              required
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">{isAr ? '-- اختر حساب الإيداع --' : '-- Select Account --'}</option>
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.id}>
                  {pm.name} {pm.bank_name ? `(${pm.bank_name})` : ''} {pm.account_number ? `[${pm.account_number}]` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Collection Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'تاريخ التحصيل والإيداع' : 'Collection Date'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={collectionDate}
              onChange={e => setCollectionDate(e.target.value)}
              required
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'ملاحظات التحصيل' : 'Notes'}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={isAr ? 'أدخل أي ملاحظات بخصوص عملية التحصيل...' : 'Optional notes...'}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loading ? (isAr ? 'جاري التحصيل...' : 'Collecting...') : (isAr ? 'تأكيد التحصيل والإيداع' : 'Confirm Collection')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
