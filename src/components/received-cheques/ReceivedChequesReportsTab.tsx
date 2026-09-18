import React, { useState, useMemo } from 'react';
import { 
  BarChart3, FileSpreadsheet, Printer, Download, Filter, 
  Calendar, Building2, User, CheckCircle2, RotateCcw, Ban, Clock 
} from 'lucide-react';
import { ReceivedCheque, Customer, PaymentMethod } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReceivedChequesReportsTabProps {
  cheques: ReceivedCheque[];
  customers: Customer[];
  paymentMethods: PaymentMethod[];
}

export const ReceivedChequesReportsTab: React.FC<ReceivedChequesReportsTabProps> = ({
  cheques,
  customers,
  paymentMethods
}) => {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  const [reportType, setReportType] = useState<'detailed' | 'by_customer' | 'by_bank' | 'by_status'>('detailed');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Filtered dataset
  const filteredCheques = useMemo(() => {
    return cheques.filter(c => {
      const receiptDateStr = String(c.receipt_date || '').slice(0, 10);
      const dueDateStr = String(c.due_date || '').slice(0, 10);
      
      if (fromDate && receiptDateStr < fromDate && dueDateStr < fromDate) return false;
      if (toDate && receiptDateStr > toDate && dueDateStr > toDate) return false;
      if (selectedCustomerId && c.customer_id !== selectedCustomerId) return false;
      if (selectedStatus && c.status !== selectedStatus) return false;

      return true;
    });
  }, [cheques, fromDate, toDate, selectedCustomerId, selectedStatus]);

  // Overall Financial Summary
  const summary = useMemo(() => {
    let totalAmount = 0;
    let collectedAmount = 0;
    let pendingAmount = 0;
    let returnedAmount = 0;
    let cancelledAmount = 0;

    filteredCheques.forEach(c => {
      const amt = Number(c.amount) || 0;
      totalAmount += amt;
      if (c.status === 'COLLECTED') collectedAmount += amt;
      else if (['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(c.status)) pendingAmount += amt;
      else if (c.status === 'RETURNED') returnedAmount += amt;
      else if (c.status === 'CANCELLED') cancelledAmount += amt;
    });

    return {
      count: filteredCheques.length,
      totalAmount,
      collectedAmount,
      pendingAmount,
      returnedAmount,
      cancelledAmount
    };
  }, [filteredCheques]);

  // Group by Customer
  const customerGrouping = useMemo(() => {
    const map = new Map<string, { customerName: string; count: number; totalAmount: number; collectedAmount: number; pendingAmount: number; returnedAmount: number }>();
    filteredCheques.forEach(c => {
      const sId = c.customer_id || 'other';
      const sName = c.customer_name || c.payer_name || (isAr ? 'جهة أخرى' : 'Other Payer');
      const amt = Number(c.amount) || 0;
      if (!map.has(sId)) {
        map.set(sId, { customerName: sName, count: 0, totalAmount: 0, collectedAmount: 0, pendingAmount: 0, returnedAmount: 0 });
      }
      const item = map.get(sId)!;
      item.count++;
      item.totalAmount += amt;
      if (c.status === 'COLLECTED') item.collectedAmount += amt;
      else if (['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(c.status)) item.pendingAmount += amt;
      else if (c.status === 'RETURNED') item.returnedAmount += amt;
    });
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredCheques, isAr]);

  // Group by Drawee Bank
  const bankGrouping = useMemo(() => {
    const map = new Map<string, { bankName: string; count: number; totalAmount: number; collectedAmount: number; pendingAmount: number }>();
    filteredCheques.forEach(c => {
      const bName = c.drawee_bank || (isAr ? 'غير محدد' : 'Unspecified Bank');
      const amt = Number(c.amount) || 0;
      if (!map.has(bName)) {
        map.set(bName, { bankName: bName, count: 0, totalAmount: 0, collectedAmount: 0, pendingAmount: 0 });
      }
      const item = map.get(bName)!;
      item.count++;
      item.totalAmount += amt;
      if (c.status === 'COLLECTED') item.collectedAmount += amt;
      else if (['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(c.status)) item.pendingAmount += amt;
    });
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredCheques, isAr]);

  // Group by Status
  const statusGrouping = useMemo(() => {
    const map = new Map<string, { status: string; count: number; totalAmount: number }>();
    filteredCheques.forEach(c => {
      const st = c.status;
      const amt = Number(c.amount) || 0;
      if (!map.has(st)) {
        map.set(st, { status: st, count: 0, totalAmount: 0 });
      }
      const item = map.get(st)!;
      item.count++;
      item.totalAmount += amt;
    });
    return Array.from(map.values());
  }, [filteredCheques]);

  const formatMoney = (val?: number) => {
    return Number(val || 0).toLocaleString(isAr ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const currencyLabel = isAr ? 'ج.م' : 'EGP';

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'RECEIVED': return isAr ? 'مستلم بالحافظة' : 'In Portfolio';
      case 'UNDER_COLLECTION': return isAr ? 'برسم التحصيل' : 'Under Collection';
      case 'COLLECTED': return isAr ? 'محصل بالبنك' : 'Collected';
      case 'POSTPONED': return isAr ? 'مؤجل الاستحقاق' : 'Postponed';
      case 'RETURNED': return isAr ? 'مرتد من البنك' : 'Returned';
      case 'CANCELLED': return isAr ? 'ملغى' : 'Cancelled';
      default: return st;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      isAr ? 'رقم الشيك' : 'Cheque #',
      isAr ? 'رقم الإيصال' : 'Receipt #',
      isAr ? 'العميل / الساحب' : 'Customer / Payer',
      isAr ? 'تاريخ الاستلام' : 'Receipt Date',
      isAr ? 'تاريخ الاستحقاق' : 'Due Date',
      isAr ? 'المبلغ' : 'Amount',
      isAr ? 'العملة' : 'Currency',
      isAr ? 'البنك المسحوب عليه' : 'Drawee Bank',
      isAr ? 'الحالة' : 'Status'
    ];

    const rows = filteredCheques.map(c => [
      c.cheque_number,
      c.receipt_number || '',
      c.customer_name || c.payer_name || '',
      c.receipt_date ? String(c.receipt_date).slice(0, 10) : '',
      c.due_date ? String(c.due_date).slice(0, 10) : '',
      c.amount,
      c.currency || 'EGP',
      c.drawee_bank || '',
      getStatusLabel(c.status)
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `received_cheques_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" dir={dir}>
      
      {/* Header & Report Selector */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>{isAr ? 'التقارير المالية والتحليلية للشيكات الواردة' : 'Financial & Analytical Reports (Received Cheques)'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAr 
              ? 'كشوف حركة أوراق القبض، تحليل شيكات العملاء، وأرصدة الشيكات تحت التحصيل'
              : 'Notes receivable statements, customer cheques analytics, and portfolio reports'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تصدير كشف CSV' : 'Export CSV'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isAr ? 'طباعة التقرير' : 'Print Report'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>{isAr ? 'خيارات وتصنيفات التقرير' : 'Report Filters & Type'}</span>
        </div>

        {/* Report Type Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'detailed', label: isAr ? 'تقرير تفصيلي شامل' : 'Detailed Report' },
            { id: 'by_customer', label: isAr ? 'تجميع حسب العميل' : 'By Customer' },
            { id: 'by_bank', label: isAr ? 'تجميع حسب البنك' : 'By Drawee Bank' },
            { id: 'by_status', label: isAr ? 'تجميع حسب الحالة' : 'By Status' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                reportType === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'من تاريخ:' : 'From Date:'}</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'إلى تاريخ:' : 'To Date:'}</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'العميل:' : 'Customer:'}</label>
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none"
            >
              <option value="">{isAr ? 'جميع العملاء' : 'All Customers'}</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'حالة الشيك:' : 'Status:'}</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none"
            >
              <option value="">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
              <option value="RECEIVED">{isAr ? 'مستلم بالحافظة' : 'In Portfolio'}</option>
              <option value="UNDER_COLLECTION">{isAr ? 'برسم التحصيل' : 'Under Collection'}</option>
              <option value="COLLECTED">{isAr ? 'محصل بالبنك' : 'Collected'}</option>
              <option value="POSTPONED">{isAr ? 'مؤجل الاستحقاق' : 'Postponed'}</option>
              <option value="RETURNED">{isAr ? 'مرتد من البنك' : 'Returned'}</option>
              <option value="CANCELLED">{isAr ? 'ملغى' : 'Cancelled'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <p className="text-[11px] text-slate-500 font-bold">{isAr ? 'إجمالي المبالغ بالتقرير' : 'Total Amount'}</p>
          <h3 className="text-base font-black font-mono mt-1 text-slate-900 dark:text-white">
            {formatMoney(summary.totalAmount)} <span className="text-xs font-normal">{currencyLabel}</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">{summary.count} {isAr ? 'شيك' : 'cheques'}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <p className="text-[11px] text-emerald-600 font-bold">{isAr ? 'شيكات محصلة' : 'Collected'}</p>
          <h3 className="text-base font-black font-mono mt-1 text-emerald-600">
            {formatMoney(summary.collectedAmount)} <span className="text-xs font-normal">{currencyLabel}</span>
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <p className="text-[11px] text-blue-600 font-bold">{isAr ? 'شيكات بالحافظة / برسم التحصيل' : 'Pending in Portfolio'}</p>
          <h3 className="text-base font-black font-mono mt-1 text-blue-600">
            {formatMoney(summary.pendingAmount)} <span className="text-xs font-normal">{currencyLabel}</span>
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <p className="text-[11px] text-rose-600 font-bold">{isAr ? 'شيكات مرتدة' : 'Returned'}</p>
          <h3 className="text-base font-black font-mono mt-1 text-rose-600">
            {formatMoney(summary.returnedAmount)} <span className="text-xs font-normal">{currencyLabel}</span>
          </h3>
        </div>
      </div>

      {/* Report Tables Depending on Report Type */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {reportType === 'detailed' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3">{isAr ? 'رقم الشيك' : 'Cheque #'}</th>
                  <th className="p-3">{isAr ? 'رقم الإيصال' : 'Receipt #'}</th>
                  <th className="p-3">{isAr ? 'العميل / الساحب' : 'Customer / Payer'}</th>
                  <th className="p-3">{isAr ? 'البنك المسحوب عليه' : 'Drawee Bank'}</th>
                  <th className="p-3">{isAr ? 'تاريخ الاستلام' : 'Receipt Date'}</th>
                  <th className="p-3">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                  <th className="p-3 text-left">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="p-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCheques.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      {isAr ? 'لا توجد شيكات مطابقة لمعايير البحث' : 'No cheques found matching filter criteria'}
                    </td>
                  </tr>
                ) : (
                  filteredCheques.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{c.cheque_number}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{c.receipt_number || '-'}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{c.customer_name || c.payer_name || '-'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{c.drawee_bank || '-'}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{String(c.receipt_date || '').slice(0, 10)}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{String(c.due_date || '').slice(0, 10)}</td>
                      <td className="p-3 text-left font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(c.amount)} {c.currency || currencyLabel}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {getStatusLabel(c.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'by_customer' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3">{isAr ? 'العميل / الساحب' : 'Customer / Payer'}</th>
                  <th className="p-3 text-center">{isAr ? 'عدد الشيكات' : 'Cheques Count'}</th>
                  <th className="p-3 text-left">{isAr ? 'إجمالي المبالغ' : 'Total Amount'}</th>
                  <th className="p-3 text-left">{isAr ? 'المحصل' : 'Collected'}</th>
                  <th className="p-3 text-left">{isAr ? 'برسم التحصيل' : 'Pending'}</th>
                  <th className="p-3 text-left">{isAr ? 'المرتد' : 'Returned'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customerGrouping.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{item.customerName}</td>
                    <td className="p-3 text-center font-mono font-bold">{item.count}</td>
                    <td className="p-3 text-left font-mono font-bold">{formatMoney(item.totalAmount)} {currencyLabel}</td>
                    <td className="p-3 text-left font-mono font-bold text-emerald-600">{formatMoney(item.collectedAmount)} {currencyLabel}</td>
                    <td className="p-3 text-left font-mono font-bold text-blue-600">{formatMoney(item.pendingAmount)} {currencyLabel}</td>
                    <td className="p-3 text-left font-mono font-bold text-rose-600">{formatMoney(item.returnedAmount)} {currencyLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'by_bank' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3">{isAr ? 'البنك المسحوب عليه' : 'Drawee Bank'}</th>
                  <th className="p-3 text-center">{isAr ? 'عدد الشيكات' : 'Cheques Count'}</th>
                  <th className="p-3 text-left">{isAr ? 'إجمالي المبالغ' : 'Total Amount'}</th>
                  <th className="p-3 text-left">{isAr ? 'المحصل' : 'Collected'}</th>
                  <th className="p-3 text-left">{isAr ? 'برسم التحصيل' : 'Pending'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bankGrouping.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{item.bankName}</td>
                    <td className="p-3 text-center font-mono font-bold">{item.count}</td>
                    <td className="p-3 text-left font-mono font-bold">{formatMoney(item.totalAmount)} {currencyLabel}</td>
                    <td className="p-3 text-left font-mono font-bold text-emerald-600">{formatMoney(item.collectedAmount)} {currencyLabel}</td>
                    <td className="p-3 text-left font-mono font-bold text-blue-600">{formatMoney(item.pendingAmount)} {currencyLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'by_status' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="p-3 text-center">{isAr ? 'عدد الشيكات' : 'Cheques Count'}</th>
                  <th className="p-3 text-left">{isAr ? 'إجمالي المبالغ' : 'Total Amount'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {statusGrouping.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{getStatusLabel(item.status)}</td>
                    <td className="p-3 text-center font-mono font-bold">{item.count}</td>
                    <td className="p-3 text-left font-mono font-bold">{formatMoney(item.totalAmount)} {currencyLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};
