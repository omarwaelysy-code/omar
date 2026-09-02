import React, { useState, useMemo } from 'react';
import { 
  BarChart3, FileSpreadsheet, Printer, Download, Filter, 
  Calendar, Building2, User, CheckCircle2, RotateCcw, Ban, Clock 
} from 'lucide-react';
import { IssuedCheque, Supplier, PaymentMethod } from '../../types';

interface ChequesReportsTabProps {
  cheques: IssuedCheque[];
  suppliers: Supplier[];
  paymentMethods: PaymentMethod[];
}

export const ChequesReportsTab: React.FC<ChequesReportsTabProps> = ({
  cheques,
  suppliers,
  paymentMethods
}) => {
  const [reportType, setReportType] = useState<'detailed' | 'by_supplier' | 'by_bank' | 'by_status' | 'by_month'>('detailed');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const bankAccounts = paymentMethods.filter(p => p.type === 'bank' || Boolean(p.bank_name));

  // Filtered dataset
  const filteredCheques = useMemo(() => {
    return cheques.filter(c => {
      const issueDateStr = String(c.issue_date).slice(0, 10);
      const dueDateStr = String(c.due_date).slice(0, 10);
      
      if (fromDate && issueDateStr < fromDate && dueDateStr < fromDate) return false;
      if (toDate && issueDateStr > toDate && dueDateStr > toDate) return false;
      if (selectedSupplierId && c.supplier_id !== selectedSupplierId) return false;
      if (selectedBankId && c.bank_account_id !== selectedBankId) return false;
      if (selectedStatus && c.status !== selectedStatus) return false;

      return true;
    });
  }, [cheques, fromDate, toDate, selectedSupplierId, selectedBankId, selectedStatus]);

  // Overall Financial Summary
  const summary = useMemo(() => {
    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let returnedAmount = 0;
    let cancelledAmount = 0;

    filteredCheques.forEach(c => {
      const amt = Number(c.amount) || 0;
      totalAmount += amt;
      if (c.status === 'PAID') paidAmount += amt;
      else if (['ISSUED', 'POSTPONED'].includes(c.status)) pendingAmount += amt;
      else if (c.status === 'RETURNED') returnedAmount += amt;
      else if (c.status === 'CANCELLED') cancelledAmount += amt;
    });

    return {
      count: filteredCheques.length,
      totalAmount,
      paidAmount,
      pendingAmount,
      returnedAmount,
      cancelledAmount
    };
  }, [filteredCheques]);

  // Group by Supplier
  const supplierGrouping = useMemo(() => {
    const map = new Map<string, { supplierName: string; count: number; totalAmount: number; paidAmount: number; pendingAmount: number; returnedAmount: number }>();
    filteredCheques.forEach(c => {
      const sId = c.supplier_id || 'unknown';
      const sName = c.supplier_name || 'غير محدد';
      const amt = Number(c.amount) || 0;
      if (!map.has(sId)) {
        map.set(sId, { supplierName: sName, count: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0, returnedAmount: 0 });
      }
      const item = map.get(sId)!;
      item.count++;
      item.totalAmount += amt;
      if (c.status === 'PAID') item.paidAmount += amt;
      else if (['ISSUED', 'POSTPONED'].includes(c.status)) item.pendingAmount += amt;
      else if (c.status === 'RETURNED') item.returnedAmount += amt;
    });
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredCheques]);

  // Group by Bank
  const bankGrouping = useMemo(() => {
    const map = new Map<string, { bankName: string; count: number; totalAmount: number; paidAmount: number; pendingAmount: number }>();
    filteredCheques.forEach(c => {
      const bId = c.bank_account_id || 'unknown';
      const bName = c.bank_name || 'الحساب البنكي';
      const amt = Number(c.amount) || 0;
      if (!map.has(bId)) {
        map.set(bId, { bankName: bName, count: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 });
      }
      const item = map.get(bId)!;
      item.count++;
      item.totalAmount += amt;
      if (c.status === 'PAID') item.paidAmount += amt;
      else if (['ISSUED', 'POSTPONED'].includes(c.status)) item.pendingAmount += amt;
    });
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredCheques]);

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
    return Number(val || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'DRAFT': return 'مسودة';
      case 'ISSUED': return 'صادر برسم الدفع';
      case 'PAID': return 'مدفوع / تم الصرف';
      case 'POSTPONED': return 'مؤجل';
      case 'RETURNED': return 'مرتد';
      case 'CANCELLED': return 'ملغى';
      default: return st;
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['رقم الشيك', 'المورد', 'البنك', 'المبلغ', 'تاريخ التحرير', 'تاريخ الاستحقاق', 'الحالة', 'تاريخ الصرف', 'البيان'];
    const rows = filteredCheques.map(c => [
      `"${c.cheque_number}"`,
      `"${c.supplier_name || ''}"`,
      `"${c.bank_name || ''}"`,
      c.amount,
      `"${String(c.issue_date).slice(0, 10)}"`,
      `"${String(c.due_date).slice(0, 10)}"`,
      `"${getStatusLabel(c.status)}"`,
      `"${c.payment_date ? String(c.payment_date).slice(0, 10) : ''}"`,
      `"${c.description || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `تقرير_الشيكات_الصادرة_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Controls & Filter Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        
        {/* Top Types Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'detailed', label: 'تقرير تفصيلي شامل' },
              { id: 'by_supplier', label: 'تجميع حسب المورد' },
              { id: 'by_bank', label: 'تجميع حسب الحساب البنكي' },
              { id: 'by_status', label: 'تجميع حسب الحالة' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setReportType(tab.id as any)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                  reportType === tab.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              تصدير Excel (CSV)
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              طباعة
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-500 mb-1">من تاريخ</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-500 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-500 mb-1">المورد</label>
            <select
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
            >
              <option value="">كل الموردين</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-500 mb-1">البنك</label>
            <select
              value={selectedBankId}
              onChange={e => setSelectedBankId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
            >
              <option value="">كل الحسابات البنكية</option>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-500 mb-1">حالة الشيك</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
            >
              <option value="">كل الحالات</option>
              <option value="DRAFT">مسودة</option>
              <option value="ISSUED">صادر برسم الدفع</option>
              <option value="PAID">مدفوع ومصروف</option>
              <option value="POSTPONED">مؤجل</option>
              <option value="RETURNED">مرتد</option>
              <option value="CANCELLED">ملغى</option>
            </select>
          </div>
        </div>

      </div>

      {/* Summary Highlights Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs text-slate-400 font-bold">إجمالي الشيكات المفلترة</span>
          <p className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
            {formatMoney(summary.totalAmount)} ج.م
          </p>
          <span className="text-[11px] text-slate-400">({summary.count} شيك)</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs text-emerald-600 font-bold">إجمالي المصروف (سداد فعلي)</span>
          <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(summary.paidAmount)} ج.م
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs text-blue-600 font-bold">التزامات قائمة (برسم الدفع)</span>
          <p className="text-lg font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
            {formatMoney(summary.pendingAmount)} ج.م
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs text-rose-600 font-bold">شيكات مرتدة</span>
          <p className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
            {formatMoney(summary.returnedAmount)} ج.م
          </p>
        </div>
      </div>

      {/* Report Data Tables */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* 1. Group by Supplier */}
        {reportType === 'by_supplier' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">اسم المورد</th>
                  <th className="px-6 py-3.5 text-center">عدد الشيكات</th>
                  <th className="px-6 py-3.5">إجمالي المبلغ</th>
                  <th className="px-6 py-3.5">المصروف (مسدد)</th>
                  <th className="px-6 py-3.5">قائم (برسم الدفع)</th>
                  <th className="px-6 py-3.5">مرتد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {supplierGrouping.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-3.5 font-bold text-slate-800 dark:text-slate-200">{row.supplierName}</td>
                    <td className="px-6 py-3.5 font-mono text-center">{row.count}</td>
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900 dark:text-white">{formatMoney(row.totalAmount)} ج.م</td>
                    <td className="px-6 py-3.5 font-mono text-emerald-600 font-bold">{formatMoney(row.paidAmount)} ج.م</td>
                    <td className="px-6 py-3.5 font-mono text-blue-600 font-bold">{formatMoney(row.pendingAmount)} ج.م</td>
                    <td className="px-6 py-3.5 font-mono text-rose-600">{formatMoney(row.returnedAmount)} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Group by Bank */}
        {reportType === 'by_bank' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">الحساب البنكي</th>
                  <th className="px-6 py-3.5 text-center">عدد الشيكات</th>
                  <th className="px-6 py-3.5">إجمالي المسحوب</th>
                  <th className="px-6 py-3.5">المنفذ فعلياً</th>
                  <th className="px-6 py-3.5">التزامات قائمة للصرف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {bankGrouping.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-3.5 font-bold text-slate-800 dark:text-slate-200">{row.bankName}</td>
                    <td className="px-6 py-3.5 font-mono text-center">{row.count}</td>
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900 dark:text-white">{formatMoney(row.totalAmount)} ج.م</td>
                    <td className="px-6 py-3.5 font-mono text-emerald-600 font-bold">{formatMoney(row.paidAmount)} ج.م</td>
                    <td className="px-6 py-3.5 font-mono text-amber-600 font-bold">{formatMoney(row.pendingAmount)} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Group by Status */}
        {reportType === 'by_status' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">حالة الشيك</th>
                  <th className="px-6 py-3.5 text-center">عدد الشيكات</th>
                  <th className="px-6 py-3.5">إجمالي المبلغ</th>
                  <th className="px-6 py-3.5">النسبة من الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {statusGrouping.map((row, idx) => {
                  const pct = summary.totalAmount > 0 ? ((row.totalAmount / summary.totalAmount) * 100).toFixed(1) : '0';
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-3.5 font-bold text-slate-800 dark:text-slate-200">{getStatusLabel(row.status)}</td>
                      <td className="px-6 py-3.5 font-mono text-center">{row.count}</td>
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-900 dark:text-white">{formatMoney(row.totalAmount)} ج.م</td>
                      <td className="px-6 py-3.5 font-mono text-slate-500">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Detailed Comprehensive Report */}
        {reportType === 'detailed' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">رقم الشيك</th>
                  <th className="px-5 py-3.5">المورد المستفيد</th>
                  <th className="px-5 py-3.5">الحساب البنكي</th>
                  <th className="px-5 py-3.5">المبلغ</th>
                  <th className="px-5 py-3.5">تاريخ التحرير</th>
                  <th className="px-5 py-3.5">تاريخ الاستحقاق</th>
                  <th className="px-5 py-3.5">الحالة</th>
                  <th className="px-5 py-3.5">تاريخ الصرف</th>
                  <th className="px-5 py-3.5">البيان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredCheques.map(cheque => (
                  <tr key={cheque.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">{cheque.cheque_number}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{cheque.supplier_name || cheque.payee_name || '-'}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{cheque.bank_name || '-'}</td>
                    <td className="px-5 py-3.5 font-mono font-black text-slate-900 dark:text-white">{formatMoney(cheque.amount)} ج.م</td>
                    <td className="px-5 py-3.5 font-mono text-slate-500">{String(cheque.issue_date).slice(0, 10)}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">{String(cheque.due_date).slice(0, 10)}</td>
                    <td className="px-5 py-3.5 font-medium">{getStatusLabel(cheque.status)}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-500">{cheque.payment_date ? String(cheque.payment_date).slice(0, 10) : '-'}</td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-[150px] truncate">{cheque.description || '-'}</td>
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
