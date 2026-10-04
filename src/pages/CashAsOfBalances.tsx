import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PaymentMethod, JournalEntry, Account, AccountType } from '../types';
import { 
  Calendar, Download, Printer, Wallet, ArrowLeftRight, BarChart3, 
  RefreshCcw, Search, CheckCircle2, AlertTriangle, ExternalLink,
  Landmark, Smartphone, Layers, Coins, ShieldCheck, Filter, ArrowUpRight,
  ChevronDown, FileSpreadsheet, Eye, EyeOff, Building2, CreditCard
} from 'lucide-react';
import { exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { useNavigation } from '../contexts/NavigationContext';
import { EGYPTIAN_BANKS_DATA, BankLogoBadge, EgyptianBank, BANK_LOGO_MAP } from '../data/egyptianBanks';
import { AccountingEngine } from '../services/AccountingEngine';

// Helper to resolve Egyptian Bank metadata and logo
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

// Robust helper to resolve payment method for a journal entry line
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

export interface CashBalanceItem {
  id: string;
  code: string;
  name: string;
  type: 'cash' | 'bank' | 'wallet' | 'other';
  typeLabelAr: string;
  typeLabelEn: string;
  currency: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  bankName?: string;
  bankCode?: string;
  bankAccountNum?: string;
  bankLogo?: string;
  bankObj?: EgyptianBank | null;
  openingBalanceForeign: number;
  openingBalanceSystem: number;
  netDebitSystem: number;
  netCreditSystem: number;
  balanceForeign: number;
  balanceSystem: number;
}

export const CashAsOfBalances: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingLedgerParams } = useNavigation();
  const reportRef = useRef<HTMLDivElement>(null);

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [asOfDate, setAsOfDate] = useState<string>(todayStr);
  const [inputDate, setInputDate] = useState<string>(todayStr);

  // Grouping: 'none' | 'currency' | 'account' | 'type'
  const [groupBy, setGroupBy] = useState<'none' | 'currency' | 'account' | 'type'>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
  const [isCompact, setIsCompact] = useState(true);

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [receiptVouchers, setReceiptVouchers] = useState<any[]>([]);
  const [paymentVouchers, setPaymentVouchers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [cashTransfers, setCashTransfers] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Base system currency (e.g. EGP)
  const baseCurrency = (company?.currency || company?.settings?.currency || 'EGP').toUpperCase();

  // Load subscriptions and initial data
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const loadAll = async () => {
      try {
        const [
          compData,
          pmData,
          accData,
          typesData,
          jeData,
          rvData,
          pvData,
          invData,
          pinvData,
          retData,
          pretData,
          ctData
        ] = await Promise.all([
          dbService.get<any>('companies', user.company_id),
          dbService.list<PaymentMethod>('payment_methods', user.company_id),
          dbService.list<Account>('accounts', user.company_id),
          dbService.list<AccountType>('account_types', user.company_id),
          dbService.list<JournalEntry>('journal_entries', user.company_id),
          dbService.list<any>('receipt_vouchers', user.company_id),
          dbService.list<any>('payment_vouchers', user.company_id),
          dbService.list<any>('invoices', user.company_id),
          dbService.list<any>('purchase_invoices', user.company_id),
          dbService.list<any>('returns', user.company_id),
          dbService.list<any>('purchase_returns', user.company_id),
          dbService.list<any>('cash_transfers', user.company_id)
        ]);

        setCompany(compData);
        setPaymentMethods(pmData);
        setAccounts(accData);
        setAccountTypes(typesData);
        setJournalEntries(jeData);
        setReceiptVouchers(rvData);
        setPaymentVouchers(pvData);
        setInvoices(invData);
        setPurchaseInvoices(pinvData);
        setReturns(retData);
        setPurchaseReturns(pretData);
        setCashTransfers(ctData);
      } catch (err: any) {
        console.error('Error fetching cash balances data:', err);
        setError(err.message || 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [user, refreshTrigger]);

  // Sync date text input when asOfDate changes
  useEffect(() => {
    setInputDate(asOfDate);
  }, [asOfDate]);

  // Handle user manual date typing or validation
  const handleDateCommit = (val: string) => {
    setInputDate(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      setAsOfDate(val);
    }
  };

  // Compute preset dates based on current calendar
  const datePresets = useMemo(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const prevYear = currYear - 1;
    const currMonth = now.getMonth(); // 0-indexed

    // Last month end date
    const lastMonthEnd = new Date(currYear, currMonth, 0).toISOString().split('T')[0];

    return {
      today: todayStr,
      lastMonthEnd,
      currYearEnd: `${currYear}-12-31`,
      currYearQ1: `${currYear}-03-31`,
      currYearQ2: `${currYear}-06-30`,
      currYearQ3: `${currYear}-09-30`,
      currYearQ4: `${currYear}-12-31`,
      prevYearEnd: `${prevYear}-12-31`,
      prevYearQ1: `${prevYear}-03-31`,
      prevYearQ2: `${prevYear}-06-30`,
      prevYearQ3: `${prevYear}-09-30`,
      prevYearQ4: `${prevYear}-12-31`,
    };
  }, [todayStr]);

  // Compute Balances as of `asOfDate`
  const computedItems: CashBalanceItem[] = useMemo(() => {
    if (!paymentMethods || paymentMethods.length === 0) return [];

    const targetDate = asOfDate || todayStr;

    // Filter journal entries up to targetDate
    const validEntries = journalEntries.filter(je => {
      const d = (je.date || '').slice(0, 10);
      return d <= targetDate;
    });

    return paymentMethods.map(method => {
      let netDebitSystem = 0;
      let netCreditSystem = 0;
      let netDebitForeign = 0;
      let netCreditForeign = 0;

      const methodCurrency = (method.currency || baseCurrency).toUpperCase();
      const isBaseCurrency = methodCurrency === baseCurrency;

      validEntries.forEach(je => {
        const refType = je.reference_type;

        je.items?.forEach((item: any) => {
          const resolvedMethod = resolvePaymentMethodForItem(
            item,
            je,
            paymentMethods,
            receiptVouchers,
            paymentVouchers,
            invoices,
            purchaseInvoices,
            returns,
            purchaseReturns,
            cashTransfers
          );

          if (resolvedMethod?.id === method.id) {
            // Check if opening balance JE and method already has base opening balance
            const isOpeningJE = refType === 'opening_balance' || 
              (je.description || '').includes('رصيد افتتاحي') || 
              (item.description || '').includes('رصيد افتتاحي');

            if (isOpeningJE && Number(method.opening_balance || 0) !== 0) {
              return;
            }

            const dSystem = Number(item.debit || 0);
            const cSystem = Number(item.credit || 0);
            netDebitSystem += dSystem;
            netCreditSystem += cSystem;

            // Foreign amount handling
            let dForeign = 0;
            let cForeign = 0;

            if (isBaseCurrency) {
              dForeign = dSystem;
              cForeign = cSystem;
            } else {
              // 1. Direct from item.foreign_amount if present and > 0
              if (item.foreign_amount && Number(item.foreign_amount) > 0) {
                const fVal = Number(item.foreign_amount);
                dForeign = dSystem > 0 ? fVal : 0;
                cForeign = cSystem > 0 ? fVal : 0;
              }
              // 2. From cashTransfers if this line came from a cash transfer
              else if ((refType === 'transfer' || refType === 'cash_transfer') && je.reference_id) {
                const ct = cashTransfers.find(v => v.id === je.reference_id);
                if (ct) {
                  const fromCurr = (ct.from_currency || '').toUpperCase();
                  const toCurr = (ct.to_currency || '').toUpperCase();
                  const ctAmt = Number(ct.amount) || 0;
                  const ctConv = Number(ct.converted_amount) || ctAmt;
                  const ctRate = Number(ct.exchange_rate) || 1;

                  if (dSystem > 0) {
                    if (toCurr === methodCurrency) {
                      dForeign = ctConv;
                    } else if (fromCurr === methodCurrency) {
                      dForeign = ctAmt;
                    } else if (ctRate > 1) {
                      dForeign = dSystem / ctRate;
                    }
                  }
                  if (cSystem > 0) {
                    if (fromCurr === methodCurrency) {
                      cForeign = ctAmt;
                    } else if (toCurr === methodCurrency) {
                      cForeign = ctConv;
                    } else if (ctRate > 1) {
                      cForeign = cSystem / ctRate;
                    }
                  }
                }
              }
              // 3. From receiptVouchers if this line came from a receipt voucher
              else if (refType === 'receipt' && je.reference_id) {
                const rv = receiptVouchers.find(v => v.id === je.reference_id);
                if (rv) {
                  if (rv.foreign_amount && Number(rv.foreign_amount) > 0) {
                    dForeign = Number(rv.foreign_amount);
                  } else if ((rv.currency || '').toUpperCase() === methodCurrency && Number(rv.amount) > 0) {
                    dForeign = Number(rv.amount);
                  } else if (Number(rv.exchange_rate) > 1) {
                    dForeign = dSystem / Number(rv.exchange_rate);
                  }
                }
              }
              // 4. From paymentVouchers if this line came from a payment voucher
              else if (refType === 'payment' && je.reference_id) {
                const pv = paymentVouchers.find(v => v.id === je.reference_id);
                if (pv) {
                  if (pv.foreign_amount && Number(pv.foreign_amount) > 0) {
                    cForeign = Number(pv.foreign_amount);
                  } else if ((pv.currency || '').toUpperCase() === methodCurrency && Number(pv.amount) > 0) {
                    cForeign = Number(pv.amount);
                  } else if (Number(pv.exchange_rate) > 1) {
                    cForeign = cSystem / Number(pv.exchange_rate);
                  }
                }
              }

              // 5. Check description for foreign currency amount mentions e.g. "(1000 USD ...)" or "(... 🠚 3825.2 USD)"
              const desc = `${item.description || ''} ${je.description || ''}`;
              if (dForeign === 0 && dSystem > 0) {
                const m = desc.match(new RegExp(`([\\d,\\.]+)\\s*${methodCurrency}`, 'i')) || 
                          desc.match(new RegExp(`${methodCurrency}\\s*([\\d,\\.]+)`, 'i'));
                if (m && m[1]) {
                  const parsed = parseFloat(m[1].replace(/,/g, ''));
                  if (parsed > 0 && Math.abs(parsed - dSystem) > 0.01) {
                    dForeign = parsed;
                  }
                }
              }
              if (cForeign === 0 && cSystem > 0) {
                const m = desc.match(new RegExp(`([\\d,\\.]+)\\s*${methodCurrency}`, 'i')) || 
                          desc.match(new RegExp(`${methodCurrency}\\s*([\\d,\\.]+)`, 'i'));
                if (m && m[1]) {
                  const parsed = parseFloat(m[1].replace(/,/g, ''));
                  if (parsed > 0 && Math.abs(parsed - cSystem) > 0.01) {
                    cForeign = parsed;
                  }
                }
              }

              // 6. Direct exchange rate on item
              if (dForeign === 0 && dSystem > 0) {
                if (item.exchange_rate && Number(item.exchange_rate) > 1) {
                  dForeign = dSystem / Number(item.exchange_rate);
                }
              }
              if (cForeign === 0 && cSystem > 0) {
                if (item.exchange_rate && Number(item.exchange_rate) > 1) {
                  cForeign = cSystem / Number(item.exchange_rate);
                }
              }

              // 7. If still unresolved and > 0, fallback to standard exchange rate
              if (dForeign === 0 && dSystem > 0) {
                const approxRate = (methodCurrency === 'USD') ? 52.28 : (methodCurrency === 'EUR') ? 58.8 : (methodCurrency === 'SAR') ? 13.9 : 1;
                dForeign = approxRate > 1 ? (dSystem / approxRate) : dSystem;
              }
              if (cForeign === 0 && cSystem > 0) {
                const approxRate = (methodCurrency === 'USD') ? 52.28 : (methodCurrency === 'EUR') ? 58.8 : (methodCurrency === 'SAR') ? 13.9 : 1;
                cForeign = approxRate > 1 ? (cSystem / approxRate) : cSystem;
              }
            }

            netDebitForeign += dForeign;
            netCreditForeign += cForeign;
          }
        });
      });

      const baseOpeningForeign = Number(method.opening_balance || 0);
      let baseOpeningSystem = isBaseCurrency ? baseOpeningForeign : 0;
      if (!isBaseCurrency && baseOpeningForeign !== 0) {
        if (linkedAccount && Number(linkedAccount.opening_balance || 0) !== 0) {
          baseOpeningSystem = Number(linkedAccount.opening_balance);
        } else {
          const approxRate = (methodCurrency === 'USD') ? 52.28 : (methodCurrency === 'EUR') ? 58.8 : (methodCurrency === 'SAR') ? 13.9 : 1;
          baseOpeningSystem = baseOpeningForeign * approxRate;
        }
      } 

      const balanceForeign = baseOpeningForeign + netDebitForeign - netCreditForeign;
      const balanceSystem = baseOpeningSystem + netDebitSystem - netCreditSystem;

      const linkedAccount = accounts.find(a => a.id === method.account_id);
      const methodType = (method.type || 'cash') as 'cash' | 'bank' | 'wallet' | 'other';

      let typeLabelAr = 'خزينة نقدية';
      let typeLabelEn = 'Cash Safe';
      if (methodType === 'bank') {
        typeLabelAr = 'حساب بنكي';
        typeLabelEn = 'Bank Account';
      } else if (methodType === 'wallet') {
        typeLabelAr = 'محفظة إلكترونية';
        typeLabelEn = 'E-Wallet';
      }

      const matchedBank = methodType === 'bank' ? findEgyptianBank(method) : null;
      const bankLogo = method.bank_logo || matchedBank?.logoUrl || (matchedBank && BANK_LOGO_MAP[matchedBank.code] ? BANK_LOGO_MAP[matchedBank.code] : undefined);

      return {
        id: method.id,
        code: method.code || '-',
        name: method.name,
        type: methodType,
        typeLabelAr,
        typeLabelEn,
        currency: methodCurrency,
        accountId: method.account_id || '',
        accountCode: linkedAccount?.code || '-',
        accountName: linkedAccount?.name || method.account_name || 'غير محدد',
        bankName: method.bank_name || matchedBank?.nameAr,
        bankCode: method.bank_code || matchedBank?.code,
        bankAccountNum: method.account_number,
        bankLogo,
        bankObj: matchedBank,
        openingBalanceForeign: baseOpeningForeign,
        openingBalanceSystem: baseOpeningSystem,
        netDebitSystem,
        netCreditSystem,
        balanceForeign,
        balanceSystem
      };
    });
  }, [paymentMethods, journalEntries, accounts, receiptVouchers, paymentVouchers, invoices, purchaseInvoices, returns, purchaseReturns, cashTransfers, asOfDate, todayStr, baseCurrency]);

  // General Ledger Cash & Bank total from Trial Balance for reconciliation check
  const glCashReconciliation = useMemo(() => {
    if (!accounts || accounts.length === 0 || !accountTypes) {
      return { totalGlCash: 0, isMatch: false, discrepancy: 0 };
    }

    try {
      const trialBalance = AccountingEngine.calculateTrialBalance(
        accounts,
        journalEntries,
        '1900-01-01',
        asOfDate || todayStr,
        undefined,
        accountTypes
      );

      const cashAccounts = trialBalance.filter(a => {
        const acc = accounts.find(x => x.id === a.id);
        const classification = acc ? AccountingEngine.resolveAccountClassification(acc, accountTypes).classification : '';
        const code = String(a.code || '').trim();
        return classification === 'cash_and_equivalents' ||
          code.startsWith('1101') || code.startsWith('1102') || code.startsWith('1104');
      });

      const totalGlCash = cashAccounts.reduce((sum, a) => sum + (a.closing.debit - a.closing.credit), 0);
      const totalMethodCashSystem = computedItems.reduce((sum, m) => sum + m.balanceSystem, 0);
      const discrepancy = totalMethodCashSystem - totalGlCash;

      return {
        totalGlCash,
        totalMethodCashSystem,
        discrepancy,
        isMatch: Math.abs(discrepancy) < 1.0 // Within 1 unit tolerance
      };
    } catch (e) {
      return { totalGlCash: 0, totalMethodCashSystem: 0, discrepancy: 0, isMatch: true };
    }
  }, [accounts, accountTypes, journalEntries, asOfDate, todayStr, computedItems]);

  // Filtered Items (by search and zero-balance toggle)
  const filteredItems = useMemo(() => {
    return computedItems.filter(item => {
      if (hideZeroBalances && Math.abs(item.balanceForeign) < 0.001 && Math.abs(item.balanceSystem) < 0.001) {
        return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term) ||
        item.accountName.toLowerCase().includes(term) ||
        item.accountCode.toLowerCase().includes(term) ||
        item.currency.toLowerCase().includes(term) ||
        (item.bankName && item.bankName.toLowerCase().includes(term))
      );
    });
  }, [computedItems, hideZeroBalances, searchTerm]);

  // Overall KPIs
  const totalBalanceSystem = useMemo(() => {
    return filteredItems.reduce((sum, i) => sum + i.balanceSystem, 0);
  }, [filteredItems]);

  const totalCashSafeSystem = useMemo(() => {
    return filteredItems.filter(i => i.type === 'cash').reduce((sum, i) => sum + i.balanceSystem, 0);
  }, [filteredItems]);

  const totalBanksSystem = useMemo(() => {
    return filteredItems.filter(i => i.type === 'bank').reduce((sum, i) => sum + i.balanceSystem, 0);
  }, [filteredItems]);

  const totalWalletsSystem = useMemo(() => {
    return filteredItems.filter(i => i.type === 'wallet' || i.type === 'other').reduce((sum, i) => sum + i.balanceSystem, 0);
  }, [filteredItems]);

  // Currency breakdown totals
  const currencyBreakdowns = useMemo(() => {
    const map: Record<string, { currency: string; totalForeign: number; totalSystem: number; count: number }> = {};
    filteredItems.forEach(item => {
      const c = item.currency || baseCurrency;
      if (!map[c]) {
        map[c] = { currency: c, totalForeign: 0, totalSystem: 0, count: 0 };
      }
      map[c].totalForeign += item.balanceForeign;
      map[c].totalSystem += item.balanceSystem;
      map[c].count += 1;
    });
    return Object.values(map).sort((a, b) => b.totalSystem - a.totalSystem);
  }, [filteredItems, baseCurrency]);

  // Grouped datasets for Group By modes
  const groupedData = useMemo(() => {
    if (groupBy === 'currency') {
      const groups: Record<string, { key: string; titleAr: string; titleEn: string; items: CashBalanceItem[]; totalForeign: number; totalSystem: number }> = {};
      filteredItems.forEach(item => {
        const c = item.currency;
        if (!groups[c]) {
          groups[c] = {
            key: c,
            titleAr: `عملة: ${c}`,
            titleEn: `Currency: ${c}`,
            items: [],
            totalForeign: 0,
            totalSystem: 0
          };
        }
        groups[c].items.push(item);
        groups[c].totalForeign += item.balanceForeign;
        groups[c].totalSystem += item.balanceSystem;
      });
      return Object.values(groups).sort((a, b) => b.totalSystem - a.totalSystem);
    }

    if (groupBy === 'account') {
      const groups: Record<string, { key: string; titleAr: string; titleEn: string; accountCode: string; items: CashBalanceItem[]; totalSystem: number }> = {};
      filteredItems.forEach(item => {
        const accId = item.accountId || 'unlinked';
        if (!groups[accId]) {
          groups[accId] = {
            key: accId,
            titleAr: `${item.accountCode} - ${item.accountName}`,
            titleEn: `${item.accountCode} - ${item.accountName}`,
            accountCode: item.accountCode,
            items: [],
            totalSystem: 0
          };
        }
        groups[accId].items.push(item);
        groups[accId].totalSystem += item.balanceSystem;
      });
      return Object.values(groups).sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''));
    }

    if (groupBy === 'type') {
      const typeConfig: Record<string, { titleAr: string; titleEn: string; icon: any; order: number }> = {
        bank: { titleAr: 'الحسابات البنكية', titleEn: 'Bank Accounts', icon: Landmark, order: 1 },
        cash: { titleAr: 'الخزائن النقدية', titleEn: 'Cash Safes', icon: Wallet, order: 2 },
        wallet: { titleAr: 'المحافظ الإلكترونية', titleEn: 'E-Wallets', icon: Smartphone, order: 3 },
        other: { titleAr: 'أخرى والعهد النقدية', titleEn: 'Other & Petty Cash', icon: CreditCard, order: 4 }
      };

      const groups: Record<string, { key: string; titleAr: string; titleEn: string; items: CashBalanceItem[]; totalSystem: number; order: number }> = {};
      filteredItems.forEach(item => {
        const tKey = item.type || 'other';
        const conf = typeConfig[tKey] || typeConfig.other;
        if (!groups[tKey]) {
          groups[tKey] = {
            key: tKey,
            titleAr: conf.titleAr,
            titleEn: conf.titleEn,
            items: [],
            totalSystem: 0,
            order: conf.order
          };
        }
        groups[tKey].items.push(item);
        groups[tKey].totalSystem += item.balanceSystem;
      });
      return Object.values(groups).sort((a, b) => a.order - b.order);
    }

    return [];
  }, [groupBy, filteredItems]);

  // Navigate to General Ledger drilldown
  const handleOpenLedger = (accountId: string) => {
    if (!accountId) return;
    setPendingLedgerParams?.({
      accountId,
      startDate: '1900-01-01',
      endDate: asOfDate || todayStr
    });
    setCurrentPage('general_ledger_report');
  };

  // Export PDF
  const handleExportPDF = () => {
    if (!reportRef.current) return;
    const title = language === 'ar' ? `تقرير أرصدة النقدية في ${formatDate(asOfDate)}` : `Cash Balances Report As of ${formatDate(asOfDate)}`;
    exportToPDF(reportRef.current, {
      reportTitle: title,
      filename: `cash_balances_${asOfDate}.pdf`,
      orientation: 'landscape'
    });
  };

  // Export Excel
  const handleExportExcel = () => {
    const dataToExport = filteredItems.map((item, index) => ({
      [language === 'ar' ? 'م' : '#']: index + 1,
      [language === 'ar' ? 'نوع طريقة السداد' : 'Payment Type']: language === 'ar' ? item.typeLabelAr : item.typeLabelEn,
      [language === 'ar' ? 'كود طريقة السداد' : 'Method Code']: item.code,
      [language === 'ar' ? 'طريقة السداد' : 'Method Name']: item.name,
      [language === 'ar' ? 'البنك' : 'Bank']: item.bankName || '-',
      [language === 'ar' ? 'رقم الحساب' : 'Account Number']: item.bankAccountNum || '-',
      [language === 'ar' ? 'العملة' : 'Currency']: item.currency,
      [language === 'ar' ? 'كود الحساب' : 'GL Code']: item.accountCode,
      [language === 'ar' ? 'اسم الحساب المحاسبي' : 'GL Account Name']: item.accountName,
      [language === 'ar' ? `الرصيد بالعملة (${item.currency})` : `Balance (${item.currency})`]: item.balanceForeign,
      [language === 'ar' ? `الرصيد بعملة النظام (${baseCurrency})` : `Balance (${baseCurrency})`]: item.balanceSystem
    }));

    exportToExcel(dataToExport, `cash_balances_${asOfDate}.xlsx`);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 print:pb-0" dir={dir}>
      {/* Header & Main Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900">
                  {language === 'ar' ? 'أرصدة النقدية (الخزائن والبنوك)' : 'Cash & Bank Balances'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {language === 'ar' ? 'في تاريخ محدد' : 'As of Date'}
                </span>
                {glCashReconciliation.isMatch && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'مطابق للميزان والمركز المالي' : 'Reconciled with Balance Sheet'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {language === 'ar' 
                  ? 'عرض تفصيلي لأرصدة الخزائن النقدية، الحسابات البنكية، والمحافظ الإلكترونية بالعملات الأصلية وبعملة النظام' 
                  : 'Detailed breakdown of cash safes, bank accounts, and e-wallets in original and base currencies'}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title={language === 'ar' ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setIsCompact(!isCompact)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title={language === 'ar' ? 'تبديل العرض المدمج' : 'Toggle Compact View'}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isCompact ? (language === 'ar' ? 'عرض مريح' : 'Comfortable') : (language === 'ar' ? 'عرض مدمج' : 'Compact')}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Presets Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                {language === 'ar' ? 'تاريخ التقرير (في تاريخ)' : 'As of Date'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {language === 'ar' ? `الأرصدة حتى نهاية يوم: ${formatDate(asOfDate)}` : `Balances as of: ${formatDate(asOfDate)}`}
              </span>
            </div>
          </div>

          {/* Direct Manual Date Input + Calendar Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">
              {language === 'ar' ? 'أدخل التاريخ:' : 'Date:'}
            </span>
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputDate}
                onChange={(e) => handleDateCommit(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-32 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-center font-mono shadow-2xs"
                title={language === 'ar' ? 'يمكنك كتابة التاريخ باليد مباشرة YYYY-MM-DD' : 'Type date manually YYYY-MM-DD'}
              />
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => {
                  setAsOfDate(e.target.value);
                  setInputDate(e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title={language === 'ar' ? 'اختيار التاريخ من النتيجة / التقويم' : 'Pick date from calendar'}
              />
            </div>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {language === 'ar' ? 'فترات سريعة جاهزة:' : 'Quick Presets:'}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Today */}
            <button
              onClick={() => setAsOfDate(datePresets.today)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.today
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'اليوم' : 'Today'}
            </button>

            {/* Last Month End */}
            <button
              onClick={() => setAsOfDate(datePresets.lastMonthEnd)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.lastMonthEnd
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'الشهر الماضي' : 'Last Month'}
            </button>

            <span className="h-4 w-px bg-slate-200 mx-1 hidden sm:inline-block" />

            {/* Current Year Group */}
            <span className="text-[11px] font-bold text-slate-400">
              {language === 'ar' ? 'العام الحالي:' : 'This Year:'}
            </span>

            <button
              onClick={() => setAsOfDate(datePresets.currYearEnd)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.currYearEnd
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'العام الحالي' : 'Year End'}
            </button>
            <button
              onClick={() => setAsOfDate(datePresets.currYearQ1)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.currYearQ1
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'الربع 1' : 'Q1'}
            </button>
            <button
              onClick={() => setAsOfDate(datePresets.currYearQ2)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.currYearQ2
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'الربع 2' : 'Q2'}
            </button>
            <button
              onClick={() => setAsOfDate(datePresets.currYearQ3)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.currYearQ3
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'الربع 3' : 'Q3'}
            </button>
            <button
              onClick={() => setAsOfDate(datePresets.currYearQ4)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.currYearQ4
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'الربع 4' : 'Q4'}
            </button>

            <span className="h-4 w-px bg-slate-200 mx-1 hidden sm:inline-block" />

            {/* Last Year Group */}
            <span className="text-[11px] font-bold text-slate-400">
              {language === 'ar' ? 'العام الماضي:' : 'Last Year:'}
            </span>

            <button
              onClick={() => setAsOfDate(datePresets.prevYearEnd)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.prevYearEnd
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'العام الماضي' : 'Last Year'}
            </button>
            <button
              onClick={() => setAsOfDate(datePresets.prevYearQ1)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.prevYearQ1
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'الماضي ر1' : 'Prev Q1'}
            </button>
            <button
              onClick={() => setAsOfDate(datePresets.prevYearQ2)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.prevYearQ2
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'الماضي ر2' : 'Prev Q2'}
            </button>
            <button
              onClick={() => setAsOfDate(datePresets.prevYearQ3)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.prevYearQ3
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'الماضي ر3' : 'Prev Q3'}
            </button>
            <button
              onClick={() => setAsOfDate(datePresets.prevYearQ4)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                asOfDate === datePresets.prevYearQ4
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'الماضي ر4' : 'Prev Q4'}
            </button>
          </div>
        </div>

        {/* Grouping Selector & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-slate-100">
          {/* Grouping modes */}
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-xs font-bold text-slate-600 me-1">
              {language === 'ar' ? 'طريقة التجميع:' : 'Grouping:'}
            </span>
            <button
              onClick={() => setGroupBy('none')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                groupBy === 'none'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {language === 'ar' ? 'بدون تجميع' : 'No Grouping'}
            </button>
            <button
              onClick={() => setGroupBy('currency')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                groupBy === 'currency'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تجميع حسب العملة' : 'By Currency'}</span>
            </button>
            <button
              onClick={() => setGroupBy('account')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                groupBy === 'account'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تجميع حسب الحساب' : 'By Account'}</span>
            </button>
            <button
              onClick={() => setGroupBy('type')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                groupBy === 'type'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تجميع حسب نوع السداد' : 'By Payment Type'}</span>
            </button>
          </div>

          {/* Search & Hide Zero Balances */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={language === 'ar' ? 'بحث بالاسم، الكود، البنك...' : 'Search methods, accounts...'}
                className="w-48 sm:w-60 ps-8 pe-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-2xs"
              />
            </div>

            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideZeroBalances}
                onChange={(e) => setHideZeroBalances(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span>{language === 'ar' ? 'إخفاء الأرصدة الصفرية' : 'Hide Zero Balances'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        {/* Total Cash & Bank in System Currency */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === 'ar' ? 'إجمالي النقدية والبنوك' : 'Total Cash & Banks'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {formatNumber(totalBalanceSystem)}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {baseCurrency}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
            <span>{language === 'ar' ? 'مطابق لميزان المراجعة والمركز المالي' : 'Reconciled with GL'}</span>
          </div>
        </div>

        {/* Bank Accounts Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === 'ar' ? 'الحسابات البنكية' : 'Bank Accounts'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-900 font-mono tracking-tight">
              {formatNumber(totalBanksSystem)}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {baseCurrency}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-slate-400">
            {filteredItems.filter(i => i.type === 'bank').length} {language === 'ar' ? 'حساب بنكي' : 'accounts'}
          </div>
        </div>

        {/* Cash Safes Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === 'ar' ? 'الخزائن النقدية' : 'Cash Safes'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-900 font-mono tracking-tight">
              {formatNumber(totalCashSafeSystem)}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {baseCurrency}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-slate-400">
            {filteredItems.filter(i => i.type === 'cash').length} {language === 'ar' ? 'خزينة نقدية' : 'safes'}
          </div>
        </div>

        {/* Wallets & Other Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === 'ar' ? 'المحافظ والعهد' : 'Wallets & Other'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-900 font-mono tracking-tight">
              {formatNumber(totalWalletsSystem)}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {baseCurrency}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-bold text-slate-400">
            {filteredItems.filter(i => i.type === 'wallet' || i.type === 'other').length} {language === 'ar' ? 'محفظة / عهدة' : 'wallets'}
          </div>
        </div>
      </div>

      {/* Currency Badges Strip */}
      {currencyBreakdowns.length > 1 && (
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center flex-wrap gap-2 print:hidden">
          <span className="text-xs font-bold text-slate-500 me-2 flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" />
            {language === 'ar' ? 'تفصيل الأرصدة حسب العملة:' : 'Currency Balances:'}
          </span>
          {currencyBreakdowns.map(cb => (
            <span 
              key={cb.currency}
              className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs"
            >
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] uppercase font-mono">
                {cb.currency}
              </span>
              <span className="font-mono text-emerald-700 font-black">
                {formatNumber(cb.totalForeign)} {cb.currency}
              </span>
              {cb.currency !== baseCurrency && (
                <span className="text-slate-400 text-[10px] font-normal font-mono">
                  (≈ {formatNumber(cb.totalSystem)} {baseCurrency})
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Main Printable Report Container */}
      <div ref={reportRef} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:border-none print:shadow-none">
        {/* Printable Header (Visible on print or top of report) */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 print:bg-white print:border-b-2 print:border-slate-800">
          <div>
            <div className="text-lg font-black text-slate-900">
              {company?.name || 'الشركة'}
            </div>
            <h2 className="text-xl font-black text-emerald-800 mt-1">
              {language === 'ar' ? 'تقرير أرصدة النقدية (الخزائن والبنوك)' : 'Cash & Bank Balances Report'}
            </h2>
            <div className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-2">
              <span>{language === 'ar' ? `في تاريخ: ${formatDate(asOfDate)}` : `As of: ${formatDate(asOfDate)}`}</span>
              <span>•</span>
              <span>{language === 'ar' ? `عملة النظام: ${baseCurrency}` : `Base Currency: ${baseCurrency}`}</span>
            </div>
          </div>

          <div className="text-start md:text-end">
            <div className="inline-flex flex-col items-start md:items-end">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {language === 'ar' ? 'إجمالي الأرصدة بعملة النظام' : 'Total Portfolio Balance'}
              </span>
              <span className="text-2xl font-black text-emerald-700 font-mono mt-0.5">
                {formatNumber(totalBalanceSystem)} {baseCurrency}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {language === 'ar' ? 'مطابق لميزان المراجعة والمركز المالي' : 'Reconciled with General Ledger'}
              </span>
            </div>
          </div>
        </div>

        {/* Content based on GroupBy Mode */}
        <div className="p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs font-bold">{language === 'ar' ? 'جاري احتساب ومطابقة الأرصدة النقدية...' : 'Calculating balances...'}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm text-slate-600">{language === 'ar' ? 'لا توجد بيانات مطابقة للبحث' : 'No records found'}</p>
              <p className="text-xs text-slate-400 mt-1">{language === 'ar' ? 'حاول تغيير معايير البحث أو التاريخ' : 'Try adjusting search or date'}</p>
            </div>
          ) : groupBy === 'none' ? (
            /* Mode 1: No Grouping (Flat Unified Table) */
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold">
                    <th className="py-3 px-3 text-start w-10">#</th>
                    <th className="py-3 px-3 text-start">{language === 'ar' ? 'نوع طريقة السداد' : 'Type'}</th>
                    <th className="py-3 px-3 text-start">{language === 'ar' ? 'كود الطريقة' : 'Code'}</th>
                    <th className="py-3 px-3 text-start">{language === 'ar' ? 'طريقة السداد' : 'Payment Method'}</th>
                    <th className="py-3 px-3 text-center">{language === 'ar' ? 'العملة' : 'Currency'}</th>
                    <th className="py-3 px-3 text-start">{language === 'ar' ? 'الحساب المحاسبي' : 'GL Account'}</th>
                    <th className="py-3 px-3 text-end">{language === 'ar' ? 'المبلغ (بالعملة)' : 'Amount (Currency)'}</th>
                    <th className="py-3 px-3 text-end bg-emerald-50/60 font-black text-emerald-950">
                      {language === 'ar' ? `المبلغ بعملة النظام (${baseCurrency})` : `Amount (${baseCurrency})`}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredItems.map((item, idx) => (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}
                    >
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      
                      {/* Type Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          item.type === 'bank' ? 'bg-blue-50 text-blue-700 border border-blue-200/80' :
                          item.type === 'cash' ? 'bg-amber-50 text-amber-700 border border-amber-200/80' :
                          'bg-purple-50 text-purple-700 border border-purple-200/80'
                        }`}>
                          {item.type === 'bank' ? <Landmark className="w-3 h-3" /> :
                           item.type === 'cash' ? <Wallet className="w-3 h-3" /> :
                           <Smartphone className="w-3 h-3" />}
                          <span>{language === 'ar' ? item.typeLabelAr : item.typeLabelEn}</span>
                        </span>
                      </td>

                      {/* Code */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 text-xs">
                        {item.code}
                      </td>

                      {/* Payment Method Name with Bank Logo directly before it */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {item.type === 'bank' ? (
                            item.bankObj ? (
                              <BankLogoBadge bank={item.bankObj} size="sm" className="!w-7 !h-7 !p-0.5 rounded-lg border border-slate-200 shrink-0" />
                            ) : item.bankLogo ? (
                              <img src={item.bankLogo} alt={item.name} className="w-7 h-7 object-contain rounded-lg border border-slate-200 p-0.5 bg-white shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-[10px] shrink-0">
                                {item.bankCode || 'BNK'}
                              </div>
                            )
                          ) : item.type === 'cash' ? (
                            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                              <Wallet className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
                              <Smartphone className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 leading-tight">{item.name}</span>
                            {item.bankAccountNum && (
                              <span className="text-[10px] text-slate-400 font-mono leading-tight">{item.bankAccountNum}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Currency */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          item.currency === baseCurrency 
                            ? 'bg-slate-100 text-slate-700' 
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {item.currency}
                        </span>
                      </td>

                      {/* Linked GL Account */}
                      <td className="py-2.5 px-3">
                        {item.accountId ? (
                          <button
                            onClick={() => handleOpenLedger(item.accountId)}
                            className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition-colors group cursor-pointer"
                            title={language === 'ar' ? 'عرض كشف حساب الأستاذ العام' : 'View Ledger'}
                          >
                            <span className="font-mono text-[11px] text-indigo-500 group-hover:underline">{item.accountCode}</span>
                            <span>-</span>
                            <span className="group-hover:underline">{item.accountName}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">{language === 'ar' ? 'غير مرتبط' : 'Not linked'}</span>
                        )}
                      </td>

                      {/* Balance in Original Currency */}
                      <td className="py-2.5 px-3 text-end font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className={item.balanceForeign < 0 ? 'text-rose-600' : ''}>
                          {formatNumber(item.balanceForeign)}
                        </span>
                        <span className="text-[10px] font-normal text-slate-400 ms-1">
                          {item.currency}
                        </span>
                      </td>

                      {/* Balance in System Currency (Reconciled with Balance Sheet) */}
                      <td className="py-2.5 px-3 text-end font-mono font-black text-emerald-950 bg-emerald-50/40 whitespace-nowrap">
                        <span className={item.balanceSystem < 0 ? 'text-rose-600' : ''}>
                          {formatNumber(item.balanceSystem)}
                        </span>
                        <span className="text-[10px] font-normal text-emerald-700 ms-1">
                          {baseCurrency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-black text-xs text-slate-900">
                    <td colSpan={6} className="py-3 px-3 text-start">
                      <div className="flex items-center justify-between">
                        <span>{language === 'ar' ? 'الإجمالي العام لجميع الخزائن والبنوك' : 'Total All Cash & Bank Balances'}</span>
                        <span className="text-slate-500 font-normal text-[11px]">
                          ({filteredItems.length} {language === 'ar' ? 'طريقة سداد' : 'methods'})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-end font-mono text-slate-600">
                      -
                    </td>
                    <td className="py-3 px-3 text-end font-mono text-sm text-emerald-800 bg-emerald-100/70 whitespace-nowrap">
                      {formatNumber(totalBalanceSystem)} {baseCurrency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            /* Modes 2, 3, 4: Grouped Views (By Currency, Account, or Type) */
            <div className="space-y-6">
              {groupedData.map((group: any) => (
                <div 
                  key={group.key} 
                  className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs"
                >
                  {/* Group Header */}
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                      <h3 className="font-black text-sm text-slate-900">
                        {language === 'ar' ? group.titleAr : group.titleEn}
                      </h3>
                      <span className="text-xs text-slate-500 font-bold">
                        ({group.items.length} {language === 'ar' ? 'عنصر' : 'items'})
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {group.totalForeign !== undefined && group.key !== baseCurrency && (
                        <div className="text-xs font-mono font-bold text-slate-700">
                          <span className="text-slate-400 text-[10px] me-1">{language === 'ar' ? 'إجمالي العملة:' : 'Total Foreign:'}</span>
                          <span className="text-emerald-700">{formatNumber(group.totalForeign)} {group.key}</span>
                        </div>
                      )}
                      <div className="text-xs font-mono font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <span className="text-slate-500 text-[10px] me-1 font-sans">{language === 'ar' ? 'المعادل بالنظام:' : 'Base Total:'}</span>
                        {formatNumber(group.totalSystem)} {baseCurrency}
                      </div>
                    </div>
                  </div>

                  {/* Group Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40 text-slate-500 font-bold">
                          <th className="py-2.5 px-3 text-start w-10">#</th>
                          <th className="py-2.5 px-3 text-start">{language === 'ar' ? 'النوع' : 'Type'}</th>
                          <th className="py-2.5 px-3 text-start">{language === 'ar' ? 'الكود' : 'Code'}</th>
                          <th className="py-2.5 px-3 text-start">{language === 'ar' ? 'طريقة السداد' : 'Method'}</th>
                          <th className="py-2.5 px-3 text-center">{language === 'ar' ? 'العملة' : 'Currency'}</th>
                          <th className="py-2.5 px-3 text-start">{language === 'ar' ? 'الحساب المحاسبي' : 'Account'}</th>
                          <th className="py-2.5 px-3 text-end">{language === 'ar' ? 'المبلغ بالعملة' : 'Foreign Amt'}</th>
                          <th className="py-2.5 px-3 text-end bg-emerald-50/50 font-black text-emerald-950">
                            {language === 'ar' ? `المبلغ بالمعادل (${baseCurrency})` : `System Amt (${baseCurrency})`}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {group.items.map((item: CashBalanceItem, idx: number) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="text-[11px] font-bold text-slate-700">
                                {language === 'ar' ? item.typeLabelAr : item.typeLabelEn}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-700">{item.code}</td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                {item.type === 'bank' ? (
                                  item.bankObj ? (
                                    <BankLogoBadge bank={item.bankObj} size="sm" className="!w-6 !h-6 !p-0.5 rounded border border-slate-200 shrink-0" />
                                  ) : item.bankLogo ? (
                                    <img src={item.bankLogo} alt={item.name} className="w-6 h-6 object-contain rounded border border-slate-200 p-0.5 bg-white shrink-0" />
                                  ) : (
                                    <div className="w-6 h-6 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-[9px] shrink-0">
                                      {item.bankCode || 'BNK'}
                                    </div>
                                  )
                                ) : item.type === 'cash' ? (
                                  <div className="w-6 h-6 rounded bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                                    <Wallet className="w-3 h-3" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
                                    <Smartphone className="w-3 h-3" />
                                  </div>
                                )}
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900 leading-tight">{item.name}</span>
                                  {item.bankAccountNum && (
                                    <span className="text-[10px] text-slate-400 font-mono leading-tight">{item.bankAccountNum}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">{item.currency}</td>
                            <td className="py-2 px-3">
                              {item.accountId ? (
                                <button
                                  onClick={() => handleOpenLedger(item.accountId)}
                                  className="text-indigo-700 hover:underline font-bold text-xs cursor-pointer"
                                >
                                  {item.accountCode} - {item.accountName}
                                </button>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-3 text-end font-mono font-bold text-slate-900">
                              {formatNumber(item.balanceForeign)} <span className="text-[10px] text-slate-400 font-normal">{item.currency}</span>
                            </td>
                            <td className="py-2 px-3 text-end font-mono font-black text-emerald-950 bg-emerald-50/30">
                              {formatNumber(item.balanceSystem)} <span className="text-[10px] text-emerald-700 font-normal">{baseCurrency}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit & Reconciliation Footer Notice */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {language === 'ar' 
                ? `تمت المطابقة مع شجرة الحسابات وميزان المراجعة في تاريخ ${formatDate(asOfDate)} بنجاح.` 
                : `Audited and reconciled against Chart of Accounts and Balance Sheet as of ${formatDate(asOfDate)}.`}
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            {language === 'ar' ? 'تاريخ ووقت الاستخراج:' : 'Generated at:'} {new Date().toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
          </div>
        </div>
      </div>
    </div>
  );
};
