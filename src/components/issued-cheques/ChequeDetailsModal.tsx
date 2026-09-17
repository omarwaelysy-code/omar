import React from 'react';
import { 
  X, Calendar, Building2, User, FileText, CheckCircle2, Clock, 
  RotateCcw, Ban, Paperclip, Printer, ExternalLink, ShieldCheck, ArrowUpRight 
} from 'lucide-react';
import { IssuedCheque } from '../../types';
import { tafqeetAr, tafqeetEn } from '../../utils/tafqeet';
import { useLanguage } from '../../contexts/LanguageContext';
import { EGYPTIAN_BANKS_DATA, BankLogoBadge, EgyptianBank } from '../../data/egyptianBanks';

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
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  if (!isOpen || !cheque) return null;

  const isForeign = cheque.currency && cheque.currency !== 'EGP';
  const exchangeRate = Number(cheque.exchange_rate) || 1.0;
  const equivalentEgp = isForeign ? Number(cheque.amount) * exchangeRate : Number(cheque.amount);

  const matchedBank = React.useMemo<EgyptianBank | null>(() => {
    if (!cheque) return null;
    const nameToSearch = (cheque.bank_name || '').trim().toLowerCase();
    if (nameToSearch) {
      const b = EGYPTIAN_BANKS_DATA.find(x => 
        x.nameAr.toLowerCase() === nameToSearch ||
        nameToSearch.includes(x.nameAr.toLowerCase()) ||
        x.nameAr.toLowerCase().includes(nameToSearch) ||
        x.nameEn.toLowerCase() === nameToSearch ||
        nameToSearch.includes(x.code.toLowerCase()) ||
        x.code.toLowerCase() === nameToSearch
      );
      if (b) return b;
    }
    return null;
  }, [cheque]);

  const tafqeetText = isAr 
    ? tafqeetAr(Number(cheque.amount) || 0, cheque.currency || 'EGP')
    : tafqeetEn(Number(cheque.amount) || 0, cheque.currency || 'EGP');

  const getStatusBadge = (status: string, isOverdue?: boolean) => {
    if (isOverdue && (status === 'ISSUED' || status === 'POSTPONED')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse">
          <Clock className="w-3.5 h-3.5" />
          {isAr ? 'متأخر الصرف (مستحق)' : 'Overdue (Due)'}
        </span>
      );
    }
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {isAr ? 'مسودة (غير مصدر)' : 'Draft (Unissued)'}
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isAr ? 'صادر (برسم الدفع)' : 'Issued (Under Payment)'}
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isAr ? 'مدفوع / تم الصرف' : 'Paid / Cleared'}
          </span>
        );
      case 'POSTPONED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            {isAr ? 'مؤجل الاستحقاق' : 'Postponed'}
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <RotateCcw className="w-3.5 h-3.5" />
            {isAr ? 'مرتد من البنك' : 'Returned by Bank'}
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            <Ban className="w-3.5 h-3.5" />
            {isAr ? 'ملغى' : 'Cancelled'}
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const isOverdue = cheque.due_date && new Date(cheque.due_date) < new Date() && ['ISSUED', 'POSTPONED'].includes(cheque.status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir={dir}>
        
        {/* Modal Header - Compact */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {matchedBank ? (
              <BankLogoBadge bank={matchedBank} size="sm" className="shadow-xs" />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg font-bold">
                🏦
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr ? 'شيك رقم:' : 'Cheque #:'} <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{cheque.cheque_number}</span>
                </h3>
                {cheque.serial_number && (
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {cheque.serial_number}
                  </span>
                )}
                {getStatusBadge(cheque.status, isOverdue)}
                {cheque.is_crossed && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {isAr ? 'مسطر //' : 'Crossed //'}
                  </span>
                )}
                {cheque.is_not_negotiable && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    {isAr ? 'غير قابل للتداول' : 'Not Negotiable'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr ? 'تفاصيل الشيك الصادر والسجل المحاسبي وحالة المعالجة' : 'Issued cheque details, accounting records, and processing state'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Compact */}
        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          
          {/* Main Amount Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/15 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-emerald-100 font-medium">{isAr ? 'مبلغ الشيك المطبوع' : 'Printed Cheque Amount'}</p>
                <h2 className="text-xl font-black font-mono mt-0.5">
                  {Number(cheque.amount).toLocaleString(isAr ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-bold">{cheque.currency || (isAr ? 'ج.م' : 'EGP')}</span>
                </h2>
                {isForeign && (
                  <p className="text-[11px] text-emerald-200 font-semibold mt-0.5">
                    {isAr 
                      ? `يعادل: ${Number(equivalentEgp).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م (سعر الصرف: ${exchangeRate})`
                      : `Equivalent: ${Number(equivalentEgp).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP (Rate: ${exchangeRate})`}
                  </p>
                )}
              </div>
              <div className={`${isAr ? 'text-left' : 'text-right'} text-[11px] text-emerald-100 space-y-0.5`}>
                <p>{isAr ? 'تاريخ التحرير:' : 'Issue Date:'} <span className="font-mono font-bold text-white">{String(cheque.issue_date).slice(0, 10)}</span></p>
                <p>{isAr ? 'تاريخ الاستحقاق:' : 'Due Date:'} <span className="font-mono font-bold text-white">{String(cheque.due_date).slice(0, 10)}</span></p>
              </div>
            </div>

            {/* Tafqeet in words */}
            <div className="pt-2 border-t border-emerald-500/40 text-xs font-serif font-bold text-emerald-50 leading-relaxed">
              <span>{isAr ? 'التفقيط: ' : 'In Words: '}</span>
              <span className="text-white font-black">{tafqeetText}</span>
              {isForeign && (
                <span className="text-emerald-200 text-[11px] block mt-0.5">
                  ({isAr ? 'المعادل بالمصري:' : 'EGP Equivalent:'} {tafqeetAr(equivalentEgp, 'EGP')})
                </span>
              )}
            </div>
          </div>

          {/* Core Information Grid - 3 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                <User className="w-3 h-3" /> {isAr ? 'المورد المستفيد (المدين)' : 'Beneficiary / Supplier'}
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {cheque.supplier_name || (isAr ? 'غير محدد' : 'Unspecified')}
              </p>
              {cheque.payee_name && cheque.payee_name !== cheque.supplier_name && (
                <p className="text-[10px] text-slate-500 truncate">{isAr ? 'المستفيد:' : 'Payee:'} {cheque.payee_name}</p>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                <FileText className="w-3 h-3" /> {isAr ? 'الحساب الدائن' : 'Credit Account'}
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {cheque.credit_account_name || (isAr ? 'أوراق دفع - شيكات صادرة' : 'Notes Payable - Issued Cheques')}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">{isAr ? 'التزام أوراق دفع' : 'Notes Payable Liability'}</p>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                <Building2 className="w-3 h-3" /> {isAr ? 'الحساب البنكي المسحوب عليه' : 'Drawn-On Bank Account'}
              </span>
              <div className="flex items-center gap-1.5">
                {matchedBank && <BankLogoBadge bank={matchedBank} size="sm" className="w-5 h-5 p-0.5 shadow-none" />}
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {matchedBank ? (isAr ? matchedBank.nameAr : (matchedBank.nameEn || matchedBank.nameAr)) : (cheque.bank_name || (isAr ? 'الحساب البنكي' : 'Bank Account'))}
                </p>
              </div>
              {cheque.account_number && (
                <p className="text-[10px] font-mono text-slate-500">{isAr ? 'رقم الحساب:' : 'Account #:'} {cheque.account_number}</p>
              )}
            </div>
          </div>

          {/* Description & Notes */}
          {(cheque.description || cheque.notes) && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              {cheque.description && (
                <div>
                  <span className="text-slate-400 font-medium">{isAr ? 'البيان والغرض: ' : 'Memo / Purpose: '}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{cheque.description}</span>
                </div>
              )}
              {cheque.notes && (
                <div>
                  <span className="text-slate-400 font-medium">{isAr ? 'ملاحظات: ' : 'Notes: '}</span>
                  <span className="text-slate-700 dark:text-slate-300">{cheque.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Lifecycle & Status Details */}
          {cheque.status === 'PAID' && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {isAr ? 'تم صرف الشيك من البنك' : 'Cheque Cleared by Bank'}
              </span>
              <p className="text-slate-600 dark:text-slate-300">
                {isAr ? 'تاريخ الصرف الفعلي:' : 'Clearance Date:'} <span className="font-mono font-bold">{cheque.payment_date ? String(cheque.payment_date).slice(0, 10) : '-'}</span>
              </p>
            </div>
          )}

          {cheque.status === 'POSTPONED' && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs space-y-1">
              <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {isAr ? 'تم تأجيل موعد الاستحقاق' : 'Cheque Due Date Postponed'}
              </span>
              <p className="text-slate-600 dark:text-slate-300">
                {isAr ? 'التاريخ الأصلي:' : 'Original Date:'} <span className="font-mono">{cheque.old_due_date ? String(cheque.old_due_date).slice(0, 10) : '-'}</span> ➔ {isAr ? 'التاريخ الجديد:' : 'New Date:'} <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{String(cheque.due_date).slice(0, 10)}</span>
              </p>
              {cheque.postponement_reason && (
                <p className="text-slate-500">{isAr ? 'سبب التأجيل:' : 'Reason:'} {cheque.postponement_reason}</p>
              )}
            </div>
          )}

          {cheque.status === 'RETURNED' && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-xs space-y-1">
              <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> {isAr ? 'شيك مرتد من البنك' : 'Cheque Returned by Bank'}
              </span>
              <p className="text-slate-600 dark:text-slate-300">
                {isAr ? 'تاريخ الارتداد:' : 'Return Date:'} <span className="font-mono font-bold">{cheque.return_date ? String(cheque.return_date).slice(0, 10) : '-'}</span>
              </p>
              {cheque.return_reason && (
                <p className="text-rose-600 dark:text-rose-400 font-bold">{isAr ? 'السبب:' : 'Reason:'} {cheque.return_reason}</p>
              )}
            </div>
          )}

          {cheque.status === 'CANCELLED' && (
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Ban className="w-4 h-4" /> {isAr ? 'تم إلغاء الشيك' : 'Cheque Cancelled'}
              </span>
              {cheque.cancel_reason && (
                <p className="text-slate-600 dark:text-slate-400">{isAr ? 'سبب الإلغاء:' : 'Reason:'} {cheque.cancel_reason}</p>
              )}
            </div>
          )}

          {/* Attachments Section */}
          {Array.isArray(cheque.attachments) && cheque.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> {isAr ? `المرفقات وصورة الشيك (${cheque.attachments.length})` : `Attachments & Scans (${cheque.attachments.length})`}
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
                        {isAr ? 'عرض الملف' : 'View File'} <ExternalLink className="w-2.5 h-2.5" />
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer - Compact */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          
          <div className="flex items-center gap-1.5">
            {onPrint && (
              <button
                type="button"
                onClick={() => onPrint(cheque)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                {isAr ? 'طباعة الشيك' : 'Print Cheque'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {cheque.status === 'DRAFT' && onIssue && (
              <button
                type="button"
                onClick={() => { onClose(); onIssue(cheque); }}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isAr ? 'اعتماد وإصدار الشيك' : 'Approve & Issue Cheque'}
              </button>
            )}

            {['ISSUED', 'POSTPONED'].includes(cheque.status) && (
              <>
                {onPay && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onPay(cheque); }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isAr ? 'تسجيل الصرف والسداد' : 'Record Clearance'}
                  </button>
                )}
                {onPostpone && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onPostpone(cheque); }}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {isAr ? 'تأجيل الاستحقاق' : 'Postpone Due Date'}
                  </button>
                )}
                {onReturn && (
                  <button
                    type="button"
                    onClick={() => { onClose(); onReturn(cheque); }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {isAr ? 'تسجيل الارتداد' : 'Record Return'}
                  </button>
                )}
              </>
            )}

            {['DRAFT', 'ISSUED', 'POSTPONED'].includes(cheque.status) && onCancel && (
              <button
                type="button"
                onClick={() => { onClose(); onCancel(cheque); }}
                className="px-3.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                {isAr ? 'إلغاء الشيك' : 'Cancel Cheque'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
