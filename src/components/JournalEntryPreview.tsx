import React from 'react';
import { FileText, Hash, CheckCircle2 } from 'lucide-react';
import { formatNumber } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';

export interface JournalEntryItem {
  account_code?: string;
  account_name: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntryPreviewProps {
  items: JournalEntryItem[];
  title?: string;
  entry_number?: string;
}

export const JournalEntryPreview: React.FC<JournalEntryPreviewProps> = ({ items, title, entry_number }) => {
  const { t, language } = useLanguage();
  const displayTitle = title || (language === 'ar' ? 'معاينة القيد المحاسبي' : 'Journal Entry Preview');

  if (items.length === 0) return null;

  const totalDebit = items.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
  const totalCredit = items.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);

  const accountColText = language === 'ar' ? 'الحساب ورقم الحساب' : 'Account & Code';
  const debitColText = language === 'ar' ? 'مدين' : 'Debit';
  const creditColText = language === 'ar' ? 'دائن' : 'Credit';
  const totalText = language === 'ar' ? 'الإجمالي' : 'Total';

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="px-3.5 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-indigo-600" />
          <span className="text-xs font-black text-slate-800 tracking-wide">{displayTitle}</span>
        </div>
        {entry_number && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-xs font-black shadow-xs">
            <Hash size={12} className="text-indigo-500" />
            <span>{language === 'ar' ? `رقم القيد: ${entry_number}` : `Entry #: ${entry_number}`}</span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead>
            <tr className="text-slate-500 bg-slate-100/40 border-b border-slate-200/60 font-bold">
              <th className="px-3.5 py-2">{accountColText}</th>
              <th className="px-3.5 py-2 text-left font-mono">{debitColText}</th>
              <th className="px-3.5 py-2 text-left font-mono">{creditColText}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              // Format account label: if code is provided and not already in name, combine them
              let label = item.account_name;
              if (item.account_code && !item.account_name.includes(item.account_code)) {
                label = `${item.account_code} - ${item.account_name}`;
              }

              return (
                <tr key={idx} className="hover:bg-white transition-colors">
                  <td className="px-3.5 py-2">
                    <div className="flex items-center gap-1.5 font-black text-slate-900">
                      {item.account_code && (
                        <span className="font-mono text-indigo-600 bg-indigo-50/80 border border-indigo-100 px-1.5 py-0.5 rounded text-[11px] font-bold">
                          {item.account_code}
                        </span>
                      )}
                      <span>{item.account_name}</span>
                    </div>
                    {item.description && (
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">{item.description}</div>
                    )}
                  </td>
                  <td className="px-3.5 py-2 text-left font-mono font-black text-emerald-600">
                    {item.debit > 0 ? formatNumber(item.debit) : '-'}
                  </td>
                  <td className="px-3.5 py-2 text-left font-mono font-black text-rose-600">
                    {item.credit > 0 ? formatNumber(item.credit) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100/50 font-black border-t border-slate-200">
              <td className="px-3.5 py-2 text-slate-700">{totalText}</td>
              <td className="px-3.5 py-2 text-left font-mono text-emerald-700">{formatNumber(totalDebit)}</td>
              <td className="px-3.5 py-2 text-left font-mono text-rose-700">{formatNumber(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {Math.abs(totalDebit - totalCredit) > 0.01 && (
        <div className="px-4 py-2 bg-rose-50 text-rose-600 text-[10px] font-bold text-center border-t border-rose-100">
          {language === 'ar' ? 'تنبيه: القيد غير متزن محاسبياً!' : 'Warning: Journal entry is unbalanced!'}
        </div>
      )}
    </div>
  );
};
