import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PaymentMethod, JournalEntry, Account } from '../types';
import { 
  Calendar, Download, Printer, Wallet, ArrowLeftRight, BarChart3, 
  RefreshCcw, Search, ArrowLeft, ArrowRight, ExternalLink,
  Landmark, Smartphone, BookOpen, Layers
} from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { useNavigation } from '../contexts/NavigationContext';
import { EGYPTIAN_BANKS_DATA, BankLogoBadge, EgyptianBank, BANK_LOGO_MAP } from '../data/egyptianBanks';

const findEgyptianBank = (methodOrBank: { bank_code?: string; name?: string; bank_name?: string; swift_code?: string } | null | undefined): EgyptianBank | null => {
  if (!methodOrBank) return null;
  if (methodOrBank.bank_code) {
    const b = EGYPTIAN_BANKS_DATA.find(x => x.code.toUpperCase() === methodOrBank.bank_code?.toUpperCase());
    if (b) return b;
  }
  if (methodOrBank.swift_code) {
    const b = EGYPTIAN_BANKS_DATA.find(x => x.swift.toUpperCase() === methodOrBank.swift_code?.toUpperCase());
    if (b) return b;
  }
  const nameToSearch = (methodOrBank.bank_name || methodOrBank.name || '').trim().toLowerCase();
  if (nameToSearch) {
    const b = EGYPTIAN_BANKS_DATA.find(x => 
      x.nameAr.toLowerCase() === nameToSearch ||
      nameToSearch.includes(x.nameAr.toLowerCase()) ||
      x.nameAr.toLowerCase().includes(nameToSearch) ||
      x.nameEn.toLowerCase() === nameToSearch ||
      x.code.toLowerCase() === nameToSearch
    );
    if (b) return b;
  }
  return null;
};

interface CashBalanceData {
  id: string;
  code: string;
  name: string;
  type: 'cash' | 'bank' | 'wallet' | 'other';
  typeLabelAr: string;
  typeLabelEn: string;
  bankLogo?: string;
  bankObj?: EgyptianBank | null;
  accountId?: string;
  accountName: string;
  openingBalance: number;
  
  // Inflows (debits)
  receiptVouchers: number;
  salesInvoices: number;
  purchaseReturns: number;
  transferIn: number;
  otherIn: number;
  
  // Outflows (credits)
  paymentVouchers: number;
  purchaseInvoices: number;
  salesReturns: number;
  transferOut: number;
  otherOut: number;
  
  balance: number;
}

