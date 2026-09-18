import React, { useState } from 'react';
import { 
  X, Calculator, Play, CheckCircle2, AlertCircle, Eye, 
  RotateCcw, DollarSign, Calendar, Layers, Check 
} from 'lucide-react';
import { fixedAssetService } from '../../services/fixedAssetService';
import { useNotification } from '../../contexts/NotificationContext';

interface AssetDepreciationRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssetDepreciationRunModal: React.FC<AssetDepreciationRunModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { showSuccess, showError } = useNotification();

  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = (now.getMonth() + 1).toString().padStart(2, '0');

  const [year, setYear] = useState<number>(defaultYear);
  const [month, setMonth] = useState<string>(defaultMonth);
  const [notes, setNotes] = useState('');

  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [posting, setPosting] = useState(false);

  if (!isOpen) return null;

  const monthNamesAr: Record<string, string> = {
    '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
    '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
    '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
  };

  const periodName = `${monthNamesAr[month] || month} ${year}`;
  const fromDate = `${year}-${month}-01`;
  const lastDay = new Date(year, parseInt(month, 10), 0).getDate();
  const toDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;

  const handlePreview = async () => {
    setLoadingPreview(true);
    setPreviewData(null);
    try {
      const data = await fixedAssetService.previewDepreciation({
        from_date: fromDate,
        to_date: toDate,
        period_name: periodName
      });
      setPreviewData(data);
      if (data.count === 0) {
        showError('لا توجد أصول مستحقة للإهلاك في هذه الفترة');
      }
    } catch (e: any) {
      showError(e.message || 'فشل حساب معاينة الإهلاك');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePost = async () => {
    if (!previewData || previewData.count === 0) {
      showError('يرجى إجراء المعاينة أولاً للتأكد من وجود أصول مستحقة');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من رغبتك في ترحيل إهلاك فترة (${periodName}) بإجمالي ${previewData.total_depreciation.toLocaleString()} EGP وتوليد القيود المحاسبية باليومية العامة؟`)) {
      return;
    }

    setPosting(true);
    try {
      const res = await fixedAssetService.runDepreciation({
        from_date: fromDate,
        to_date: toDate,
        period_name: periodName,
        notes
      });
      showSuccess(res.message || 'تم ترحيل دورة الإهلاك بنجاح');
      onSuccess();
      onClose();
    } catch (e: any) {
      showError(e.message || 'فشل ترحيل الإهلاك');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">تشغيل دورة الإهلاك الدوري</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                حساب ومعاينة أقساط الإهلاك لكافة الأصول النشطة وترحيل القيود إلى دفتر اليومية العام آلياً
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Period Selection */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">تحديد فترة الإهلاك</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">السنة المالية</label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(parseInt(e.target.value, 10) || defaultYear)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">الشهر</label>
                <select
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm"
                >
                  {Object.entries(monthNamesAr).map(([mNum, mName]) => (
                    <option key={mNum} value={mNum}>{mNum} - {mName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">نطاق التاريخ</label>
                <div className="text-xs font-mono text-slate-300 bg-slate-800/80 border border-slate-700 rounded-lg p-2.5">
                  من {fromDate} إلى {toDate}
                </div>
              </div>

              <button
                type="button"
                onClick={handlePreview}
                disabled={loadingPreview}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                {loadingPreview ? 'جاري الحساب...' : 'معاينة الإهلاك (Preview)'}
              </button>
            </div>
          </div>

          {/* Preview Results */}
          {previewData && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
                  <span className="text-[11px] font-medium text-slate-400">الفترة المحددة</span>
                  <p className="text-base font-bold text-white mt-1">{periodName}</p>
                </div>

                <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
                  <span className="text-[11px] font-medium text-slate-400">عدد الأصول المستحقة</span>
                  <p className="text-base font-extrabold text-blue-400 mt-1">{previewData.count} أصل</p>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <span className="text-[11px] font-medium text-amber-300">إجمالي إهلاك الفترة</span>
                  <p className="text-xl font-black text-amber-400 mt-1">
                    {previewData.total_depreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </p>
                </div>
              </div>

              {/* Table of items */}
              <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-72">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-800 sticky top-0 text-slate-300 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">رقم الأصل</th>
                      <th className="p-3">اسم الأصل</th>
                      <th className="p-3">التصنيف</th>
                      <th className="p-3">الرصيد الافتتاحي (NBV)</th>
                      <th className="p-3">قسط إهلاك الفترة</th>
                      <th className="p-3">الرصيد الختامي (NBV)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {previewData.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-white font-bold">{item.asset_number}</td>
                        <td className="p-3 font-medium text-slate-200">{item.asset_name}</td>
                        <td className="p-3 text-slate-400">{item.category_name}</td>
                        <td className="p-3 font-mono">{Number(item.opening_nbv).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 font-mono font-bold text-amber-400">+{Number(item.depreciation_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{Number(item.closing_nbv).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">ملاحظات ترحيل الدورة (تظهر في القيد المحاسبي)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="ملاحظات دورة الإهلاك..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handlePost}
            disabled={posting || !previewData || previewData.count === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            {posting ? 'جاري ترحيل القيود...' : 'اعتماد وترحيل الإهلاك وإنشاء القيود'}
          </button>
        </div>
      </div>
    </div>
  );
};
