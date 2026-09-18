import React, { useState } from 'react';
import { 
  X, Calendar, Building2, User, FileText, CheckCircle2, Clock, 
  RotateCcw, Ban, Paperclip, Printer, ExternalLink, ArrowDownLeft,
  Eye, Download
} from 'lucide-react';
import { ReceivedCheque } from '../../types';
import { tafqeetAr, tafqeetEn } from '../../utils/tafqeet';
import { useLanguage } from '../../contexts/LanguageContext';
import { EGYPTIAN_BANKS_DATA, BankLogoBadge, EgyptianBank } from '../../data/egyptianBanks';
import { AttachmentPreviewModal, ChequeAttachmentData } from '../common/AttachmentPreviewModal';

interface ReceivedChequeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: ReceivedCheque | null;
  onCollect?: (cheque: ReceivedCheque) => void;
  onPostpone?: (cheque: ReceivedCheque) => void;
  onReturn?: (cheque: ReceivedCheque) => void;
  onCancel?: (cheque: ReceivedCheque) => void;
}

export const ReceivedChequeDetailsModal: React.FC<ReceivedChequeDetailsModalProps> = ({
  isOpen,
  onClose,
  cheque,
  onCollect,
  onPostpone,
  onReturn,
  onCancel
}) => {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState<ChequeAttachmentData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handlePreviewAttachment = (att: ChequeAttachmentData) => {
    setSelectedPreviewAttachment(att);
    setIsPreviewOpen(true);
  };

  const handleDownloadAttachment = (att: ChequeAttachmentData) => {
    if (!att?.url) return;
    try {
      const a = document.createElement('a');
      a.href = att.url;
      a.download = att.name || 'cheque_document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(att.url, '_blank');
    }
  };

  if (!isOpen || !cheque) return null;

  const isForeign = cheque.currency && cheque.currency !== 'EGP';
  const exchangeRate = Number(cheque.exchange_rate) || 1.0;
  const equivalentEgp = isForeign ? Number(cheque.amount) * exchangeRate : Number(cheque.amount);

  const matchedBank = React.useMemo<EgyptianBank | null>(() => {
    if (!cheque) return null;
    const nameToSearch = (cheque.drawee_bank || cheque.deposit_bank_name || '').trim().toLowerCase();
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
    if (isOverdue && ['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(status)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse">
          <Clock className="w-3.5 h-3.5" />
          {isAr ? 'مستحق التحصيل (متأخر)' : 'Overdue for Collection'}
        </span>
      );
    }
    switch (status) {
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isAr ? 'مستلم في الحافظة' : 'In Portfolio'}
          </span>
        );
      case 'UNDER_COLLECTION':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            {isAr ? 'برسم التحصيل' : 'Under Collection'}
          </span>
        );
      case 'COLLECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isAr ? 'محصل بالبنك' : 'Collected / Cleared'}
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
            {isAr ? 'مرتد من البنك' : 'Returned / Bounced'}
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

  const isOverdue = cheque.due_date && new Date(cheque.due_date) < new Date() && ['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(cheque.status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir={dir}>
        
        {/* Modal Header */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {matchedBank ? (
              <BankLogoBadge bank={matchedBank} size="sm" className="shadow-xs" />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-bold">
                📥
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr ? 'شيك وارد رقم:' : 'Received Cheque #:'} <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{cheque.cheque_number}</span>
                </h3>
                {cheque.receipt_number && (
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    {cheque.receipt_number}
                  </span>
                )}
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    {isAr ? 'غير قابل للتداول' : 'Not Negotiable'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr ? 'تفاصيل استلام الشيك وأوراق القبض والحالة البنكية' : 'Received cheque details, notes receivable, and bank status'}
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

        {/* Modal Body */}
        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          
          {/* Main Amount Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-600/15 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-blue-100 font-medium">{isAr ? 'مبلغ الشيك المستلم' : 'Received Cheque Amount'}</p>
                <h2 className="text-xl font-black font-mono mt-0.5">
                  {Number(cheque.amount).toLocaleString(isAr ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-bold">{cheque.currency || (isAr ? 'ج.م' : 'EGP')}</span>
                </h2>
                {isForeign && (
                  <p className="text-[11px] text-blue-200 font-semibold mt-0.5">
                    {isAr 
                      ? `يعادل: ${Number(equivalentEgp).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م (سعر الصرف: ${exchangeRate})`
                      : `Equivalent: ${Number(equivalentEgp).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP (Rate: ${exchangeRate})`}
                  </p>
                )}
              </div>
              <div className={`${isAr ? 'text-left' : 'text-right'} text-[11px] text-blue-100 space-y-0.5`}>
                <p>{isAr ? 'تاريخ الاستلام:' : 'Receipt Date:'} <span className="font-mono font-bold text-white">{String(cheque.receipt_date).slice(0, 10)}</span></p>
                <p>{isAr ? 'تاريخ الاستحقاق:' : 'Due Date:'} <span className="font-mono font-bold text-white">{String(cheque.due_date).slice(0, 10)}</span></p>
              </div>
            </div>

            {/* Tafqeet */}
            <div className="pt-2 border-t border-blue-500/40 text-xs font-serif font-bold text-blue-50 leading-relaxed">
              <span>{isAr ? 'التفقيط: ' : 'In Words: '}</span>
              <span className="text-white font-black">{tafqeetText}</span>
              {isForeign && (
                <span className="text-blue-200 text-[11px] block mt-0.5">
                  ({isAr ? 'المعادل بالمصري:' : 'EGP Equivalent:'} {tafqeetAr(equivalentEgp, 'EGP')})
                </span>
              )}
            </div>
          </div>

          {/* Core Information Grid - 3 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                <User className="w-3 h-3" /> {isAr ? 'العميل / الساحب' : 'Customer / Drawer'}
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {cheque.customer_name || cheque.payer_name || (isAr ? 'غير محدد' : 'Unspecified')}
              </p>
              {cheque.cheque_type && (
                <p className="text-[10px] text-blue-600 font-semibold">
                  {String(cheque.cheque_type).toUpperCase() === 'CUSTOMER' ? (isAr ? 'شيك عميل' : 'Customer Cheque') : (isAr ? 'شيك أوراق قبض أخرى' : 'Other Cheque')}
                </p>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                <FileText className="w-3 h-3" /> {isAr ? 'حساب أوراق القبض (المدين)' : 'Debit Account'}
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {cheque.debit_account_name || (isAr ? 'أوراق قبض' : 'Notes Receivable')}
              </p>
              <p className="text-[10px] text-blue-600 font-semibold">{isAr ? 'أصل متداول - أوراق قبض' : 'Current Asset - Notes Receivable'}</p>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                <Building2 className="w-3 h-3" /> {isAr ? 'البنك المسحوب عليه' : 'Drawee Bank'}
              </span>
              <div className="flex items-center gap-1.5">
                {matchedBank && <BankLogoBadge bank={matchedBank} size="sm" className="w-5 h-5 p-0.5 shadow-none" />}
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {cheque.drawee_bank || (isAr ? 'غير محدد' : 'Unspecified')}
                </p>
              </div>
            </div>
          </div>

          {/* Deposit bank info if collected */}
          {cheque.deposit_bank_name && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-bold">{isAr ? 'تم الإيداع في حساب بنك:' : 'Deposited into Bank:'}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">{cheque.deposit_bank_name}</span>
            </div>
          )}

          {/* Description & Notes */}
          {(cheque.purpose || cheque.notes) && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
              {cheque.purpose && (
                <div>
                  <span className="text-slate-400 font-medium">{isAr ? 'البيان والغرض: ' : 'Purpose: '}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{cheque.purpose}</span>
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

          {/* Settlement Details */}
          {Array.isArray(cheque.settlement_details) && cheque.settlement_details.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'تسويات فواتير المبيعات المرتبطة' : 'Linked Sales Invoice Settlements'}
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="p-2">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                      <th className="p-2">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="p-2">{isAr ? 'إجمالي الفاتورة' : 'Total'}</th>
                      <th className="p-2">{isAr ? 'المبلغ المسدد' : 'Settled Amount'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cheque.settlement_details.map((st: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 font-mono font-bold text-blue-600 dark:text-blue-400">{st.invoice_number || st.invoice_id}</td>
                        <td className="p-2 font-mono text-slate-600 dark:text-slate-300">{st.invoice_date ? String(st.invoice_date).slice(0, 10) : '-'}</td>
                        <td className="p-2 font-mono">{Number(st.invoice_total || 0).toLocaleString()} {cheque.currency || (isAr ? 'ج.م' : 'EGP')}</td>
                        <td className="p-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">{Number(st.settled_amount || 0).toLocaleString()} {cheque.currency || (isAr ? 'ج.م' : 'EGP')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lifecycle & Status Details */}
          {cheque.status === 'COLLECTED' && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {isAr ? 'تم تحصيل الشيك وإيداعه في البنك' : 'Cheque Collected & Deposited'}
              </span>
              <p className="text-slate-600 dark:text-slate-300">
                {isAr ? 'تاريخ التحصيل الفعلي:' : 'Collection Date:'} <span className="font-mono font-bold">{cheque.collected_date ? String(cheque.collected_date).slice(0, 10) : '-'}</span>
              </p>
            </div>
          )}

          {cheque.status === 'POSTPONED' && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs space-y-1">
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
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-xs space-y-1">
              <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> {isAr ? 'شيك مرتد من البنك المسحوب عليه' : 'Cheque Returned / Bounced'}
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
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
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
                <Paperclip className="w-3.5 h-3.5" /> {isAr ? `المرفقات وصور الشيك (${cheque.attachments.length})` : `Attachments (${cheque.attachments.length})`}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {cheque.attachments.map((att, idx) => (
                  <div
                    key={att.id || idx}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 flex items-center justify-between gap-2.5 transition-all text-xs"
                  >
                    <div
                      onClick={() => handlePreviewAttachment(att)}
                      className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group"
                    >
                      {att.type && att.type.startsWith('image/') ? (
                        <img src={att.url} alt={att.name} className="w-8 h-8 object-cover rounded-lg shrink-0 border border-slate-200 dark:border-slate-700" />
                      ) : (
                        <FileText className="w-8 h-8 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{att.name}</p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-semibold">
                          <Eye className="w-2.5 h-2.5" /> {isAr ? 'معاينة' : 'Preview'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDownloadAttachment(att); }}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors shrink-0 cursor-pointer"
                      title={isAr ? 'تحميل المرفق' : 'Download'}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2">
          {['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(cheque.status) && (
            <>
              {onCollect && (
                <button
                  type="button"
                  onClick={() => { onClose(); onCollect(cheque); }}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isAr ? 'تحصيل وإيداع بالبنك' : 'Collect & Deposit'}
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

          {['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(cheque.status) && onCancel && (
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
      </div>

      {/* Attachment Preview Modal */}
      <AttachmentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        attachment={selectedPreviewAttachment}
      />
    </div>
  );
};
