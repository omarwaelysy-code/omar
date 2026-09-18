import React, { useState, useEffect } from 'react';
import { 
  X, Building2, Calendar, DollarSign, User, Printer, FileText, 
  Clock, Wrench, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight,
  Download, Paperclip, Share2, Layers, Tag
} from 'lucide-react';
import { FixedAsset, DepreciationScheduleItem } from '../../types/fixedAssets';
import { fixedAssetService } from '../../services/fixedAssetService';
import { useLanguage } from '../../contexts/LanguageContext';

interface AssetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string | null;
  onCapitalize?: (asset: FixedAsset) => void;
  onTransfer?: (asset: FixedAsset) => void;
  onMaintain?: (asset: FixedAsset) => void;
  onRevalue?: (asset: FixedAsset) => void;
  onDispose?: (asset: FixedAsset) => void;
}

export const AssetDetailsModal: React.FC<AssetDetailsModalProps> = ({
  isOpen,
  onClose,
  assetId,
  onCapitalize,
  onTransfer,
  onMaintain,
  onRevalue,
  onDispose
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'history' | 'components' | 'attachments'>('overview');
  const [loading, setLoading] = useState(false);
  const [assetData, setAssetData] = useState<FixedAsset | null>(null);
  const [schedule, setSchedule] = useState<DepreciationScheduleItem[]>([]);
  const [history, setHistory] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !assetId) return;
    loadAssetDetails(assetId);
  }, [isOpen, assetId]);

  const loadAssetDetails = async (id: string) => {
    setLoading(true);
    try {
      const [asset, sched, hist] = await Promise.all([
        fixedAssetService.getAsset(id),
        fixedAssetService.getDepreciationSchedule(id),
        fixedAssetService.getAssetHistory(id)
      ]);
      setAssetData(asset);
      setSchedule(sched);
      setHistory(hist);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const printAssetCard = () => {
    window.print();
  };

  if (!isOpen || !assetId) return null;

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; bg: string; text: string }> = {
      DRAFT: { label: 'مسودة', bg: 'bg-slate-700/60', text: 'text-slate-300' },
      PENDING_APPROVAL: { label: 'قيد الاعتماد', bg: 'bg-amber-500/10', text: 'text-amber-400' },
      ACTIVE: { label: 'نشط ويعمل', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
      FULLY_DEPRECIATED: { label: 'منتهي الإهلاك', bg: 'bg-blue-500/10', text: 'text-blue-400' },
      UNDER_MAINTENANCE: { label: 'تحت الصيانة', bg: 'bg-purple-500/10', text: 'text-purple-400' },
      DISPOSED: { label: 'مستبعد', bg: 'bg-rose-500/10', text: 'text-rose-400' },
      SOLD: { label: 'مباع', bg: 'bg-orange-500/10', text: 'text-orange-400' },
      SCRAPPED: { label: 'مخرّد', bg: 'bg-red-500/10', text: 'text-red-400' }
    };
    const c = config[status] || { label: status, bg: 'bg-slate-700', text: 'text-slate-300' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/60 print:border-b print:border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 print:hidden">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-extrabold text-white print:text-black">
                  {assetData?.name || 'بطاقة الأصل الثابت'}
                </h2>
                {assetData && getStatusBadge(assetData.status)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono print:text-gray-600">
                رقم الأصل: {assetData?.asset_number} {assetData?.category_name ? `• التصنيف: ${assetData.category_name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={printAssetCard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة البطاقة
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Operations Action Bar */}
        {assetData && assetData.status !== 'DISPOSED' && assetData.status !== 'SOLD' && (
          <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 bg-slate-800/30 border-b border-slate-800 print:hidden">
            {assetData.status === 'DRAFT' && onCapitalize && (
              <button
                onClick={() => onCapitalize(assetData)}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                اعتماد ورسملة الأصل
              </button>
            )}
            {assetData.status === 'ACTIVE' && (
              <>
                {onTransfer && (
                  <button
                    onClick={() => onTransfer(assetData)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    نقل وتغيير العهدة
                  </button>
                )}
                {onMaintain && (
                  <button
                    onClick={() => onMaintain(assetData)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    تسجيل صيانة
                  </button>
                )}
                {onRevalue && (
                  <button
                    onClick={() => onRevalue(assetData)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    إعادة تقييم
                  </button>
                )}
                {onDispose && (
                  <button
                    onClick={() => onDispose(assetData)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/30 text-rose-300 hover:text-white rounded-lg text-xs font-bold transition-all ml-auto"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    استبعاد / بيع الأصل
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-800 bg-slate-900/50 print:hidden">
          {[
            { id: 'overview', label: 'نظرة عامة والبيانات الفنية' },
            { id: 'schedule', label: `جدول الإهلاك (${schedule.length})` },
            { id: 'history', label: 'سجل الحركات التاريخي' },
            { id: 'components', label: `المكونات (${assetData?.components?.length || 0})` },
            { id: 'attachments', label: `المرفقات (${assetData?.attachments?.length || 0})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
              جاري تحميل بيانات وسجل الأصل...
            </div>
          ) : assetData ? (
            <div>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Financial KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <span className="text-[11px] font-medium text-slate-400">التكلفة التاريخية المرسملة</span>
                      <p className="text-lg font-black text-white mt-1">
                        {Number(assetData.capitalized_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </p>
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <span className="text-[11px] font-medium text-slate-400">مجمع الإهلاك المتراكم</span>
                      <p className="text-lg font-black text-amber-400 mt-1">
                        {Number(assetData.accumulated_depreciation || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </p>
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <span className="text-[11px] font-medium text-slate-400">صافي القيمة الدفترية (NBV)</span>
                      <p className="text-lg font-black text-emerald-400 mt-1">
                        {Number(assetData.net_book_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </p>
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <span className="text-[11px] font-medium text-slate-400">القيمة التخريدية</span>
                      <p className="text-lg font-black text-blue-400 mt-1">
                        {Number(assetData.salvage_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </p>
                    </div>
                  </div>

                  {/* Specifications & Org grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Organization & Custody */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">الموقع والعهدة الإدارية</h4>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">الموظف المسؤول (العهدة):</span>
                        <span className="font-bold text-white">{assetData.custodian_name || 'غير محدد'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">الفرع / المستودع:</span>
                        <span className="font-semibold text-white">{assetData.warehouse_name || 'المركز الرئيسي'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">القسم:</span>
                        <span className="font-semibold text-white">{assetData.department_name || 'عام'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">مركز التكلفة:</span>
                        <span className="font-semibold text-white">{assetData.cost_center_name || 'بدون مركز تكلفة'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5">
                        <span className="text-slate-400">الموقع الفعلي:</span>
                        <span className="font-semibold text-white">{assetData.location_name || 'غير محدد'}</span>
                      </div>
                    </div>

                    {/* Technical & Depreciation Specs */}
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">المعايير الفنية والإهلاك</h4>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">طريقة الإهلاك:</span>
                        <span className="font-bold text-blue-400">
                          {assetData.depreciation_method === 'STRAIGHT_LINE' ? 'القسط الثابت (Straight Line)' : assetData.depreciation_method}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">العمر الإنتاجي:</span>
                        <span className="font-semibold text-white">{assetData.useful_life} {assetData.useful_life_unit === 'MONTHS' ? 'شهور' : 'سنوات'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">الرقم التسلسلي (Serial):</span>
                        <span className="font-mono text-white">{assetData.serial_number || '---'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">الباركود:</span>
                        <span className="font-mono text-white">{assetData.barcode || '---'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5">
                        <span className="text-slate-400">الشركة والموديل:</span>
                        <span className="font-semibold text-white">{assetData.manufacturer || ''} {assetData.model || ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Accounting accounts summary */}
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">الحسابات المحاسبية المرتبطة</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">حساب الأصل الثابت</span>
                        <span className="font-bold text-white mt-1 block">{assetData.asset_account_name || 'غير محدد'}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">حساب مجمع الإهلاك</span>
                        <span className="font-bold text-white mt-1 block">{assetData.accumulated_depreciation_account_name || 'غير محدد'}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">حساب مصروف الإهلاك</span>
                        <span className="font-bold text-white mt-1 block">{assetData.depreciation_expense_account_name || 'غير محدد'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DEPRECIATION SCHEDULE */}
              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">جدول الإهلاك المتوقع والفعلي</h3>
                      <p className="text-xs text-slate-400">توزيع قسط الإهلاك الشهري على مدار العمر الإنتاجي للأصل حتى القيمة التخريدية</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-3">الفترة</th>
                          <th className="p-3">الرصيد الافتتاحي (NBV)</th>
                          <th className="p-3">قسط إهلاك الفترة</th>
                          <th className="p-3">مجمع الإهلاك</th>
                          <th className="p-3">الرصيد الختامي (NBV)</th>
                          <th className="p-3 text-center">الحالة المحاسبية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {schedule.map((row, idx) => (
                          <tr key={idx} className={row.is_posted ? 'bg-emerald-500/5' : 'hover:bg-slate-800/30'}>
                            <td className="p-3 font-semibold text-white">{row.period_name} ({row.period})</td>
                            <td className="p-3 font-mono">{row.opening_nbv.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 font-mono font-bold text-amber-400">{row.depreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 font-mono text-slate-300">{row.accumulated_depreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 font-mono font-bold text-emerald-400">{row.closing_nbv.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center">
                              {row.is_posted ? (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold">
                                  تم الترحيل
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full text-[10px]">
                                  متوقع
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: HISTORY TIMELINE */}
              {activeTab === 'history' && history && (
                <div className="space-y-6">
                  {/* Transfers */}
                  {history.transfers?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">سجل النقل وتغيير العهدة ({history.transfers.length})</h4>
                      <div className="space-y-2">
                        {history.transfers.map((t: any) => (
                          <div key={t.id} className="p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between text-slate-400">
                              <span>تاريخ النقل: <strong className="text-white">{t.transfer_date}</strong></span>
                              <span>بواسطة: {t.created_by}</span>
                            </div>
                            <p className="text-slate-300">
                              من عهدة: <strong>{t.from_custodian_name || 'بدون'}</strong> إلى: <strong className="text-emerald-400">{t.to_custodian_name || 'بدون'}</strong>
                              {t.to_location ? ` (الموقع: ${t.to_location})` : ''}
                            </p>
                            {t.reason && <p className="text-slate-400 text-[11px]">السبب: {t.reason}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Maintenance */}
                  {history.maintenance?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">سجل عمليات الصيانة ({history.maintenance.length})</h4>
                      <div className="space-y-2">
                        {history.maintenance.map((m: any) => (
                          <div key={m.id} className="p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="font-bold text-white">{m.maintenance_type} - {m.maintenance_date}</span>
                              <span className="font-black text-amber-400">{Number(m.cost).toLocaleString()} EGP</span>
                            </div>
                            <p className="text-slate-400 text-[11px]">{m.description || 'بدون وصف'}</p>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                              {m.is_capitalized ? 'مرسملة (أضيفت لتكلفة الأصل)' : 'مصروف صيانة تشغيلي'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Revaluations */}
                  {history.revaluations?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">سجل إعادة التقييم</h4>
                      <div className="space-y-2">
                        {history.revaluations.map((r: any) => (
                          <div key={r.id} className="p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between text-white font-semibold">
                              <span>التاريخ: {r.revaluation_date}</span>
                              <span>من {Number(r.old_value).toLocaleString()} إلى {Number(r.new_value).toLocaleString()} EGP</span>
                            </div>
                            <p className="text-emerald-400 font-bold text-[11px]">الفارق: {Number(r.difference).toLocaleString()} EGP</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Depreciations summary */}
                  {history.depreciations?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">سجل الإهلاكات المرحلة ({history.depreciations.length})</h4>
                      <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-800/60 text-slate-400">
                            <tr>
                              <th className="p-2">الدورة</th>
                              <th className="p-2">الافتتاحي</th>
                              <th className="p-2">الإهلاك</th>
                              <th className="p-2">الختامي</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {history.depreciations.map((d: any) => (
                              <tr key={d.id}>
                                <td className="p-2 font-semibold text-white">{d.period_name}</td>
                                <td className="p-2 font-mono">{Number(d.opening_nbv).toLocaleString()}</td>
                                <td className="p-2 font-mono text-amber-400 font-bold">{Number(d.depreciation_amount).toLocaleString()}</td>
                                <td className="p-2 font-mono text-emerald-400">{Number(d.closing_nbv).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: COMPONENTS */}
              {activeTab === 'components' && (
                <div className="space-y-3">
                  {(!assetData.components || assetData.components.length === 0) ? (
                    <p className="text-center py-10 text-slate-500 text-xs">لا توجد مكونات منفصلة مسجلة لهذا الأصل.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {assetData.components.map((comp, idx) => (
                        <div key={idx} className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl space-y-1">
                          <h5 className="text-xs font-bold text-white">{comp.name}</h5>
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>التكلفة: <strong className="text-amber-400">{Number(comp.cost).toLocaleString()} EGP</strong></span>
                            <span>العمر: {comp.useful_life || '---'} سنة</span>
                          </div>
                          {comp.serial_number && (
                            <p className="text-[10px] font-mono text-slate-400">سيريال: {comp.serial_number}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: ATTACHMENTS */}
              {activeTab === 'attachments' && (
                <div className="space-y-3">
                  {(!assetData.attachments || assetData.attachments.length === 0) ? (
                    <p className="text-center py-10 text-slate-500 text-xs">لا توجد مستندات أو صور مرفقة لهذا الأصل.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {assetData.attachments.map((att: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-semibold text-white truncate">{att.name}</p>
                              <p className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          {att.data && (
                            <a
                              href={att.data}
                              download={att.name}
                              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
