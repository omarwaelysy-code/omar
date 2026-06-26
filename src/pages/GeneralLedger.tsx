import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { JournalEntry, Account, Customer, Supplier, LedgerLine, AccountType, PaymentMethod } from '../types';
import { Search, Calendar, FileText, Download, Printer, Filter, BookOpen, ArrowLeftRight, User, Users, RefreshCcw, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { AccountingEngine } from '../services/AccountingEngine';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { useNavigation } from '../contexts/NavigationContext';

const isDefaultMethodForAccount = (method: any, sharingMethods: any[]) => {
  if (sharingMethods.length === 1) return true;
  const hasCashInName = (name: string) => {
    const n = name.toLowerCase();
    return n === 'كاش' || n === 'cash' || n === 'الخزينة الرئيسية' || n === 'الخزنة الرئيسية';
  };
  const cashMethod = sharingMethods.find(p => hasCashInName(p.name));
  if (cashMethod) return method.id === cashMethod.id;
  const sorted = [...sharingMethods].sort((a, b) => a.name.localeCompare(b.name));
  return method.id === sorted[0].id;
};

export const GeneralLedger: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingViewDoc } = useNavigation();
  const reportRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ledgerMode, setLedgerMode] = useState<'single' | 'detailed'>('single');
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [detailedSearchTerm, setDetailedSearchTerm] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const resolvePaymentMethodForLine = (
    line: any,
    invoices?: any[],
    purchaseInvoices?: any[]
  ) => {
    const sharingMethods = paymentMethods.filter(p => p.account_id === line.account_id);
    if (sharingMethods.length === 0) return null;
    
    // 1. Strict sub_account match
    if (line.sub_account_id && line.sub_account_type === 'payment_method') {
      const pm = sharingMethods.find(p => p.id === line.sub_account_id);
      if (pm) return pm;
    }
    
    // 2. Opening Balance match
    if (line.reference_type === 'opening_balance') {
      const ref = line.reference_id || line.reference;
      if (ref) {
        const pm = sharingMethods.find(p => p.id === ref || p.code === ref || p.name === ref);
        if (pm) return pm;
      }
    }

    // 3. Invoice / Purchase Invoice lookup if arrays are provided
    if (!line.sub_account_id && line.reference_id) {
      if (line.reference_type === 'invoice' && invoices) {
        const invoice = invoices.find(i => i.id === line.reference_id);
        if (invoice && invoice.payment_type === 'cash' && invoice.payment_method_id) {
          const pm = sharingMethods.find(p => p.id === invoice.payment_method_id);
          if (pm) return pm;
        }
      } else if (line.reference_type === 'purchase_invoice' && purchaseInvoices) {
        const pInvoice = purchaseInvoices.find(i => i.id === line.reference_id);
        if (pInvoice && pInvoice.payment_type === 'cash' && pInvoice.payment_method_id) {
          const pm = sharingMethods.find(p => p.id === pInvoice.payment_method_id);
          if (pm) return pm;
        }
      }
    }

    // 4. If only one safe points to this account, it must be it
    if (sharingMethods.length === 1) {
      return sharingMethods[0];
    }

    const matchDesc = (desc: string, method: any) => {
      if (!desc) return false;
      const hasName = desc.includes(method.name) || (method.code && desc.includes(method.code));
      if (!hasName) return false;
      
      const longerMatch = sharingMethods.find(other => {
        if (other.id === method.id) return false;
        if (other.name.length <= method.name.length) return false;
        if (!other.name.includes(method.name)) return false;
        return desc.includes(other.name) || (other.code && desc.includes(other.code));
      });
      return !longerMatch;
    };

    let matchedMethod = null;
    const descToUse = line.description || '';
    
    // 5. Transfer matching
    if (line.reference_type === 'transfer' || line.reference_type === 'cash_transfer' || descToUse.includes('تحويل')) {
      for (const method of sharingMethods) {
        let isMatch = false;
        const isToUs = descToUse.includes(`إلى ${method.name}`) || descToUse.includes(`وارد ${method.name}`);
        const isFromUs = descToUse.includes(`من ${method.name}`) || descToUse.includes(`صادر ${method.name}`);
        
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;

        if (debit > 0) isMatch = isToUs || (matchDesc(descToUse, method) && !isFromUs);
        else if (credit > 0) isMatch = isFromUs || (matchDesc(descToUse, method) && !isToUs);
        else isMatch = matchDesc(descToUse, method);
        
        if (isMatch) {
          matchedMethod = method;
          break;
        }
      }
    } else {
      for (const method of sharingMethods) {
        if (matchDesc(descToUse, method)) {
          matchedMethod = method;
          break;
        }
      }
    }

    if (matchedMethod) return matchedMethod;

    // 6. Fallback to default safe
    const defaultMethod = sharingMethods.find(method => isDefaultMethodForAccount(method, sharingMethods));
    return defaultMethod || sharingMethods[0];
  };

  const handleTransactionClick = (type: string | undefined, reference: string) => {
    if (!reference || reference === '-' || reference === '') return;
    
    let normType = type;
    if (!normType) {
      if (reference.startsWith('INV-')) normType = 'invoice';
      else if (reference.startsWith('PINV-')) normType = 'purchase_invoice';
      else if (reference.startsWith('RCT-')) normType = 'receipt';
      else if (reference.startsWith('PAY-')) normType = 'payment_voucher';
      else if (reference.startsWith('RET-')) normType = 'return';
      else if (reference.startsWith('PRET-')) normType = 'purchase_return';
      else normType = 'manual';
    }
    
    if (normType === 'invoice') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: reference });
      setCurrentPage('invoices');
    } else if (normType === 'purchase_invoice') {
      setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: reference });
      setCurrentPage('purchase_invoices');
    } else if (normType === 'receipt' || normType === 'receipt_voucher') {
      setPendingViewDoc({ type: 'receipt', idOrNumber: reference });
      setCurrentPage('receipts');
    } else if (normType === 'payment_voucher' || normType === 'payment') {
      setPendingViewDoc({ type: 'payment_voucher', idOrNumber: reference });
      setCurrentPage('payment_vouchers');
    } else if (normType === 'return') {
      setPendingViewDoc({ type: 'return', idOrNumber: reference });
      setCurrentPage('returns');
    } else if (normType === 'purchase_return') {
      setPendingViewDoc({ type: 'purchase_return', idOrNumber: reference });
      setCurrentPage('purchase_returns');
    } else {
      setPendingViewDoc({ type: 'manual', idOrNumber: reference });
      setCurrentPage('journal_entries');
    }
  };
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { pendingLedgerParams, setPendingLedgerParams } = useNavigation();

  useEffect(() => {
    if (pendingLedgerParams) {
      setSelectedAccountId(pendingLedgerParams.accountId);
      setDateRange({
        start: pendingLedgerParams.startDate,
        end: pendingLedgerParams.endDate
      });
      setPendingLedgerParams(null);
    }
  }, [pendingLedgerParams, setPendingLedgerParams]);

  useEffect(() => {
    if (!user) return;

    const unsubscribeEntries = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, (data) => {
      setEntries(data);
      setLoading(false);
    });

    const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
    const unsubscribeCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
    const unsubscribeSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
    const unsubscribeAccountTypes = dbService.subscribe<AccountType>('account_types', user.company_id, setAccountTypes);
    const unsubscribePaymentMethods = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);

    return () => {
      unsubscribeEntries();
      unsubscribeAccounts();
      unsubscribeCustomers();
      unsubscribeSuppliers();
      unsubscribeAccountTypes();
      unsubscribePaymentMethods();
    };
  }, [user, refreshTrigger]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  // Flattening journal items for the Detailed Journal Entries table
  const detailedLines = React.useMemo(() => {
    if (ledgerMode !== 'detailed') return [];

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    const lines: any[] = [];

    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate < start || entryDate > end) return;

      entry.items?.forEach(item => {
        // Apply entity filters if selected
        if (selectedEntityIds.length > 0) {
          const matchesEntity = selectedEntityIds.includes(item.customer_id || '') || 
                               selectedEntityIds.includes(item.supplier_id || '') ||
                               selectedEntityIds.includes(item.sub_account_id || '');
          if (!matchesEntity) return;
        }

        let entityName = item.customer_name || item.supplier_name || '';
        if (!entityName) {
          if (item.customer_id && customers) {
            const found = customers.find(c => c.id === item.customer_id);
            if (found) entityName = found.name;
          }
          if (!entityName && item.supplier_id && suppliers) {
            const found = suppliers.find(s => s.id === item.supplier_id);
            if (found) entityName = found.name;
          }
          if (!entityName && item.sub_account_id && customers && (item.sub_account_type === 'customer' || !item.sub_account_type)) {
            const found = customers.find(c => c.id === item.sub_account_id);
            if (found) entityName = found.name;
          }
          if (!entityName && item.sub_account_id && suppliers && (item.sub_account_type === 'supplier' || !item.sub_account_type)) {
            const found = suppliers.find(s => s.id === item.sub_account_id);
            if (found) entityName = found.name;
          }
        }
        if (!entityName) {
          entityName = item.sub_account_type === 'payment_method' ? 'خزينة/بنك' : '';
        }

        // Sub-account / Product name parser helper
        const getSubAccountOrProduct = (itm: any) => {
          const desc = itm.description || entry.description || '';
          // Match "صنف: X" or "الصنف: X"
          const productMatch = desc.match(/(?:صنف|الصنف)\s*:\s*([^-\n\r]+)/i);
          if (productMatch && productMatch[1]) {
            return productMatch[1].trim();
          }
          
          const pm = resolvePaymentMethodForLine({
            account_id: itm.account_id,
            sub_account_id: itm.sub_account_id,
            sub_account_type: itm.sub_account_type,
            reference_type: entry.reference_type,
            reference_id: entry.reference_id,
            reference: entry.reference_number,
            description: itm.description || entry.description,
            debit: Number(itm.debit) || 0,
            credit: Number(itm.credit) || 0
          });
          if (pm) return pm.name;

          if (itm.sub_account_id) {
            if (itm.sub_account_type === 'expense') {
              return 'مصروف';
            }
            return itm.sub_account_id;
          }
          return '-';
        };

        const subAccountOrProduct = getSubAccountOrProduct(item);

        // Account type resolution
        const account = accounts.find(a => a.id === item.account_id);
        const typeInfo = accountTypes.find(t => t.id === account?.type_id);
        const typeLabel = typeInfo ? typeInfo.name : (account?.type_name || '-');
        const resolvedAccountName = item.account_name || account?.name || '';

        const matchesSearch = 
          !detailedSearchTerm ||
          resolvedAccountName.toLowerCase().includes(detailedSearchTerm.toLowerCase()) ||
          (item.description || '').toLowerCase().includes(detailedSearchTerm.toLowerCase()) ||
          entry.description.toLowerCase().includes(detailedSearchTerm.toLowerCase()) ||
          (entry.entry_number || '').toLowerCase().includes(detailedSearchTerm.toLowerCase()) ||
          (entry.reference_number || '').toLowerCase().includes(detailedSearchTerm.toLowerCase()) ||
          entityName.toLowerCase().includes(detailedSearchTerm.toLowerCase()) ||
          subAccountOrProduct.toLowerCase().includes(detailedSearchTerm.toLowerCase());

        if (!matchesSearch) return;

        lines.push({
          id: entry.id,
          date: entry.date,
          entry_number: entry.entry_number,
          account_id: item.account_id,
          account_name: resolvedAccountName,
          account_type: typeLabel,
          reference: entry.reference_number || '-',
          reference_type: entry.reference_type,
          entity_name: entityName || '-',
          sub_account_product: subAccountOrProduct,
          debit: Number(item.debit) || 0,
          credit: Number(item.credit) || 0,
          description: item.description || entry.description
        });
      });
    });

    // Sort by date, with entry_number and ID as tie-breakers
    return lines.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      
      const aNo = a.entry_number || '';
      const bNo = b.entry_number || '';
      const noDiff = aNo.localeCompare(bNo, undefined, { numeric: true });
      if (noDiff !== 0) return noDiff;

      return (a.id || '').localeCompare(b.id || '');
    });
  }, [ledgerMode, entries, dateRange.start, dateRange.end, selectedEntityIds, detailedSearchTerm, accounts, accountTypes, customers, suppliers]);

  const detailedTotals = React.useMemo(() => {
    return detailedLines.reduce((acc, line) => ({
      debit: acc.debit + line.debit,
      credit: acc.credit + line.credit
    }), { debit: 0, credit: 0 });
  }, [detailedLines]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const { lines: ledgerData, openingBalance: startBalance } = selectedAccount
    ? AccountingEngine.calculateLedger(
        selectedAccount,
        entries,
        dateRange.start,
        dateRange.end,
        selectedEntityIds,
        customers,
        suppliers
      )
    : { lines: [], openingBalance: 0 };

  const totals = ledgerData.reduce((acc, tx) => ({
    debit: acc.debit + tx.debit,
    credit: acc.credit + tx.credit
  }), { 
    debit: startBalance > 0 ? startBalance : 0, 
    credit: startBalance < 0 ? Math.abs(startBalance) : 0 
  });

  const currentBalance = ledgerData.length > 0 ? ledgerData[ledgerData.length - 1].balance : startBalance;

  const getSubAccountOrProductSingle = (line: any) => {
    const desc = line.description || '';
    const productMatch = desc.match(/(?:صنف|الصنف)\s*:\s*([^-\n\r]+)/i);
    if (productMatch && productMatch[1]) {
      return productMatch[1].trim();
    }
    
    const pm = resolvePaymentMethodForLine({
      account_id: line.account_id || selectedAccountId,
      sub_account_id: line.sub_account_id,
      sub_account_type: line.sub_account_type,
      reference_type: line.reference_type,
      reference_id: line.reference_id,
      reference: line.reference,
      description: line.description,
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0
    });
    if (pm) return pm.name;

    if (line.sub_account_id) {
      if (line.sub_account_type === 'expense') {
        return 'مصروف';
      }
      return line.sub_account_id;
    }
    return '-';
  };

  const handleExportPDF = async () => {
    if (reportRef.current) {
      if (ledgerMode === 'detailed') {
        await exportToPDF(reportRef.current, { 
          filename: `Detailed_Journal_Entries`, 
          orientation: 'landscape',
          reportTitle: t('ledger.detailed_entries')
        });
      } else {
        const account = accounts.find(a => a.id === selectedAccountId);
        await exportToPDF(reportRef.current, { 
          filename: `General_Ledger_${account?.name || 'Account'}`, 
          orientation: 'landscape',
          reportTitle: `${t('ledger.title')}: ${account?.name || ''}`
        });
      }
    }
  };

  const handleExportExcel = () => {
    if (ledgerMode === 'detailed') {
      const data = detailedLines.map(line => ({
        [t('journal.column_date')]: line.date,
        [language === 'ar' ? 'رقم القيد' : 'Entry No.']: line.entry_number || '-',
        [t('accounts.column_name')]: line.account_name,
        [t('accounts.column_type')]: line.account_type,
        [t('journal.column_reference')]: line.reference,
        [t('journal.type')]: line.reference_type,
        [t('ledger.column_entity')]: line.entity_name,
        [language === 'ar' ? 'الحساب الفرعي/الصنف' : 'Sub-account/Product']: line.sub_account_product,
        [t('journal.column_debit')]: line.debit,
        [t('journal.column_credit')]: line.credit,
        [t('journal.column_description')]: line.description
      }));
      exportToExcel(data, { filename: 'Detailed_Journal_Entries' });
    } else {
      const account = accounts.find(a => a.id === selectedAccountId);
      const data = ledgerData.map(tx => ({
        [t('journal.column_date')]: tx.date,
        [t('ledger.column_entity')]: tx.entity_name || '-',
        [language === 'ar' ? 'الحساب الفرعي/الصنف' : 'Sub-account/Product']: getSubAccountOrProductSingle(tx),
        [t('journal.column_description')]: tx.description,
        [t('journal.column_reference')]: tx.reference || '-',
        [language === 'ar' ? 'رقم القيد' : 'Entry No.']: tx.entry_number || '-',
        [t('journal.column_debit')]: tx.debit,
        [t('journal.column_credit')]: tx.credit,
        [t('ledger.column_balance')]: tx.balance
      }));
      exportToExcel(data, { filename: `General_Ledger_${account?.name || 'Account'}` });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isExportDisabled = ledgerMode === 'single' ? !selectedAccountId : false;

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900">{t('ledger.title')}</h2>
          <p className="text-zinc-500 font-medium mt-1">{t('ledger.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200/50 shadow-inner w-fit">
            <button
              onClick={() => setLedgerMode('single')}
              className={`p-2 px-6 rounded-xl transition-all font-bold text-sm ${ledgerMode === 'single' ? 'bg-white text-emerald-600 shadow-sm border border-zinc-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {t('ledger.single_account')}
            </button>
            <button
              onClick={() => setLedgerMode('detailed')}
              className={`p-2 px-6 rounded-xl transition-all font-bold text-sm ${ledgerMode === 'detailed' ? 'bg-white text-emerald-600 shadow-sm border border-zinc-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {t('ledger.detailed_entries')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh}
              className="p-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 hover:text-emerald-600 transition-all hover:scale-105 active:scale-95 shadow-sm"
              title={t('reports.update_data')}
            >
              <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleExportPDF} disabled={isExportDisabled} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm disabled:opacity-50"><Printer size={20} /></button>
            <button onClick={handleExportExcel} disabled={isExportDisabled} className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm disabled:opacity-50"><Download size={20} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {ledgerMode === 'detailed' ? (
          <div className="md:col-span-2 relative">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3.5 text-zinc-400`} size={20} />
            <input
              type="text"
              placeholder={t('journal.search_placeholder')}
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium`}
              value={detailedSearchTerm}
              onChange={(e) => setDetailedSearchTerm(e.target.value)}
            />
          </div>
        ) : (
          <div className="md:col-span-2 relative">
            <BookOpen className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
            <select
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium appearance-none`}
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
              }}
            >
              <option value="">{t('ledger.select_account')}</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="relative">
          <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
          <input
            type="date"
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium`}
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div className="relative">
          <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={20} />
          <input
            type="date"
            className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium`}
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className={`flex items-center gap-2 text-zinc-600 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
            <Users size={20} className="text-emerald-500" />
            <span className="font-bold">{t('ledger.filter_entities')}</span>
          </div>
          {selectedEntityIds.length > 0 && (
            <button 
              onClick={() => setSelectedEntityIds([])}
              className="text-xs font-black text-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1"
            >
              {t('ledger.deselect_all')} ({selectedEntityIds.length})
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={`text-xs font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <User size={14} /> {t('nav.customers')}
            </label>
            <div className={`flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-200 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              {customers.map(entity => (
                <button
                  key={entity.id}
                  onClick={() => {
                    setSelectedEntityIds(prev => 
                      prev.includes(entity.id) 
                        ? prev.filter(id => id !== entity.id)
                        : [...prev, entity.id]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    selectedEntityIds.includes(entity.id)
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-100 hover:border-zinc-200'
                  }`}
                >
                  {entity.name}
                </button>
              ))}
              {customers.length === 0 && <p className="text-xs text-zinc-400 italic">{t('ledger.no_customers')}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-xs font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <Users size={14} /> {t('nav.suppliers')}
            </label>
            <div className={`flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-200 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              {suppliers.map(entity => (
                <button
                  key={entity.id}
                  onClick={() => {
                    setSelectedEntityIds(prev => 
                      prev.includes(entity.id) 
                        ? prev.filter(id => id !== entity.id)
                        : [...prev, entity.id]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    selectedEntityIds.includes(entity.id)
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-100 hover:border-zinc-200'
                  }`}
                >
                  {entity.name}
                </button>
              ))}
              {suppliers.length === 0 && <p className="text-xs text-zinc-400 italic">{t('ledger.no_suppliers')}</p>}
            </div>
          </div>
        </div>
      </div>

      {ledgerMode === 'detailed' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('ledger.total_debit')}</p>
              <p className="text-2xl font-black text-emerald-600">{formatNumber(detailedTotals.debit)}</p>
            </div>
            <div className={`bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('ledger.total_credit')}</p>
              <p className="text-2xl font-black text-emerald-600">{formatNumber(detailedTotals.credit)}</p>
            </div>
            <div className={`bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{language === 'ar' ? 'صافي الحركات' : 'Net Activity'}</p>
              <p className="text-2xl font-black text-emerald-600">
                {formatNumber(detailedTotals.debit - detailedTotals.credit)}
              </p>
            </div>
          </div>

          <div ref={reportRef} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_date')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_entry_number')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('accounts.column_name')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('accounts.column_type')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_reference')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.type')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('ledger.column_entity')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{language === 'ar' ? 'الحساب الفرعي / الصنف' : 'Sub-account / Product'}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('journal.column_debit')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('journal.column_credit')}</th>
                    <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_description')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {detailedLines.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-zinc-900">{formatDate(tx.date)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-indigo-600">
                        {tx.entry_number ? (
                          <span 
                            onClick={() => {
                              setPendingViewDoc({ type: 'journal', idOrNumber: tx.entry_number! });
                              setCurrentPage('journal_entries');
                            }}
                            className="px-3 py-1 bg-zinc-100 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-black cursor-pointer transition-all inline-block hover:scale-105 active:scale-95 font-mono"
                          >
                            {tx.entry_number}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-zinc-900">{tx.account_name}</td>
                      <td className="px-6 py-4 text-sm text-zinc-500 font-bold">{tx.account_type}</td>
                      <td className="px-6 py-4 text-sm">
                        {tx.reference && tx.reference !== '-' ? (
                          <span 
                            onClick={() => handleTransactionClick(tx.reference_type, tx.reference)}
                            className="px-3 py-1 bg-zinc-100 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-black cursor-pointer transition-all inline-block hover:scale-105 active:scale-95 font-mono"
                          >
                            {tx.reference}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 font-bold">{t(`reference_types.${tx.reference_type}`) || tx.reference_type}</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600">{tx.entity_name}</td>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-600">{tx.sub_account_product}</td>
                      <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{tx.debit > 0 ? formatNumber(tx.debit) : '-'}</td>
                      <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{tx.credit > 0 ? formatNumber(tx.credit) : '-'}</td>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-500 max-w-xs truncate">{tx.description}</td>
                    </tr>
                  ))}
                  {detailedLines.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-zinc-500 font-medium">
                        {t('ledger.no_transactions')}
                      </td>
                    </tr>
                  )}
                </tbody>
                {detailedLines.length > 0 && (
                  <tfoot className="bg-zinc-900 text-white font-black">
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center border-l border-zinc-700">{t('journal.total')}</td>
                      <td className="px-6 py-4 text-center border-l border-zinc-700">
                        {detailedTotals.debit ? formatNumber(detailedTotals.debit) : '0.00'}
                      </td>
                      <td className="px-6 py-4 text-center border-l border-zinc-700">
                        {detailedTotals.credit ? formatNumber(detailedTotals.credit) : '0.00'}
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Single Account Ledger Mode */
        !selectedAccountId ? (
          <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 mx-auto mb-4">
              <BookOpen size={32} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900">{t('ledger.please_select')}</h3>
            <p className="text-zinc-500 font-medium">{t('ledger.select_hint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('ledger.total_debit')}</p>
                <p className="text-2xl font-black text-emerald-600">{formatNumber(totals.debit)}</p>
              </div>
              <div className={`bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('ledger.total_credit')}</p>
                <p className="text-2xl font-black text-emerald-600">{formatNumber(totals.credit)}</p>
              </div>
              <div className={`bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('ledger.final_balance')}</p>
                <p className={`text-2xl font-black ${currentBalance >= 0 ? 'text-emerald-600' : 'text-emerald-600'}`}>
                  {formatNumber(currentBalance)}
                </p>
              </div>
            </div>

            <div ref={reportRef} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} border-collapse`}>
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_date')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('ledger.column_entity')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{language === 'ar' ? 'الحساب الفرعي / الصنف' : 'Sub-account / Product'}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_description')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{t('journal.column_reference')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700">{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('journal.column_debit')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('journal.column_credit')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-700 text-center">{t('ledger.column_balance')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {/* Opening Balance Row */}
                    <tr className="bg-zinc-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-zinc-900">{dateRange.start}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400">-</td>
                      <td className="px-6 py-4 text-sm text-zinc-400">-</td>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-600">{t('ledger.opening_balance_row')}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400 text-center">-</td>
                      <td className="px-6 py-4 text-sm text-zinc-400 text-center">-</td>
                      <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{startBalance > 0 ? formatNumber(startBalance) : '-'}</td>
                      <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{startBalance < 0 ? formatNumber(Math.abs(startBalance)) : '-'}</td>
                      <td className="px-6 py-4 text-sm font-black text-zinc-900 text-center">{formatNumber(startBalance)}</td>
                    </tr>
                    {ledgerData.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-zinc-900">{formatDate(tx.date)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-600">
                          {tx.entity_name || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-zinc-600">
                          {getSubAccountOrProductSingle(tx)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-zinc-600 max-w-xs truncate">
                          {tx.description}
                        </td>
                        <td className="px-6 py-4">
                          {tx.reference && tx.reference !== '-' ? (
                            <span 
                              onClick={() => handleTransactionClick(tx.reference_type, tx.reference)}
                              className="px-3 py-1 bg-zinc-100 text-emerald-600 hover:text-emerald-705 hover:bg-emerald-50 rounded-lg text-xs font-black cursor-pointer transition-all inline-block hover:scale-105 active:scale-95 font-mono"
                            >
                              {tx.reference}
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-zinc-100 text-zinc-400 rounded-lg text-xs font-bold font-mono">
                              -
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {tx.entry_number ? (
                            <span 
                              onClick={() => {
                                setPendingViewDoc({ type: 'journal', idOrNumber: tx.entry_number! });
                                setCurrentPage('journal_entries');
                              }}
                              className="px-3 py-1 bg-zinc-100 text-indigo-600 hover:text-indigo-707 hover:bg-indigo-50 rounded-lg text-xs font-black cursor-pointer transition-all inline-block hover:scale-105 active:scale-95 font-mono"
                            >
                              {tx.entry_number}
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-zinc-100 text-zinc-400 rounded-lg text-xs font-bold font-mono">
                              -
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{tx.debit > 0 ? formatNumber(tx.debit) : '-'}</td>
                        <td className="px-6 py-4 text-sm font-black text-emerald-600 text-center">{tx.credit > 0 ? formatNumber(tx.credit) : '-'}</td>
                        <td className="px-6 py-4 text-sm font-black text-zinc-900 text-center">{formatNumber(tx.balance)}</td>
                      </tr>
                    ))}
                    {ledgerData.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-zinc-500 font-medium">
                          {t('ledger.no_transactions')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
