import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, Calendar, FileText, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, formatNumber } from '../../utils/formatUtils';
import { apiRequest } from '../../services/dbService';
import { useNotification } from '../../contexts/NotificationContext';

export interface ReversalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  moduleName: string;
  docId: string;
  docNumber: string;
  docDate: string;
  docAmount?: number;
  entityName?: string;
  entityType?: 'customer' | 'supplier' | 'general' | null;
  moduleTitleAr: string;
}

export const ReversalModal: React.FC<ReversalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  moduleName,
  docId,
  docNumber,
  docDate,
  docAmount,
  entityName,
  entityType,
  moduleTitleAr
}) => {
  const { showNotification } = useNotification();
  const todayStr = new Date().toISOString().slice(0, 10);
  const originalDateClean = docDate ? docDate.slice(0, 10) : todayStr;

  const [dateChoice, setDateChoice] = useState<'original' | 'today' | 'custom'>('original');
  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const getEffectiveDate = () => {
    if (dateChoice === 'original') return originalDateClean;
    if (dateChoice === 'today') return todayStr;
    return customDate || todayStr;
  };

  const handleConfirm = async () => {
    const finalDate = getEffectiveDate();
    if (!finalDate) {
      showNotification('يرجى تحديد تاريخ العكس.', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await apiRequest<any>('/documents/reverse', 'POST', {
        moduleName,
        docId,
        reversalDate: finalDate,
        reason: reason.trim()
      });

      if (res && res.success) {
        showNotification(
          `تم عكس المستند بنجاح! تم إنشاء المستند العكسي (${res.reversalDocNumber})${res.reversalEntryNumber ? ' والقيد (' + res.reversalEntryNumber + ')' : ''}`,
          'success'
        );
        window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: moduleName } }));
        window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
        window.dispatchEvent(new CustomEvent('db-refresh', {}));
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        throw new Error(res?.error || 'فشل عكس المستند.');
      }
    } catch (err: any) {
      console.error('Error in reversal:', err);
      showNotification(err.message || 'حدث خطأ أثناء عكس المستند.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col text-right font-sans"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-900">عكس المستند (Reverse Document)</h3>
                <p className="text-xs text-amber-800 font-bold">
                  إلغاء الأثر المالي والمخزني بحركة عكسية مع الحفاظ على المستند الأصلي
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              disabled={loading}
              className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            
            {/* Original Document Summary */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold">نوع المستند:</span>
                <span className="font-black text-zinc-800">{moduleTitleAr}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold">رقم المستند الأصلي:</span>
                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{docNumber}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold">تاريخ المستند الأصلي:</span>
                <span className="font-mono text-zinc-700">{formatDate(docDate)}</span>
              </div>
              {docAmount !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-bold">القيمة الإجمالية:</span>
                  <span className="font-mono font-black text-emerald-700">{formatNumber(docAmount)}</span>
                </div>
              )}
              {entityName && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-bold">{entityType === 'supplier' ? 'المورد:' : 'العميل:'}</span>
                  <span className="font-bold text-zinc-800">{entityName}</span>
                </div>
              )}
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-zinc-800">
                اختر تاريخ العكس (Reversal Date):
              </label>

              <div className="grid grid-cols-1 gap-2">
                {/* Option 1: Same Date */}
                <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  dateChoice === 'original' ? 'bg-blue-50/70 border-blue-400 text-blue-950 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="radio" 
                      name="dateChoice" 
                      value="original" 
                      checked={dateChoice === 'original'}
                      onChange={() => setDateChoice('original')}
                      className="text-blue-600 focus:ring-blue-500" 
                    />
                    <div>
                      <span className="text-xs block">نفس تاريخ الحركة الأصلية</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{formatDate(docDate)}</span>
                    </div>
                  </div>
                  <Calendar size={16} className="text-zinc-400" />
                </label>

                {/* Option 2: Today */}
                <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  dateChoice === 'today' ? 'bg-blue-50/70 border-blue-400 text-blue-950 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="radio" 
                      name="dateChoice" 
                      value="today" 
                      checked={dateChoice === 'today'}
                      onChange={() => setDateChoice('today')}
                      className="text-blue-600 focus:ring-blue-500" 
                    />
                    <div>
                      <span className="text-xs block">تاريخ اليوم الحالي</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{todayStr}</span>
                    </div>
                  </div>
                  <Calendar size={16} className="text-zinc-400" />
                </label>

                {/* Option 3: Custom Date */}
                <label className={`p-3 rounded-xl border cursor-pointer transition-all space-y-2 ${
                  dateChoice === 'custom' ? 'bg-blue-50/70 border-blue-400 text-blue-950 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="radio" 
                        name="dateChoice" 
                        value="custom" 
                        checked={dateChoice === 'custom'}
                        onChange={() => setDateChoice('custom')}
                        className="text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-xs">تاريخ مخصص يتم إدخاله</span>
                    </div>
                    <Calendar size={16} className="text-zinc-400" />
                  </div>

                  {dateChoice === 'custom' && (
                    <div className="pt-1">
                      <input 
                        type="date" 
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="w-full bg-white border border-zinc-300 rounded-lg p-2 text-xs font-mono font-bold text-zinc-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-zinc-800">
                سبب العكس / ملاحظات التدقيق:
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="أدخل سبب العكس (مثال: إلغاء بناءً على طلب العميل، خطأ في الحساب...)"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-zinc-400"
              />
            </div>

            {/* Advisory Info */}
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>تنبيه رقابي:</strong> لن يتم حذف المستند الأصلي، بل سيتم حفظه مع قيده، وتوليد مستند عكسي جديد وقيد عكسي متطابق وتسوية إقفال آلية للأرصدة وفقاً للمعايير المحاسبية المعتمدة.
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-bold border border-zinc-200 transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-600/20 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'جاري العكس المحاسبي...' : 'تأكيد عكس المستند'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
