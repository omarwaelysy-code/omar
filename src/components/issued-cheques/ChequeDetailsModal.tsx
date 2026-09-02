import React from 'react';
import { 
  X, Calendar, Building2, User, FileText, CheckCircle2, Clock, 
  RotateCcw, Ban, Paperclip, Printer, ExternalLink, ShieldCheck, ArrowUpRight 
} from 'lucide-react';
import { IssuedCheque } from '../../types';

interface ChequeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: IssuedCheque | null;
  onIssue?: (cheque: IssuedCheque) => void;
  onPay?: (cheque: IssuedCheque) => void;
  onPostpone?: (cheque: IssuedCheque) => void;
  onReturn?: (cheque: IssuedCheque) => void;
  onCancel?: (cheque: IssuedCheque) => void;
  onPrint?: (cheque: IssuedCheque) => void;
}

export const ChequeDetailsModal: React.FC<ChequeDetailsModalProps> = ({
  isOpen,
  onClose,
  cheque,
  onIssue,
  onPay,
  onPostpone,
  onReturn,
  onCancel,
  onPrint
}) => {
  if (!isOpen || !cheque) return null;

  const getStatusBadge = (status: string, isOverdue?: boolean) => {
    if (isOverdue && (status === 'ISSUED' || status === 'POSTPONED')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse">
          <Clock className="w-3.5 h-3.5" />
          متأخر الصرف (مستحق)
        </span>
      );
    }
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            مسودة (غير مصدر)
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            صادر (برسم الدفع)
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            مدفوع / تم الصرف
          </span>
        );
      case 'POSTPONED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            مؤجل الاستحقاق
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <RotateCcw className="w-3.5 h-3.5" />
            مرتد من البنك
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            <Ban className="w-3.5 h-3.5" />
            ملغى
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const isOverdue = cheque.due_date && new Date(cheque.due_date) < new Date() && ['ISSUED', 'POSTPONED'].includes(cheque.status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir="rtl">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold">
              🏦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  شيك رقم: <span className="font-mono">{cheque.cheque_number}</span>
                </h3>
                {getStatusBadge(cheque.status, isOverdue)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تفاصيل الشيك الصادر والسجل المحاسبي وحالة المعالجة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Main Amount Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-lg shadow-emerald-600/15">
            <div>
              <p className="text-xs text-emerald-100 font-medium">مبلغ الشيك الإجمالي</p>
              <h2 className="text-2xl font-black font-mono mt-1">
                {Number(cheque.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} <span className="text-sm font-normal">ج.م</span>
              </h2>
            </div>
            <div className="text-left text-xs text-emerald-100 space-y-1">
              <p>تاريخ التحرير: <span className="font-mono font-bold text-white">{String(cheque.issue_date).slice(0, 10)}</span></p>
              <p>تاريخ الاستحقاق: <span className="font-mono font-bold text-white">{String(cheque.due_date).slice(0, 10)}</span></p>
            </div>
          </div>

          {/* Core Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> المورد المستفيد
              </span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {cheque.supplier_name || 'غير محدد'}
              </p>
              {cheque.payee_name && cheque.payee_name !== cheque.supplier_name && (
                <p className="text-xs text-slate-500">المستفيد المكتوب: {cheque.payee_name}</p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> الحساب البنكي المسحوب عليه
              </span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {cheque.bank_name || 'الحساب البنكي'}
              </p>
              {cheque.account_number && (
                <p className="text-xs font-mono text-slate-500">رقم الحساب: {cheque.account_number}</p>
              )}
            </div>
          </div>

          {/* Description & Notes */}
          {(cheque.description || cheque.notes) && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              {cheque.description && (
                <div>
                  <span className="text-slate-400 font-medium">البيان والغرض: </span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{cheque.description}</span>
                </div>
              )}
              {cheque.notes && (
                <div>
                  <span className="text-slate-400 font-medium">ملاحظات: </span>
                  <span className="text-slate-700 dark:text-slate-300">{cheque.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Lifecycle & Status Details */}
          {cheque.status === 'PAID' && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> تم صرف الشيك من البنك
              </span>
              <p className="text-slate-600 dark:text-slate-300">
                تاريخ الصرف الفعلي: <span className="font-mono font-bold">{cheque.payment_date ? String(cheque.payment_date).slice(0, 10) : '-'}</span>
              </p>
            </div>
          )}

          {cheque.status === 'POSTPONED' && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs space-y-1">
              <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> تم تأجيل موعد الاستحقاق
              </span>
              <p className="text-slate-600 dark:text-slate-300">
                التاريخ الأصلي: <span className="font-mono">{cheque.old_due_date ? String(cheque.old_due_date).slice(0, 10) : '-'}</span> ➔ التاريخ الجديد: <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{String(cheque.due_date).slice(0, 10)}</span>
              </p>
              {cheque.postponement_reason && (
                <p className="text-slate-500">سبب التأجيل: {cheque.postponement_reason}</p>
              )}
            </div>
          )}

          {cheque.status === 'RETURNED' && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-xs space-y-1">
              <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> شيك مرتد من البنك
              </span>
              <p className="text-slate-600 dark:text-slate-300">
                تاريخ الارتداد: <span className="font-mono font-bold">{cheque.return_date ? String(cheque.return_date).slice(0, 10) : '-'}</span>
              </p>
              {cheque.return_reason && (
                <p className="text-rose-600 dark:text-rose-400 font-bold">السبب: {cheque.return_reason}</p>
              )}
            </div>
          )}

          {cheque.status === 'CANCELLED' && (
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Ban className="w-4 h-4" /> تم إلغاء الشيك
              </span>
              {cheque.cancel_reason && (
                <p className="text-slate-600 dark:text-slate-400">سبب الإلغاء: {cheque.cancel_reason}</p>
              )}
            </div>
          )}

          {/* Attachments Section */}
          {Array.isArray(cheque.attachments) && cheque.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> المرفقات وصورة الشيك ({cheque.attachments.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cheque.attachments.map(att => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center gap-2.5 transition-all text-xs group"
                  >
                    {att.type.startsWith('image/') ? (
                      <img src={att.url} alt={att.name} className="w-8 h-8 object-cover rounded-lg" />
                    ) : (
                      <FileText className="w-8 h-8 text-slate-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-600">{att.name}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        عرض الملف <ExternalLink className="w-2.5 h-2.5" />
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            {onPrint && (
              <button
                type="button"
                onClick={() => onPrint(cheque)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-white dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                طباعة الشيك / إيصال الاستلام
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {cheque.status === 'DRAFT' && onIssue && (
              <button
                type="button"
                onClick={() => { onClose(); onIssue(cheque); }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                اعتماد وإصدار الشيك
              </button>
            )}

            {['ISSUED', 'POSTPONED'].includes(cheque.status) && (
              <>
                {onPay && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onPay(cheque); }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    تسجيل الصرف والسداد
                  </button>
                )}
                {onPostpone && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onPostpone(cheque); }}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all"
                  >
                    <Clock className="w-4 h-4" />
                    تأجيل الاستحقاق
                  </button>
                )}
                {onReturn && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onReturn(cheque); }}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    تسجيل الارتداد
                  </button>
                )}
              </>
            )}

            {['DRAFT', 'ISSUED', 'POSTPONED'].includes(cheque.status) && onCancel && (
              <button
                type="button"
                onClick={() => { onClose(); onCancel(cheque); }}
                className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Ban className="w-4 h-4" />
                إلغاء الشيك
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
