import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Printer, Filter, RefreshCw, BarChart3, 
  Calendar, Building2, User, DollarSign, Layers 
} from 'lucide-react';
import { fixedAssetService } from '../../services/fixedAssetService';
import * as XLSX from 'xlsx';

export const FixedAssetsReportsTab: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<string>('register');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const reportsList = [
    { id: 'register', label: '1. سجل الأصول الثابتة الشامل (Asset Register)' },
    { id: 'depreciation', label: '2. تقرير إهلاك الأصول الدوري (Depreciation Report)' },
    { id: 'movement', label: '3. تقرير حركات ونقل الأصول والعهدة (Movement Report)' },
    { id: 'valuation', label: '4. تقرير القيمة الدفترية والتقييم (Valuation Report)' },
    { id: 'fully_depreciated', label: '5. تقرير الأصول منتهية الإهلاك (Fully Depreciated)' },
    { id: 'disposal', label: '6. تقرير استبعاد وبيع الأصول (Disposal Report)' },
    { id: 'gain_loss', label: '7. تقرير أرباح وخسائر التصرف في الأصول (Gain / Loss)' },
    { id: 'by_custodian', label: '8. تقرير الأصول حسب الموظفين والعهدة (By Custodian)' },
    { id: 'by_location', label: '9. تقرير الأصول حسب الفروع والمواقع (By Location)' },
    { id: 'maintenance', label: '10. تقرير تكاليف صيانة الأصول (Maintenance Report)' }
  ];

  useEffect(() => {
    loadReport(selectedReport);
  }, [selectedReport]);

  const loadReport = async (repType: string) => {
    setLoading(true);
    try {
      const rows = await fixedAssetService.getReport(repType);
      setData(rows || []);
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    if (data.length === 0) return;
    const repName = reportsList.find(r => r.id === selectedReport)?.label || selectedReport;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${repName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}.xlsx`);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl print:hidden">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-300">نوع التقرير:</label>
          <select
            value={selectedReport}
            onChange={e => setSelectedReport(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[280px]"
          >
            {reportsList.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadReport(selectedReport)}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={printReport}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" />
            طباعة التقرير
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            تصدير إلى Excel
          </button>
        </div>
      </div>

      {/* Report Header for Print */}
      <div className="hidden print:block text-center py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-black">{reportsList.find(r => r.id === selectedReport)?.label}</h2>
        <p className="text-xs text-gray-500 mt-1">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
      </div>

      {/* Report Table View */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/60 print:border-none print:bg-white">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">جاري تجميع وحساب بيانات التقرير...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">لا توجد بيانات مسجلة لهذا التقرير.</div>
        ) : (
          <table className="w-full text-right text-xs print:text-black">
            <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-800 print:bg-gray-100 print:text-black">
              {/* Dynamic Headers per Report Type */}
              {selectedReport === 'register' && (
                <tr>
                  <th className="p-3">رقم الأصل</th>
                  <th className="p-3">اسم الأصل</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">الفرع / المخزن</th>
                  <th className="p-3">القسم</th>
                  <th className="p-3">العهدة</th>
                  <th className="p-3">تاريخ الشراء</th>
                  <th className="p-3">التكلفة المرسملة</th>
                  <th className="p-3">مجمع الإهلاك</th>
                  <th className="p-3">صافي القيمة الدفترية</th>
                  <th className="p-3">الحالة</th>
                </tr>
              )}
              {selectedReport === 'depreciation' && (
                <tr>
                  <th className="p-3">رقم الدورة</th>
                  <th className="p-3">الفترة</th>
                  <th className="p-3">رقم الأصل</th>
                  <th className="p-3">اسم الأصل</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">الرصيد الافتتاحي</th>
                  <th className="p-3">إهلاك الفترة</th>
                  <th className="p-3">مجمع الإهلاك</th>
                  <th className="p-3">الرصيد الختامي</th>
                </tr>
              )}
              {selectedReport === 'movement' && (
                <tr>
                  <th className="p-3">تاريخ النقل</th>
                  <th className="p-3">رقم الأصل</th>
                  <th className="p-3">اسم الأصل</th>
                  <th className="p-3">من فرع</th>
                  <th className="p-3">إلى فرع</th>
                  <th className="p-3">من عهدة</th>
                  <th className="p-3">إلى عهدة</th>
                  <th className="p-3">السبب</th>
                </tr>
              )}
              {selectedReport === 'valuation' && (
                <tr>
                  <th className="p-3">تصنيف الأصل</th>
                  <th className="p-3">عدد الأصول</th>
                  <th className="p-3">إجمالي التكلفة</th>
                  <th className="p-3">مجمع الإهلاك</th>
                  <th className="p-3">صافي القيمة الدفترية (NBV)</th>
                  <th className="p-3">القيمة التخريدية</th>
                </tr>
              )}
              {selectedReport === 'fully_depreciated' && (
                <tr>
                  <th className="p-3">رقم الأصل</th>
                  <th className="p-3">اسم الأصل</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">تاريخ الشراء</th>
                  <th className="p-3">التكلفة المرسملة</th>
                  <th className="p-3">مجمع الإهلاك</th>
                  <th className="p-3">القيمة التخريدية</th>
                  <th className="p-3">آخر تاريخ إهلاك</th>
                </tr>
              )}
              {selectedReport === 'disposal' && (
                <tr>
                  <th className="p-3">تاريخ الاستبعاد</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">رقم الأصل</th>
                  <th className="p-3">اسم الأصل</th>
                  <th className="p-3">التكلفة الأصلية</th>
                  <th className="p-3">مجمع الإهلاك</th>
                  <th className="p-3">القيمة الدفترية</th>
                  <th className="p-3">سعر البيع</th>
                  <th className="p-3">الربح / الخسارة</th>
                  <th className="p-3">المشتري</th>
                </tr>
              )}
              {selectedReport === 'gain_loss' && (
                <tr>
                  <th className="p-3">تاريخ البيع</th>
                  <th className="p-3">رقم الأصل</th>
                  <th className="p-3">اسم الأصل</th>
                  <th className="p-3">القيمة الدفترية</th>
                  <th className="p-3">سعر البيع</th>
                  <th className="p-3">الربح / الخسارة</th>
                  <th className="p-3">النوع المحاسبي</th>
                </tr>
              )}
              {selectedReport === 'by_custodian' && (
                <tr>
                  <th className="p-3">الموظف المسؤول (العهدة)</th>
                  <th className="p-3">كود الموظف</th>
                  <th className="p-3">عدد الأصول</th>
                  <th className="p-3">إجمالي التكلفة</th>
                  <th className="p-3">صافي القيمة الدفترية</th>
                </tr>
              )}
              {selectedReport === 'by_location' && (
                <tr>
                  <th className="p-3">الفرع / المستودع</th>
                  <th className="p-3">الموقع التفصيلي</th>
                  <th className="p-3">عدد الأصول</th>
                  <th className="p-3">إجمالي التكلفة</th>
                  <th className="p-3">صافي القيمة الدفترية</th>
                </tr>
              )}
              {selectedReport === 'maintenance' && (
                <tr>
                  <th className="p-3">تاريخ الصيانة</th>
                  <th className="p-3">رقم الأصل</th>
                  <th className="p-3">اسم الأصل</th>
                  <th className="p-3">نوع الصيانة</th>
                  <th className="p-3">المورد / الفني</th>
                  <th className="p-3">التكلفة</th>
                  <th className="p-3">النوع (مرسملة / مصروف)</th>
                  <th className="p-3">الوصف</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-800/60 print:divide-gray-200">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 print:hover:bg-transparent">
                  {selectedReport === 'register' && (
                    <>
                      <td className="p-3 font-mono font-bold text-white print:text-black">{row.asset_number}</td>
                      <td className="p-3 font-medium text-slate-200 print:text-black">{row.name}</td>
                      <td className="p-3 text-slate-400">{row.category_name}</td>
                      <td className="p-3 text-slate-400">{row.warehouse_name || 'المركز الرئيسي'}</td>
                      <td className="p-3 text-slate-400">{row.department_name || 'عام'}</td>
                      <td className="p-3 font-medium text-amber-400 print:text-black">{row.custodian_name || '---'}</td>
                      <td className="p-3 text-slate-400">{row.acquisition_date}</td>
                      <td className="p-3 font-mono font-bold text-white print:text-black">{Number(row.capitalized_cost).toLocaleString()}</td>
                      <td className="p-3 font-mono text-amber-400">{Number(row.accumulated_depreciation).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">{Number(row.net_book_value).toLocaleString()}</td>
                      <td className="p-3 text-xs">{row.status}</td>
                    </>
                  )}
                  {selectedReport === 'depreciation' && (
                    <>
                      <td className="p-3 font-mono">{row.run_number}</td>
                      <td className="p-3 font-semibold text-white print:text-black">{row.period_name}</td>
                      <td className="p-3 font-mono">{row.asset_number}</td>
                      <td className="p-3 font-medium text-slate-200 print:text-black">{row.asset_name}</td>
                      <td className="p-3 text-slate-400">{row.category_name}</td>
                      <td className="p-3 font-mono">{Number(row.opening_nbv).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-amber-400">+{Number(row.depreciation_amount).toLocaleString()}</td>
                      <td className="p-3 font-mono text-slate-300">{Number(row.accumulated_depreciation).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">{Number(row.closing_nbv).toLocaleString()}</td>
                    </>
                  )}
                  {selectedReport === 'movement' && (
                    <>
                      <td className="p-3">{row.transfer_date}</td>
                      <td className="p-3 font-mono font-bold text-white print:text-black">{row.asset_number}</td>
                      <td className="p-3 font-medium text-slate-200">{row.asset_name}</td>
                      <td className="p-3 text-slate-400">{row.from_warehouse || '---'}</td>
                      <td className="p-3 font-semibold text-white">{row.to_warehouse || '---'}</td>
                      <td className="p-3 text-slate-400">{row.from_custodian || '---'}</td>
                      <td className="p-3 font-bold text-emerald-400">{row.to_custodian || '---'}</td>
                      <td className="p-3 text-slate-400 text-[11px]">{row.reason || '---'}</td>
                    </>
                  )}
                  {selectedReport === 'valuation' && (
                    <>
                      <td className="p-3 font-bold text-white print:text-black">{row.category_name}</td>
                      <td className="p-3 font-bold text-blue-400">{row.asset_count}</td>
                      <td className="p-3 font-mono font-bold text-white print:text-black">{Number(row.total_cost).toLocaleString()}</td>
                      <td className="p-3 font-mono text-amber-400">{Number(row.total_accumulated_depreciation).toLocaleString()}</td>
                      <td className="p-3 font-mono font-extrabold text-emerald-400">{Number(row.total_net_book_value).toLocaleString()}</td>
                      <td className="p-3 font-mono text-slate-400">{Number(row.total_salvage_value).toLocaleString()}</td>
                    </>
                  )}
                  {selectedReport === 'fully_depreciated' && (
                    <>
                      <td className="p-3 font-mono font-bold text-white print:text-black">{row.asset_number}</td>
                      <td className="p-3 font-semibold text-slate-200">{row.name}</td>
                      <td className="p-3 text-slate-400">{row.category_name}</td>
                      <td className="p-3 text-slate-400">{row.acquisition_date}</td>
                      <td className="p-3 font-mono font-bold text-white">{Number(row.capitalized_cost).toLocaleString()}</td>
                      <td className="p-3 font-mono text-amber-400">{Number(row.accumulated_depreciation).toLocaleString()}</td>
                      <td className="p-3 font-mono text-blue-400">{Number(row.salvage_value).toLocaleString()}</td>
                      <td className="p-3 text-slate-400">{row.last_depreciation_date || '---'}</td>
                    </>
                  )}
                  {selectedReport === 'disposal' && (
                    <>
                      <td className="p-3">{row.disposal_date}</td>
                      <td className="p-3 font-bold text-amber-400">{row.disposal_type}</td>
                      <td className="p-3 font-mono font-bold text-white">{row.asset_number}</td>
                      <td className="p-3 font-semibold text-slate-200">{row.asset_name}</td>
                      <td className="p-3 font-mono">{Number(row.original_cost).toLocaleString()}</td>
                      <td className="p-3 font-mono text-amber-400">{Number(row.accumulated_depreciation).toLocaleString()}</td>
                      <td className="p-3 font-mono">{Number(row.net_book_value).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-white">{Number(row.disposal_proceeds).toLocaleString()}</td>
                      <td className={`p-3 font-mono font-black ${Number(row.gain_loss_amount) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {Number(row.gain_loss_amount) >= 0 ? `+${Number(row.gain_loss_amount).toLocaleString()}` : Number(row.gain_loss_amount).toLocaleString()}
                      </td>
                      <td className="p-3 text-slate-300">{row.buyer_name || '---'}</td>
                    </>
                  )}
                  {selectedReport === 'gain_loss' && (
                    <>
                      <td className="p-3">{row.disposal_date}</td>
                      <td className="p-3 font-mono font-bold text-white">{row.asset_number}</td>
                      <td className="p-3 font-semibold text-slate-200">{row.asset_name}</td>
                      <td className="p-3 font-mono">{Number(row.net_book_value).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-white">{Number(row.disposal_proceeds).toLocaleString()}</td>
                      <td className={`p-3 font-mono font-black ${Number(row.gain_loss_amount) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {Number(row.gain_loss_amount) >= 0 ? `+${Number(row.gain_loss_amount).toLocaleString()}` : Number(row.gain_loss_amount).toLocaleString()}
                      </td>
                      <td className="p-3 font-semibold text-slate-300">{row.type}</td>
                    </>
                  )}
                  {selectedReport === 'by_custodian' && (
                    <>
                      <td className="p-3 font-bold text-white print:text-black">{row.custodian_name}</td>
                      <td className="p-3 font-mono text-slate-400">{row.employee_code || '---'}</td>
                      <td className="p-3 font-bold text-blue-400">{row.asset_count}</td>
                      <td className="p-3 font-mono font-bold text-white">{Number(row.total_cost).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">{Number(row.total_nbv).toLocaleString()}</td>
                    </>
                  )}
                  {selectedReport === 'by_location' && (
                    <>
                      <td className="p-3 font-bold text-white print:text-black">{row.warehouse_name}</td>
                      <td className="p-3 text-slate-300">{row.location_name}</td>
                      <td className="p-3 font-bold text-blue-400">{row.asset_count}</td>
                      <td className="p-3 font-mono font-bold text-white">{Number(row.total_cost).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">{Number(row.total_nbv).toLocaleString()}</td>
                    </>
                  )}
                  {selectedReport === 'maintenance' && (
                    <>
                      <td className="p-3">{row.maintenance_date}</td>
                      <td className="p-3 font-mono font-bold text-white">{row.asset_number}</td>
                      <td className="p-3 font-semibold text-slate-200">{row.asset_name}</td>
                      <td className="p-3 font-bold text-purple-400">{row.maintenance_type}</td>
                      <td className="p-3 text-slate-300">{row.supplier_name || '---'}</td>
                      <td className="p-3 font-mono font-bold text-white">{Number(row.cost).toLocaleString()} EGP</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${row.is_capitalized ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                          {row.is_capitalized ? 'مرسملة' : 'تشغيلية'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 text-[11px] truncate max-w-xs">{row.description || '---'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
