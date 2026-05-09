import React from 'react';
import { FileText } from 'lucide-react';
import { formatNumber } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';

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

export const JournalEntryPreview: React.FC<JournalEntryPreviewProps> = ({ items, title }) => {
  const { t } = useLanguage();
  const displayTitle = title || t('journal.preview_title');

  if (items.length === 0) return null;

  const totalDebit = items.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = items.reduce((sum, item) => sum + item.credit, 0);

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-100 flex items-center gap-2">
        <FileText size={16} className="text-slate-400" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{displayTitle}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="px-4 py-2 font-bold">{t('common.account')}</th>
              <th className="px-4 py-2 font-bold text-left">{t('common.debit')}</th>
              <th className="px-4 py-2 font-bold text-left">{t('common.credit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-white transition-colors">
                <td className="px-4 py-2">
                  <div className="font-bold text-slate-900">{item.account_name}</div>
                  <div className="text-[10px] text-slate-400">{item.description}</div>
                </td>
                <td className="px-4 py-2 text-left font-mono font-bold text-emerald-600">
                  {item.debit > 0 ? formatNumber(item.debit) : '-'}
                </td>
                <td className="px-4 py-2 text-left font-mono font-bold text-rose-600">
                  {item.credit > 0 ? formatNumber(item.credit) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100/30 font-bold border-t border-slate-200">
              <td className="px-4 py-2 text-slate-600">{t('common.total')}</td>
              <td className="px-4 py-2 text-left font-mono text-emerald-700">{formatNumber(totalDebit)}</td>
              <td className="px-4 py-2 text-left font-mono text-rose-700">{formatNumber(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {Math.abs(totalDebit - totalCredit) > 0.01 && (
        <div className="px-4 py-2 bg-rose-50 text-rose-600 text-[10px] font-bold text-center border-t border-rose-100">
          {t('journal.unbalanced_warning')}
        </div>
      )}
    </div>
  );
};
