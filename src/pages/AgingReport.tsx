import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';
import { dbService } from '../services/dbService';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { formatNumber, formatMoney, formatDate, isCustomerAccount, isSupplierAccount } from '../utils/formatUtils';
import { 
  Clock, 
  Calendar, 
  Users, 
  Truck, 
  Search, 
  FileSpreadsheet, 
  Download, 
  Printer, 
  RefreshCcw, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  Filter
} from 'lucide-react';

interface AgingItem {
  id: string;
  code: string;
  name: string;
  phone: string;
  credit_period_days?: number;
  openInvoices: {
    id: string;
    invoice_number: string;
    date: string;
    due_date?: string;
    currency: string;
    exchange_rate: number;
    original_base_amount: number;
    settled_up_to_as_of: number;
    open_balance: number;
    age_days: number;
    bracket: 'current' | '31-60' | '61-90' | '91-120' | 'over120';
  }[];
  brackets: {
    current: number;
    b31_60: number;
    b61_90: number;
    b91_120: number;
    over120: number;
  };
  totalInvoicesBalance: number;
  unallocatedCredits: number;
  ledgerBalance: number;
  finalBalance: number;
}

interface AgingReportProps {
  initialType?: 'customer' | 'supplier';
}

export const AgingReport: React.FC<AgingReportProps> = ({ initialType = 'customer' }) => {
  const { user, company } = useAuth();
  const { language, t } = useLanguage();
  const { setCurrentPage } = useNavigation();

  // Active entity type (Customer vs Supplier)
  const [entityType, setEntityType] = useState<'customer' | 'supplier'>(initialType);

  // Filter states
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [asOfDate, setAsOfDate] = useState<string>(todayStr);
  const [agingBasis, setAgingBasis] = useState<'document_date' | 'due_date'>('due_date');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [onlyWithBalance, setOnlyWithBalance] = useState<boolean>(true);
  const [bracketFilter, setBracketFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Loading & Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [rawCustomers, setRawCustomers] = useState<any[]>([]);
  const [rawSuppliers, setRawSuppliers] = useState<any[]>([]);
  const [rawInvoices, setRawInvoices] = useState<any[]>([]);
  const [rawPurchaseInvoices, setRawPurchaseInvoices] = useState<any[]>([]);
  const [rawReceipts, setRawReceipts] = useState<any[]>([]);
  const [rawPayments, setRawPayments] = useState<any[]>([]);
  const [rawReturns, setRawReturns] = useState<any[]>([]);
  const [rawPurchaseReturns, setRawPurchaseReturns] = useState<any[]>([]);
  const [rawJournalEntries, setRawJournalEntries] = useState<any[]>([]);
  const [rawAccounts, setRawAccounts] = useState<any[]>([]);
  const [rawCurrencies, setRawCurrencies] = useState<any[]>([]);

  const reportRef = useRef<HTMLDivElement>(null);

  // System currency detection
  const systemCurrency = useMemo(() => {
    return company?.currency_code || (company?.settings as any)?.currency_code || (company?.settings as any)?.currency || 'EGP';
  }, [company]);

  const currenciesMap = useMemo(() => {
    return (rawCurrencies || []).reduce((acc: any, c: any) => {
      acc[c.id] = c;
      return acc;
    }, {});
  }, [rawCurrencies]);

  const toDateStr = (d: any) => {
    if (!d) return '';
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  };

  // Fetch all necessary data
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [
        custs,
        supps,
        invs,
        pinvs,
        receipts,
        payments,
        returns,
        preturns,
        jes,
        accs,
        currs
      ] = await Promise.all([
        dbService.list('customers', user.company_id),
        dbService.list('suppliers', user.company_id),
        dbService.list('invoices', user.company_id),
        dbService.list('purchase_invoices', user.company_id),
        dbService.list('receipt_vouchers', user.company_id),
        dbService.list('payment_vouchers', user.company_id),
        dbService.list('returns', user.company_id),
        dbService.list('purchase_returns', user.company_id),
        dbService.list('journal_entries', user.company_id),
        dbService.list('accounts', user.company_id),
        dbService.list('currencies', user.company_id)
      ]);

      setRawCustomers(custs || []);
      setRawSuppliers(supps || []);
      setRawInvoices(invs || []);
      setRawPurchaseInvoices(pinvs || []);
      setRawReceipts(receipts || []);
      setRawPayments(payments || []);
      setRawReturns(returns || []);
      setRawPurchaseReturns(preturns || []);
      setRawJournalEntries(jes || []);
      setRawAccounts(accs || []);
      setRawCurrencies(currs || []);
    } catch (err) {
      console.error('Error fetching aging data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, company]);

  // Quick Preset Handlers
  const handleApplyPreset = (preset: string) => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed

    let target = todayStr;
    switch (preset) {
      case 'today':
        target = todayStr;
        break;
      case 'end_last_month':
        target = new Date(curYear, curMonth, 0).toISOString().slice(0, 10);
        break;
      case 'end_last_year':
        target = `${curYear - 1}-12-31`;
        break;
      case 'q1_current':
        target = `${curYear}-03-31`;
        break;
      case 'q2_current':
        target = `${curYear}-06-30`;
        break;
      case 'q3_current':
        target = `${curYear}-09-30`;
        break;
      case 'q4_current':
        target = `${curYear}-12-31`;
        break;
      case 'q1_prev':
        target = `${curYear - 1}-03-31`;
        break;
      case 'q2_prev':
        target = `${curYear - 1}-06-30`;
        break;
      case 'q3_prev':
        target = `${curYear - 1}-09-30`;
        break;
      case 'q4_prev':
        target = `${curYear - 1}-12-31`;
        break;
      default:
        break;
    }
    setAsOfDate(target);
  };

  // Toggle row expansion
  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const allIds: Record<string, boolean> = {};
    calculatedAging.forEach(item => {
      allIds[item.id] = true;
    });
    setExpandedRows(allIds);
  };

  const collapseAll = () => {
    setExpandedRows({});
  };

  // -------------------------------------------------------------
  // CALCULATION ENGINE
  // -------------------------------------------------------------
  const calculatedAging = useMemo<AgingItem[]>(() => {
    if (!asOfDate) return [];

    const isCustomer = entityType === 'customer';
    const entities = isCustomer ? rawCustomers : rawSuppliers;
    const invoices = isCustomer ? rawInvoices : rawPurchaseInvoices;
    const receipts = isCustomer ? rawReceipts : rawPayments;
    const returns = isCustomer ? rawReturns : rawPurchaseReturns;

    const asOfTime = new Date(`${asOfDate}T23:59:59.999Z`).getTime();

    return entities.map((entity: any) => {
      const entityId = entity.id;
      const creditDays = Number(entity.credit_period_days) || 0;

      // 1. Calculate General Ledger balance from journal entries as of asOfDate
      const entityLines: any[] = [];
      rawJournalEntries.forEach((je: any) => {
        const jeDateStr = toDateStr(je.date);
        if (jeDateStr > asOfDate) return;

        const cItems = (je.items || []).filter((item: any) => {
          const matchEntity = isCustomer 
            ? (item.customer_id === entityId || item.sub_account_id === entityId)
            : (item.supplier_id === entityId || item.sub_account_id === entityId);
          
          const isEntityAcct = isCustomer 
            ? isCustomerAccount(item.account_id, entity, rawAccounts)
            : isSupplierAccount(item.account_id, entity, rawAccounts);

          return matchEntity && isEntityAcct;
        });

        if (cItems.length === 0) return;

        const deb = Number(cItems.reduce((s: number, it: any) => s + (Number(it.debit) || 0), 0).toFixed(2));
        const crd = Number(cItems.reduce((s: number, it: any) => s + (Number(it.credit) || 0), 0).toFixed(2));

        entityLines.push({
          date: jeDateStr,
          reference_type: je.reference_type,
          debit: deb,
          credit: crd,
          description: cItems[0]?.description || je.description || ''
        });
      });

      const hasOpBalInEntries = entityLines.some(
        (line: any) => line.reference_type === 'opening_balance' || (line.description && line.description.includes('رصيد افتتاحي'))
      );
      const manualOpening = hasOpBalInEntries ? 0 : (Number(entity.opening_balance) || 0);

      let totalDebit = 0;
      let totalCredit = 0;
      entityLines.forEach((l: any) => {
        totalDebit += l.debit;
        totalCredit += l.credit;
      });

      // Customer is Debit minus Credit; Supplier is Credit minus Debit
      const actualLedgerBalance = isCustomer 
        ? Number((manualOpening + totalDebit - totalCredit).toFixed(2))
        : Number((manualOpening + totalCredit - totalDebit).toFixed(2));

      // 2. Gather all open invoices/bills up to asOfDate
      const openInvoicesList: AgingItem['openInvoices'] = [];

      invoices.forEach((inv: any) => {
        const invEntityId = isCustomer ? inv.customer_id : inv.supplier_id;
        if (invEntityId !== entityId) return;
        if (inv.payment_type === 'cash') return;

        const invDateStr = toDateStr(inv.date);
        if (!invDateStr || invDateStr > asOfDate) return;

        // Base currency amount in system currency
        let docCurrency = systemCurrency;
        if (inv.currency_id && currenciesMap[inv.currency_id]) {
          docCurrency = currenciesMap[inv.currency_id].code;
        } else if (inv.currency_code) {
          docCurrency = inv.currency_code;
        } else if (inv.currency) {
          docCurrency = currenciesMap[inv.currency]?.code || inv.currency;
        }

        const docRate = Number(inv.exchange_rate) || 1;
        const isForeign = docCurrency !== systemCurrency;
        const originalBaseAmount = isForeign
          ? (Number(inv.total_base_amount) || (docRate > 0 && docRate !== 1 ? Number((Number(inv.total_amount || 0) * docRate).toFixed(2)) : Number(inv.total_amount || 0)))
          : (Number(inv.total_amount) || 0);

        // Calculate all settlements occurred ON OR BEFORE asOfDate
        let settledUpToAsOf = 0;

        if (Array.isArray(inv.settlements)) {
          inv.settlements.forEach((s: any) => {
            const sDate = toDateStr(s.settlement_date || s.date || invDateStr);
            if (sDate <= asOfDate) {
              settledUpToAsOf += Number(s.settled_amount || s.amount || 0);
            }
          });
        }

        // Voucher settlements
        receipts.forEach((v: any) => {
          if (Array.isArray(v.items)) {
            v.items.forEach((item: any) => {
              if (Array.isArray(item.settlements)) {
                item.settlements.forEach((s: any) => {
                  if (String(s.target_id) === String(inv.id)) {
                    const sDate = toDateStr(s.settlement_date || s.date || v.date);
                    if (sDate <= asOfDate) {
                      const alreadyInInv = inv.settlements?.some((is: any) => 
                        is.target_id === v.id || String(is.reference_number) === String(v.voucher_number || v.number)
                      );
                      if (!alreadyInInv) {
                        settledUpToAsOf += Number(s.settled_amount || s.amount || 0);
                      }
                    }
                  }
                });
              }
            });
          }
        });

        const openBalance = Number(Math.max(0, originalBaseAmount - settledUpToAsOf).toFixed(2));

        if (openBalance > 0.009) {
          let dueDateStr = toDateStr(inv.due_date);
          if (!dueDateStr) {
            const baseD = new Date(invDateStr);
            baseD.setDate(baseD.getDate() + creditDays);
            dueDateStr = baseD.toISOString().slice(0, 10);
          }

          let ageDays = 0;
          if (agingBasis === 'due_date') {
            const dueTime = new Date(`${dueDateStr}T00:00:00.000Z`).getTime();
            ageDays = Math.floor((asOfTime - dueTime) / (1000 * 3600 * 24));
          } else {
            const invTime = new Date(`${invDateStr}T00:00:00.000Z`).getTime();
            ageDays = Math.floor((asOfTime - invTime) / (1000 * 3600 * 24));
          }

          let bracket: AgingItem['openInvoices'][0]['bracket'] = 'current';
          if (ageDays <= 30) {
            bracket = 'current';
          } else if (ageDays <= 60) {
            bracket = '31-60';
          } else if (ageDays <= 90) {
            bracket = '61-90';
          } else if (ageDays <= 120) {
            bracket = '91-120';
          } else {
            bracket = 'over120';
          }

          openInvoicesList.push({
            id: inv.id,
            invoice_number: inv.invoice_number || inv.number || inv.id.slice(0, 8),
            date: invDateStr,
            due_date: dueDateStr,
            currency: docCurrency,
            exchange_rate: docRate,
            original_base_amount: originalBaseAmount,
            settled_up_to_as_of: settledUpToAsOf,
            open_balance: openBalance,
            age_days: ageDays,
            bracket
          });
        }
      });

      // Sort invoices oldest first
      openInvoicesList.sort((a, b) => b.age_days - a.age_days);

      const totalInvoicesBalance = Number(
        openInvoicesList.reduce((sum, inv) => sum + inv.open_balance, 0).toFixed(2)
      );

      // 3. Brackets distribution strictly reconciled with General Ledger balance
      const brackets = {
        current: 0,
        b31_60: 0,
        b61_90: 0,
        b91_120: 0,
        over120: 0
      };

      if (actualLedgerBalance <= 0) {
        // Customer or Supplier is paid in advance or zero balance
      } else if (totalInvoicesBalance <= actualLedgerBalance) {
        // Invoices sum up to or less than ledger balance -> place open invoices in their respective brackets
        openInvoicesList.forEach(i => {
          if (i.bracket === 'current') brackets.current += i.open_balance;
          else if (i.bracket === '31-60') brackets.b31_60 += i.open_balance;
          else if (i.bracket === '61-90') brackets.b61_90 += i.open_balance;
          else if (i.bracket === '91-120') brackets.b91_120 += i.open_balance;
          else if (i.bracket === 'over120') brackets.over120 += i.open_balance;
        });
        // Remaining older balance (e.g. from opening balance or older unbilled balance) sits in +120 days
        const remainingOld = actualLedgerBalance - totalInvoicesBalance;
        brackets.over120 += remainingOld;
      } else {
        // Invoices total exceeds ledger balance -> customer has unallocated payments/credits!
        // Allocate the active ledger balance starting from the most recent open invoices
        let remainingToAllocate = actualLedgerBalance;
        const sortedByNewest = [...openInvoicesList].sort((a, b) => a.age_days - b.age_days);
        sortedByNewest.forEach(i => {
          if (remainingToAllocate <= 0) return;
          const take = Math.min(i.open_balance, remainingToAllocate);
          if (i.bracket === 'current') brackets.current += take;
          else if (i.bracket === '31-60') brackets.b31_60 += take;
          else if (i.bracket === '61-90') brackets.b61_90 += take;
          else if (i.bracket === '91-120') brackets.b91_120 += take;
          else if (i.bracket === 'over120') brackets.over120 += take;
          remainingToAllocate -= take;
        });
      }

      brackets.current = Number(brackets.current.toFixed(2));
      brackets.b31_60 = Number(brackets.b31_60.toFixed(2));
      brackets.b61_90 = Number(brackets.b61_90.toFixed(2));
      brackets.b91_120 = Number(brackets.b91_120.toFixed(2));
      brackets.over120 = Number(brackets.over120.toFixed(2));

      // Unallocated credits = difference between invoice open balance and actual ledger balance
      const unallocatedCredits = Number(Math.max(0, totalInvoicesBalance - actualLedgerBalance).toFixed(2));
      const finalBalance = actualLedgerBalance;

      return {
        id: entity.id,
        code: entity.code || entity.customer_code || entity.supplier_code || entity.id.slice(0, 6),
        name: entity.name || entity.company_name || '-',
        phone: entity.phone || entity.mobile || '-',
        credit_period_days: creditDays,
        openInvoices: openInvoicesList,
        brackets,
        totalInvoicesBalance,
        unallocatedCredits,
        ledgerBalance: actualLedgerBalance,
        finalBalance
      };
    });
  }, [
    asOfDate,
    entityType,
    agingBasis,
    rawCustomers,
    rawSuppliers,
    rawInvoices,
    rawPurchaseInvoices,
    rawReceipts,
    rawPayments,
    rawReturns,
    rawPurchaseReturns,
    rawJournalEntries,
    rawAccounts,
    currenciesMap,
    systemCurrency
  ]);

  // Filtered dataset for display
  const filteredAging = useMemo(() => {
    return calculatedAging.filter(item => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches = 
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // 2. Only with balance filter
      if (onlyWithBalance && Math.abs(item.finalBalance) < 0.01 && item.totalInvoicesBalance < 0.01) {
        return false;
      }

      // 3. Bracket filter
      if (bracketFilter === 'current' && item.brackets.current <= 0.01) return false;
      if (bracketFilter === '31-60' && item.brackets.b31_60 <= 0.01) return false;
      if (bracketFilter === '61-90' && item.brackets.b61_90 <= 0.01) return false;
      if (bracketFilter === '91-120' && item.brackets.b91_120 <= 0.01) return false;
      if (bracketFilter === 'over120' && item.brackets.over120 <= 0.01) return false;

      return true;
    });
  }, [calculatedAging, searchTerm, onlyWithBalance, bracketFilter]);

  // Overall Totals
  const totals = useMemo(() => {
    return filteredAging.reduce((acc, item) => ({
      current: acc.current + item.brackets.current,
      b31_60: acc.b31_60 + item.brackets.b31_60,
      b61_90: acc.b61_90 + item.brackets.b61_90,
      b91_120: acc.b91_120 + item.brackets.b91_120,
      over120: acc.over120 + item.brackets.over120,
      totalInvoices: acc.totalInvoices + item.totalInvoicesBalance,
      unallocated: acc.unallocated + item.unallocatedCredits,
      finalBalance: acc.finalBalance + item.finalBalance
    }), {
      current: 0,
      b31_60: 0,
      b61_90: 0,
      b91_120: 0,
      over120: 0,
      totalInvoices: 0,
      unallocated: 0,
      finalBalance: 0
    });
  }, [filteredAging]);

  // Export handlers
  const handleExportPDF = async () => {
    if (reportRef.current) {
      const title = entityType === 'customer' 
        ? (language === 'ar' ? 'تقرير أعمار ديون العملاء' : 'Customer Aging Report')
        : (language === 'ar' ? 'تقرير أعمار ديون الموردين' : 'Supplier Aging Report');

      await exportToPDF(reportRef.current, {
        filename: `${entityType}_aging_${asOfDate}`,
        orientation: 'landscape',
        reportTitle: `${title} - ${language === 'ar' ? 'حتى تاريخ:' : 'As of:'} ${formatDate(asOfDate)}`
      });
    }
  };

  const handleExportExcel = () => {
    const isCustomer = entityType === 'customer';
    const exportData = filteredAging.map(item => ({
      [isCustomer ? (language === 'ar' ? 'كود العميل' : 'Customer Code') : (language === 'ar' ? 'كود المورد' : 'Supplier Code')]: item.code,
      [isCustomer ? (language === 'ar' ? 'اسم العميل' : 'Customer Name') : (language === 'ar' ? 'اسم المورد' : 'Supplier Name')]: item.name,
      [language === 'ar' ? 'الهاتف' : 'Phone']: item.phone,
      [language === 'ar' ? 'غير مستحق / 0-30 يوم' : 'Current (0-30)']: item.brackets.current,
      [language === 'ar' ? '31-60 يوم' : '31-60 Days']: item.brackets.b31_60,
      [language === 'ar' ? '61-90 يوم' : '61-90 Days']: item.brackets.b61_90,
      [language === 'ar' ? '91-120 يوم' : '91-120 Days']: item.brackets.b91_120,
      [language === 'ar' ? 'أكثر من 120 يوم' : '+120 Days']: item.brackets.over120,
      [language === 'ar' ? 'دفعات مقدمة / غير مخصصة' : 'Unallocated Credits']: item.unallocatedCredits,
      [language === 'ar' ? 'إجمالي الرصيد المحاسبي' : 'Total Balance']: item.finalBalance
    }));

    exportToExcel(exportData, `${entityType}_aging_${asOfDate}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNavigateToStatement = (id: string) => {
    if (entityType === 'customer') {
      sessionStorage.setItem('customer_statement_filter_customer_id', id);
      sessionStorage.setItem('customer_statement_filter_end_date', asOfDate);
      setCurrentPage('customer_statement');
    } else {
      sessionStorage.setItem('supplier_statement_filter_supplier_id', id);
      sessionStorage.setItem('supplier_statement_filter_end_date', asOfDate);
      setCurrentPage('supplier_statement');
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto px-2 sm:px-4">
      {/* Top Header & Entity Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center shadow-inner">
            <Clock size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-zinc-800 tracking-tight">
                {language === 'ar' ? 'تقرير أعمار الديون المحاسبي' : 'Accounts Debt Aging Report'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {language === 'ar' ? 'مطابق لميزان المراجعة' : 'Trial Balance Reconciled'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {language === 'ar' 
                ? 'تحليل أعمار الديون والفواتير غير المسواة مع مراعاة السدادات والأرصدة الدفترية' 
                : 'Aging analysis of unpaid balances and invoices respecting settlements & ledger balances'}
            </p>
          </div>
        </div>

        {/* Customer / Supplier Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-zinc-100 rounded-2xl border border-zinc-200">
            <button
              onClick={() => setEntityType('customer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                entityType === 'customer'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Users size={16} />
              <span>{language === 'ar' ? 'ديون العملاء (Receivable)' : 'Customers Aging'}</span>
            </button>
            <button
              onClick={() => setEntityType('supplier')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                entityType === 'supplier'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Truck size={16} />
              <span>{language === 'ar' ? 'ديون الموردين (Payable)' : 'Suppliers Aging'}</span>
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={fetchData}
            title={language === 'ar' ? 'تحديث البيانات' : 'Refresh'}
            className="p-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-2xl border border-zinc-200 transition-colors"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportExcel}
            title="Excel"
            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl border border-emerald-200 transition-colors"
          >
            <FileSpreadsheet size={16} />
          </button>
          <button
            onClick={handleExportPDF}
            title="PDF"
            className="p-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-2xl border border-red-200 transition-colors"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handlePrint}
            title="Print"
            className="p-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-2xl border border-zinc-200 transition-colors"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          
          {/* As of Date picker */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              {language === 'ar' ? 'حتى تاريخ (As of Date):' : 'As of Cut-off Date:'}
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-mono font-bold text-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Aging Basis selector */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              {language === 'ar' ? 'أساس احتساب العمر:' : 'Aging Calculation Basis:'}
            </label>
            <div className="flex p-0.5 bg-zinc-100 rounded-2xl border border-zinc-200">
              <button
                type="button"
                onClick={() => setAgingBasis('due_date')}
                className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all ${
                  agingBasis === 'due_date'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
              </button>
              <button
                type="button"
                onClick={() => setAgingBasis('document_date')}
                className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all ${
                  agingBasis === 'document_date'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {language === 'ar' ? 'تاريخ التسجيل' : 'Document Date'}
              </button>
            </div>
          </div>

          {/* Search box */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              {language === 'ar' ? 'بحث بالاسم أو الكود:' : 'Search Name / Code:'}
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'اكتب اسم العميل، الكود أو الهاتف...' : 'Search by name, code or phone...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Bracket Filter & Options */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              {language === 'ar' ? 'تصفية الشريحة:' : 'Filter Bracket:'}
            </label>
            <select
              value={bracketFilter}
              onChange={(e) => setBracketFilter(e.target.value)}
              className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">{language === 'ar' ? 'كافة الشرائح' : 'All Brackets'}</option>
              <option value="current">{language === 'ar' ? 'غير مستحق / 0-30 يوم' : 'Current / 0-30 Days'}</option>
              <option value="31-60">{language === 'ar' ? '31-60 يوم' : '31-60 Days'}</option>
              <option value="61-90">{language === 'ar' ? '61-90 يوم' : '61-90 Days'}</option>
              <option value="91-120">{language === 'ar' ? '91-120 يوم' : '91-120 Days'}</option>
              <option value="over120">{language === 'ar' ? 'أكثر من 120 يوم' : '+120 Days'}</option>
            </select>
          </div>
        </div>

        {/* Date Quick Presets */}
        <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1 mr-1">
              <Calendar size={13} />
              {language === 'ar' ? 'خيارات سريعة:' : 'Quick Presets:'}
            </span>
            <button
              onClick={() => handleApplyPreset('today')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border ${
                asOfDate === todayStr 
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-zinc-200'
              }`}
            >
              {language === 'ar' ? 'اليوم' : 'Today'}
            </button>
            <button
              onClick={() => handleApplyPreset('end_last_month')}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200 transition-all"
            >
              {language === 'ar' ? 'نهاية الشهر السابق' : 'End of Last Month'}
            </button>
            <button
              onClick={() => handleApplyPreset('end_last_year')}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200 transition-all"
            >
              {language === 'ar' ? 'نهاية العام السابق' : 'End of Last Year'}
            </button>

            {/* Current Year Quarters */}
            <div className="flex items-center gap-1 bg-zinc-50 p-0.5 rounded-xl border border-zinc-200/80">
              <span className="text-[10px] font-bold text-zinc-400 px-1">{language === 'ar' ? 'السنة الحالية:' : 'Cur Year:'}</span>
              <button
                onClick={() => handleApplyPreset('q1_current')}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white text-zinc-600"
              >
                Q1
              </button>
              <button
                onClick={() => handleApplyPreset('q2_current')}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white text-zinc-600"
              >
                Q2
              </button>
              <button
                onClick={() => handleApplyPreset('q3_current')}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white text-zinc-600"
              >
                Q3
              </button>
              <button
                onClick={() => handleApplyPreset('q4_current')}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white text-zinc-600"
              >
                Q4
              </button>
            </div>

            {/* Prev Year Quarters */}
            <div className="flex items-center gap-1 bg-zinc-50 p-0.5 rounded-xl border border-zinc-200/80">
              <span className="text-[10px] font-bold text-zinc-400 px-1">{language === 'ar' ? 'السنة السابقة:' : 'Prev Year:'}</span>
              <button
                onClick={() => handleApplyPreset('q1_prev')}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white text-zinc-600"
              >
                Q1
              </button>
              <button
                onClick={() => handleApplyPreset('q2_prev')}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white text-zinc-600"
              >
                Q2
              </button>
              <button
                onClick={() => handleApplyPreset('q3_prev')}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white text-zinc-600"
              >
                Q3
              </button>
              <button
                onClick={() => handleApplyPreset('q4_prev')}
                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white text-zinc-600"
              >
                Q4
              </button>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-zinc-600">
              <input
                type="checkbox"
                checked={onlyWithBalance}
                onChange={(e) => setOnlyWithBalance(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
              />
              <span>{language === 'ar' ? 'عرض من لديهم رصيد فقط' : 'Only with outstanding balance'}</span>
            </label>

            <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-500">
              <button onClick={expandAll} className="hover:text-emerald-700 underline px-1">
                {language === 'ar' ? 'توسيع الكل' : 'Expand All'}
              </button>
              <span>|</span>
              <button onClick={collapseAll} className="hover:text-emerald-700 underline px-1">
                {language === 'ar' ? 'طي الكل' : 'Collapse All'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* Total Outstanding */}
        <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm relative overflow-hidden">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
            {language === 'ar' ? 'إجمالي الديون القائمة' : 'Total Outstanding'}
          </div>
          <div className="text-lg font-black text-zinc-900 font-mono">
            {formatMoney(totals.finalBalance)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1 flex items-center justify-between">
            <span>{systemCurrency}</span>
            <span className="font-bold text-emerald-600">{filteredAging.length} {language === 'ar' ? 'طرف' : 'parties'}</span>
          </div>
          <div className="h-1 bg-zinc-900 rounded-full mt-2" />
        </div>

        {/* Current / 0-30 */}
        <div className="bg-white p-4 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden bg-gradient-to-b from-white to-emerald-50/20">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{language === 'ar' ? '0 - 30 يوم (حالي)' : '0 - 30 Days (Current)'}</span>
            <span className="font-bold font-mono">
              {totals.finalBalance > 0 ? `${((totals.current / totals.finalBalance) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <div className="text-lg font-black text-emerald-700 font-mono">
            {formatMoney(totals.current)}
          </div>
          <div className="text-[10px] text-emerald-600/70 mt-1">{language === 'ar' ? 'ضمن الحدود الآمنة' : 'Safe collection zone'}</div>
          <div className="h-1 bg-emerald-500 rounded-full mt-2" />
        </div>

        {/* 31-60 Days */}
        <div className="bg-white p-4 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden bg-gradient-to-b from-white to-blue-50/20">
          <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{language === 'ar' ? '31 - 60 يوم' : '31 - 60 Days'}</span>
            <span className="font-bold font-mono">
              {totals.finalBalance > 0 ? `${((totals.b31_60 / totals.finalBalance) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <div className="text-lg font-black text-blue-700 font-mono">
            {formatMoney(totals.b31_60)}
          </div>
          <div className="text-[10px] text-blue-600/70 mt-1">{language === 'ar' ? 'متابعة دورية' : 'Regular followup'}</div>
          <div className="h-1 bg-blue-500 rounded-full mt-2" />
        </div>

        {/* 61-90 Days */}
        <div className="bg-white p-4 rounded-3xl border border-amber-100 shadow-sm relative overflow-hidden bg-gradient-to-b from-white to-amber-50/20">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{language === 'ar' ? '61 - 90 يوم' : '61 - 90 Days'}</span>
            <span className="font-bold font-mono">
              {totals.finalBalance > 0 ? `${((totals.b61_90 / totals.finalBalance) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <div className="text-lg font-black text-amber-700 font-mono">
            {formatMoney(totals.b61_90)}
          </div>
          <div className="text-[10px] text-amber-600/70 mt-1">{language === 'ar' ? 'تنبيه التحصيل' : 'Urgent reminder'}</div>
          <div className="h-1 bg-amber-500 rounded-full mt-2" />
        </div>

        {/* 91-120 Days */}
        <div className="bg-white p-4 rounded-3xl border border-orange-100 shadow-sm relative overflow-hidden bg-gradient-to-b from-white to-orange-50/20">
          <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{language === 'ar' ? '91 - 120 يوم' : '91 - 120 Days'}</span>
            <span className="font-bold font-mono">
              {totals.finalBalance > 0 ? `${((totals.b91_120 / totals.finalBalance) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <div className="text-lg font-black text-orange-700 font-mono">
            {formatMoney(totals.b91_120)}
          </div>
          <div className="text-[10px] text-orange-600/70 mt-1">{language === 'ar' ? 'متأخرة حرجة' : 'Critical delay'}</div>
          <div className="h-1 bg-orange-500 rounded-full mt-2" />
        </div>

        {/* Over 120 Days */}
        <div className="bg-white p-4 rounded-3xl border border-rose-100 shadow-sm relative overflow-hidden bg-gradient-to-b from-white to-rose-50/20">
          <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{language === 'ar' ? '+120 يوم (حرجة)' : '+120 Days (Severe)'}</span>
            <span className="font-bold font-mono">
              {totals.finalBalance > 0 ? `${((totals.over120 / totals.finalBalance) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <div className="text-lg font-black text-rose-700 font-mono">
            {formatMoney(totals.over120)}
          </div>
          <div className="text-[10px] text-rose-600/70 mt-1">{language === 'ar' ? 'مخصص ديون مشكوك فيها' : 'Risk provision zone'}</div>
          <div className="h-1 bg-rose-500 rounded-full mt-2" />
        </div>
      </div>

      {/* Main Table Card */}
      <div ref={reportRef} className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Table Top Info */}
        <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-black text-zinc-800 text-sm flex items-center gap-2">
              <Layers size={18} className="text-emerald-600" />
              {entityType === 'customer' 
                ? (language === 'ar' ? 'جدول أعمار ديون العملاء التفصيلي' : 'Detailed Accounts Receivable Aging')
                : (language === 'ar' ? 'جدول أعمار ديون الموردين التفصيلي' : 'Detailed Accounts Payable Aging')
              }
            </span>
            <span className="text-zinc-400">|</span>
            <span className="text-zinc-500 font-medium">
              {language === 'ar' ? 'حتى تاريخ:' : 'Cut-off Date:'} <strong className="text-zinc-800 font-mono">{formatDate(asOfDate)}</strong>
            </span>
            <span className="text-zinc-400">|</span>
            <span className="text-zinc-500 font-medium">
              {language === 'ar' ? 'الأساس:' : 'Basis:'} <strong className="text-emerald-700">{agingBasis === 'due_date' ? (language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date') : (language === 'ar' ? 'تاريخ التسجيل' : 'Document Date')}</strong>
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold font-mono">
            <span className="text-zinc-500">
              {language === 'ar' ? 'عملة التقرير:' : 'Currency:'} <strong className="text-zinc-800">{systemCurrency}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
              {language === 'ar' ? 'مطابق دفترياً بنسبة 100%' : '100% GL Reconciled'}
            </span>
          </div>
        </div>

        {/* The Grid Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs border border-zinc-200">
            <thead>
              <tr className="bg-zinc-100 text-zinc-700 font-black text-[11px] uppercase tracking-wider">
                <th className="p-2.5 border border-zinc-200 text-center w-10">#</th>
                <th className="p-2.5 border border-zinc-200 w-24">{language === 'ar' ? 'الكود' : 'Code'}</th>
                <th className="p-2.5 border border-zinc-200 min-w-[200px]">
                  {entityType === 'customer' 
                    ? (language === 'ar' ? 'اسم العميل' : 'Customer Name') 
                    : (language === 'ar' ? 'اسم المورد' : 'Supplier Name')
                  }
                </th>
                <th className="p-2.5 border border-zinc-200 w-28 text-center">{language === 'ar' ? 'الهاتف' : 'Phone'}</th>
                
                {/* Aging Columns */}
                <th className="p-2.5 border border-zinc-200 text-right w-28 bg-emerald-50/40 text-emerald-800">
                  {language === 'ar' ? '0 - 30 يوم' : '0-30 Days'}
                </th>
                <th className="p-2.5 border border-zinc-200 text-right w-28 bg-blue-50/40 text-blue-800">
                  {language === 'ar' ? '31 - 60 يوم' : '31-60 Days'}
                </th>
                <th className="p-2.5 border border-zinc-200 text-right w-28 bg-amber-50/40 text-amber-800">
                  {language === 'ar' ? '61 - 90 يوم' : '61-90 Days'}
                </th>
                <th className="p-2.5 border border-zinc-200 text-right w-28 bg-orange-50/40 text-orange-800">
                  {language === 'ar' ? '91 - 120 يوم' : '91-120 Days'}
                </th>
                <th className="p-2.5 border border-zinc-200 text-right w-28 bg-rose-50/40 text-rose-800">
                  {language === 'ar' ? '+120 يوم' : '+120 Days'}
                </th>
                
                {/* Unallocated advances */}
                <th className="p-2.5 border border-zinc-200 text-right w-28 text-zinc-500 font-semibold" title={language === 'ar' ? 'دفعات مقدمة وسدادات غير مخصصة لفواتير محددة حتى التاريخ' : 'Unallocated credits & advance payments'}>
                  {language === 'ar' ? 'دفعات غير مخصصة' : 'Unallocated'}
                </th>

                {/* Total Balance */}
                <th className="p-2.5 border border-zinc-200 text-right w-32 bg-zinc-200/60 font-black text-zinc-900">
                  {language === 'ar' ? 'إجمالي الرصيد' : 'Total Balance'}
                </th>
                
                <th className="p-2.5 border border-zinc-200 text-center w-24">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCcw size={24} className="animate-spin text-emerald-600" />
                      <span className="font-semibold">{language === 'ar' ? 'جارٍ احتساب وتحليل أعمار الديون...' : 'Calculating aging balances...'}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAging.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-zinc-400 italic">
                    {language === 'ar' ? 'لا توجد بيانات ديون تطابق خيارات التصفية والبحث المحددة' : 'No records match selected filter options'}
                  </td>
                </tr>
              ) : (
                filteredAging.map((item, index) => {
                  const isExpanded = !!expandedRows[item.id];
                  const hasInvoices = item.openInvoices.length > 0;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`hover:bg-zinc-50/80 transition-colors ${isExpanded ? 'bg-emerald-50/10' : ''}`}>
                        
                        {/* Row toggle / index */}
                        <td className="p-2 text-center border border-zinc-200 text-zinc-400 font-mono">
                          {hasInvoices ? (
                            <button
                              onClick={() => toggleRow(item.id)}
                              className="w-5 h-5 rounded hover:bg-zinc-200 flex items-center justify-center transition-colors text-zinc-600 mx-auto"
                              title={isExpanded ? (language === 'ar' ? 'طي الفواتير' : 'Collapse') : (language === 'ar' ? 'عرض الفواتير التفصيلية' : 'Expand')}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </td>

                        {/* Code */}
                        <td className="p-2 px-3 border border-zinc-200 font-mono font-bold text-zinc-600">
                          {item.code}
                        </td>

                        {/* Name */}
                        <td className="p-2 px-3 border border-zinc-200 font-bold text-zinc-800">
                          <div className="flex items-center gap-1.5">
                            <span 
                              onClick={() => hasInvoices && toggleRow(item.id)} 
                              className={hasInvoices ? 'cursor-pointer hover:text-emerald-700' : ''}
                            >
                              {item.name}
                            </span>
                            {item.credit_period_days ? (
                              <span className="text-[10px] text-zinc-400 font-normal">
                                ({item.credit_period_days} {language === 'ar' ? 'يوم ائتمان' : 'days'})
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="p-2 px-3 border border-zinc-200 text-center font-mono text-zinc-500">
                          {item.phone}
                        </td>

                        {/* Current (0-30) */}
                        <td className="p-2 px-3 border border-zinc-200 text-right font-mono font-semibold text-emerald-800 bg-emerald-50/10">
                          {item.brackets.current > 0 ? formatNumber(item.brackets.current) : '-'}
                        </td>

                        {/* 31-60 */}
                        <td className="p-2 px-3 border border-zinc-200 text-right font-mono font-semibold text-blue-800 bg-blue-50/10">
                          {item.brackets.b31_60 > 0 ? formatNumber(item.brackets.b31_60) : '-'}
                        </td>

                        {/* 61-90 */}
                        <td className="p-2 px-3 border border-zinc-200 text-right font-mono font-semibold text-amber-800 bg-amber-50/10">
                          {item.brackets.b61_90 > 0 ? formatNumber(item.brackets.b61_90) : '-'}
                        </td>

                        {/* 91-120 */}
                        <td className="p-2 px-3 border border-zinc-200 text-right font-mono font-semibold text-orange-800 bg-orange-50/10">
                          {item.brackets.b91_120 > 0 ? formatNumber(item.brackets.b91_120) : '-'}
                        </td>

                        {/* +120 */}
                        <td className="p-2 px-3 border border-zinc-200 text-right font-mono font-bold text-rose-700 bg-rose-50/10">
                          {item.brackets.over120 > 0 ? formatNumber(item.brackets.over120) : '-'}
                        </td>

                        {/* Unallocated advances */}
                        <td className="p-2 px-3 border border-zinc-200 text-right font-mono text-zinc-500">
                          {item.unallocatedCredits > 0 ? (
                            <span className="text-zinc-500 font-semibold" title={language === 'ar' ? 'يتم خصمها من إجمالي الرصيد الدفتري' : 'Deducted from balance'}>
                              ({formatNumber(item.unallocatedCredits)})
                            </span>
                          ) : '-'}
                        </td>

                        {/* Total Balance */}
                        <td className="p-2 px-3 border border-zinc-200 text-right font-mono font-black text-zinc-900 bg-zinc-100/50">
                          {formatNumber(item.finalBalance)}
                        </td>

                        {/* Actions */}
                        <td className="p-1 px-2 border border-zinc-200 text-center">
                          <button
                            onClick={() => handleNavigateToStatement(item.id)}
                            className="p-1.5 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[11px]"
                            title={language === 'ar' ? 'فتح كشف الحساب' : 'Open Statement'}
                          >
                            <FileText size={13} />
                            <span>{language === 'ar' ? 'كشف' : 'Stmt'}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Invoices Breakdown */}
                      {isExpanded && hasInvoices && (
                        <tr className="bg-zinc-50/70">
                          <td colSpan={12} className="p-3 pr-8 border border-zinc-200">
                            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-inner">
                              <div className="p-2.5 bg-zinc-100/80 border-b border-zinc-200 flex items-center justify-between text-xs">
                                <span className="font-bold text-zinc-700 flex items-center gap-1.5">
                                  <FileText size={14} className="text-emerald-600" />
                                  {language === 'ar' 
                                    ? `الفواتير غير المسواة حتى تاريخ ${formatDate(asOfDate)} (${item.openInvoices.length} فاتورة)` 
                                    : `Unpaid Invoices as of ${formatDate(asOfDate)} (${item.openInvoices.length} invoices)`}
                                </span>
                                <span className="text-[11px] text-zinc-500 font-mono">
                                  {language === 'ar' ? 'المبالغ الموضحة بالعملة المحلية' : 'Amounts in local currency'}
                                </span>
                              </div>
                              <table className="w-full text-right text-xs">
                                <thead>
                                  <tr className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200 text-[10px]">
                                    <th className="p-2">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice No.'}</th>
                                    <th className="p-2">{language === 'ar' ? 'تاريخ الفاتورة' : 'Invoice Date'}</th>
                                    <th className="p-2">{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                                    <th className="p-2 text-right">{language === 'ar' ? 'المبلغ الأصلي' : 'Original Amount'}</th>
                                    <th className="p-2 text-right">{language === 'ar' ? 'المسوى حتى التاريخ' : 'Settled to Date'}</th>
                                    <th className="p-2 text-right font-black text-zinc-800">{language === 'ar' ? 'المتبقي' : 'Open Balance'}</th>
                                    <th className="p-2 text-center">{language === 'ar' ? 'العمر (يوم)' : 'Age (Days)'}</th>
                                    <th className="p-2 text-center">{language === 'ar' ? 'الشريحة' : 'Bracket'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                                  {item.openInvoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-zinc-50/50">
                                      <td className="p-2 font-bold text-emerald-700 flex items-center gap-1">
                                        <span>{inv.invoice_number}</span>
                                        {inv.currency !== systemCurrency ? (
                                          <span className="text-[9px] px-1 bg-amber-50 text-amber-700 rounded border border-amber-200">
                                            {inv.currency}
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="p-2 text-zinc-600">{formatDate(inv.date)}</td>
                                      <td className="p-2 text-zinc-600">{formatDate(inv.due_date)}</td>
                                      <td className="p-2 text-right text-zinc-600">{formatNumber(inv.original_base_amount)}</td>
                                      <td className="p-2 text-right text-emerald-600 font-semibold">{formatNumber(inv.settled_up_to_as_of)}</td>
                                      <td className="p-2 text-right font-black text-zinc-900">{formatNumber(inv.open_balance)}</td>
                                      <td className="p-2 text-center text-zinc-700 font-bold">{inv.age_days}</td>
                                      <td className="p-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          inv.bracket === 'current' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                          inv.bracket === '31-60' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                          inv.bracket === '61-90' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                          inv.bracket === '91-120' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                          'bg-rose-50 text-rose-700 border border-rose-200'
                                        }`}>
                                          {inv.bracket === 'current' ? (language === 'ar' ? '0 - 30 يوم' : '0-30 Days') :
                                           inv.bracket === '31-60' ? (language === 'ar' ? '31 - 60 يوم' : '31-60 Days') :
                                           inv.bracket === '61-90' ? (language === 'ar' ? '61 - 90 يوم' : '61-90 Days') :
                                           inv.bracket === '91-120' ? (language === 'ar' ? '91 - 120 يوم' : '91-120 Days') :
                                           (language === 'ar' ? '+120 يوم' : '+120 Days')}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Table Footer Totals */}
            <tfoot>
              <tr className="bg-zinc-200/90 text-zinc-900 font-black text-xs border-t-2 border-zinc-300">
                <td colSpan={4} className="p-3 text-center border border-zinc-300 font-black">
                  {language === 'ar' ? 'الإجماليات العامة:' : 'GRAND TOTALS:'}
                </td>
                <td className="p-3 px-3 border border-zinc-300 text-right font-mono text-emerald-800">
                  {formatNumber(totals.current)}
                </td>
                <td className="p-3 px-3 border border-zinc-300 text-right font-mono text-blue-800">
                  {formatNumber(totals.b31_60)}
                </td>
                <td className="p-3 px-3 border border-zinc-300 text-right font-mono text-amber-800">
                  {formatNumber(totals.b61_90)}
                </td>
                <td className="p-3 px-3 border border-zinc-300 text-right font-mono text-orange-800">
                  {formatNumber(totals.b91_120)}
                </td>
                <td className="p-3 px-3 border border-zinc-300 text-right font-mono text-rose-800">
                  {formatNumber(totals.over120)}
                </td>
                <td className="p-3 px-3 border border-zinc-300 text-right font-mono text-zinc-600">
                  {totals.unallocated > 0 ? `(${formatNumber(totals.unallocated)})` : '-'}
                </td>
                <td className="p-3 px-3 border border-zinc-300 text-right font-mono text-sm font-black text-zinc-900 bg-zinc-300/60">
                  {formatNumber(totals.finalBalance)}
                </td>
                <td className="p-3 border border-zinc-300 text-center text-[10px] text-zinc-500 font-normal">
                  {systemCurrency}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
