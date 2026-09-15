import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, DollarSign, Building2, Calendar, Wallet } from 'lucide-react';
import { IssuedCheque, PaymentMethod, Account } from '../../types';
import { issuedChequeService } from '../../services/issuedChequeService';
import { useNotification } from '../../contexts/NotificationContext';

interface ChequePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cheque: IssuedCheque | null;
  paymentMethods?: PaymentMethod[];
  accounts?: Account[];
}

export const ChequePaymentModal: React.FC<ChequePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cheque,
  paymentMethods = [],
  accounts = []
}) => {
  const { showSuccess, showError } = useNotification();
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  // Set default bank account to the cheque's bank
  useEffect(() => {
    if (cheque) {
      setSelectedAccountId(cheque.bank_account_id || '');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [cheque, isOpen]);

  // Valid account usages for "النقدية والبنوك والوسائل المالية"
  const validCashUsages = ['cash', 'petty_cash', 'bank', 'wallet', 'credit_card', 'debit_card', 'main_cash'];

  // Collect all available financial methods/accounts
  const { bankOptions, cashAndOtherOptions } = useMemo(() => {
    const banks: Array<{ id: string; name: string; type: string; isDefault: boolean }> = [];
    const cashList: Array<{ id: string; name: string; type: string }> = [];

    // 1. From Payment Methods
    paymentMethods.forEach(pm => {
      const isBank = pm.type === 'bank' || Boolean(pm.bank_name);
      const isDefault = pm.id === cheque?.bank_account_id;
      const item = {
        id: pm.id,
        name: `${pm.name}${pm.bank_name ? ` (${pm.bank_name})` : ''}${pm.currency ? ` [${pm.currency}]` : ''}`,
        type: pm.type,
        isDefault
      };
      if (isBank) {
        banks.push(item);
      } else {
        cashList.push(item);
      }
    });

    // 2. From Accounts with cash/bank usage not already covered
    accounts.forEach(acc => {
      if (validCashUsages.includes(acc.account_usage || '')) {
        const alreadyInPm = paymentMethods.some(pm => pm.account_id === acc.id || pm.id === acc.id);
        if (!alreadyInPm) {
          const isBank = acc.account_usage === 'bank';
          const isDefault = acc.id === cheque?.bank_account_id;
          const item = {
            id: acc.id,
            name: `${acc.code ? `${acc.code} - ` : ''}${acc.name}`,
            type: acc.account_usage || 'cash',
            isDefault
          };
          if (isBank) {
            banks.push(item);
          } else {
            cashList.push(item);
          }
        }
      }
    });

    // Sort banks so that the cheque's default bank is first
    banks.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

    return { bankOptions: banks, cashAndOtherOptions: cashList };
  }, [paymentMethods, accounts, cheque?.bank_account_id]);

  // Selected account/method display name
  const selectedAccountName = useMemo(() => {
    const all = [...bankOptions, ...cashAndOtherOptions];
    const found = all.find(a => a.id === selectedAccountId);
    return found?.name || cheque?.bank_name || 'حساب البنك';
  }, [bankOptions, cashAndOtherOptions, selectedAccountId, cheque?.bank_name]);

  if (!isOpen || !cheque) return null;

  const isForeign = cheque.currency && cheque.currency !== 'EGP';
  const exchangeRate = Number(cheque.exchange_rate) || 1.0;
  const equivalentEgp = isForeign ? Number(cheque.amount) * exchangeRate : Number(cheque.amount);

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      showError('يرجى اختيار حساب الصرف والخصم.');
      return;
    }
    setLoading(true);
    try {
      await issuedChequeService.payCheque(cheque.id, paymentDate, notes, selectedAccountId);
      showSuccess('تم تسجيل صرف وسداد الشيك وترحيل القيد بنجاح.');
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir="rtl">
        
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
                خصم قيمة الشيك وتوليد قيد التسوية المحاسبي
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
              <span>البنك الأصلي المسحوب عليه:</span>
              <span className="font-bold text-slate-900 dark:text-white">{cheque.bank_name || 'بنك الشيك'}</span>
            </div>
            
            <div className="flex justify-between items-center text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">المبلغ المطلوب خصمه:</span>
              <div className="text-left">
                <span className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {Number(cheque.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {cheque.currency || 'ج.م'}
                </span>
                {isForeign && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                    يعادل: {Number(equivalentEgp).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م (بسعر صرف {exchangeRate})
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bank / Cash Account Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>حساب الصرف والخصم (النقدية والبنوك والوسائل المالية) <span className="text-rose-500">*</span></span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {bankOptions.some(b => b.id === selectedAccountId) ? 'حساب بنكي' : 'خزينة / وسيلة مالية'}
              </span>
            </label>
            <div className="relative group">
              <select
                required
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              >
                <optgroup label="الحسابات البنكية (البنك الافتراضي للشيك أولاً)">
                  {bankOptions.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.id === cheque.bank_account_id ? ' ★ (الافتراضي للشيك)' : ''}
                    </option>
                  ))}
                </optgroup>
                {cashAndOtherOptions.length > 0 && (
                  <optgroup label="الخزائن والنقدية والوسائل المالية الأخرى">
                    {cashAndOtherOptions.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              * تم تعيين البنك المسحوب عليه كافتراضي، ويمكنك تغييره لأي حساب نقدية أو بنك آخر مسجل بالنظام.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              تاريخ الخصم والصرف الفعلي من الحساب <span className="text-rose-500">*</span>
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
            ⚠️ <strong>ملاحظة محاسبية:</strong> سيتم إنشاء قيد يومية آلياً (من حـ/ {cheque.credit_account_name || 'أوراق الدفع'} إلى حـ/ {selectedAccountName}) وتحديث حالة الشيك إلى <strong>مدفوع</strong>.
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