interface StatementLine {
  date: string;
  entryNumber: string;
  referenceType: string;
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

const resolvePaymentMethodForItem = (
  item: any,
  je: any,
  paymentMethods: PaymentMethod[],
  receiptVouchers: any[],
  paymentVouchers: any[],
  invoices: any[],
  purchaseInvoices: any[],
  returns: any[],
  purchaseReturns: any[],
  cashTransfers: any[]
): PaymentMethod | null => {
  // Prerequisite: The ledger account MUST match the payment method's account_id.
  // Non-cash/bank lines (like customer accounts, supplier accounts, VAT, revenue) are ignored.
  const sharingMethods = paymentMethods.filter(p => p.account_id === item.account_id);
  if (sharingMethods.length === 0) return null;

  // 1. Strict sub_account match
  if (item.sub_account_type === 'payment_method' && item.sub_account_id) {
    const pm = sharingMethods.find(p => p.id === item.sub_account_id);
    if (pm) return pm;
  }

  // 2. Receipt Voucher lookup
  if (je.reference_type === 'receipt' && je.reference_id) {
    const rv = receiptVouchers.find(v => v.id === je.reference_id);
    if (rv && rv.payment_method_id) {
      const pm = sharingMethods.find(p => p.id === rv.payment_method_id);
      if (pm) return pm;
    }
  }

  // 3. Payment Voucher lookup
  if (je.reference_type === 'payment' && je.reference_id) {
    const pv = paymentVouchers.find(v => v.id === je.reference_id);
    if (pv && pv.payment_method_id) {
      const pm = sharingMethods.find(p => p.id === pv.payment_method_id);
      if (pm) return pm;
    }
  }

  // 4. Sales Invoice lookup
  if (je.reference_type === 'invoice' && je.reference_id) {
    const inv = invoices.find(v => v.id === je.reference_id);
    if (inv && inv.payment_method_id) {
      const pm = sharingMethods.find(p => p.id === inv.payment_method_id);
      if (pm) return pm;
    }
  }

  // 5. Purchase Invoice lookup
  if (je.reference_type === 'purchase_invoice' && je.reference_id) {
    const pinv = purchaseInvoices.find(v => v.id === je.reference_id);
    if (pinv && pinv.payment_method_id) {
      const pm = sharingMethods.find(p => p.id === pinv.payment_method_id);
      if (pm) return pm;
    }
  }

  // 6. Sales Return lookup
  if (je.reference_type === 'return' && je.reference_id) {
    const ret = returns.find(v => v.id === je.reference_id);
    if (ret && ret.payment_method_id) {
      const pm = sharingMethods.find(p => p.id === ret.payment_method_id);
      if (pm) return pm;
    }
  }

  // 7. Purchase Return lookup
  if (je.reference_type === 'purchase_return' && je.reference_id) {
    const pret = purchaseReturns.find(v => v.id === je.reference_id);
    if (pret && pret.payment_method_id) {
      const pm = sharingMethods.find(p => p.id === pret.payment_method_id);
      if (pm) return pm;
    }
  }

  // 8. Cash Transfer lookup
  if ((je.reference_type === 'transfer' || je.reference_type === 'cash_transfer') && je.reference_id) {
    const ct = cashTransfers.find(v => v.id === je.reference_id);
    if (ct) {
      const debit = Number(item.debit) || 0;
      const pmId = debit > 0 ? ct.to_payment_method_id : ct.from_payment_method_id;
      const pm = sharingMethods.find(p => p.id === pmId);
      if (pm) return pm;
    }
  }

  // 9. Account ID Fallback (if only one method shares this ledger account)
  if (sharingMethods.length === 1) {
    return sharingMethods[0];
  }

  // 10. Fallback by description match
  const desc = (item.description || je.description || '').toLowerCase();
  for (const pm of sharingMethods) {
    if (desc.includes(pm.name.toLowerCase()) || (pm.code && desc.includes(pm.code.toLowerCase()))) {
      return pm;
    }
  }

  return null;
};

export const CashBalances: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingViewDoc } = useNavigation();
  
  const reportRef = useRef<HTMLDivElement>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // First day of current year
    end: new Date().toISOString().split('T')[0]
  });
  
  const [viewMode, setViewMode] = useState<'summary' | 'statement'>('summary');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  
  const [balances, setBalances] = useState<CashBalanceData[]>([]);
  
  // Raw data stores for statement calculations
  const [rawJournalEntries, setRawJournalEntries] = useState<JournalEntry[]>([]);
  const [rawReceiptVouchers, setRawReceiptVouchers] = useState<any[]>([]);
  const [rawPaymentVouchers, setRawPaymentVouchers] = useState<any[]>([]);
  const [rawInvoices, setRawInvoices] = useState<any[]>([]);
  const [rawPurchaseInvoices, setRawPurchaseInvoices] = useState<any[]>([]);
  const [rawReturns, setRawReturns] = useState<any[]>([]);
  const [rawPurchaseReturns, setRawPurchaseReturns] = useState<any[]>([]);
  const [rawCashTransfers, setRawCashTransfers] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'type' | 'account'>('none');
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [hideEmptyPaymentMethods, setHideEmptyPaymentMethods] = useState(false);
  const [isCompact, setIsCompact] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<PaymentMethod>(
        'payment_methods', 
        user.company_id, 
        (data) => {
          setPaymentMethods(data);
          if (data.length === 0) setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
      const unsubAccounts = dbService.subscribe<Account>(
        'accounts',
        user.company_id,
        setAccounts
      );
      return () => {
        unsub();
        unsubAccounts();
      };
    } else {
      setLoading(false);
    }
  }, [user, refreshTrigger]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      if (paymentMethods.length === 0) {
        if (!loading) return; 
        setLoading(false);
        return;
      }
      
      setError(null);
      setLoading(true);
      try {
        const [
          paymentMethodsData,
          journalEntries,
          receiptVouchers,
          paymentVouchers,
          invoices,
          purchaseInvoices,
          returns,
          purchaseReturns,
          cashTransfers,
          accountsData
        ] = await Promise.all([
          dbService.list<PaymentMethod>('payment_methods', user.company_id),
          dbService.list<JournalEntry>('journal_entries', user.company_id),
          dbService.list<any>('receipt_vouchers', user.company_id),
          dbService.list<any>('payment_vouchers', user.company_id),
          dbService.list<any>('invoices', user.company_id),
          dbService.list<any>('purchase_invoices', user.company_id),
          dbService.list<any>('returns', user.company_id),
          dbService.list<any>('purchase_returns', user.company_id),
          dbService.list<any>('cash_transfers', user.company_id),
          dbService.list<Account>('accounts', user.company_id)
        ]);

        setRawJournalEntries(journalEntries);
        setRawReceiptVouchers(receiptVouchers);
        setRawPaymentVouchers(paymentVouchers);
        setRawInvoices(invoices);
        setRawPurchaseInvoices(purchaseInvoices);
        setRawReturns(returns);
        setRawPurchaseReturns(purchaseReturns);
        setRawCashTransfers(cashTransfers);

        const startStr = dateRange.start;
        const endStr = dateRange.end;

        const calculatedBalances = paymentMethodsData.map(method => {
          let opIn = 0;
          let opOut = 0;
          
          let receiptVouchersAmount = 0;
          let salesInvoicesAmount = 0;
          let purchaseReturnsAmount = 0;
          let transferInAmount = 0;
          let otherInAmount = 0;
          
          let paymentVouchersAmount = 0;
          let purchaseInvoicesAmount = 0;
          let salesReturnsAmount = 0;
          let transferOutAmount = 0;
          let otherOutAmount = 0;

          // Process journal entries for this payment method
          journalEntries.forEach(je => {
            const jeDateStr = (je.date || '').slice(0, 10);
            const refType = je.reference_type;
            const isTransfer = refType === 'transfer' || refType === 'cash_transfer';

            je.items?.forEach((item: any) => {
              // Resolve payment method using our robust resolver
              const resolvedMethod = resolvePaymentMethodForItem(
                item,
                je,
                paymentMethodsData,
                receiptVouchers,
                paymentVouchers,
                invoices,
                purchaseInvoices,
                returns,
                purchaseReturns,
                cashTransfers
              );

              const isMatch = resolvedMethod?.id === method.id;

              if (isMatch) {
                // If this is an opening balance journal entry and method has baseOpening,
                // skip it to prevent double-counting with baseOpening!
                const isOpeningJE = refType === 'opening_balance' || 
                  (je.description || '').includes('رصيد افتتاحي') || 
                  (item.description || '').includes('رصيد افتتاحي');

                if (isOpeningJE && Number(method.opening_balance || 0) !== 0) {
                  return;
                }

                const amountDebit = Number(item.debit || 0);
                const amountCredit = Number(item.credit || 0);

                if (startStr && jeDateStr < startStr) {
                  opIn += amountDebit;
                  opOut += amountCredit;
                } else if ((!startStr || jeDateStr >= startStr) && (!endStr || jeDateStr <= endStr)) {
                  // Inflow (Debit)
                  if (amountDebit > 0) {
                    if (refType === 'receipt') {
                      receiptVouchersAmount += amountDebit;
                    } else if (refType === 'invoice') {
                      salesInvoicesAmount += amountDebit;
                    } else if (refType === 'purchase_return') {
                      purchaseReturnsAmount += amountDebit;
                    } else if (isTransfer) {
                      transferInAmount += amountDebit;
                    } else {
                      otherInAmount += amountDebit;
                    }
                  }
                  // Outflow (Credit)
                  if (amountCredit > 0) {
                    if (refType === 'payment') {
                      paymentVouchersAmount += amountCredit;
                    } else if (refType === 'purchase_invoice') {
                      purchaseInvoicesAmount += amountCredit;
                    } else if (refType === 'return') {
                      salesReturnsAmount += amountCredit;
                    } else if (isTransfer) {
                      transferOutAmount += amountCredit;
                    } else {
                      otherOutAmount += amountCredit;
                    }
                  }
                }
              }
            });
          });

          // Beginning Balance = Method's Opening Balance + Debits before start - Credits before start
          const baseOpening = Number(method.opening_balance || 0);
          const beginningBalance = baseOpening + opIn - opOut;
          const endingBalance = beginningBalance + 
            (receiptVouchersAmount + salesInvoicesAmount + purchaseReturnsAmount + transferInAmount + otherInAmount) -
            (paymentVouchersAmount + purchaseInvoicesAmount + salesReturnsAmount + transferOutAmount + otherOutAmount);

          const linkedAccount = accountsData.find(a => a.id === method.account_id);

          const methodType = (method.type || 'cash') as 'cash' | 'bank' | 'wallet';
          let typeLabelAr = 'خزينة';
          let typeLabelEn = 'Cash Safe';
          if (methodType === 'bank') {
            typeLabelAr = 'بنك';
            typeLabelEn = 'Bank';
          } else if (methodType === 'wallet') {
            typeLabelAr = 'محفظة إلكترونية';
            typeLabelEn = 'E-Wallet';
          }

          const matchedBank = methodType === 'bank' ? findEgyptianBank(method) : null;
          const logoUrl = method.bank_logo || matchedBank?.logoUrl || (matchedBank && BANK_LOGO_MAP[matchedBank.code] ? BANK_LOGO_MAP[matchedBank.code] : undefined);

          return {
            id: method.id,
            code: method.code || '-',
            name: method.name,
            type: methodType,
            typeLabelAr,
            typeLabelEn,
            bankLogo: logoUrl,
            bankObj: matchedBank,
            accountId: method.account_id,
            accountName: linkedAccount ? `${linkedAccount.code} - ${linkedAccount.name}` : (method.account_name || '-'),
            openingBalance: beginningBalance,
            receiptVouchers: receiptVouchersAmount,
            salesInvoices: salesInvoicesAmount,
            purchaseReturns: purchaseReturnsAmount,
            transferIn: transferInAmount,
            otherIn: otherInAmount,
            paymentVouchers: paymentVouchersAmount,
            purchaseInvoices: purchaseInvoicesAmount,
            salesReturns: salesReturnsAmount,
            transferOut: transferOutAmount,
            otherOut: otherOutAmount,
            balance: endingBalance
          };
        });

        // Reconcile direct unassigned journal entries on cash/bank accounts
        const cashAccIds = new Set(paymentMethodsData.map(p => p.account_id).filter(Boolean));
        accountsData.forEach(a => {
          if (a.code?.startsWith('110') || a.code?.startsWith('113') || (a as any).type === 'cash_and_equivalents') {
            cashAccIds.add(a.id);
          }
        });

        const unassignedByAccount = new Map<string, {
          account: Account;
          opIn: number;
          opOut: number;
          transferIn: number;
          otherIn: number;
          transferOut: number;
          otherOut: number;
        }>();

        journalEntries.forEach(je => {
          const jeDateStr = (je.date || '').slice(0, 10);
          const isTransfer = je.reference_type === 'transfer' || je.reference_type === 'cash_transfer';

          je.items?.forEach((item: any) => {
            if (!item?.account_id || !cashAccIds.has(item.account_id)) return;
            const resolvedMethod = resolvePaymentMethodForItem(
              item,
              je,
              paymentMethodsData,
              receiptVouchers,
              paymentVouchers,
              invoices,
              purchaseInvoices,
              returns,
              purchaseReturns,
              cashTransfers
            );

            if (!resolvedMethod) {
              const acc = accountsData.find(a => a.id === item.account_id);
              if (!acc) return;
              if (!unassignedByAccount.has(acc.id)) {
                unassignedByAccount.set(acc.id, {
                  account: acc,
                  opIn: 0,
                  opOut: 0,
                  transferIn: 0,
                  otherIn: 0,
                  transferOut: 0,
                  otherOut: 0
                });
              }

              const group = unassignedByAccount.get(acc.id)!;
              const amountDebit = Number(item.debit || 0);
              const amountCredit = Number(item.credit || 0);

              if (startStr && jeDateStr < startStr) {
                group.opIn += amountDebit;
                group.opOut += amountCredit;
              } else if ((!startStr || jeDateStr >= startStr) && (!endStr || jeDateStr <= endStr)) {
                if (amountDebit > 0) {
                  if (isTransfer) group.transferIn += amountDebit;
                  else group.otherIn += amountDebit;
                }
                if (amountCredit > 0) {
                  if (isTransfer) group.transferOut += amountCredit;
                  else group.otherOut += amountCredit;
                }
              }
            }
          });
        });

        const unassignedRows: CashBalanceData[] = [];
        unassignedByAccount.forEach((data, accId) => {
          const baseOpening = Number(data.account.opening_balance || 0);
          const beginningBalance = baseOpening + data.opIn - data.opOut;
          const endingBalance = beginningBalance + (data.transferIn + data.otherIn) - (data.transferOut + data.otherOut);

          if (
            Math.abs(beginningBalance) > 0.001 ||
            data.transferIn > 0.001 ||
            data.otherIn > 0.001 ||
            data.transferOut > 0.001 ||
            data.otherOut > 0.001 ||
            Math.abs(endingBalance) > 0.001
          ) {
            unassignedRows.push({
              id: `unassigned_${accId}`,
              code: `GL-${data.account.code}`,
              name: language === 'ar' 
                ? `حركات وقيود عامة على ${data.account.name}` 
                : `General Ledger Entries on ${data.account.name}`,
              type: 'other',
              typeLabelAr: 'قيد عام',
              typeLabelEn: 'General Ledger',
              bankLogo: undefined,
              bankObj: null,
              accountId: data.account.id,
              accountName: `${data.account.code} - ${data.account.name}`,
              openingBalance: beginningBalance,
              receiptVouchers: 0,
              salesInvoices: 0,
              purchaseReturns: 0,
              transferIn: data.transferIn,
              otherIn: data.otherIn,
              paymentVouchers: 0,
              purchaseInvoices: 0,
              salesReturns: 0,
              transferOut: data.transferOut,
              otherOut: data.otherOut,
              balance: endingBalance
            });
          }
        });

        setBalances([...calculatedBalances, ...unassignedRows]);
      } catch (e: any) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, paymentMethods, dateRange, refreshTrigger]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const filteredBalances = balances.filter(b => {
    // 1. Search term filter
    const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (b.typeLabelAr && b.typeLabelAr.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (b.typeLabelEn && b.typeLabelEn.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    // 2. Hide empty payment methods filter
    if (hideEmptyPaymentMethods) {
      const hasMovement = 
        Math.abs(b.openingBalance) > 0.001 ||
        b.receiptVouchers > 0.001 ||
        b.salesInvoices > 0.001 ||
        b.purchaseReturns > 0.001 ||
        b.transferIn > 0.001 ||
        b.otherIn > 0.001 ||
        b.paymentVouchers > 0.001 ||
        b.purchaseInvoices > 0.001 ||
        b.salesReturns > 0.001 ||
        b.transferOut > 0.001 ||
        b.otherOut > 0.001 ||
        Math.abs(b.balance) > 0.001;
      return hasMovement;
    }

    return true;
  });

  const computeTotals = (items: CashBalanceData[]) => ({
    openingBalance: items.reduce((sum, b) => sum + b.openingBalance, 0),
    receiptVouchers: items.reduce((sum, b) => sum + b.receiptVouchers, 0),
    salesInvoices: items.reduce((sum, b) => sum + b.salesInvoices, 0),
    purchaseReturns: items.reduce((sum, b) => sum + b.purchaseReturns, 0),
    transferIn: items.reduce((sum, b) => sum + b.transferIn, 0),
    otherIn: items.reduce((sum, b) => sum + b.otherIn, 0),
    paymentVouchers: items.reduce((sum, b) => sum + b.paymentVouchers, 0),
    purchaseInvoices: items.reduce((sum, b) => sum + b.purchaseInvoices, 0),
    salesReturns: items.reduce((sum, b) => sum + b.salesReturns, 0),
    transferOut: items.reduce((sum, b) => sum + b.transferOut, 0),
    otherOut: items.reduce((sum, b) => sum + b.otherOut, 0),
    balance: items.reduce((sum, b) => sum + b.balance, 0)
  });

  const totals = useMemo(() => computeTotals(filteredBalances), [filteredBalances]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') {
      return [{
        id: 'all',
        titleAr: '',
        titleEn: '',
        icon: null,
        colorClass: '',
        items: filteredBalances,
        totals
      }];
    }

    if (groupBy === 'type') {
      const typeOrder = ['bank', 'cash', 'wallet', 'other'] as const;
      const typeMeta: Record<string, { titleAr: string; titleEn: string; icon: any; color: string }> = {
        bank: {
          titleAr: 'الحسابات البنكية (البنوك)',
          titleEn: 'Bank Accounts',
          icon: Landmark,
          color: 'text-indigo-700 bg-indigo-50 border-indigo-200'
        },
        cash: {
          titleAr: 'الخزائن والنقدية',
          titleEn: 'Cash & Safes',
          icon: Wallet,
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200'
        },
        wallet: {
          titleAr: 'المحافظ الإلكترونية',
          titleEn: 'E-Wallets',
          icon: Smartphone,
          color: 'text-violet-700 bg-violet-50 border-violet-200'
        },
        other: {
          titleAr: 'حسابات وقيود الأستاذ العام',
          titleEn: 'General Ledger Accounts',
          icon: BookOpen,
          color: 'text-slate-700 bg-slate-50 border-slate-200'
        }
      };

      return typeOrder
        .map(tKey => {
          const items = filteredBalances.filter(b => b.type === tKey);
          if (items.length === 0) return null;
          return {
            id: `type_${tKey}`,
            titleAr: typeMeta[tKey].titleAr,
            titleEn: typeMeta[tKey].titleEn,
            icon: typeMeta[tKey].icon,
            colorClass: typeMeta[tKey].color,
            items,
            totals: computeTotals(items)
          };
        })
        .filter(Boolean) as {
          id: string;
          titleAr: string;
          titleEn: string;
          icon: any;
          colorClass: string;
          items: CashBalanceData[];
          totals: ReturnType<typeof computeTotals>;
        }[];
    }

    if (groupBy === 'account') {
      const map = new Map<string, CashBalanceData[]>();
      filteredBalances.forEach(b => {
        const accKey = b.accountName || (language === 'ar' ? 'حساب غير محدد' : 'Unspecified Account');
        if (!map.has(accKey)) {
          map.set(accKey, []);
        }
        map.get(accKey)!.push(b);
      });

      const groups: {
        id: string;
        titleAr: string;
        titleEn: string;
        icon: any;
        colorClass: string;
        items: CashBalanceData[];
        totals: ReturnType<typeof computeTotals>;
      }[] = [];

      map.forEach((items, accKey) => {
        groups.push({
          id: `acc_${accKey}`,
          titleAr: `${language === 'ar' ? 'الحساب المحاسبي' : 'Account'}: ${accKey}`,
          titleEn: `Account: ${accKey}`,
          icon: BookOpen,
          colorClass: 'text-sky-800 bg-sky-50 border-sky-200',
          items,
          totals: computeTotals(items)
        });
      });
      return groups;
    }

    return [];
  }, [groupBy, filteredBalances, totals, language]);

  const allColumns = [
    { id: 'code', labelAr: 'كود طريقة السداد', labelEn: 'Payment Method Code', type: 'meta' },
    { id: 'name', labelAr: 'اسم طريقة السداد', labelEn: 'Payment Method Name', type: 'meta' },
    { id: 'type', labelAr: 'نوع طريقة السداد', labelEn: 'Payment Method Type', type: 'meta' },
    { id: 'logo', labelAr: 'اللوجو', labelEn: 'Logo', type: 'meta' },
    { id: 'accountName', labelAr: 'اسم الحساب المحاسبي', labelEn: 'Linked Account Name', type: 'meta' },
    { id: 'openingBalance', labelAr: 'رصيد أول الفترة', labelEn: 'Beginning Balance', type: 'balance' },
    
    // Inflows (وارد)
    { id: 'receiptVouchers', labelAr: 'سندات قبض', labelEn: 'Receipt Vouchers', type: 'inflow' },
    { id: 'salesInvoices', labelAr: 'فواتير مبيعات نقدية', labelEn: 'Cash Sales Invoices', type: 'inflow' },
    { id: 'purchaseReturns', labelAr: 'مرتجع مشتريات نقدي', labelEn: 'Cash Purchase Returns', type: 'inflow' },
    { id: 'transferIn', labelAr: 'تحويل وارد', labelEn: 'Incoming Transfer', type: 'inflow' },
    { id: 'otherIn', labelAr: 'واردات أخرى', labelEn: 'Other Inflows', type: 'inflow' },
    
    // Outflows (منصرف)
    { id: 'paymentVouchers', labelAr: 'سندات صرف', labelEn: 'Payment Vouchers', type: 'outflow' },
    { id: 'purchaseInvoices', labelAr: 'فواتير مشتريات نقدية', labelEn: 'Cash Purchase Invoices', type: 'outflow' },
    { id: 'salesReturns', labelAr: 'مرتجع مبيعات نقدي', labelEn: 'Cash Sales Returns', type: 'outflow' },
    { id: 'transferOut', labelAr: 'تحويل منصرف', labelEn: 'Outgoing Transfer', type: 'outflow' },
    { id: 'otherOut', labelAr: 'منصرفات أخرى', labelEn: 'Other Outflows', type: 'outflow' },
    
    // Ending
    { id: 'balance', labelAr: 'الرصيد', labelEn: 'Balance', type: 'balance' }
  ];

  const visibleColumns = allColumns.filter(col => {
    if (col.id === 'logo' && !balances.some(b => b.type === 'bank')) return false;
    if (col.type === 'meta' || col.id === 'balance' || col.id === 'openingBalance') return true;
    if (hideEmptyColumns) {
      const colTotal = totals[col.id as keyof typeof totals] || 0;
      return Math.abs(colTotal) > 0.001;
    }
    return true;
  });

  // Calculate detailed statement lines for the selected payment method
  const getStatementData = () => {
    if (!selectedMethodId) return { beginningBalance: 0, endingBalance: 0, lines: [] };
    const isUnassigned = selectedMethodId.startsWith('unassigned_');
    const targetAccountId = isUnassigned ? selectedMethodId.replace('unassigned_', '') : null;
    const method = isUnassigned ? null : paymentMethods.find(m => m.id === selectedMethodId);
    if (!method && !isUnassigned) return { beginningBalance: 0, endingBalance: 0, lines: [] };

    let opIn = 0;
    let opOut = 0;
    const methodEntries: any[] = [];

    rawJournalEntries.forEach(je => {
      const jeDateStr = (je.date || '').slice(0, 10);
      const refType = je.reference_type;
      
      je.items?.forEach((item: any) => {
        const resolvedMethod = resolvePaymentMethodForItem(
          item,
          je,
          paymentMethods,
          rawReceiptVouchers,
          rawPaymentVouchers,
          rawInvoices,
          rawPurchaseInvoices,
          rawReturns,
          rawPurchaseReturns,
          rawCashTransfers
        );

        let isMatch = false;
        if (isUnassigned) {
          isMatch = item.account_id === targetAccountId && !resolvedMethod;
        } else {
          isMatch = resolvedMethod?.id === method?.id;
        }

        if (isMatch) {
          const isOpeningJE = refType === 'opening_balance' || 
            (je.description || '').includes('رصيد افتتاحي') || 
            (item.description || '').includes('رصيد افتتاحي');

          if (!isUnassigned && isOpeningJE && Number(method?.opening_balance || 0) !== 0) {
            return;
          }

          const amountDebit = Number(item.debit || 0);
          const amountCredit = Number(item.credit || 0);

          if (dateRange.start && jeDateStr < dateRange.start) {
            opIn += amountDebit;
            opOut += amountCredit;
          } else if ((!dateRange.start || jeDateStr >= dateRange.start) && (!dateRange.end || jeDateStr <= dateRange.end)) {
            methodEntries.push({
              date: jeDateStr,
              entryNumber: je.entry_number || je.reference_number || '-',
              referenceType: je.reference_type,
              referenceNumber: je.reference_number || '-',
              description: item.description || je.description || '-',
              debit: amountDebit,
              credit: amountCredit,
              timestamp: new Date(je.date).getTime()
            });
          }
        }
      });
    });

    // Chronological sorting
    methodEntries.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.timestamp - b.timestamp;
    });

    const targetAccount = isUnassigned ? accounts.find(a => a.id === targetAccountId) : null;
    const baseOpening = isUnassigned ? Number(targetAccount?.opening_balance || 0) : Number(method?.opening_balance || 0);
    let balance = baseOpening + opIn - opOut;
    const beginningBalance = balance;

    const statementLines = methodEntries.map(entry => {
      balance = balance + entry.debit - entry.credit;
      return {
        ...entry,
        runningBalance: balance
      };
    });

    return {
      beginningBalance,
      endingBalance: balance,
      lines: statementLines
    };
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

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'receipt': return language === 'ar' ? 'سند قبض' : 'Receipt';
      case 'payment': return language === 'ar' ? 'سند صرف' : 'Payment';
      case 'invoice': return language === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice';
      case 'purchase_invoice': return language === 'ar' ? 'فاتورة مشتريات' : 'Purchase Invoice';
      case 'return': return language === 'ar' ? 'مرتجع مبيعات' : 'Sales Return';
      case 'purchase_return': return language === 'ar' ? 'مرتجع مشتريات' : 'Purchase Return';
      case 'transfer':
      case 'cash_transfer': return language === 'ar' ? 'تحويل نقدي' : 'Cash Transfer';
      default: return language === 'ar' ? 'قيد تسوية' : 'Adjustment';
    }
  };

  const statementData = getStatementData();

  const handleExportPDF = async () => {
    if (reportRef.current) {
      const filename = viewMode === 'summary' ? 'Cash_Balances_Report' : `Statement_${selectedMethodId}`;
      const title = viewMode === 'summary' 
        ? (() => {
            if (language === 'ar') {
              const startStr = dateRange.start ? ` من ${formatDate(dateRange.start)}` : '';
              const endStr = dateRange.end ? ` إلى ${formatDate(dateRange.end)}` : '';
              return `تقرير حركة النقدية الخزائن والبنوك${startStr}${endStr}`;
            } else {
              const startStr = dateRange.start ? ` from ${formatDate(dateRange.start)}` : '';
              const endStr = dateRange.end ? ` to ${formatDate(dateRange.end)}` : '';
              return `Cash & Bank Report${startStr}${endStr}`;
            }
          })()
        : (() => {
            const methodName = paymentMethods.find(m => m.id === selectedMethodId)?.name || '';
            if (language === 'ar') {
              const startStr = dateRange.start ? ` من ${formatDate(dateRange.start)}` : '';
              const endStr = dateRange.end ? ` إلى ${formatDate(dateRange.end)}` : '';
              return `كشف حركة: ${methodName}${startStr}${endStr}`;
            } else {
              const startStr = dateRange.start ? ` from ${formatDate(dateRange.start)}` : '';
              const endStr = dateRange.end ? ` to ${formatDate(dateRange.end)}` : '';
              return `Statement: ${methodName}${startStr}${endStr}`;
            }
          })()
      
      await exportToPDF(reportRef.current, { 
        filename, 
        orientation: 'landscape',
        reportTitle: title
      });
    }
  };

  const handleExportExcel = () => {
    if (viewMode === 'summary') {
      const data: Record<string, any>[] = [];

      if (groupBy === 'none') {
        filteredBalances.forEach(b => {
          const rowData: Record<string, any> = {};
          visibleColumns.forEach(col => {
            const colHeader = language === 'ar' ? col.labelAr : col.labelEn;
            if (col.id === 'type') {
              rowData[colHeader] = language === 'ar' ? b.typeLabelAr : b.typeLabelEn;
            } else if (col.id === 'logo') {
              rowData[colHeader] = b.bankObj?.nameAr || (b.type === 'bank' ? (language === 'ar' ? 'بنك' : 'Bank') : '-');
            } else {
              rowData[colHeader] = b[col.id as keyof typeof b];
            }
          });
          data.push(rowData);
        });
      } else {
        groupedData.forEach(group => {
          group.items.forEach(b => {
            const rowData: Record<string, any> = {
              [language === 'ar' ? 'المجموعة' : 'Group']: language === 'ar' ? group.titleAr : group.titleEn
            };
            visibleColumns.forEach(col => {
              const colHeader = language === 'ar' ? col.labelAr : col.labelEn;
              if (col.id === 'type') {
                rowData[colHeader] = language === 'ar' ? b.typeLabelAr : b.typeLabelEn;
              } else if (col.id === 'logo') {
                rowData[colHeader] = b.bankObj?.nameAr || (b.type === 'bank' ? (language === 'ar' ? 'بنك' : 'Bank') : '-');
              } else {
                rowData[colHeader] = b[col.id as keyof typeof b];
              }
            });
            data.push(rowData);
          });

          // Group Subtotal Row
          const subtotalRow: Record<string, any> = {
            [language === 'ar' ? 'المجموعة' : 'Group']: language === 'ar' ? `إجمالي: ${group.titleAr}` : `Total: ${group.titleEn}`
          };
          visibleColumns.forEach(col => {
            const colHeader = language === 'ar' ? col.labelAr : col.labelEn;
            if (col.type === 'meta') {
              subtotalRow[colHeader] = '-';
            } else {
              subtotalRow[colHeader] = group.totals[col.id as keyof typeof group.totals] || 0;
            }
          });
          data.push(subtotalRow);
        });
      }

      // Grand Total Row
      const grandTotalRow: Record<string, any> = {
        ...(groupBy !== 'none' ? { [language === 'ar' ? 'المجموعة' : 'Group']: language === 'ar' ? 'الإجمالي العام' : 'Grand Total' } : {})
      };
      visibleColumns.forEach(col => {
        const colHeader = language === 'ar' ? col.labelAr : col.labelEn;
        if (col.type === 'meta') {
          grandTotalRow[colHeader] = col.id === 'name' ? (language === 'ar' ? 'الإجمالي العام' : 'Grand Total') : '-';
        } else {
          grandTotalRow[colHeader] = totals[col.id as keyof typeof totals] || 0;
        }
      });
      data.push(grandTotalRow);

      exportToExcel(data, { filename: 'Cash_Balances_Report' });
    } else {
      const data = [
        {
          [language === 'ar' ? 'التاريخ' : 'Date']: dateRange.start || '-',
          [language === 'ar' ? 'رقم القيد' : 'Journal Entry']: '-',
          [language === 'ar' ? 'نوع الحركة' : 'Type']: language === 'ar' ? 'رصيد منقول' : 'Balance Forward',
          [language === 'ar' ? 'المرجع' : 'Reference']: '-',
          [language === 'ar' ? 'البيان' : 'Description']: language === 'ar' ? 'رصيد أول الفترة' : 'Beginning Balance',
          [language === 'ar' ? 'القبض (مدين)' : 'Receipt (Debit)']: '-',
          [language === 'ar' ? 'الصرف (دائن)' : 'Payment (Credit)']: '-',
          [language === 'ar' ? 'الرصيد' : 'Balance']: statementData.beginningBalance
        },
        ...statementData.lines.map(l => ({
          [language === 'ar' ? 'التاريخ' : 'Date']: l.date,
          [language === 'ar' ? 'رقم القيد' : 'Journal Entry']: l.entryNumber,
          [language === 'ar' ? 'نوع الحركة' : 'Type']: getTransactionTypeLabel(l.referenceType),
          [language === 'ar' ? 'المرجع' : 'Reference']: l.referenceNumber,
          [language === 'ar' ? 'البيان' : 'Description']: l.description,
          [language === 'ar' ? 'القبض (مدين)' : 'Receipt (Debit)']: l.debit || 0,
          [language === 'ar' ? 'الصرف (دائن)' : 'Payment (Credit)']: l.credit || 0,
          [language === 'ar' ? 'الرصيد' : 'Balance']: l.runningBalance
        }))
      ];
      exportToExcel(data, { filename: `Statement_${paymentMethods.find(m => m.id === selectedMethodId)?.name}` });
    }
  };

  const selectedMethod = useMemo(() => {
    if (!selectedMethodId) return null;
    if (selectedMethodId.startsWith('unassigned_')) {
      const accId = selectedMethodId.replace('unassigned_', '');
      const acc = accounts.find(a => a.id === accId);
      return {
        id: selectedMethodId,
        name: language === 'ar' ? `حركات وقيود عامة على ${acc?.name || ''}` : `General Entries on ${acc?.name || ''}`,
        account_name: acc ? `${acc.code} - ${acc.name}` : '',
        code: `GL-${acc?.code || ''}`
      } as any;
    }
    return paymentMethods.find(m => m.id === selectedMethodId);
  }, [selectedMethodId, paymentMethods, accounts, language]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 font-medium italic animate-pulse">
          {language === 'ar' ? 'جاري تحميل البيانات...' : 'Loading data...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 bg-rose-50 rounded-3xl border border-rose-100 italic">
        <p className="text-rose-600 font-bold">{error}</p>
        <button 
          onClick={handleRefresh}
          className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all"
        >
          {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            {viewMode === 'statement' && selectedMethod?.type === 'bank' && (() => {
              const matched = findEgyptianBank(selectedMethod);
              if (matched) {
                return <BankLogoBadge bank={matched} size="sm" className="!w-9 !h-9 !p-1 rounded-xl shadow-xs border border-zinc-200 bg-white shrink-0" />;
              }
              if (selectedMethod.bank_logo) {
                return <img src={selectedMethod.bank_logo} alt={selectedMethod.name} className="w-9 h-9 object-contain rounded-xl border border-zinc-200 bg-white p-1 shrink-0" />;
              }
              return null;
            })()}
            <h2 className="text-2xl font-black text-zinc-900">
              {viewMode === 'summary' 
                ? (language === 'ar' ? 'تقرير حركة النقدية (الخزائن والبنوك) خلال فترة' : 'Cash & Bank Movements Report (Period)')
                : (language === 'ar' ? `كشف حركة: ${selectedMethod?.name || ''}` : `Statement: ${selectedMethod?.name || ''}`)}
            </h2>
            {viewMode === 'summary' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                ✓ {language === 'ar' ? 'مطابق لميزان المراجعة وقائمة المركز المالي' : 'Reconciled with Balance Sheet'}
              </span>
            )}
          </div>
          <p className="text-zinc-500 font-medium mt-1">
            {viewMode === 'summary'
              ? (language === 'ar' ? 'عرض أرصدة وحركات الخزائن والبنوك خلال فترة محددة' : 'View cash and bank balances and movements during a period')
              : (language === 'ar' ? `الحساب المحاسبي المرتبط: ${selectedMethod?.account_name || ''}` : `Linked Account: ${selectedMethod?.account_name || ''}`)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'statement' && (
            <button 
              onClick={() => setViewMode('summary')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-all font-bold cursor-pointer"
            >
              {dir === 'rtl' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
              {language === 'ar' ? 'رجوع للتقرير الرئيسي' : 'Back to Summary'}
            </button>
          )}
          <button 
            onClick={handleRefresh}
            className="p-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 hover:text-emerald-600 transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
            title={language === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={handleExportPDF} 
            className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm cursor-pointer"
            title={language === 'ar' ? 'طباعة PDF' : 'Export PDF'}
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={handleExportExcel} 
            className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50 transition-all shadow-sm cursor-pointer"
            title={language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Filters (Only visible in summary or shared) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Calendar className="absolute right-3 top-3 text-zinc-400" size={20} />
          <input
            type="date"
            className="w-full pr-10 pl-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div className="relative">
          <Calendar className="absolute right-3 top-3 text-zinc-400" size={20} />
          <input
            type="date"
            className="w-full pr-10 pl-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
        {viewMode === 'summary' && (
          <div className="relative">
            <Search className="absolute right-3 top-3 text-zinc-400" size={20} />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث باسم أو كود طريقة السداد...' : 'Search by name or code...'}
              className="w-full pr-10 pl-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {viewMode === 'summary' ? (
        <>
          {/* Options & Grouping Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-zinc-50 border border-zinc-200/80 px-4 py-3 rounded-2xl shadow-xs">
            {/* Grouping Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-zinc-600 flex items-center gap-1.5 shrink-0">
                <Layers size={15} className="text-indigo-600" />
                {language === 'ar' ? 'طريقة التجميع:' : 'Group By:'}
              </span>
              <div className="inline-flex items-center bg-zinc-200/70 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setGroupBy('none')}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                    groupBy === 'none'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {language === 'ar' ? 'بدون تجميع' : 'No Grouping'}
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy('type')}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    groupBy === 'type'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Landmark size={13} />
                  {language === 'ar' ? 'حسب النوع' : 'By Type'}
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy('account')}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    groupBy === 'account'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <BookOpen size={13} />
                  {language === 'ar' ? 'حسب الحساب' : 'By Account'}
                </button>
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 transition-all cursor-pointer"
                  checked={hideEmptyColumns}
                  onChange={(e) => setHideEmptyColumns(e.target.checked)}
                />
                {language === 'ar' ? 'إخفاء الأعمدة التي لا تحتوي على أي حركة' : 'Hide columns with no movement'}
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 transition-all cursor-pointer"
                  checked={hideEmptyPaymentMethods}
                  onChange={(e) => setHideEmptyPaymentMethods(e.target.checked)}
                />
                {language === 'ar' ? 'إخفاء طرق السداد التي لا تحتوي على أي حركة' : 'Hide payment methods with no movement'}
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 transition-all cursor-pointer"
                  checked={isCompact}
                  onChange={(e) => setIsCompact(e.target.checked)}
                />
                {language === 'ar' ? 'عرض مدمج ومصغر (تقليل حجم الخلايا والصفوف والأعمدة)' : 'Compact View'}
              </label>
            </div>
          </div>

          {/* Summary Table */}
          <div ref={reportRef} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-zinc-50/90 border-b border-zinc-200">
                    {visibleColumns.map(col => (
                      <th 
                        key={col.id} 
                        className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-3.5 py-2.5 text-sm'} font-bold text-zinc-700 border-l border-zinc-200 whitespace-nowrap ${col.id === 'logo' ? 'text-center' : col.type === 'meta' ? '' : 'text-center'}`}
                      >
                        {language === 'ar' ? col.labelAr : col.labelEn}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredBalances.length > 0 ? (
                    groupedData.map((group) => (
                      <React.Fragment key={group.id}>
                        {/* Group Header Row */}
                        {groupBy !== 'none' && (
                          <tr className="bg-gradient-to-r from-zinc-100 via-zinc-50 to-zinc-100/60 border-y-2 border-zinc-300 font-bold text-zinc-900">
                            <td colSpan={visibleColumns.length} className="px-4 py-2.5">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2.5">
                                  {group.icon && (
                                    <div className={`p-1.5 rounded-lg border shadow-2xs ${group.colorClass || 'bg-white text-zinc-700'}`}>
                                      <group.icon size={16} />
                                    </div>
                                  )}
                                  <span className="text-xs md:text-sm font-black text-zinc-800">
                                    {language === 'ar' ? group.titleAr : group.titleEn}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-200/80 text-zinc-700">
                                    {group.items.length} {language === 'ar' ? 'طريقة سداد' : 'methods'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs font-mono">
                                  <span className="text-zinc-500 font-bold">
                                    {language === 'ar' ? 'صافي رصيد المجموعة:' : 'Group Balance:'}
                                  </span>
                                  <span className={`font-black font-mono tabular-nums px-2 py-0.5 rounded-md ${group.totals.balance >= 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                    {formatNumber(group.totals.balance)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Group Items */}
                        {group.items.map((b) => (
                          <tr key={b.id} className="hover:bg-zinc-50/70 transition-colors">
                            {visibleColumns.map(col => {
                              const value = b[col.id as keyof typeof b];
                              const isMeta = col.type === 'meta';
                              const isBalance = col.type === 'balance';
                              const isInflow = col.type === 'inflow';
                              const isOutflow = col.type === 'outflow';

                              const numVal = Number(value) || 0;

                              let textColor = 'text-zinc-900';
                              if (isInflow) textColor = 'text-emerald-600';
                              if (isOutflow) textColor = 'text-rose-600';
                              if (isBalance) {
                                textColor = numVal >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold';
                              }

                              // Column: Logo
                              if (col.id === 'logo') {
                                if (b.type === 'bank') {
                                  return (
                                    <td key={col.id} className={`${isCompact ? 'px-1 py-1' : 'px-2 py-1.5'} border-l border-zinc-100 text-center`}>
                                      <div className="flex items-center justify-center">
                                        {b.bankObj ? (
                                          <BankLogoBadge bank={b.bankObj} size="sm" className="!w-6 !h-6 !p-0.5 rounded-md shadow-2xs border border-zinc-200/90 bg-white" />
                                        ) : b.bankLogo ? (
                                          <img src={b.bankLogo} alt={b.name} className="w-6 h-6 object-contain rounded-md border border-zinc-200 bg-white p-0.5" />
                                        ) : (
                                          <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600" title={b.name}>
                                            <Landmark size={13} />
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  );
                                }
                                return (
                                  <td key={col.id} className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} border-l border-zinc-100 text-center text-zinc-300 font-bold`}>
                                    -
                                  </td>
                                );
                              }

                              // Column: Type
                              if (col.id === 'type') {
                                let badgeClass = 'bg-zinc-100 text-zinc-700 border-zinc-200';
                                let IconComponent = Wallet;
                                if (b.type === 'bank') {
                                  badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                                  IconComponent = Landmark;
                                } else if (b.type === 'cash') {
                                  badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                  IconComponent = Wallet;
                                } else if (b.type === 'wallet') {
                                  badgeClass = 'bg-violet-50 text-violet-700 border-violet-200';
                                  IconComponent = Smartphone;
                                } else if (b.type === 'other') {
                                  badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                                  IconComponent = BookOpen;
                                }

                                return (
                                  <td key={col.id} className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} border-l border-zinc-100 whitespace-nowrap`}>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeClass}`}>
                                      <IconComponent size={12} className="shrink-0" />
                                      {language === 'ar' ? b.typeLabelAr : b.typeLabelEn}
                                    </span>
                                  </td>
                                );
                              }

                              return (
                                <td 
                                  key={col.id} 
                                  className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} border-l border-zinc-100 whitespace-nowrap ${isMeta ? 'font-medium' : 'text-center font-bold font-mono tabular-nums'} ${textColor}`}
                                >
                                  {col.id === 'name' ? (
                                    <button 
                                      onClick={() => {
                                        setSelectedMethodId(b.id);
                                        setViewMode('statement');
                                      }} 
                                      className="text-indigo-600 hover:text-indigo-900 hover:underline font-bold text-right cursor-pointer truncate max-w-[180px] inline-block align-middle"
                                      title={value as string}
                                    >
                                      {value as string}
                                    </button>
                                  ) : isMeta ? (
                                    <span className="truncate max-w-[140px] inline-block align-middle" title={value as string}>
                                      {value as string}
                                    </span>
                                  ) : (
                                    numVal > 0.001 || numVal < -0.001 ? formatNumber(numVal) : '-'
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {/* Group Subtotal Row */}
                        {groupBy !== 'none' && (
                          <tr className="bg-zinc-100/80 font-bold text-xs border-b-2 border-zinc-200">
                            {visibleColumns.map((col, idx) => {
                              const isMeta = col.type === 'meta';
                              if (isMeta) {
                                if (idx === 0) {
                                  const metaColsCount = visibleColumns.filter(c => c.type === 'meta').length;
                                  return (
                                    <td 
                                      key={col.id} 
                                      colSpan={metaColsCount} 
                                      className={`${isCompact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} text-right border-l border-zinc-200 font-black text-zinc-800`}
                                    >
                                      {language === 'ar' ? `إجمالي: ${group.titleAr}` : `Total: ${group.titleEn}`}
                                    </td>
                                  );
                                }
                                return null;
                              }

                              const val = group.totals[col.id as keyof typeof group.totals] || 0;
                              const isInflow = col.type === 'inflow';
                              const isOutflow = col.type === 'outflow';
                              const isBalance = col.type === 'balance';
                              
                              let textColor = 'text-zinc-800';
                              if (isInflow) textColor = 'text-emerald-700 font-black';
                              if (isOutflow) textColor = 'text-rose-700 font-black';
                              if (isBalance) {
                                textColor = val >= 0 ? 'text-emerald-800 font-black' : 'text-rose-700 font-black';
                              }

                              return (
                                <td 
                                  key={col.id} 
                                  className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center border-l border-zinc-200 font-mono tabular-nums ${textColor}`}
                                >
                                  {Math.abs(val) > 0.001 ? formatNumber(val) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-6 text-center text-zinc-400 italic text-xs">
                        {language === 'ar' ? 'لا توجد بيانات تطابق البحث' : 'No data matching the search'}
                      </td>
                    </tr>
                  )}

                  {/* Grand Totals Row */}
                  <tr className="bg-zinc-900 text-white font-bold text-xs">
                    {visibleColumns.map((col, idx) => {
                      const isMeta = col.type === 'meta';
                      if (isMeta) {
                        if (idx === 0) {
                          const metaColsCount = visibleColumns.filter(c => c.type === 'meta').length;
                          return (
                            <td 
                              key={col.id} 
                              colSpan={metaColsCount} 
                              className={`${isCompact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} text-center border-l border-zinc-800 font-black text-white`}
                            >
                              {language === 'ar' ? 'الإجمالي العام' : 'Grand Total'}
                            </td>
                          );
                        }
                        return null;
                      }

                      const value = totals[col.id as keyof typeof totals] || 0;
                      const isInflow = col.type === 'inflow';
                      const isOutflow = col.type === 'outflow';
                      
                      let textColor = 'text-white';
                      if (isInflow) textColor = 'text-emerald-400';
                      if (isOutflow) textColor = 'text-rose-400';

                      return (
                        <td 
                          key={col.id} 
                          className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center border-l border-zinc-800 font-mono tabular-nums ${textColor}`}
                        >
                          {formatNumber(value)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Detailed Statement View */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-zinc-50 border border-zinc-200/80 p-3.5 rounded-2xl">
            <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm text-center">
              <span className="text-[11px] text-zinc-400 font-bold block mb-0.5">
                {language === 'ar' ? 'رصيد أول الفترة' : 'Beginning Balance'}
              </span>
              <span className="text-lg font-black text-zinc-700 font-mono tabular-nums">
                {formatNumber(statementData.beginningBalance)}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm text-center">
              <span className="text-[11px] text-zinc-400 font-bold block mb-0.5">
                {language === 'ar' ? 'إجمالي القبض' : 'Total Receipts'}
              </span>
              <span className="text-lg font-black text-emerald-600 font-mono tabular-nums">
                {formatNumber(statementData.lines.reduce((sum, l) => sum + l.debit, 0))}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm text-center">
              <span className="text-[11px] text-zinc-400 font-bold block mb-0.5">
                {language === 'ar' ? 'إجمالي الصرف' : 'Total Payments'}
              </span>
              <span className="text-lg font-black text-rose-600 font-mono tabular-nums">
                {formatNumber(statementData.lines.reduce((sum, l) => sum + l.credit, 0))}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm text-center">
              <span className="text-[11px] text-zinc-400 font-bold block mb-0.5">
                {language === 'ar' ? 'رصيد آخر الفترة' : 'Ending Balance'}
              </span>
              <span className={statementData.endingBalance >= 0 ? "text-lg font-black text-emerald-700 font-mono tabular-nums" : "text-lg font-black text-rose-600 font-mono tabular-nums"}>
                {formatNumber(statementData.endingBalance)}
              </span>
            </div>
          </div>

          <div ref={reportRef} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3 text-sm'} font-bold text-zinc-700 border-l border-zinc-200 whitespace-nowrap`}>
                      {language === 'ar' ? 'التاريخ' : 'Date'}
                    </th>
                    <th className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3 text-sm'} font-bold text-zinc-700 border-l border-zinc-200 whitespace-nowrap`}>
                      {language === 'ar' ? 'رقم القيد' : 'Journal Entry'}
                    </th>
                    <th className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3 text-sm'} font-bold text-zinc-700 border-l border-zinc-200 whitespace-nowrap`}>
                      {language === 'ar' ? 'نوع الحركة' : 'Type'}
                    </th>
                    <th className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3 text-sm'} font-bold text-zinc-700 border-l border-zinc-200 whitespace-nowrap`}>
                      {language === 'ar' ? 'المرجع' : 'Reference'}
                    </th>
                    <th className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3 text-sm'} font-bold text-zinc-700 border-l border-zinc-200 whitespace-nowrap`}>
                      {language === 'ar' ? 'البيان' : 'Description'}
                    </th>
                    <th className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3 text-sm'} font-bold text-zinc-700 text-center border-l border-zinc-200 whitespace-nowrap`}>
                      {language === 'ar' ? 'القبض' : 'Debit'}
                    </th>
                    <th className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3 text-sm'} font-bold text-zinc-700 text-center border-l border-zinc-200 whitespace-nowrap`}>
                      {language === 'ar' ? 'الصرف' : 'Credit'}
                    </th>
                    <th className={`${isCompact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3 text-sm'} font-bold text-zinc-700 text-center whitespace-nowrap`}>
                      {language === 'ar' ? 'الرصيد' : 'Balance'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {statementData.lines.length > 0 || statementData.beginningBalance !== 0 ? (
                    <>
                      {/* Beginning Balance Row (رصيد منقول) */}
                      <tr className="bg-zinc-50/50 font-bold text-zinc-500 italic">
                        <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} border-l border-zinc-100 font-medium whitespace-nowrap`}>
                          {dateRange.start || '-'}
                        </td>
                        <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} border-l border-zinc-100 whitespace-nowrap`}>-</td>
                        <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} border-l border-zinc-100 font-bold text-indigo-600 whitespace-nowrap`}>
                          {language === 'ar' ? 'رصيد منقول' : 'Balance Forward'}
                        </td>
                        <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} border-l border-zinc-100 whitespace-nowrap`}>-</td>
                        <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} border-l border-zinc-100 text-zinc-400 whitespace-nowrap`}>
                          {language === 'ar' ? 'رصيد أول الفترة' : 'Beginning Balance'}
                        </td>
                        <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} text-center border-l border-zinc-100 font-bold font-mono text-zinc-400 whitespace-nowrap`}>-</td>
                        <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} text-center border-l border-zinc-100 font-bold font-mono text-zinc-400 whitespace-nowrap`}>-</td>
                        <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} text-center font-bold font-mono tabular-nums whitespace-nowrap`}>
                          <span className={statementData.beginningBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                            {formatNumber(statementData.beginningBalance)}
                          </span>
                        </td>
                      </tr>
                      
                      {statementData.lines.map((l, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/70 transition-colors">
                          <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} text-zinc-500 border-l border-zinc-100 font-medium whitespace-nowrap`}>
                            {l.date}
                          </td>
                          <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} border-l border-zinc-100 font-bold text-indigo-600 whitespace-nowrap`}>
                            <button 
                              onClick={() => {
                                setPendingViewDoc({ type: 'journal', idOrNumber: l.entryNumber });
                                setCurrentPage('journal_entries');
                              }}
                              className="hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              {l.entryNumber}
                              <ExternalLink size={11} />
                            </button>
                          </td>
                          <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} text-zinc-600 border-l border-zinc-100 font-bold whitespace-nowrap`}>
                            {getTransactionTypeLabel(l.referenceType)}
                          </td>
                          <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} border-l border-zinc-100 font-bold text-indigo-600 whitespace-nowrap`}>
                            {l.referenceNumber !== '-' ? (
                              <button 
                                onClick={() => handleTransactionClick(l.referenceType, l.referenceNumber)}
                                className="hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                {l.referenceNumber}
                                <ExternalLink size={11} />
                              </button>
                            ) : '-'}
                          </td>
                          <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} text-zinc-800 border-l border-zinc-100 max-w-[200px] truncate whitespace-nowrap`} title={l.description}>
                            {l.description}
                          </td>
                          <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} text-emerald-600 text-center border-l border-zinc-100 font-bold font-mono tabular-nums whitespace-nowrap`}>
                            {l.debit > 0 ? formatNumber(l.debit) : '-'}
                          </td>
                          <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} text-rose-600 text-center border-l border-zinc-100 font-bold font-mono tabular-nums whitespace-nowrap`}>
                            {l.credit > 0 ? formatNumber(l.credit) : '-'}
                          </td>
                          <td className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'} text-center font-bold font-mono tabular-nums whitespace-nowrap`}>
                            <span className={l.runningBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                              {formatNumber(l.runningBalance)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-zinc-400 italic">
                        {language === 'ar' ? 'لا توجد حركات لهذه طريقة السداد خلال هذه الفترة' : 'No transactions found for this payment method during this period'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
