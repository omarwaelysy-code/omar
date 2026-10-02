import React from 'react';
import { RotateCcw, AlertTriangle, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { formatDate } from '../../utils/formatUtils';

export interface ReversalBannerProps {
  isReversed?: boolean;
  reversedAt?: string;
  reversalReason?: string;
  reversedByDocNumber?: string;
  reversedByEntryNumber?: string;
  reversalSettlementNumber?: string;
  isReversalDoc?: boolean;
  originalDocNumber?: string;
  originalEntryNumber?: string;
}

export const ReversalBanner: React.FC<ReversalBannerProps> = ({
  isReversed,
  reversedAt,
  reversalReason,
  reversedByDocNumber,
  reversedByEntryNumber,
  reversalSettlementNumber,
  isReversalDoc,
  originalDocNumber,
  originalEntryNumber
}) => {
  if (!isReversed && !isReversalDoc) return null;

  if (isReversed) {
    return (
      <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-3.5 text-right text-xs my-2.5 shadow-2xs space-y-1.5" dir="rtl">
        <div className="flex items-center gap-2 text-amber-700 font-black">
          <AlertTriangle size={17} className="text-amber-600 shrink-0" />
          <span className="text-sm">⚠️ هذا المستند معكوس (Reversed Document)</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-black text-[10px]">
            معكوس
          </span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-zinc-700 font-semibold border-t border-amber-200/60">
          {reversedByDocNumber && (
            <div>
              <span className="text-zinc-500 font-normal">المستند العكسي: </span>
              <span className="font-mono font-bold text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded">{reversedByDocNumber}</span>
            </div>
          )}
          {reversedByEntryNumber && (
            <div>
              <span className="text-zinc-500 font-normal">القيد العكسي: </span>
              <span className="font-mono font-bold text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded">{reversedByEntryNumber}</span>
            </div>
          )}
          {reversalSettlementNumber && (
            <div>
              <span className="text-zinc-500 font-normal">تسوية العكس: </span>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded">{reversalSettlementNumber}</span>
            </div>
          )}
          {reversedAt && (
            <div>
              <span className="text-zinc-500 font-normal">تاريخ العكس: </span>
              <span className="font-mono font-bold text-zinc-800">{formatDate(reversedAt)}</span>
            </div>
          )}
          {reversalReason && (
            <div className="sm:col-span-2">
              <span className="text-zinc-500 font-normal">السبب: </span>
              <span className="text-zinc-900 font-bold">{reversalReason}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isReversalDoc) {
    return (
      <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-2xl p-3.5 text-right text-xs my-2.5 shadow-2xs space-y-1.5" dir="rtl">
        <div className="flex items-center gap-2 text-blue-700 font-black">
          <RotateCcw size={17} className="text-blue-600 shrink-0" />
          <span className="text-sm">🔄 مستند حركة عكسية (Reversal Document)</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-black text-[10px]">
            حركة عكسية
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-zinc-700 font-semibold border-t border-blue-200/60">
          {originalDocNumber && (
            <div>
              <span className="text-zinc-500 font-normal">المستند الأصلي: </span>
              <span className="font-mono font-bold text-blue-900 bg-blue-100/70 px-1.5 py-0.5 rounded">{originalDocNumber}</span>
            </div>
          )}
          {originalEntryNumber && (
            <div>
              <span className="text-zinc-500 font-normal">القيد الأصلي: </span>
              <span className="font-mono font-bold text-blue-900 bg-blue-100/70 px-1.5 py-0.5 rounded">{originalEntryNumber}</span>
            </div>
          )}
          {reversalSettlementNumber && (
            <div>
              <span className="text-zinc-500 font-normal">تسوية العكس: </span>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded">{reversalSettlementNumber}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
