import React from 'react';
import { FileText } from 'lucide-react';

interface JournalEntryItem {
  account_name: string;
  debit: number;
  credit: number;
  description?: string;
}

interface JournalEntryPreviewProps {
  items: JournalEntryItem[];
  title?: string;
}

export const JournalEntryPreview: React.FC<JournalEntryPreviewProps> = ({ items, title = 'معاينة قيد اليومية' }) => {
  if (items.length === 0) return null;

  const totalDebit = items.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = items.reduce((sum, item) => sum + item.credit, 0);

  return (
    <div className="bg-zinc-50 rounded-2xl border border-zinc-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="px-4 py-3 bg-zinc-100/50 border-b border-zinc-100 flex items-center gap-2">
        <FileText size={16} className="text-zinc-400" />
        <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">{title}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead>
            <tr className="text-zinc-400 border-b border-zinc-100">
              <th className="px-4 py-2 font-bold">الحساب</th>
              <th className="px-4 py-2 font-bold text-left">مدين</th>
              <th className="px-4 py-2 font-bold text-left">دائن</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-white transition-colors">
                <td className="px-4 py-2">
                  <div className="font-bold text-zinc-900">{item.account_name}</div>
                  <div className="text-[10px] text-zinc-400 italic">{item.description}</div>
                </td>
                <td className="px-4 py-2 text-left font-mono font-bold text-emerald-600">
                  {item.debit > 0 ? item.debit.toLocaleString() : '-'}
                </td>
                <td className="px-4 py-2 text-left font-mono font-bold text-rose-600">
                  {item.credit > 0 ? item.credit.toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-100/30 font-black border-t border-zinc-200">
              <td className="px-4 py-2 text-zinc-600">الإجمالي</td>
              <td className="px-4 py-2 text-left font-mono text-emerald-700">{totalDebit.toLocaleString()}</td>
              <td className="px-4 py-2 text-left font-mono text-rose-700">{totalCredit.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {Math.abs(totalDebit - totalCredit) > 0.01 && (
        <div className="px-4 py-2 bg-rose-50 text-rose-600 text-[10px] font-bold text-center border-t border-rose-100">
          تنبيه: القيد غير متزن!
        </div>
      )}
    </div>
  );
};
