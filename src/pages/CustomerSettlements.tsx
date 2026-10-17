import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Customer, Account, Currency, Company } from '../types';
import { Search, Trash2, X, Layers, User, Calendar, RotateCcw, ChevronDown, Check, AlertCircle, Info, ArrowLeftRight, LayoutGrid, SlidersHorizontal, ExternalLink, Download, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { useNavigation } from '../contexts/NavigationContext';
import { formatNumber, formatDate, formatMoney, isCustomerAccount } from '../utils/formatUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { ExportButtons } from '../components/ExportButtons';
import { AttachmentsManager, AttachmentItem } from '../components/common/AttachmentsManager';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { useDefaultAccounts, getDefaultAccount } from '../utils/defaultAccountsHelper';
import { useRef } from 'react';


interface Movement {
  id: string; // unique composite key (e.g. "INV_ID" or "VOU_ID-itemIdx")
  original_id: string; // doc database ID
  date: string;
  type_label: string;
  number: string;
  page_name: string; // 'invoices', 'receipts', 'returns', 'journal_entries'
  original_amount: number;
  open_amount: number;
  settled_amount: number; // user editable in local currency
  foreign_open_amount?: number; // open balance in foreign currency
  foreign_settled_amount?: number; // user editable in foreign currency
  notes: string;
  je_number?: string;
  selected: boolean;
  currency?: string;
  exchange_rate?: number;
  foreign_amount?: number | null;
}

export const CustomerSettlements: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingViewDoc, pendingViewDoc } = useNavigation();

  // Database states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [allReturns, setAllReturns] = useState<any[]>([]);
  const [allPurchaseReturns, setAllPurchaseReturns] = useState<any[]>([]);
  const [allJournalEntries, setAllJournalEntries] = useState<any[]>([]);
  const [allPurchaseInvoices, setAllPurchaseInvoices] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const { defaultAccountMap } = useDefaultAccounts(user?.company_id);
  const [previewJeNumber, setPreviewJeNumber] = useState<string>('');
  const tableRef = useRef<HTMLDivElement>(null);

  const handleExportExcel = () => {
    const data = historyList.map(h => ({
      [language === 'ar' ? 'رقم التسوية' : 'Settlement No.']: h.settlement_number,
      [language === 'ar' ? 'التاريخ' : 'Date']: formatDate(h.date),
      [language === 'ar' ? 'العميل' : 'Customer']: h.entity_name,
      [language === 'ar' ? 'المبلغ' : 'Amount']: h.debitDocs.reduce((sum, d) => sum + d.amount, 0)
    }));
    exportToExcel(data, { filename: 'Customer_Settlements', sheetName: 'تسويات العملاء' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, {
        filename: 'Customer_Settlements',
        reportTitle: 'سجل تسويات العملاء'
      });
    }
  };


  // Active states
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingSettlementNum, setEditingSettlementNum] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // UI layout and search states
  const [layoutMode, setLayoutMode] = useState<'split' | 'unified'>('unified');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSearchType, setFilterSearchType] = useState<string>('number');
  const [filterDocNumbers, setFilterDocNumbers] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterCurrencies, setFilterCurrencies] = useState<string[]>([]);

  // Movements state
  const [debitMovements, setDebitMovements] = useState<Movement[]>([]);
  const [creditMovements, setCreditMovements] = useState<Movement[]>([]);

  // History Detail modal
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  useEffect(() => {
    if (user) {
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubInvoices = dbService.subscribe<any>('invoices', user.company_id, setAllInvoices);
      const unsubReceipts = dbService.subscribe<any>('receipt_vouchers', user.company_id, setAllReceipts);
      const unsubReturns = dbService.subscribe<any>('returns', user.company_id, setAllReturns);
      const unsubPR = dbService.subscribe<any>('purchase_returns', user.company_id, setAllPurchaseReturns);
      const unsubJEs = dbService.subscribe<any>('journal_entries', user.company_id, setAllJournalEntries);
      const unsubPI = dbService.subscribe<any>('purchase_invoices', user.company_id, setAllPurchaseInvoices);
      const unsubPayments = dbService.subscribe<any>('payment_vouchers', user.company_id, setAllPayments);
      const unsubAccounts = dbService.subscribe<any>('accounts', user.company_id, setAccounts);
      const unsubCurrencies = dbService.subscribe<Currency>('currencies', user.company_id, setCurrencies);

      dbService.get<Company>('companies', user.company_id).then(c => {
        if (c) setCompany(c);
      }).catch(err => console.error('Failed to load company for settlements:', err));

      setLoading(false);

      return () => {
        unsubCustomers();
        unsubInvoices();
        unsubReceipts();
        unsubReturns();
        unsubPR();
        unsubJEs();
        unsubPI();
        unsubPayments();
        unsubAccounts();
        unsubCurrencies();
      };
    }
  }, [user]);

  useEffect(() => {
    if (user && settlementDate) {
      dbService.getNextSequence('journal_entries', settlementDate)
        .then(setPreviewJeNumber)
        .catch(() => {});
    }
  }, [user, settlementDate]);

  const systemCurrency = useMemo(() => {
    return company?.settings?.currency || (company as any)?.currency || 'EGP';
  }, [company]);

  const currenciesMap = useMemo(() => {
    return (currencies || []).reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {} as Record<string, Currency>);
  }, [currencies]);

  const hasForeignMovements = useMemo(() => {
    const isForeign = (m: Movement) => Boolean(m.currency && m.currency !== systemCurrency);
    return debitMovements.some(isForeign) || creditMovements.some(isForeign);
  }, [debitMovements, creditMovements, systemCurrency]);

  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    set.add(systemCurrency);
    (currencies || []).forEach(c => {
      if (c.code) set.add(c.code);
    });
    debitMovements.forEach(m => {
      if (m.currency) set.add(m.currency);
    });
    creditMovements.forEach(m => {
      if (m.currency) set.add(m.currency);
    });
    return Array.from(set);
  }, [systemCurrency, currencies, debitMovements, creditMovements]);

  const handleToggleCurrencyFilter = (curr: string) => {
    setFilterCurrencies(prev => {
      if (prev.includes(curr)) {
        return prev.filter(c => c !== curr);
      } else {
        return [...prev, curr];
      }
    });
  };



  // Helpers for calculation (Level 2 compatibility)
  const getInvoiceSettlements = (inv: any) => {
    if (!inv) return [];
    const voucherSettlements: any[] = [];

    // Receipt Vouchers
    allReceipts.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach((item: any) => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => {
              if (String(s.target_id) === String(inv.id)) {
                voucherSettlements.push({
                  id: `${v.id}-${s.target_id}`,
                  date: v.date,
                  type_label: language === 'ar' ? 'سند قبض' : 'Receipt Voucher',
                  number: v.voucher_number || v.number || v.id,
                  page_name: 'receipts',
                  amount: Number(s.settled_amount) || 0,
                  notes: v.description || v.notes || ''
                });
              }
            });
          }
        });
      }
    });

    // Returns
    const returnSettlements: any[] = [];
    allReturns.forEach(r => {
      const descMatches = r.description?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                          r.notes?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                          r.return_number?.toLowerCase().includes(inv.invoice_number.toLowerCase());
      
      const isCorrectEntity = r.customer_id === inv.customer_id;
      if (descMatches && isCorrectEntity && r.payment_type !== 'cash') {
        returnSettlements.push({
          id: r.id,
          date: r.date,
          type_label: language === 'ar' ? 'مرتجع مبيعات' : 'Sales Return',
          number: r.return_number || r.id,
          page_name: 'returns',
          amount: Number(r.total_amount) || 0,
          notes: r.description || r.notes || ''
        });
      }
    });

    // Manual JEs
    const jeSettlements: any[] = [];
    allJournalEntries.forEach(je => {
      if (String(je.reference_id) === String(inv.id) || je.reference_number === inv.invoice_number) {
        return;
      }
      const standardTypes = ['invoice', 'purchase_invoice', 'receipt', 'payment', 'return', 'purchase_return', 'receipt_voucher', 'payment_voucher'];
      if (je.reference_type && standardTypes.includes(je.reference_type)) {
        return;
      }

      const jeDescMatches = je.description?.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
                            je.reference_number?.toLowerCase().includes(inv.invoice_number.toLowerCase());
                            
      je.items?.forEach((item: any, idx: number) => {
        const matchesEntity = item.customer_id === inv.customer_id || item.sub_account_id === inv.customer_id;
        if (matchesEntity && Number(item.credit) > 0) {
          const lineDescMatches = item.description?.toLowerCase().includes(inv.invoice_number.toLowerCase());
          if (jeDescMatches || lineDescMatches) {
            jeSettlements.push({
              id: `${je.id}-${idx}`,
              date: je.date,
              type_label: language === 'ar' ? 'قيد يومية' : 'Journal Entry',
              number: je.entry_number || je.id.slice(0, 8),
              page_name: 'journal_entries',
              amount: Number(item.credit),
              notes: item.description || je.description || ''
            });
          }
        }
      });
    });

    // Invoice-side settlements
    const invoiceSideSettlements: any[] = [];
    const countedVoucherIds = new Set<string>();
    voucherSettlements.forEach(vs => {
      const voucherId = vs.id.replace(`-${String(inv.id)}`, '');
      countedVoucherIds.add(voucherId);
    });

    if (inv.settlements && Array.isArray(inv.settlements)) {
      inv.settlements.forEach((s: any) => {
        const parts = (s.target_id || '').split('-');
        const voucherOriginalId = parts.length > 1 ? parts.slice(0, -1).join('-') : s.target_id;
        const alreadyCounted = countedVoucherIds.has(voucherOriginalId) || countedVoucherIds.has(s.target_id);

        let targetExists = allReceipts.some((v: any) => String(v.id) === String(voucherOriginalId)) ||
                           allReturns.some((r: any) => String(r.id) === String(voucherOriginalId)) ||
                           allJournalEntries.some((je: any) => String(je.id) === String(voucherOriginalId));

        if (targetExists && !alreadyCounted) {
          invoiceSideSettlements.push({
            id: `${inv.id}-${s.target_id}`,
            date: s.settlement_date || s.date || inv.date,
            type_label: s.type_label || (language === 'ar' ? 'تسوية' : 'Settlement'),
            number: s.settlement_number || s.reference_number || s.target_id,
            page_name: s.type || 'receipts',
            amount: Number(s.settled_amount || s.amount) || 0,
            notes: s.notes || ''
          });
        }
      });
    }

    return [...voucherSettlements, ...returnSettlements, ...jeSettlements, ...invoiceSideSettlements];
  };

  const getSettlementsForTarget = (targetId: string, jeRefType?: string) => {
    let settledSum = 0;
    
    // Sum from invoices
    allInvoices.forEach(inv => {
      if (inv.settlements && Array.isArray(inv.settlements)) {
        inv.settlements.forEach((s: any) => {
          if (editingSettlementNum && s.settlement_number === editingSettlementNum) return;
          if (s.target_id === targetId || (jeRefType === 'opening_balance' && s.target_id === `OPEN-${selectedCustomerId}`)) {
            settledSum += Number(s.settled_amount) || 0;
          }
        });
      }
    });

    // Sum from vouchers
    allReceipts.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach(item => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => {
              if (editingSettlementNum && s.settlement_number === editingSettlementNum) return;
              if (s.target_id === targetId || (jeRefType === 'opening_balance' && s.target_id === `OPEN-${selectedCustomerId}`)) {
                settledSum += Number(s.settled_amount) || 0;
              }
            });
          }
        });
      }
    });

    return settledSum;
  };

  const getJournalEntryNumber = (docId: string, docNumber: string, pageName: string) => {
    const je = allJournalEntries.find((je: any) => 
      je.reference_id === docId || 
      je.reference_number === docNumber
    );
    if (!je && pageName === 'journal_entries') {
      const directJe = allJournalEntries.find((je: any) => je.id === docId || je.entry_number === docNumber);
      return directJe?.entry_number || '-';
    }
    return je?.entry_number || '-';
  };

  // Build History list
  const historyList = useMemo(() => {
    const historyMap = new Map<string, {
      settlement_number: string;
      date: string;
      entity_name: string;
      entity_id: string;
      total_amount: number;
      debitDocs: { number: string; type_label: string; amount: number; page_name: string; original_id: string; date: string; je_number: string }[];
      creditDocs: { number: string; type_label: string; amount: number; page_name: string; original_id: string; date: string; je_number: string }[];
      created_from?: string;
      attachments?: AttachmentItem[];
    }>();

    // 1. Scan Invoices
    allInvoices.forEach(inv => {
      if (inv.settlements && Array.isArray(inv.settlements)) {
        inv.settlements.forEach((s: any) => {
          if (s.settlement_number) {
            const num = s.settlement_number;
            let inferredOrigin = s.created_from || '';
            if (!inferredOrigin) {
              if (s.originalItemAmount !== undefined && s.originalItemAmount !== null) {
                inferredOrigin = 'receipts';
              } else if (s.entry_number) {
                inferredOrigin = 'invoices';
              } else {
                inferredOrigin = 'customer_settlements';
              }
            }
            let entry = historyMap.get(num);
            if (!entry) {
              entry = {
                settlement_number: num,
                date: s.settlement_date || inv.date,
                entity_name: inv.customer_name || '',
                entity_id: inv.customer_id || '',
                total_amount: 0,
                debitDocs: [],
                creditDocs: [],
                attachments: Array.isArray(s.attachments) ? s.attachments : [],
                created_from: inferredOrigin
              };
              historyMap.set(num, entry);
            } else if (inferredOrigin && !entry.created_from) {
              entry.created_from = inferredOrigin;
            }
            if (Array.isArray(s.attachments) && s.attachments.length > 0 && (!entry.attachments || entry.attachments.length === 0)) {
              entry.attachments = s.attachments;
            }
            if (!entry.debitDocs.some(d => d.number === inv.invoice_number)) {
              entry.debitDocs.push({
                number: inv.invoice_number,
                type_label: language === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice',
                amount: Number(s.settled_amount) || 0,
                page_name: 'invoices',
                original_id: inv.id,
                date: inv.date,
                je_number: getJournalEntryNumber(inv.id, inv.invoice_number, 'invoices')
              });
            }
            if (!entry.creditDocs.some(c => c.number === s.reference_number)) {
              const targetOriginalId = (s.target_id || '').split('-')[0];
              entry.creditDocs.push({
                number: s.reference_number,
                type_label: s.type_label || 'تسوية',
                amount: Number(s.settled_amount) || 0,
                page_name: s.type || 'receipts',
                original_id: targetOriginalId,
                date: s.date || inv.date,
                je_number: getJournalEntryNumber(targetOriginalId, s.reference_number, s.type || 'receipts')
              });
            }
          }
        });
      }
    });

    // 2. Scan Vouchers
    allReceipts.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach((item: any) => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => {
              if (s.settlement_number) {
                const num = s.settlement_number;
                let inferredOrigin = s.created_from || '';
                if (!inferredOrigin) {
                  if (s.invoiceId) {
                    inferredOrigin = 'invoices';
                  } else if (s.entry_number) {
                    inferredOrigin = 'receipts';
                  } else {
                    inferredOrigin = 'customer_settlements';
                  }
                }
                let entry = historyMap.get(num);
                if (!entry) {
                  entry = {
                    settlement_number: num,
                    date: s.settlement_date || v.date,
                    entity_name: item.entity_name || v.customer_name || '',
                    entity_id: item.entity_id || v.customer_id || '',
                    total_amount: 0,
                    debitDocs: [],
                    creditDocs: [],
                    attachments: Array.isArray(s.attachments) ? s.attachments : [],
                    created_from: inferredOrigin
                  };
                  historyMap.set(num, entry);
                } else if (inferredOrigin && !entry.created_from) {
                  entry.created_from = inferredOrigin;
                }
                if (Array.isArray(s.attachments) && s.attachments.length > 0 && (!entry.attachments || entry.attachments.length === 0)) {
                  entry.attachments = s.attachments;
                }
                if (!entry.creditDocs.some(c => c.number === (v.voucher_number || v.number))) {
                  entry.creditDocs.push({
                    number: v.voucher_number || v.number || v.id,
                    type_label: 'سند قبض',
                    amount: Number(s.settled_amount) || 0,
                    page_name: 'receipts',
                    original_id: v.id,
                    date: v.date,
                    je_number: getJournalEntryNumber(v.id, v.voucher_number || v.number, 'receipts')
                  });
                }
                if (!entry.debitDocs.some(d => d.number === s.reference_number)) {
                  entry.debitDocs.push({
                    number: s.reference_number,
                    type_label: s.type_label || 'تسوية',
                    amount: Number(s.settled_amount) || 0,
                    page_name: s.type || 'invoices',
                    original_id: s.target_id,
                    date: s.date || v.date,
                    je_number: getJournalEntryNumber(s.target_id, s.reference_number, s.type || 'invoices')
                  });
                }
              }
            });
          }
        });
      }
    });

    const list = Array.from(historyMap.values()).map(h => {
      const total = h.debitDocs.reduce((sum, d) => sum + d.amount, 0);
      return { ...h, total_amount: total };
    });

    // Filtering by search term
    return list.filter(h => 
      h.settlement_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.entity_name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.settlement_number.localeCompare(a.settlement_number));
  }, [allInvoices, allReceipts, searchTerm]);

  // Clickable badge navigation to document details
  const navigateToDoc = (pageName: string, docId: string) => {
    let pageId = pageName;
    let docType = pageName;
    if (pageName === 'receipts' || pageName === 'receipt_vouchers') {
      pageId = 'receipts';
      docType = 'receipt';
    } else if (pageName === 'payment_vouchers') {
      pageId = 'payment_vouchers';
      docType = 'payment_voucher';
    } else if (pageName === 'journal_entries' || pageName === 'journal' || pageName === 'discounts') {
      pageId = 'journal_entries';
      docType = 'manual';
    } else if (pageName === 'returns') {
      pageId = 'returns';
      docType = 'return';
    } else if (pageName === 'purchase_returns') {
      pageId = 'purchase_returns';
      docType = 'purchase_return';
    } else if (pageName === 'invoices') {
      pageId = 'invoices';
      docType = 'invoice';
    } else if (pageName === 'purchase_invoices') {
      pageId = 'purchase_invoices';
      docType = 'purchase_invoice';
    }

    setCurrentPage(pageId);
    setPendingViewDoc({ type: docType, idOrNumber: docId });
  };

  const handleSettlementNumberClick = (h: any) => {
    // 1. Direct navigation based on created_from if present
    if (h.created_from === 'invoices' && h.debitDocs?.length > 0) {
      const inv = h.debitDocs[0];
      navigateToDoc(inv.page_name, inv.original_id);
      return;
    }
    if (h.created_from === 'purchase_invoices' && h.debitDocs?.length > 0) {
      const inv = h.debitDocs[0];
      navigateToDoc(inv.page_name, inv.original_id);
      return;
    }
    if (h.created_from === 'receipts' && h.creditDocs?.length > 0) {
      const rec = h.creditDocs[0];
      navigateToDoc(rec.page_name, rec.original_id);
      return;
    }
    if (h.created_from === 'payment_vouchers' && h.creditDocs?.length > 0) {
      const pay = h.creditDocs[0];
      navigateToDoc(pay.page_name, pay.original_id);
      return;
    }

    // 2. Load into edit form on the settlements page
    setActiveTab('new');
    setSelectedCustomerId(h.entity_id);
    setSettlementDate(h.date.slice(0, 10));
    setEditingSettlementNum(h.settlement_number);
    setAttachments(Array.isArray(h.attachments) ? h.attachments : []);
  };

  // Build list of movements when customer selection changes
  useEffect(() => {
    if (!selectedCustomerId) {
      setDebitMovements([]);
      setCreditMovements([]);
      return;
    }

    const currentEditingSettlement = historyList.find(x => x.settlement_number === editingSettlementNum);

    // --- DEBIT MOVEMENTS (Sales Invoices & Debit JE Lines) ---
    const debits: Movement[] = [];

    // 1. Sales Invoices
    allInvoices.forEach(inv => {
      if (inv.customer_id === selectedCustomerId && inv.payment_type !== 'cash') {
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
        const foreignAmount = isForeign ? Number(inv.total_amount || 0) : null;
        const baseAmount = isForeign
          ? (Number(inv.total_base_amount) || (docRate > 0 && docRate !== 1 ? Number((Number(inv.total_amount || 0) * docRate).toFixed(2)) : Number(inv.total_amount || 0)))
          : (Number(inv.total_amount) || 0);

        const settlements = getInvoiceSettlements(inv);
        const settledAmount = settlements
          .filter((s: any) => s.settlement_number !== editingSettlementNum)
          .reduce((sum, s) => sum + s.amount, 0);
        const originalAmount = baseAmount;
        const openAmount = originalAmount - settledAmount;
        const foreignOpenAmount = isForeign && docRate > 0 ? Number((openAmount / docRate).toFixed(2)) : 0;

        const editMatch = currentEditingSettlement?.debitDocs?.find((d: any) => d.original_id === inv.id || d.number === inv.invoice_number);
        const foreignSettledAmount = editMatch
          ? (docRate > 0 ? Number((editMatch.amount / docRate).toFixed(2)) : 0)
          : 0;

        if (openAmount > 0.01 || editMatch) {
          debits.push({
            id: inv.id,
            original_id: inv.id,
            date: inv.date,
            type_label: 'فاتورة مبيعات',
            number: inv.invoice_number,
            page_name: 'invoices',
            original_amount: originalAmount,
            open_amount: openAmount,
            settled_amount: editMatch ? editMatch.amount : 0,
            foreign_open_amount: foreignOpenAmount,
            foreign_settled_amount: foreignSettledAmount,
            notes: inv.description || inv.notes || '',
            selected: !!editMatch,
            currency: docCurrency,
            exchange_rate: docRate,
            foreign_amount: foreignAmount
          });
        }
      }
    });

    const customer = customers.find(c => c.id === selectedCustomerId);

    // 2. Debit JEs
    allJournalEntries.forEach(je => {
      const standardTypes = ['invoice', 'purchase_invoice', 'receipt', 'payment', 'return', 'purchase_return', 'receipt_voucher', 'payment_voucher'];
      if (je.reference_type && standardTypes.includes(je.reference_type)) return;

      je.items?.forEach((item: any, idx: number) => {
        const matchesEntity = item.customer_id === selectedCustomerId || item.sub_account_id === selectedCustomerId;
        if (matchesEntity && Number(item.debit) > 0 && isCustomerAccount(item.account_id, customer, accounts)) {
          let jeCurrency = systemCurrency;
          let jeRate = Number(item.exchange_rate) || 1;
          if (item.currency && item.currency !== 'local' && item.currency !== systemCurrency) {
            jeCurrency = currenciesMap[item.currency]?.code || item.currency;
          }
          const isForeign = jeCurrency !== systemCurrency;
          const foreignAmount = isForeign
            ? (Number(item.foreign_amount) || (jeRate > 1 ? Number((Number(item.debit) / jeRate).toFixed(2)) : null))
            : null;
          const originalAmount = Number(item.debit) || 0;
          const settled = getSettlementsForTarget(`${je.id}-${idx}`, je.reference_type);
          const openAmount = originalAmount - settled;
          const foreignOpenAmount = isForeign && jeRate > 0 ? Number((openAmount / jeRate).toFixed(2)) : 0;

          const editMatch = currentEditingSettlement?.debitDocs?.find((d: any) => d.original_id === je.id || d.number === (je.entry_number || je.id.slice(0, 8)));
          const foreignSettledAmount = editMatch
            ? (jeRate > 0 ? Number((editMatch.amount / jeRate).toFixed(2)) : 0)
            : 0;

          if (openAmount > 0.01 || editMatch) {
            const isDiscount = je.reference_type === 'customer_discount';
            const isOpBal = je.reference_type === 'opening_balance';
            debits.push({
              id: `${je.id}-${idx}`,
              original_id: je.id,
              date: je.date,
              type_label: language === 'ar' ? (isOpBal ? 'قيد رصيد أول' : (isDiscount ? 'خصم مسموح به' : 'قيد يومية (مدين)')) : (isOpBal ? 'Opening Balance JE' : (isDiscount ? 'Granted Discount' : 'Journal Entry (Debit)')),
              number: je.entry_number || je.id.slice(0, 8),
              page_name: isDiscount ? 'discounts' : 'journal_entries',
              original_amount: originalAmount,
              open_amount: openAmount,
              settled_amount: editMatch ? editMatch.amount : 0,
              foreign_open_amount: foreignOpenAmount,
              foreign_settled_amount: foreignSettledAmount,
              notes: item.description || je.description || '',
              je_number: je.entry_number || je.id.slice(0, 8),
              selected: !!editMatch,
              currency: jeCurrency,
              exchange_rate: jeRate,
              foreign_amount: foreignAmount
            });
          }
        }
      });
    });

    // --- CREDIT MOVEMENTS (Receipt Vouchers, Sales Returns, Credit JEs) ---
    const credits: Movement[] = [];

    // 1. Receipt Vouchers
    allReceipts.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach((item: any, idx: number) => {
          if (item.entity_id === selectedCustomerId || item.customer_id === selectedCustomerId || (item.type === 'customer' && item.entity_id === selectedCustomerId)) {
            let vCurrency = systemCurrency;
            let vRate = Number(v.exchange_rate) || 1;
            if (v.currency_id && currenciesMap[v.currency_id]) {
              vCurrency = currenciesMap[v.currency_id].code;
            } else if (v.currency_code) {
              vCurrency = v.currency_code;
            } else if (v.currency) {
              vCurrency = currenciesMap[v.currency]?.code || v.currency;
            } else if (item.currency && item.currency !== 'local' && item.currency !== systemCurrency) {
              vCurrency = currenciesMap[item.currency]?.code || item.currency;
              if (item.exchange_rate) vRate = Number(item.exchange_rate);
            }
            const isForeign = vCurrency !== systemCurrency;
            const foreignAmount = isForeign
              ? (Number(item.foreign_amount) || Number(item.amount) || 0)
              : null;
            const baseAmount = isForeign
              ? (Number(item.base_amount) || (vRate > 0 && vRate !== 1 ? Number((Number(item.amount || 0) * vRate).toFixed(2)) : Number(item.amount || 0)))
              : Number(item.amount || 0);

            let totalSettled = 0;
            const countedInvoiceIds = new Set<string>();

            if (item.settlements && Array.isArray(item.settlements)) {
              item.settlements.forEach((s: any) => {
                if (editingSettlementNum && s.settlement_number === editingSettlementNum) return;
                totalSettled += Number(s.settled_amount || s.amount || 0);
                countedInvoiceIds.add(s.target_id);
              });
            }

            // Gathers invoice-side settlements targeting this voucher item
            allInvoices.forEach(inv => {
              if (inv.settlements && Array.isArray(inv.settlements)) {
                inv.settlements.forEach((s: any) => {
                  if (editingSettlementNum && s.settlement_number === editingSettlementNum) return;
                  if (s.target_id === `${v.id}-${idx}` && !countedInvoiceIds.has(inv.id)) {
                    totalSettled += Number(s.settled_amount || s.amount || 0);
                  }
                });
              }
            });

            const originalAmount = baseAmount;
            const openAmount = originalAmount - totalSettled;
            const foreignOpenAmount = isForeign && vRate > 0 ? Number((openAmount / vRate).toFixed(2)) : 0;

            const editMatch = currentEditingSettlement?.creditDocs?.find((c: any) => c.original_id === v.id || c.number === (v.voucher_number || v.number));
            const foreignSettledAmount = editMatch
              ? (vRate > 0 ? Number((editMatch.amount / vRate).toFixed(2)) : 0)
              : 0;

            if (openAmount > 0.01 || editMatch) {
              credits.push({
                id: `${v.id}-${idx}`,
                original_id: v.id,
                date: v.date,
                type_label: 'سند قبض',
                number: v.voucher_number || v.number || v.id,
                page_name: 'receipts',
                original_amount: originalAmount,
                open_amount: openAmount,
                settled_amount: editMatch ? editMatch.amount : 0,
                foreign_open_amount: foreignOpenAmount,
                foreign_settled_amount: foreignSettledAmount,
                notes: v.description || v.notes || '',
                je_number: v.entry_number || '',
                selected: !!editMatch,
                currency: vCurrency,
                exchange_rate: vRate,
                foreign_amount: foreignAmount
              });
            }
          }
        });
      }
    });

    // 2. Sales Returns
    allReturns.forEach(r => {
      if (r.customer_id === selectedCustomerId && r.payment_type !== 'cash') {
        let retCurrency = systemCurrency;
        let retRate = Number(r.exchange_rate) || 1;
        if (r.currency_id && currenciesMap[r.currency_id]) {
          retCurrency = currenciesMap[r.currency_id].code;
        } else if (r.currency_code) {
          retCurrency = r.currency_code;
        } else if (r.currency) {
          retCurrency = currenciesMap[r.currency]?.code || r.currency;
        }
        const isForeign = retCurrency !== systemCurrency;
        const foreignAmount = isForeign ? (Number(r.foreign_amount) || Number(r.total_amount) || 0) : null;
        const baseAmount = isForeign
          ? (Number(r.total_base_amount) || (retRate > 0 && retRate !== 1 ? Number((Number(r.total_amount || 0) * retRate).toFixed(2)) : Number(r.total_amount || 0)))
          : (Number(r.total_amount) || 0);

        const settled = getSettlementsForTarget(r.id);
        const originalAmount = baseAmount;
        const openAmount = originalAmount - settled;
        const foreignOpenAmount = isForeign && retRate > 0 ? Number((openAmount / retRate).toFixed(2)) : 0;

        const editMatch = currentEditingSettlement?.creditDocs?.find((c: any) => c.original_id === r.id || c.number === r.return_number);
        const foreignSettledAmount = editMatch
          ? (retRate > 0 ? Number((editMatch.amount / retRate).toFixed(2)) : 0)
          : 0;

        if (openAmount > 0.01 || editMatch) {
          credits.push({
            id: r.id,
            original_id: r.id,
            date: r.date,
            type_label: 'مرتجع مبيعات',
            number: r.return_number || r.id,
            page_name: 'returns',
            original_amount: originalAmount,
            open_amount: openAmount,
            settled_amount: editMatch ? editMatch.amount : 0,
            foreign_open_amount: foreignOpenAmount,
            foreign_settled_amount: foreignSettledAmount,
            notes: r.description || r.notes || '',
            je_number: r.entry_number || '',
            selected: !!editMatch,
            currency: retCurrency,
            exchange_rate: retRate,
            foreign_amount: foreignAmount
          });
        }
      }
    });

    // 3. Credit JEs
    allJournalEntries.forEach(je => {
      const standardTypes = ['invoice', 'purchase_invoice', 'receipt', 'payment', 'return', 'purchase_return', 'receipt_voucher', 'payment_voucher'];
      if (je.reference_type && standardTypes.includes(je.reference_type)) return;

      je.items?.forEach((item: any, idx: number) => {
        const matchesEntity = item.customer_id === selectedCustomerId || item.sub_account_id === selectedCustomerId;
        if (matchesEntity && Number(item.credit) > 0 && isCustomerAccount(item.account_id, customer, accounts)) {
          let jeCurrency = systemCurrency;
          let jeRate = Number(item.exchange_rate) || 1;
          if (item.currency && item.currency !== 'local' && item.currency !== systemCurrency) {
            jeCurrency = currenciesMap[item.currency]?.code || item.currency;
          }
          const isForeign = jeCurrency !== systemCurrency;
          const foreignAmount = isForeign
            ? (Number(item.foreign_amount) || (jeRate > 1 ? Number((Number(item.credit) / jeRate).toFixed(2)) : null))
            : null;
          const originalAmount = Number(item.credit) || 0;
          const settled = getSettlementsForTarget(`${je.id}-${idx}`, je.reference_type);
          const openAmount = originalAmount - settled;
          const foreignOpenAmount = isForeign && jeRate > 0 ? Number((openAmount / jeRate).toFixed(2)) : 0;

          const editMatch = currentEditingSettlement?.creditDocs?.find((c: any) => c.original_id === je.id || c.number === (je.entry_number || je.id.slice(0, 8)));
          const foreignSettledAmount = editMatch
            ? (jeRate > 0 ? Number((editMatch.amount / jeRate).toFixed(2)) : 0)
            : 0;

          if (openAmount > 0.01 || editMatch) {
            const isDiscount = je.reference_type === 'customer_discount';
            const isOpBal = je.reference_type === 'opening_balance';
            credits.push({
              id: `${je.id}-${idx}`,
              original_id: je.id,
              date: je.date,
              type_label: language === 'ar' ? (isOpBal ? 'قيد رصيد أول' : (isDiscount ? 'خصم مسموح به' : 'قيد يومية (دائن)')) : (isOpBal ? 'Opening Balance JE' : (isDiscount ? 'Granted Discount' : 'Journal Entry (Credit)')),
              number: je.entry_number || je.id.slice(0, 8),
              page_name: isDiscount ? 'discounts' : 'journal_entries',
              original_amount: originalAmount,
              open_amount: openAmount,
              settled_amount: editMatch ? editMatch.amount : 0,
              foreign_open_amount: foreignOpenAmount,
              foreign_settled_amount: foreignSettledAmount,
              notes: item.description || je.description || '',
              je_number: je.entry_number || je.id.slice(0, 8),
              selected: !!editMatch,
              currency: jeCurrency,
              exchange_rate: jeRate,
              foreign_amount: foreignAmount
            });
          }
        }
      });
    });

    setDebitMovements(debits.sort((a, b) => b.date.localeCompare(a.date)));
    setCreditMovements(credits.sort((a, b) => b.date.localeCompare(a.date)));
  }, [selectedCustomerId, allInvoices, allReceipts, allReturns, allJournalEntries, customers, editingSettlementNum, historyList, currenciesMap, systemCurrency]);

  // Helper to translate doc type according to active language
  const getDocTypeLabel = (pageName: string, isDebit?: boolean, fallbackLabel?: string) => {
    if (language === 'ar') {
      return fallbackLabel || (
        pageName === 'invoices' ? 'فاتورة مبيعات' :
        pageName === 'receipts' ? 'سند قبض' :
        pageName === 'returns' ? 'مرتجع مبيعات' :
        pageName === 'discounts' ? 'خصم مسموح به' :
        pageName === 'journal_entries' ? (isDebit ? 'قيد يومية (مدين)' : 'قيد يومية (دائن)') :
        fallbackLabel || ''
      );
    }
    // English
    switch (pageName) {
      case 'invoices':
        return 'Sales Invoice';
      case 'receipts':
        return 'Receipt Voucher';
      case 'returns':
        return 'Sales Return';
      case 'discounts':
        return 'Allowed Discount';
      case 'journal_entries':
        return isDebit ? 'Journal Entry (Debit)' : 'Journal Entry (Credit)';
      default:
        if (fallbackLabel === 'فاتورة مبيعات') return 'Sales Invoice';
        if (fallbackLabel === 'سند قبض') return 'Receipt Voucher';
        if (fallbackLabel === 'مرتجع مبيعات') return 'Sales Return';
        if (fallbackLabel === 'خصم مسموح به') return 'Allowed Discount';
        if (fallbackLabel?.includes('قيد')) return isDebit ? 'Journal Entry (Debit)' : 'Journal Entry (Credit)';
        return fallbackLabel || pageName;
    }
  };

  // Helper for foreign amount sign (+ for invoices/debits, - for receipts/returns/credits)
  const getMovementSign = (m: Movement & { isDebit?: boolean }) => {
    if (m.page_name === 'invoices') return '+';
    if (m.page_name === 'receipts' || m.page_name === 'returns' || m.page_name === 'discounts') return '-';
    return m.isDebit ? '+' : '-';
  };

  // Apply Advanced Filtering
  const applyFilters = (list: Movement[]) => {
    return list.filter(m => {
      // 1. Bulk multi-search
      if (filterDocNumbers.trim()) {
        const queryList = filterDocNumbers
          .split(/[\n,;]+/)
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);
        if (queryList.length > 0) {
          const matched = queryList.some(query => {
            if (filterSearchType === 'number') {
              return m.number.toLowerCase().includes(query);
            }
            if (filterSearchType === 'foreign_amount') {
              const cleanQ = query.replace(/,/g, '').trim();
              const numVal = parseFloat(cleanQ);
              if (m.foreign_amount !== undefined && m.foreign_amount !== null) {
                return !isNaN(numVal)
                  ? Math.abs(m.foreign_amount - numVal) < 0.01
                  : String(m.foreign_amount).includes(cleanQ);
              }
              return false;
            }
            if (filterSearchType === 'currency') {
              return !!(m.currency && m.currency.toLowerCase().includes(query));
            }
            if (filterSearchType === 'je_number') {
              return !!(m.je_number && m.je_number.toLowerCase().includes(query));
            }
            if (filterSearchType === 'date') {
              return m.date.slice(0, 10).includes(query);
            }
            if (filterSearchType === 'original_amount') {
              const cleanQ = query.replace(/,/g, '').trim();
              const numVal = parseFloat(cleanQ);
              return !isNaN(numVal) && Math.abs(m.original_amount - numVal) < 0.01;
            }
            if (filterSearchType === 'open_amount') {
              const cleanQ = query.replace(/,/g, '').trim();
              const numVal = parseFloat(cleanQ);
              return !isNaN(numVal) && Math.abs(m.open_amount - numVal) < 0.01;
            }
            if (filterSearchType === 'notes') {
              return !!(m.notes && m.notes.toLowerCase().includes(query));
            }
            return false;
          });
          if (!matched) return false;
        }
      }

      // 2. Date range
      if (filterFromDate && m.date.slice(0, 10) < filterFromDate) return false;
      if (filterToDate && m.date.slice(0, 10) > filterToDate) return false;

      // 3. Movement Type
      if (filterTypes.length > 0) {
        if (!filterTypes.includes(m.page_name)) return false;
      }

      // 4. Currency Filter
      if (filterCurrencies.length > 0) {
        const movCurrency = m.currency || systemCurrency;
        if (!filterCurrencies.includes(movCurrency)) return false;
      }

      // 5. Basic search bar (searchTerm)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const docLabel = getDocTypeLabel(m.page_name, (m as any).isDebit, m.type_label);
        const matchesQuery = m.number.toLowerCase().includes(query) || 
                             m.type_label.toLowerCase().includes(query) || 
                             docLabel.toLowerCase().includes(query) ||
                             m.notes.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      return true;
    });
  };

  const processedDebitMovements = useMemo(() => {
    return applyFilters(debitMovements);
  }, [debitMovements, filterDocNumbers, filterSearchType, filterFromDate, filterToDate, filterTypes, filterCurrencies, searchTerm]);

  const processedCreditMovements = useMemo(() => {
    return applyFilters(creditMovements);
  }, [creditMovements, filterDocNumbers, filterSearchType, filterFromDate, filterToDate, filterTypes, filterCurrencies, searchTerm]);

  // Unified grid table array
  const unifiedMovements = useMemo(() => {
    const merged: (Movement & { isDebit: boolean })[] = [];
    processedDebitMovements.forEach(m => merged.push({ ...m, isDebit: true }));
    processedCreditMovements.forEach(m => merged.push({ ...m, isDebit: false }));
    // Sort descending by date
    return merged.sort((a, b) => b.date.localeCompare(a.date));
  }, [processedDebitMovements, processedCreditMovements]);

  // Totals
  const totalSettledDebit = useMemo(() => {
    return debitMovements.reduce((sum, m) => sum + (m.selected ? m.settled_amount : 0), 0);
  }, [debitMovements]);

  const totalSettledCredit = useMemo(() => {
    return creditMovements.reduce((sum, m) => sum + (m.selected ? m.settled_amount : 0), 0);
  }, [creditMovements]);

  const difference = useMemo(() => {
    return Math.abs(totalSettledDebit - totalSettledCredit);
  }, [totalSettledDebit, totalSettledCredit]);

  const isAllDebitSelected = useMemo(() => {
    return processedDebitMovements.length > 0 && processedDebitMovements.every(m => m.selected);
  }, [processedDebitMovements]);

  const handleSelectAllDebits = (checked: boolean) => {
    const visibleIds = new Set(processedDebitMovements.map(m => m.id));
    setDebitMovements(prev => prev.map(m => {
      if (visibleIds.has(m.id)) {
        return { 
          ...m, 
          selected: checked, 
          settled_amount: checked ? m.open_amount : 0,
          foreign_settled_amount: checked ? (m.foreign_open_amount || 0) : 0
        };
      }
      return m;
    }));
  };

  const isAllCreditSelected = useMemo(() => {
    return processedCreditMovements.length > 0 && processedCreditMovements.every(m => m.selected);
  }, [processedCreditMovements]);

  const handleSelectAllCredits = (checked: boolean) => {
    const visibleIds = new Set(processedCreditMovements.map(m => m.id));
    setCreditMovements(prev => prev.map(m => {
      if (visibleIds.has(m.id)) {
        return { 
          ...m, 
          selected: checked, 
          settled_amount: checked ? m.open_amount : 0,
          foreign_settled_amount: checked ? (m.foreign_open_amount || 0) : 0
        };
      }
      return m;
    }));
  };

  const isAllUnifiedSelected = useMemo(() => {
    return unifiedMovements.length > 0 && unifiedMovements.every(m => m.selected);
  }, [unifiedMovements]);

  const handleSelectAllUnified = (checked: boolean) => {
    const visibleDebitIds = new Set(processedDebitMovements.map(m => m.id));
    const visibleCreditIds = new Set(processedCreditMovements.map(m => m.id));

    setDebitMovements(prev => prev.map(m => {
      if (visibleDebitIds.has(m.id)) {
        return { 
          ...m, 
          selected: checked, 
          settled_amount: checked ? m.open_amount : 0,
          foreign_settled_amount: checked ? (m.foreign_open_amount || 0) : 0
        };
      }
      return m;
    }));

    setCreditMovements(prev => prev.map(m => {
      if (visibleCreditIds.has(m.id)) {
        return { 
          ...m, 
          selected: checked, 
          settled_amount: checked ? m.open_amount : 0,
          foreign_settled_amount: checked ? (m.foreign_open_amount || 0) : 0
        };
      }
      return m;
    }));
  };

  // Handlers for checkboxes & inputs
  const handleToggleDebit = (id: string, checked: boolean) => {
    setDebitMovements(prev => prev.map(m => {
      if (m.id === id) {
        return { 
          ...m, 
          selected: checked, 
          settled_amount: checked ? m.open_amount : 0,
          foreign_settled_amount: checked ? (m.foreign_open_amount || 0) : 0
        };
      }
      return m;
    }));
  };

  const handleToggleCredit = (id: string, checked: boolean) => {
    setCreditMovements(prev => prev.map(m => {
      if (m.id === id) {
        return { 
          ...m, 
          selected: checked, 
          settled_amount: checked ? m.open_amount : 0,
          foreign_settled_amount: checked ? (m.foreign_open_amount || 0) : 0
        };
      }
      return m;
    }));
  };

  const handleDebitAmountChange = (id: string, amount: number) => {
    setDebitMovements(prev => prev.map(m => {
      if (m.id === id) {
        const val = Math.max(0, Math.min(m.open_amount, amount));
        const rate = m.exchange_rate && m.exchange_rate > 0 ? m.exchange_rate : 1;
        const isForeign = Boolean(m.currency && m.currency !== systemCurrency);
        const fxVal = isForeign ? Number((val / rate).toFixed(2)) : 0;
        return { ...m, settled_amount: val, foreign_settled_amount: fxVal, selected: val > 0 };
      }
      return m;
    }));
  };

  const handleDebitForeignAmountChange = (id: string, foreignAmount: number) => {
    setDebitMovements(prev => prev.map(m => {
      if (m.id === id) {
        const maxFx = m.foreign_open_amount !== undefined ? m.foreign_open_amount : 999999999;
        const fxVal = Math.max(0, Math.min(maxFx, foreignAmount));
        const rate = m.exchange_rate && m.exchange_rate > 0 ? m.exchange_rate : 1;
        const localVal = Number((fxVal * rate).toFixed(2));
        const finalLocal = Math.min(m.open_amount, localVal);
        return { ...m, foreign_settled_amount: fxVal, settled_amount: finalLocal, selected: fxVal > 0 };
      }
      return m;
    }));
  };

  const handleCreditAmountChange = (id: string, amount: number) => {
    setCreditMovements(prev => prev.map(m => {
      if (m.id === id) {
        const val = Math.max(0, Math.min(m.open_amount, amount));
        const rate = m.exchange_rate && m.exchange_rate > 0 ? m.exchange_rate : 1;
        const isForeign = Boolean(m.currency && m.currency !== systemCurrency);
        const fxVal = isForeign ? Number((val / rate).toFixed(2)) : 0;
        return { ...m, settled_amount: val, foreign_settled_amount: fxVal, selected: val > 0 };
      }
      return m;
    }));
  };

  const handleCreditForeignAmountChange = (id: string, foreignAmount: number) => {
    setCreditMovements(prev => prev.map(m => {
      if (m.id === id) {
        const maxFx = m.foreign_open_amount !== undefined ? m.foreign_open_amount : 999999999;
        const fxVal = Math.max(0, Math.min(maxFx, foreignAmount));
        const rate = m.exchange_rate && m.exchange_rate > 0 ? m.exchange_rate : 1;
        const localVal = Number((fxVal * rate).toFixed(2));
        const finalLocal = Math.min(m.open_amount, localVal);
        return { ...m, foreign_settled_amount: fxVal, settled_amount: finalLocal, selected: fxVal > 0 };
      }
      return m;
    }));
  };

  // Realized Forex calculation
  const forexCalculation = useMemo(() => {
    const debits = debitMovements
      .filter(m => m.selected && ((m.foreign_settled_amount || 0) > 0 || m.settled_amount > 0))
      .map(m => ({
        ...m,
        remFx: m.foreign_settled_amount || 0,
        remEgp: m.settled_amount || 0,
        rate: m.exchange_rate || 1
      }));

    const credits = creditMovements
      .filter(m => m.selected && ((m.foreign_settled_amount || 0) > 0 || m.settled_amount > 0))
      .map(m => ({
        ...m,
        remFx: m.foreign_settled_amount || 0,
        remEgp: m.settled_amount || 0,
        rate: m.exchange_rate || 1
      }));

    let totalGainLoss = 0;
    let totalMatchedFx = 0;
    let primaryCurr = '';

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debits.length && cIdx < credits.length) {
      const d = debits[dIdx];
      const c = credits[cIdx];

      const isSameForeign = Boolean(
        d.currency && c.currency &&
        d.currency === c.currency &&
        d.currency !== systemCurrency
      );

      if (isSameForeign && d.remFx > 0.0001 && c.remFx > 0.0001) {
        const matchFx = Math.min(d.remFx, c.remFx);
        primaryCurr = d.currency || 'USD';
        totalMatchedFx += matchFx;

        // In Customer Settlements:
        // Debit is Invoice (rate d.rate).
        // Credit is Receipt (rate c.rate).
        // Gain if c.rate > d.rate (collected more EGP than invoiced).
        const diffPerUnit = c.rate - d.rate;
        const gainLoss = Number((matchFx * diffPerUnit).toFixed(2));
        totalGainLoss += gainLoss;

        d.remFx -= matchFx;
        c.remFx -= matchFx;
      }

      const dDone = isSameForeign ? d.remFx <= 0.001 : true;
      const cDone = isSameForeign ? c.remFx <= 0.001 : true;

      if (dDone) dIdx++;
      if (cDone) cIdx++;

      if (!isSameForeign) {
        dIdx++;
        cIdx++;
      }
    }

    const roundedGainLoss = Number(totalGainLoss.toFixed(2));
    const hasForex = Math.abs(roundedGainLoss) >= 0.01;
    const isGain = roundedGainLoss > 0;
    const targetKey = isGain ? 'realized_forex_gain' : 'realized_forex_loss';
    const account = hasForex ? (getDefaultAccount(targetKey, defaultAccountMap, accounts) || accounts.find(a => a.code === (isGain ? '420201' : '630201'))) : undefined;

    return {
      hasForex,
      netGainLoss: roundedGainLoss,
      matchedForeignAmount: Number(totalMatchedFx.toFixed(2)),
      currency: primaryCurr,
      account,
      isGain
    };
  }, [debitMovements, creditMovements, systemCurrency, defaultAccountMap, accounts]);

  // Toggle layout mode
  const handleToggleLayout = () => {
    setLayoutMode(prev => prev === 'split' ? 'unified' : 'split');
  };

  // Toggle type selection filters
  const handleToggleTypeFilter = (type: string) => {
    setFilterTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Sequence generation for settlement
  const generateSettlementSerial = (dateStr: string) => {
    const dateParts = dateStr.slice(0, 10).split('-');
    const year = dateParts[0];
    const month = dateParts[1].padStart(2, '0');
    const prefix = `SET-${year}-${month}`;

    let maxSeq = 0;
    
    const checkSettlementNum = (num: string) => {
      if (num && num.startsWith(prefix)) {
        const parts = num.split('-');
        if (parts.length >= 4) {
          const seq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    };

    // 1. Check Invoices settlements (Customer)
    allInvoices.forEach(inv => {
      if (inv.settlements && Array.isArray(inv.settlements)) {
        inv.settlements.forEach((s: any) => checkSettlementNum(s.settlement_number));
      }
    });

    // 2. Check Vouchers settlements (Customer)
    allReceipts.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach(item => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => checkSettlementNum(s.settlement_number));
          }
        });
      }
    });

    // 3. Check Purchase Invoices settlements (Supplier)
    allPurchaseInvoices.forEach(inv => {
      if (inv.settlements && Array.isArray(inv.settlements)) {
        inv.settlements.forEach((s: any) => checkSettlementNum(s.settlement_number));
      }
    });

    // 4. Check Payment Vouchers settlements (Supplier)
    allPayments.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach(item => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => checkSettlementNum(s.settlement_number));
          }
        });
      }
    });

    const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
    return `${prefix}-${nextSeq}`;
  };

  const autoSettlementNumber = useMemo(() => {
    return generateSettlementSerial(settlementDate);
  }, [settlementDate, allInvoices, allReceipts, allPurchaseInvoices, allPayments]);

  // Submit Save Settlement
  const handleSaveSettlement = async () => {
    if (!user) return;
    if (!selectedCustomerId) return;
    if (totalSettledDebit <= 0) {
      showNotification(language === 'ar' ? 'المبلغ المسوى يجب أن يكون أكبر من الصفر' : 'Settled amount must be greater than zero', 'error');
      return;
    }
    const diff = Math.abs(totalSettledDebit - totalSettledCredit);
    const isDirectBalanced = diff <= 0.05;
    const isForexBalanced = forexCalculation.hasForex && Math.abs(diff - Math.abs(forexCalculation.netGainLoss)) <= 0.05;

    if (!isDirectBalanced && !isForexBalanced) {
      showNotification(
        language === 'ar' 
          ? `الحركات غير متوازنة، الفارق: ${formatMoney(diff)} ${t('common.currency')}، يرجى ضبط المبالغ قبل الحفظ`
          : `Movements are unbalanced, difference: ${formatMoney(diff)}, please adjust amounts before saving`, 
        'error'
      );
      return;
    }

    try {
      const settlementNumber = editingSettlementNum || autoSettlementNumber;

      if (editingSettlementNum) {
        const deleteSettlementNoPrompt = async (settlementNo: string) => {
          for (const inv of allInvoices) {
            if (inv.settlements && Array.isArray(inv.settlements)) {
              const hasMatch = inv.settlements.some((s: any) => s.settlement_number === settlementNo);
              if (hasMatch) {
                const updated = inv.settlements.filter((s: any) => s.settlement_number !== settlementNo);
                await dbService.update('invoices', inv.id, { settlements: updated });
              }
            }
          }
          for (const v of allReceipts) {
            if (v.items && Array.isArray(v.items)) {
              let changed = false;
              const updatedItems = v.items.map((item: any) => {
                if (item.settlements && Array.isArray(item.settlements)) {
                  const hasMatch = item.settlements.some((s: any) => s.settlement_number === settlementNo);
                  if (hasMatch) {
                    changed = true;
                    return { ...item, settlements: item.settlements.filter((s: any) => s.settlement_number !== settlementNo) };
                  }
                }
                return item;
              });
              if (changed) {
                await dbService.update('receipt_vouchers', v.id, { ...v, items: updatedItems });
              }
            }
          }
        };
        await deleteSettlementNoPrompt(editingSettlementNum);
      }

      // Perform FIFO matching
      const debitsToSettle = debitMovements
        .filter(m => m.selected && m.settled_amount > 0)
        .map(m => ({ ...m, remaining: m.settled_amount }));

      const creditsToSettle = creditMovements
        .filter(m => m.selected && m.settled_amount > 0)
        .map(m => ({ ...m, remaining: m.settled_amount }));

      const links: { debitTx: Movement; creditTx: Movement; amount: number }[] = [];
      let dIdx = 0;
      let cIdx = 0;

      while (dIdx < debitsToSettle.length && cIdx < creditsToSettle.length) {
        const debit = debitsToSettle[dIdx];
        const credit = creditsToSettle[cIdx];
        const alloc = Number(Math.min(debit.remaining, credit.remaining).toFixed(2));

        if (alloc > 0.009) {
          links.push({ debitTx: debit, creditTx: credit, amount: alloc });
        }

        debit.remaining -= alloc;
        credit.remaining -= alloc;

        if (debit.remaining <= 0.01) dIdx++;
        if (credit.remaining <= 0.01) cIdx++;
      }

      // Group Updates to avoid multi-write conflicts
      const invoiceUpdates = new Map<string, any>();
      const voucherUpdates = new Map<string, any>();

      for (const link of links) {
        const { debitTx, creditTx, amount } = link;

        // Debit side update (Invoice)
        if (debitTx.page_name === 'invoices') {
          const invId = debitTx.original_id;
          let inv = invoiceUpdates.get(invId);
          if (!inv) {
            inv = allInvoices.find(i => i.id === invId);
            if (inv) {
              inv = { ...inv, settlements: [...(inv.settlements || [])] };
              invoiceUpdates.set(invId, inv);
            }
          }
          if (inv) {
            inv.settlements.push({
              target_id: creditTx.id,
              settled_amount: amount,
              reference_number: creditTx.number,
              type: creditTx.page_name,
              type_label: creditTx.type_label,
              date: creditTx.date,
              original_amount: creditTx.original_amount,
              settlement_number: settlementNumber,
              settlement_date: settlementDate,
              attachments,
              created_from: 'customer_settlements'
            });
          }
        }

        // Credit side update (Receipt Voucher)
        if (creditTx.page_name === 'receipts') {
          const vId = creditTx.original_id;
          const parts = creditTx.id.split('-');
          const itemIdx = parseInt(parts[parts.length - 1], 10);

          let voucher = voucherUpdates.get(vId);
          if (!voucher) {
            voucher = allReceipts.find(v => v.id === vId);
            if (voucher) {
              voucher = {
                ...voucher,
                items: voucher.items.map((it: any) => ({
                  ...it,
                  settlements: [...(it.settlements || [])]
                }))
              };
              voucherUpdates.set(vId, voucher);
            }
          }
          if (voucher && !isNaN(itemIdx) && itemIdx < voucher.items.length) {
            voucher.items[itemIdx].settlements.push({
              target_id: debitTx.id,
              settled_amount: amount,
              reference_number: debitTx.number,
              type: debitTx.page_name,
              type_label: debitTx.type_label,
              date: debitTx.date,
              original_amount: debitTx.original_amount,
              settlement_number: settlementNumber,
              settlement_date: settlementDate,
              attachments,
              created_from: 'customer_settlements'
            });
          }
        }
      }

      // Execute Updates in DB
      for (const [id, inv] of invoiceUpdates.entries()) {
        await dbService.update('invoices', id, { settlements: inv.settlements });
      }
      for (const [id, v] of voucherUpdates.entries()) {
        await dbService.update('receipt_vouchers', id, v);
      }

      // Record Forex Realized Gain/Loss Journal Entry if exists
      if (forexCalculation.hasForex && Math.abs(forexCalculation.netGainLoss) >= 0.01) {
        try {
          const isGain = forexCalculation.isGain;
          const absAmount = Math.abs(forexCalculation.netGainLoss);
          const cust = customers.find(c => c.id === selectedCustomerId);
          const entityAcc = accounts.find(a => a.id === cust?.account_id) || 
                            getDefaultAccount('customer', defaultAccountMap, accounts);
          const targetKey = isGain ? 'realized_forex_gain' : 'realized_forex_loss';
          const forexAcc = forexCalculation.account || 
                           getDefaultAccount(targetKey, defaultAccountMap, accounts) ||
                           accounts.find(a => a.code === (isGain ? '420201' : '630201'));

          if (entityAcc && forexAcc) {
            const jeNumber = await dbService.getNextSequence('journal_entries', settlementDate);
            const jeItems = isGain ? [
              {
                account_id: entityAcc.id,
                account_name: entityAcc.name,
                debit: absAmount,
                credit: 0,
                description: `أرباح فروق عملة محققة - تسوية عميل: ${cust?.name} - تسوية رقم: ${settlementNumber}`,
                customer_id: selectedCustomerId,
                customer_name: cust?.name
              },
              {
                account_id: forexAcc.id,
                account_name: forexAcc.name,
                debit: 0,
                credit: absAmount,
                description: `أرباح فروق عملة محققة - تسوية عميل: ${cust?.name} - تسوية رقم: ${settlementNumber}`,
                customer_id: selectedCustomerId,
                customer_name: cust?.name
              }
            ] : [
              {
                account_id: forexAcc.id,
                account_name: forexAcc.name,
                debit: absAmount,
                credit: 0,
                description: `خسائر فروق عملة محققة - تسوية عميل: ${cust?.name} - تسوية رقم: ${settlementNumber}`,
                customer_id: selectedCustomerId,
                customer_name: cust?.name
              },
              {
                account_id: entityAcc.id,
                account_name: entityAcc.name,
                debit: 0,
                credit: absAmount,
                description: `خسائر فروق عملة محققة - تسوية عميل: ${cust?.name} - تسوية رقم: ${settlementNumber}`,
                customer_id: selectedCustomerId,
                customer_name: cust?.name
              }
            ];

            await dbService.add('journal_entries', {
              company_id: user.company_id,
              date: settlementDate,
              entry_number: jeNumber,
              description: `قيد فروق عملة محققة ناتجة عن تسوية أرصدة عميل رقم: ${settlementNumber} - ${cust?.name}`,
              reference_id: settlementNumber,
              reference_type: 'customer_settlement_forex',
              reference_number: settlementNumber,
              items: jeItems,
              total_debit: absAmount,
              total_credit: absAmount,
              created_at: new Date().toISOString(),
              created_by: user.id
            });
          }
        } catch (jeErr) {
          console.error('Failed to create forex journal entry:', jeErr);
        }
      }

      setAttachments([]);
      showNotification(language === 'ar' ? 'تم حفظ التسوية بنجاح وتوزيع الأرصدة' : 'Settlement saved and balances distributed successfully', 'success');

      // Log activity
      const cust = customers.find(c => c.id === selectedCustomerId);
      dbService.logActivity(
        user.id,
        user.username,
        user.company_id,
        'تسوية أرصدة عميل',
        `حفظ تسوية رقم ${settlementNumber} للعميل: ${cust?.name} بمبلغ: ${formatNumber(totalSettledDebit)}`,
        'customer_settlements'
      );

      // Reset
      setSelectedCustomerId('');
      setDebitMovements([]);
      setCreditMovements([]);
      setEditingSettlementNum(null);
    } catch (err: any) {
      console.error(err);
      showNotification(t('settlements.toast_error'), 'error');
    }
  };



  // Handle redirect from other pages (e.g. clicking on settlement reference)
  useEffect(() => {
    if (pendingViewDoc && pendingViewDoc.type === 'settlement' && historyList.length > 0) {
      const found = historyList.find(h => h.settlement_number === pendingViewDoc.idOrNumber);
      if (found) {
        handleSettlementNumberClick(found);
        setPendingViewDoc(null);
      }
    }
  }, [pendingViewDoc, historyList, setPendingViewDoc, handleSettlementNumberClick]);

  // Export Settlement to Excel
  const handleExportSettlementExcel = (h: any) => {
    const excelData: any[] = [];
    
    h.debitDocs.forEach((doc: any) => {
      excelData.push({
        [language === 'ar' ? 'رقم التسوية' : 'Settlement No.']: h.settlement_number,
        [language === 'ar' ? 'تاريخ التسوية' : 'Settlement Date']: formatDate(h.date),
        [language === 'ar' ? 'العميل' : 'Customer']: h.entity_name,
        [language === 'ar' ? 'نوع المستند' : 'Doc Type']: doc.type_label,
        [language === 'ar' ? 'رقم المستند' : 'Doc No.']: doc.number,
        [language === 'ar' ? 'تاريخ المستند' : 'Doc Date']: formatDate(doc.date),
        [language === 'ar' ? 'رقم القيد' : 'JE No.']: doc.je_number || '-',
        [language === 'ar' ? 'مدين (مسوى)' : 'Debit Settled']: doc.amount,
        [language === 'ar' ? 'دائن (مسوى)' : 'Credit Settled']: 0
      });
    });

    h.creditDocs.forEach((doc: any) => {
      excelData.push({
        [language === 'ar' ? 'رقم التسوية' : 'Settlement No.']: h.settlement_number,
        [language === 'ar' ? 'تاريخ التسوية' : 'Settlement Date']: formatDate(h.date),
        [language === 'ar' ? 'العميل' : 'Customer']: h.entity_name,
        [language === 'ar' ? 'نوع المستند' : 'Doc Type']: doc.type_label,
        [language === 'ar' ? 'رقم المستند' : 'Doc No.']: doc.number,
        [language === 'ar' ? 'تاريخ المستند' : 'Doc Date']: formatDate(doc.date),
        [language === 'ar' ? 'رقم القيد' : 'JE No.']: doc.je_number || '-',
        [language === 'ar' ? 'مدين (مسوى)' : 'Debit Settled']: 0,
        [language === 'ar' ? 'دائن (مسوى)' : 'Credit Settled']: doc.amount
      });
    });

    exportToExcel(excelData, {
      filename: `settlement_${h.settlement_number}`,
      sheetName: 'Settlement'
    });
  };

  // Rollback Settlement
  const handleDeleteSettlement = async (settlementNumber: string, customerName: string) => {
    if (!user) return;
    if (!window.confirm(language === 'ar' ? `هل أنت متأكد من إلغاء وحذف التسوية رقم ${settlementNumber}؟` : `Are you sure you want to cancel and delete settlement No. ${settlementNumber}?`)) return;

    try {
      // 1. Update Invoices
      for (const inv of allInvoices) {
        if (inv.settlements && Array.isArray(inv.settlements)) {
          const hasMatch = inv.settlements.some((s: any) => s.settlement_number === settlementNumber);
          if (hasMatch) {
            const updated = inv.settlements.filter((s: any) => s.settlement_number !== settlementNumber);
            await dbService.update('invoices', inv.id, { settlements: updated });
          }
        }
      }

      // 2. Update Vouchers
      for (const v of allReceipts) {
        if (v.items && Array.isArray(v.items)) {
          let changed = false;
          const updatedItems = v.items.map((item: any) => {
            if (item.settlements && Array.isArray(item.settlements)) {
              const hasMatch = item.settlements.some((s: any) => s.settlement_number === settlementNumber);
              if (hasMatch) {
                changed = true;
                return { ...item, settlements: item.settlements.filter((s: any) => s.settlement_number !== settlementNumber) };
              }
            }
            return item;
          });

          if (changed) {
            await dbService.update('receipt_vouchers', v.id, { ...v, items: updatedItems });
          }
        }
      }

      // 3. Delete Forex Journal Entry if created
      const relatedJes = allJournalEntries.filter((je: any) =>
        je.reference_id === settlementNumber ||
        je.reference_number === settlementNumber ||
        (je.reference_type === 'customer_settlement_forex' && (je.description?.includes(settlementNumber) || je.reference_id === settlementNumber))
      );
      for (const je of relatedJes) {
        try {
          await dbService.delete('journal_entries', je.id);
        } catch (e) {
          console.error('Error deleting forex JE:', e);
        }
      }

      showNotification(t('settlements.delete_success'), 'success');

      // Log activity
      dbService.logActivity(
        user.id,
        user.username,
        user.company_id,
        'حذف تسوية أرصدة عميل',
        `حذف وإلغاء تسوية رقم ${settlementNumber} للعميل: ${customerName}`,
        'customer_settlements'
      );
    } catch (err: any) {
      console.error(err);
      showNotification(t('settlements.delete_error'), 'error');
    }
  };

  return (
    <div className="space-y-2.5 animate-in fade-in duration-500" dir={dir}>
      {/* Title block */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-0.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold tracking-tight text-zinc-800">{t('settlements.customer_title')}</h2>
          <span className="text-[11px] text-zinc-400 hidden md:inline">| {t('settlements.customer_subtitle')}</span>
        </div>
        
        {/* Tab Switcher & Layout Toggle */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ExportButtons
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            onPrint={() => printElement(tableRef.current, 'تسويات العملاء')}
            size="sm"
          />
          {selectedCustomerId && activeTab === 'new' && (
            <button
              onClick={handleToggleLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-all rounded-xl font-bold text-xs shadow-sm"
            >
              <LayoutGrid size={14} className="text-emerald-600" />
              <span>{layoutMode === 'split' ? (language === 'ar' ? 'عرض الجدول الموحد' : 'Unified Grid View') : (language === 'ar' ? 'عرض الجداول المنفصلة' : 'Split Tables View')}</span>
            </button>
          )}

          <div className="flex bg-zinc-100 p-0.5 rounded-xl border border-zinc-200/50 shadow-inner w-fit">
            <button
              onClick={() => {
                setActiveTab('new');
                setEditingSettlementNum(null);
                setSelectedCustomerId('');
                setDebitMovements([]);
                setCreditMovements([]);
              }}
              className={`py-1 px-3.5 rounded-lg transition-all font-bold text-xs ${activeTab === 'new' ? 'bg-white text-emerald-600 shadow-sm border border-zinc-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {t('settlements.new_settlement')}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-1 px-3.5 rounded-lg transition-all font-bold text-xs ${activeTab === 'history' ? 'bg-white text-emerald-600 shadow-sm border border-zinc-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {t('settlements.settlement_history')}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'new' ? (
        <div className="space-y-3">
          {/* Customer Selection Card */}
          <div className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 tracking-tighter mb-1 px-1 uppercase">{t('discounts.column_customer')}</label>
                <SearchableSelect 
                  options={customers.map(c => ({
                    value: c.id,
                    label: c.name,
                    code: c.code,
                    subLabel: c.mobile
                  }))}
                  value={selectedCustomerId}
                  onChange={(val) => setSelectedCustomerId(val)}
                  placeholder={t('settlements.select_customer')}
                  searchPlaceholder={language === 'ar' ? 'بحث باسم العميل أو الكود...' : 'Search customer by name or code...'}
                  emptyText={language === 'ar' ? 'لا يوجد عميل يطابق البحث' : 'No customer matches search'}
                  icon={<User size={15} />}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 tracking-tighter mb-1 px-1 uppercase">{t('settlements.date')}</label>
                <div className="relative group">
                  <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-zinc-400 pointer-events-none`} />
                  <input 
                    required
                    type="date" 
                    className={`w-full ${dir === 'rtl' ? 'ps-3 pe-9' : 'pe-3 ps-9'} py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-xs`}
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 tracking-tighter mb-1 px-1 uppercase">{t('settlements.auto_number')}</label>
                <div className="relative group">
                  <input 
                    readOnly
                    type="text" 
                    className="w-full px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-xl font-bold text-emerald-600 text-xs outline-none cursor-default font-mono"
                    value={selectedCustomerId ? (editingSettlementNum || autoSettlementNumber) : '-'}
                  />
                </div>
              </div>

              {selectedCustomerId && (
                <div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center justify-center gap-1.5 w-full py-1.5 border rounded-xl font-bold text-xs transition-all shadow-xs ${showFilters ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
                  >
                    <SlidersHorizontal size={14} />
                    <span>{language === 'ar' ? 'تصفية وبحث متقدم' : 'Advanced Filters & Search'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Advanced Filters Panel */}
            <AnimatePresence>
              {showFilters && selectedCustomerId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Bulk numbers search */}
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase">{language === "ar" ? "البحث المتعدد" : "Multi Search"}</label>
                        <select
                          className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border-0 rounded-lg outline-none py-0.5 px-2 cursor-pointer"
                          value={filterSearchType}
                          onChange={(e) => setFilterSearchType(e.target.value)}
                        >
                          <option value="number">{language === "ar" ? "رقم المستند" : "Doc Number"}</option>
                          <option value="foreign_amount">{language === "ar" ? "المبلغ بالعملة الأجنبية" : "Foreign Currency Amount"}</option>
                          <option value="currency">{language === "ar" ? "رمز العملة (USD / EUR ...)" : "Currency Code (USD / EUR ...)"}</option>
                          <option value="je_number">{language === "ar" ? "رقم القيد" : "JE Number"}</option>
                          <option value="date">{language === "ar" ? "التاريخ (YYYY-MM-DD)" : "Date (YYYY-MM-DD)"}</option>
                          <option value="original_amount">{language === "ar" ? "المبلغ الأصلي" : "Original Amount"}</option>
                          <option value="open_amount">{language === "ar" ? "المبلغ المتبقي" : "Remaining Amount"}</option>
                          <option value="notes">{language === "ar" ? "ملاحظات / وصف" : "Notes / Description"}</option>
                        </select>
                      </div>
                      <textarea
                        rows={3}
                        className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-mono"
                        placeholder={
                          filterSearchType === 'number' ? 'INV-2026-06-000005\nINV-2026-06-000003' :
                          filterSearchType === 'foreign_amount' ? '34400.00\n812.92' :
                          filterSearchType === 'currency' ? 'USD\nEUR\nSAR' :
                          filterSearchType === 'je_number' ? 'JV-2026-0001\nJV-2026-0002' :
                          filterSearchType === 'date' ? '2026-06-01\n2026-06-05' :
                          filterSearchType === 'original_amount' ? '1500\n3400.50' :
                          filterSearchType === 'open_amount' ? '500\n1000' : (language === 'ar' ? 'وصف أو ملاحظة القيد' : 'JE notes or description')
                        }
                        value={filterDocNumbers}
                        onChange={(e) => setFilterDocNumbers(e.target.value)}
                      />
                    </div>

                    {/* Date range search */}
                    <div className="space-y-4">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase">{language === "ar" ? "البحث بنطاق تاريخى" : "Search by Date Range"}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 mb-1">{language === "ar" ? "من تاريخ" : "From Date"}</label>
                          <input
                            type="date"
                            className="w-full p-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                            value={filterFromDate}
                            onChange={(e) => setFilterFromDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 mb-1">{language === "ar" ? "إلى تاريخ" : "To Date"}</label>
                          <input
                            type="date"
                            className="w-full p-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                            value={filterToDate}
                            onChange={(e) => setFilterToDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Filter by Type */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-2 px-1 uppercase">{language === "ar" ? "تصفية حسب نوع المستند" : "Filter by Doc Type"}</label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { key: 'invoices', label: language === 'ar' ? 'فواتير مبيعات' : 'Sales Invoices' },
                          { key: 'receipts', label: language === 'ar' ? 'سندات قبض' : 'Receipt Vouchers' },
                          { key: 'returns', label: language === 'ar' ? 'مرتجعات' : 'Returns' },
                          { key: 'journal_entries', label: language === 'ar' ? 'قيود يومية' : 'Journal Entries' },
                          { key: 'discounts', label: language === 'ar' ? 'الخصومات' : 'Discounts' }
                        ].map(type => (
                          <label key={type.key} className="flex items-center gap-2 p-2 bg-zinc-50 hover:bg-zinc-100 rounded-xl cursor-pointer select-none border border-transparent hover:border-zinc-200/50">
                            <input
                              type="checkbox"
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-4.5 h-4.5"
                              checked={filterTypes.includes(type.key)}
                              onChange={() => handleToggleTypeFilter(type.key)}
                            />
                            <span className="font-semibold text-zinc-700">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Filter by Currency */}
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase">{language === "ar" ? "تصفية حسب العملة" : "Filter by Currency"}</label>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {filterCurrencies.length === 0 ? (language === 'ar' ? 'الكل' : 'All') : `${filterCurrencies.length} ${language === 'ar' ? 'محددة' : 'selected'}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="flex items-center gap-2 p-2 bg-zinc-50 hover:bg-zinc-100 rounded-xl cursor-pointer select-none border border-transparent hover:border-zinc-200/50">
                          <input
                            type="checkbox"
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4.5 h-4.5"
                            checked={filterCurrencies.length === 0}
                            onChange={() => setFilterCurrencies([])}
                          />
                          <span className={`font-semibold ${filterCurrencies.length === 0 ? 'text-emerald-700 font-bold' : 'text-zinc-700'}`}>{language === 'ar' ? 'الكل' : 'All'}</span>
                        </label>
                        {availableCurrencies.map(curr => (
                          <label key={curr} className="flex items-center gap-2 p-2 bg-zinc-50 hover:bg-zinc-100 rounded-xl cursor-pointer select-none border border-transparent hover:border-zinc-200/50">
                            <input
                              type="checkbox"
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-4.5 h-4.5"
                              checked={filterCurrencies.includes(curr)}
                              onChange={() => handleToggleCurrencyFilter(curr)}
                            />
                            <span className={`font-semibold ${filterCurrencies.includes(curr) ? 'text-emerald-700 font-bold' : 'text-zinc-700'}`}>{curr}</span>
                          </label>
                        ))}
                      </div>

                      {/* Clear filters button */}
                      <button
                        onClick={() => {
                          setFilterDocNumbers('');
                          setFilterSearchType('number');
                          setFilterFromDate('');
                          setFilterToDate('');
                          setFilterTypes([]);
                          setFilterCurrencies([]);
                          setSearchTerm('');
                        }}
                        className="mt-4 text-[10px] font-bold text-red-500 hover:text-red-600 underline text-right block ml-auto"
                      >
                        {language === 'ar' ? 'إعادة تعيين كافة المرشحات' : 'Reset All Filters'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {selectedCustomerId ? (
            <div className="space-y-4">
              {/* Realized Forex Difference Info Card if active */}
              {forexCalculation.hasForex && (
                <div className="p-2.5 px-3 rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50/90 via-orange-50/50 to-amber-50/90 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${forexCalculation.isGain ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                      💱
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-zinc-800 text-[11px]">
                          {language === 'ar' ? 'فروق تقييم العملة المحققة:' : 'Realized Forex Difference:'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-black text-xs font-mono ${forexCalculation.isGain ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {forexCalculation.isGain ? '+' : ''}{formatMoney(forexCalculation.netGainLoss)} {t('common.currency')}
                          <span className="ms-1 text-[10px] font-semibold">
                            ({forexCalculation.isGain ? (language === 'ar' ? 'أرباح فروق عملة' : 'Gain') : (language === 'ar' ? 'خسائر فروق عملة' : 'Loss')})
                          </span>
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                        {language === 'ar' 
                          ? `احتساب فرق العملة على ${formatNumber(forexCalculation.matchedForeignAmount)} ${forexCalculation.currency} متطابقة، وباقي المبلغ يستخدم في التسوية فقط.`
                          : `Forex calculated on ${formatNumber(forexCalculation.matchedForeignAmount)} ${forexCalculation.currency} matched, remaining amount used for settlement only.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <div className="bg-white/80 border border-amber-200/80 px-2.5 py-1 rounded-xl shadow-2xs">
                      <span className="text-[10px] text-zinc-400 font-bold block">{language === 'ar' ? 'الحساب الافتراضي المتأثر:' : 'Default Affected Account:'}</span>
                      <span className="font-bold text-zinc-700 font-mono text-xs">
                        {forexCalculation.account ? `${forexCalculation.account.code} - ${forexCalculation.account.name}` : (forexCalculation.isGain ? '420201 - أرباح فروق عملة محققة' : '630201 - خسائر فروق عملة محققة')}
                      </span>
                    </div>

                    <div className="bg-white/80 border border-amber-200/80 px-2.5 py-1 rounded-xl shadow-2xs">
                      <span className="text-[10px] text-zinc-400 font-bold block">{language === 'ar' ? 'رقم قيد اليومية التلقائي:' : 'Auto Journal Entry No.:'}</span>
                      <span className="font-bold text-emerald-700 font-mono text-xs">
                        {previewJeNumber || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {layoutMode === 'split' ? (
                /* 1. COMPACT SPLIT TABLE LAYOUT */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Debit Side Column */}
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col min-h-[350px]">
                    <div className="p-2.5 px-3 bg-red-50/60 border-b border-red-100 flex items-center justify-between">
                      <span className="font-bold text-red-700 text-xs flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        {language === 'ar' ? 'الجانب المدين (المستندات المطلوبة)' : 'Debit Side (Required Documents)'}
                      </span>
                      <span className="bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {language === 'ar' ? 'إجمالي المسوى:' : 'Total Settled:'} {formatMoney(totalSettledDebit)} {t('common.currency')}
                      </span>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs border border-zinc-200">
                        <thead>
                          <tr className="bg-zinc-100 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-1 px-1.5 border border-zinc-200 w-12 text-center">
                              <input 
                                type="checkbox" 
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                checked={isAllDebitSelected}
                                onChange={(e) => handleSelectAllDebits(e.target.checked)}
                              />
                            </th>
                            <th className="p-1 px-1.5 border border-zinc-200">{language === 'ar' ? 'نوع الحركة' : 'Doc Type'}</th>
                            <th className="p-1 px-1.5 border border-zinc-200">{language === 'ar' ? 'رقم المستند' : 'Doc No.'}</th>
                            <th className="p-1 px-1.5 border border-zinc-200">{t('settlements.movement_date')}</th>
                            {hasForeignMovements && (
                              <>
                                <th className="p-1 px-1.5 border border-zinc-200 text-right bg-amber-50/40 text-amber-900">{language === 'ar' ? 'المتبقي (أجنبي)' : 'Open (FX)'}</th>
                                <th className="p-1 px-1.5 border border-zinc-200 text-center">{language === 'ar' ? 'العملة' : 'Curr'}</th>
                                <th className="p-1 px-1.5 border border-zinc-200 text-right">{language === 'ar' ? 'سعر الصرف' : 'Rate'}</th>
                                <th className="p-1 px-1.5 border border-zinc-200 w-24 text-right bg-amber-50/60 text-amber-900">{language === 'ar' ? 'المسوى (أجنبي)' : 'Settle (FX)'}</th>
                              </>
                            )}
                            <th className="p-1 px-1.5 border border-zinc-200 text-right">{t('settlements.movement_amount')}</th>
                            <th className="p-1 px-1.5 border border-zinc-200 text-right">{t('settlements.movement_remaining')}</th>
                            <th className="p-1 px-1.5 border border-zinc-200 w-24 text-right bg-red-50/30 text-red-900">{t('settlements.movement_settle_amount')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {processedDebitMovements.length === 0 ? (
                            <tr>
                              <td colSpan={hasForeignMovements ? 11 : 7} className="p-6 text-center text-zinc-400 italic text-xs">{language === 'ar' ? 'لا توجد حركات مدينة تطابق البحث' : 'No debit movements match search'}</td>
                            </tr>
                          ) : (
                            processedDebitMovements.map(m => (
                              <tr key={m.id} className={`hover:bg-zinc-50 transition-colors ${m.selected ? 'bg-emerald-50/15' : ''}`}>
                                <td className="p-0.5 text-center border border-zinc-200">
                                  <input 
                                    type="checkbox" 
                                    className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                    checked={m.selected}
                                    onChange={(e) => handleToggleDebit(m.id, e.target.checked)}
                                  />
                                </td>
                                <td className="p-0.5 px-1.5 border border-zinc-200 font-semibold text-zinc-600 text-[11px]">{getDocTypeLabel(m.page_name, true, m.type_label)}</td>
                                <td className="p-0.5 px-1.5 border border-zinc-200 font-bold text-[11px]">
                                  <button
                                    onClick={() => navigateToDoc(m.page_name, m.original_id)}
                                    className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 focus:outline-none"
                                  >
                                    <span>{m.number}</span>
                                    <ExternalLink size={9} className="opacity-40" />
                                  </button>
                                </td>
                                <td className="p-0.5 px-1.5 border border-zinc-200 text-zinc-500 text-[11px]">{formatDate(m.date)}</td>
                                {hasForeignMovements && (
                                  <>
                                    <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-mono font-bold text-[11px] text-amber-900 bg-amber-50/20">
                                      {m.currency && m.currency !== systemCurrency ? formatNumber(m.foreign_open_amount !== undefined ? m.foreign_open_amount : Math.abs(m.foreign_amount || 0)) : '-'}
                                    </td>
                                    <td className="p-0.5 px-1 border border-zinc-200 text-center">
                                      <span className={`px-1 py-0.2 rounded text-[9px] font-bold font-mono ${m.currency && m.currency !== systemCurrency ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-zinc-100 text-zinc-600'}`}>
                                        {m.currency || systemCurrency}
                                      </span>
                                    </td>
                                    <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-mono text-zinc-600 text-[11px]">
                                      {m.currency && m.currency !== systemCurrency && m.exchange_rate && m.exchange_rate !== 1 ? formatNumber(m.exchange_rate) : '-'}
                                    </td>
                                    <td className="p-0.5 px-1 border border-zinc-200 text-right bg-amber-50/40">
                                      {m.currency && m.currency !== systemCurrency ? (
                                        <input 
                                          type="number"
                                          step="any"
                                          className="h-6 px-1.5 py-0 bg-white border border-amber-300 rounded text-right font-black text-amber-900 focus:ring-1 focus:ring-amber-500 outline-none text-[11px] w-full"
                                          value={m.foreign_settled_amount || ''}
                                          placeholder="0.00"
                                          onChange={(e) => handleDebitForeignAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                        />
                                      ) : '-'}
                                    </td>
                                  </>
                                )}
                                <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-semibold text-zinc-500 text-[11px]">{formatNumber(m.original_amount)}</td>
                                <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-bold text-zinc-800 text-[11px]">{formatNumber(m.open_amount)}</td>
                                <td className="p-0.5 px-1 border border-zinc-200 text-right bg-red-50/30">
                                  <input 
                                    type="number"
                                    step="any"
                                    className="h-6 px-1.5 py-0 bg-white border border-red-200 rounded text-right font-black text-red-700 focus:ring-1 focus:ring-red-500 outline-none text-[11px] w-full"
                                    value={m.settled_amount || ''}
                                    placeholder="0.00"
                                    onChange={(e) => handleDebitAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Credit Side Column */}
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col min-h-[350px]">
                    <div className="p-2.5 px-3 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
                      <span className="font-bold text-emerald-700 text-xs flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {language === 'ar' ? 'الجانب الدائن (دفعات / مرتجعات / إعفاءات)' : 'Credit Side (Payments / Returns / Allowances)'}
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {language === 'ar' ? 'إجمالي المسوى:' : 'Total Settled:'} {formatMoney(totalSettledCredit)} {t('common.currency')}
                      </span>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs border border-zinc-200">
                        <thead>
                          <tr className="bg-zinc-100 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-1 px-1.5 border border-zinc-200 w-12 text-center">
                              <input 
                                type="checkbox" 
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                checked={isAllCreditSelected}
                                onChange={(e) => handleSelectAllCredits(e.target.checked)}
                              />
                            </th>
                            <th className="p-1 px-1.5 border border-zinc-200">{language === 'ar' ? 'نوع الحركة' : 'Doc Type'}</th>
                            <th className="p-1 px-1.5 border border-zinc-200">{language === 'ar' ? 'رقم المستند' : 'Doc No.'}</th>
                            <th className="p-1 px-1.5 border border-zinc-200">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                            {hasForeignMovements && (
                              <>
                                <th className="p-1 px-1.5 border border-zinc-200 text-right bg-amber-50/40 text-amber-900">{language === 'ar' ? 'المتبقي (أجنبي)' : 'Open (FX)'}</th>
                                <th className="p-1 px-1.5 border border-zinc-200 text-center">{language === 'ar' ? 'العملة' : 'Curr'}</th>
                                <th className="p-1 px-1.5 border border-zinc-200 text-right">{language === 'ar' ? 'سعر الصرف' : 'Rate'}</th>
                                <th className="p-1 px-1.5 border border-zinc-200 w-24 text-right bg-amber-50/60 text-amber-900">{language === 'ar' ? 'المسوى (أجنبي)' : 'Settle (FX)'}</th>
                              </>
                            )}
                            <th className="p-1 px-1.5 border border-zinc-200 text-right">{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                            <th className="p-1 px-1.5 border border-zinc-200 text-right">{language === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                            <th className="p-1 px-1.5 border border-zinc-200 w-24 text-right bg-emerald-50/30 text-emerald-900">{language === 'ar' ? 'المسوى' : 'Settled'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {processedCreditMovements.length === 0 ? (
                            <tr>
                              <td colSpan={hasForeignMovements ? 11 : 7} className="p-6 text-center text-zinc-400 italic text-xs">{language === 'ar' ? 'لا توجد حركات دائنة تطابق البحث' : 'No credit movements match search'}</td>
                            </tr>
                          ) : (
                            processedCreditMovements.map(m => (
                              <tr key={m.id} className={`hover:bg-zinc-50 transition-colors ${m.selected ? 'bg-emerald-50/15' : ''}`}>
                                <td className="p-0.5 text-center border border-zinc-200">
                                  <input 
                                    type="checkbox" 
                                    className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                    checked={m.selected}
                                    onChange={(e) => handleToggleCredit(m.id, e.target.checked)}
                                  />
                                </td>
                                <td className="p-0.5 px-1.5 border border-zinc-200 font-semibold text-zinc-600 text-[11px]">{getDocTypeLabel(m.page_name, false, m.type_label)}</td>
                                <td className="p-0.5 px-1.5 border border-zinc-200 font-bold text-[11px]">
                                  <button
                                    onClick={() => navigateToDoc(m.page_name, m.original_id)}
                                    className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 focus:outline-none"
                                  >
                                    <span>{m.number}</span>
                                    <ExternalLink size={9} className="opacity-40" />
                                  </button>
                                </td>
                                <td className="p-0.5 px-1.5 border border-zinc-200 text-zinc-500 text-[11px]">{formatDate(m.date)}</td>
                                {hasForeignMovements && (
                                  <>
                                    <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-mono font-bold text-[11px] text-amber-900 bg-amber-50/20">
                                      {m.currency && m.currency !== systemCurrency ? formatNumber(m.foreign_open_amount !== undefined ? m.foreign_open_amount : Math.abs(m.foreign_amount || 0)) : '-'}
                                    </td>
                                    <td className="p-0.5 px-1 border border-zinc-200 text-center">
                                      <span className={`px-1 py-0.2 rounded text-[9px] font-bold font-mono ${m.currency && m.currency !== systemCurrency ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-zinc-100 text-zinc-600'}`}>
                                        {m.currency || systemCurrency}
                                      </span>
                                    </td>
                                    <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-mono text-zinc-600 text-[11px]">
                                      {m.currency && m.currency !== systemCurrency && m.exchange_rate && m.exchange_rate !== 1 ? formatNumber(m.exchange_rate) : '-'}
                                    </td>
                                    <td className="p-0.5 px-1 border border-zinc-200 text-right bg-amber-50/40">
                                      {m.currency && m.currency !== systemCurrency ? (
                                        <input 
                                          type="number"
                                          step="any"
                                          className="h-6 px-1.5 py-0 bg-white border border-amber-300 rounded text-right font-black text-amber-900 focus:ring-1 focus:ring-amber-500 outline-none text-[11px] w-full"
                                          value={m.foreign_settled_amount || ''}
                                          placeholder="0.00"
                                          onChange={(e) => handleCreditForeignAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                        />
                                      ) : '-'}
                                    </td>
                                  </>
                                )}
                                <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-semibold text-zinc-500 text-[11px]">{formatNumber(m.original_amount)}</td>
                                <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-bold text-zinc-800 text-[11px]">{formatNumber(m.open_amount)}</td>
                                <td className="p-0.5 px-1 border border-zinc-200 text-right bg-emerald-50/30">
                                  <input 
                                    type="number"
                                    step="any"
                                    className="h-6 px-1.5 py-0 bg-white border border-emerald-200 rounded text-right font-black text-emerald-700 focus:ring-1 focus:ring-emerald-500 outline-none text-[11px] w-full"
                                    value={m.settled_amount || ''}
                                    placeholder="0.00"
                                    onChange={(e) => handleCreditAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* 2. COMPACT UNIFIED SINGLE TABLE LAYOUT (Excel Grid) */
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col min-h-[350px]">
                  <div className="p-2 px-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                    <span className="font-bold text-zinc-700 text-xs flex items-center gap-1.5">
                      <SlidersHorizontal size={14} className="text-emerald-600" />
                      {language === 'ar' ? 'عرض الجدول الموحد المحاسبي (Excel Grid)' : 'Show Accounting Unified Grid (Excel Grid)'}
                    </span>
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100 font-bold">
                        {language === 'ar' ? 'مدين:' : 'Debit:'} {formatMoney(totalSettledDebit)}
                      </span>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 font-bold">
                        {language === 'ar' ? 'دائن:' : 'Credit:'} {formatMoney(totalSettledCredit)}
                      </span>
                      {forexCalculation.hasForex && (
                        <span className={`px-2 py-0.5 rounded border font-bold ${forexCalculation.isGain ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {language === 'ar' ? 'فرق العملة:' : 'Forex:'} {formatMoney(forexCalculation.netGainLoss)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs border border-zinc-200">
                      <thead>
                        <tr className="bg-zinc-100 text-zinc-600 font-bold text-[10px] uppercase">
                          <th className="p-1 px-1.5 border border-zinc-200 w-12 text-center" rowSpan={2}>
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <input 
                                type="checkbox" 
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                checked={isAllUnifiedSelected}
                                onChange={(e) => handleSelectAllUnified(e.target.checked)}
                              />
                              <span className="text-[9px]">{language === 'ar' ? 'الكل' : 'All'}</span>
                            </div>
                          </th>
                          <th className="p-1 px-1.5 border border-zinc-200 w-20" rowSpan={2}>{t('settlements.movement_date')}</th>
                          <th className="p-1 px-1.5 border border-zinc-200 w-24" rowSpan={2}>{language === 'ar' ? 'نوع الحركة' : 'Doc Type'}</th>
                          <th className="p-1 px-1.5 border border-zinc-200 w-28" rowSpan={2}>{language === 'ar' ? 'رقم المستند' : 'Doc No.'}</th>
                          <th className="p-1 px-1 border border-zinc-200 text-center w-12" rowSpan={2}>{language === 'ar' ? 'العملة' : 'Curr'}</th>
                          <th className="p-1 px-1.5 border border-zinc-200 text-right w-16" rowSpan={2}>{language === 'ar' ? 'سعر الصرف' : 'Rate'}</th>
                          
                          {hasForeignMovements && (
                            <th className="p-1 border border-zinc-200 text-center bg-amber-50/70 text-amber-900 font-bold" colSpan={3}>
                              {language === 'ar' ? 'حركات العملة الأجنبية' : 'Foreign Movements'}
                            </th>
                          )}
                          <th className="p-1 border border-zinc-200 text-center bg-red-50/50 text-red-700 font-bold" colSpan={2}>
                            {language === 'ar' ? 'الحركات المدينة (عملة النظام)' : 'Debit Movements (Debit)'}
                          </th>
                          <th className="p-1 border border-zinc-200 text-center bg-emerald-50/50 text-emerald-700 font-bold" colSpan={2}>
                            {language === 'ar' ? 'الحركات الدائنة (عملة النظام)' : 'Credit Movements (Credit)'}
                          </th>
                        </tr>
                        <tr className="bg-zinc-100 text-zinc-500 text-[9px] uppercase">
                          {hasForeignMovements && (
                            <>
                              <th className="p-1 border border-zinc-200 text-right w-20 bg-amber-50/30 text-amber-900">{language === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                              <th className="p-1 border border-zinc-200 text-right w-24 bg-amber-50/50 text-amber-900 font-bold">{language === 'ar' ? 'مدين (أجنبي)' : 'Debit (FX)'}</th>
                              <th className="p-1 border border-zinc-200 text-right w-24 bg-amber-50/50 text-amber-900 font-bold">{language === 'ar' ? 'دائن (أجنبي)' : 'Credit (FX)'}</th>
                            </>
                          )}
                          <th className="p-1 border border-zinc-200 text-right w-20 bg-red-50/30 text-red-900">{language === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                          <th className="p-1 border border-zinc-200 text-right w-24 bg-red-50/40 text-red-900 font-bold">{language === 'ar' ? 'المسوى' : 'Settled'}</th>
                          <th className="p-1 border border-zinc-200 text-right w-20 bg-emerald-50/30 text-emerald-900">{language === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                          <th className="p-1 border border-zinc-200 text-right w-24 bg-emerald-50/40 text-emerald-900 font-bold">{language === 'ar' ? 'المسوى' : 'Settled'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {unifiedMovements.length === 0 ? (
                          <tr>
                            <td colSpan={hasForeignMovements ? 13 : 10} className="p-6 text-center text-zinc-400 italic text-xs">
                              {language === 'ar' ? 'لا توجد حركات تطابق خيارات التصفية والبحث' : 'No movements match selected search filters'}
                            </td>
                          </tr>
                        ) : (
                          unifiedMovements.map(m => (
                            <tr key={m.id} className={`hover:bg-zinc-50 transition-colors ${m.selected ? 'bg-emerald-50/15' : ''}`}>
                              <td className="p-0.5 text-center border border-zinc-200">
                                <input 
                                  type="checkbox" 
                                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                  checked={m.selected}
                                  onChange={(e) => {
                                    if (m.isDebit) {
                                      handleToggleDebit(m.id, e.target.checked);
                                    } else {
                                      handleToggleCredit(m.id, e.target.checked);
                                    }
                                  }}
                                />
                              </td>
                              <td className="p-0.5 px-1.5 border border-zinc-200 text-zinc-500 font-semibold text-[11px]">{formatDate(m.date)}</td>
                              <td className="p-0.5 px-1.5 border border-zinc-200 text-zinc-600 font-bold text-[11px]">{getDocTypeLabel(m.page_name, m.isDebit, m.type_label)}</td>
                              <td className="p-0.5 px-1.5 border border-zinc-200 font-bold text-[11px]">
                                <button
                                  onClick={() => navigateToDoc(m.page_name, m.original_id)}
                                  className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 focus:outline-none"
                                >
                                  <span>{m.number}</span>
                                  <ExternalLink size={9} className="opacity-40" />
                                </button>
                              </td>
                              <td className="p-0.5 px-1 border border-zinc-200 text-center">
                                <span className={`px-1 py-0.2 rounded text-[9px] font-bold font-mono ${m.currency && m.currency !== systemCurrency ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-zinc-100 text-zinc-600'}`}>
                                  {m.currency || systemCurrency}
                                </span>
                              </td>
                              <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-mono text-zinc-600 text-[11px]">
                                {m.currency && m.currency !== systemCurrency && m.exchange_rate && m.exchange_rate !== 1
                                  ? formatNumber(m.exchange_rate)
                                  : '-'}
                              </td>

                              {/* Foreign Currency Columns */}
                              {hasForeignMovements && (
                                <>
                                  <td className="p-0.5 px-1.5 border border-zinc-200 text-right font-mono font-bold text-[11px] bg-amber-50/20 text-amber-900">
                                    {m.currency && m.currency !== systemCurrency ? (
                                      <span dir="ltr" className="inline-block font-mono">
                                        {formatNumber(m.foreign_open_amount !== undefined ? m.foreign_open_amount : Math.abs(m.foreign_amount || 0))}
                                      </span>
                                    ) : (
                                      <span className="text-zinc-300 font-mono">-</span>
                                    )}
                                  </td>
                                  <td className="p-0.5 px-1 border border-zinc-200 text-right bg-amber-50/30">
                                    {m.isDebit && m.currency && m.currency !== systemCurrency ? (
                                      <input 
                                        type="number"
                                        step="any"
                                        className="h-6 px-1.5 py-0 bg-white border border-amber-300 rounded text-right font-black text-amber-900 focus:ring-1 focus:ring-amber-500 outline-none text-[11px] w-full"
                                        value={m.foreign_settled_amount || ''}
                                        placeholder="0.00"
                                        onChange={(e) => handleDebitForeignAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                      />
                                    ) : (
                                      <span className="text-zinc-300 font-mono text-center block">-</span>
                                    )}
                                  </td>
                                  <td className="p-0.5 px-1 border border-zinc-200 text-right bg-amber-50/30">
                                    {!m.isDebit && m.currency && m.currency !== systemCurrency ? (
                                      <input 
                                        type="number"
                                        step="any"
                                        className="h-6 px-1.5 py-0 bg-white border border-amber-300 rounded text-right font-black text-amber-900 focus:ring-1 focus:ring-amber-500 outline-none text-[11px] w-full"
                                        value={m.foreign_settled_amount || ''}
                                        placeholder="0.00"
                                        onChange={(e) => handleCreditForeignAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                      />
                                    ) : (
                                      <span className="text-zinc-300 font-mono text-center block">-</span>
                                    )}
                                  </td>
                                </>
                              )}
                              
                              {/* Debit columns (system currency) */}
                              <td className="p-0.5 px-1.5 border border-zinc-200 text-right bg-red-50/5 text-red-600 font-semibold text-[11px]">
                                {m.isDebit ? formatNumber(m.open_amount) : '-'}
                              </td>
                              <td className="p-0.5 px-1 border border-zinc-200 text-right bg-red-50/15">
                                {m.isDebit ? (
                                  <input 
                                    type="number"
                                    step="any"
                                    className="h-6 px-1.5 py-0 bg-white border border-red-200 rounded text-right font-black text-red-700 focus:ring-1 focus:ring-red-500 outline-none text-[11px] w-full"
                                    value={m.settled_amount || ''}
                                    placeholder="0.00"
                                    onChange={(e) => handleDebitAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                  />
                                ) : '-'}
                              </td>

                              {/* Credit columns (system currency) */}
                              <td className="p-0.5 px-1.5 border border-zinc-200 text-right bg-emerald-50/5 text-emerald-600 font-semibold text-[11px]">
                                {!m.isDebit ? formatNumber(m.open_amount) : '-'}
                              </td>
                              <td className="p-0.5 px-1 border border-zinc-200 text-right bg-emerald-50/15">
                                {!m.isDebit ? (
                                  <input 
                                    type="number"
                                    step="any"
                                    className="h-6 px-1.5 py-0 bg-white border border-emerald-200 rounded text-right font-black text-emerald-700 focus:ring-1 focus:ring-emerald-500 outline-none text-[11px] w-full"
                                    value={m.settled_amount || ''}
                                    placeholder="0.00"
                                    onChange={(e) => handleCreditAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                  />
                                ) : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}xs"
                                    value={m.settled_amount || ''}
                                    placeholder="0.00"
                                    onChange={(e) => handleDebitAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                  />
                                ) : '-'}
                              </td>

                              {/* Credit columns */}
                              <td className="p-1 px-2 border border-zinc-200 text-right bg-emerald-50/5 text-emerald-600 font-semibold">
                                {!m.isDebit ? formatNumber(m.open_amount) : '-'}
                              </td>
                              <td className="p-0.5 border border-zinc-200 text-right bg-emerald-50/5">
                                {!m.isDebit ? (
                                  <input 
                                    type="number"
                                    step="any"
                                    className="w-full px-2 py-1 bg-transparent border-0 text-right font-black text-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none text-xs"
                                    value={m.settled_amount || ''}
                                    placeholder="0.00"
                                    onChange={(e) => handleCreditAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                  />
                                ) : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              <div className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm">
                <AttachmentsManager
                  attachments={attachments}
                  onChange={setAttachments}
                />
              </div>

              {/* Summary Bottom Actions Card */}
              <div className="bg-slate-900 p-3.5 rounded-2xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                <div className="flex flex-wrap items-center gap-5">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{language === 'ar' ? 'إجمالي المدين المسوى' : 'Total Settled Debit'}</span>
                    <p className="text-base font-bold text-red-400">{formatMoney(totalSettledDebit)} {t('common.currency')}</p>
                  </div>
                  <div className="w-px h-8 bg-zinc-800 hidden md:block" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{language === 'ar' ? 'إجمالي الدائن المسوى' : 'Total Settled Credit'}</span>
                    <p className="text-base font-bold text-emerald-400">{formatMoney(totalSettledCredit)} {t('common.currency')}</p>
                  </div>
                  <div className="w-px h-8 bg-zinc-800 hidden md:block" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{language === 'ar' ? 'الفرق' : 'Difference'}</span>
                    <p className={`text-base font-bold ${difference === 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {formatMoney(difference)} {t('common.currency')}
                    </p>
                  </div>
                </div>

                <div>
                  <button
                    onClick={handleSaveSettlement}
                    disabled={difference > 0.01 || totalSettledDebit === 0}
                    className="w-full md:w-auto px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Check size={16} />
                    {language === 'ar' ? 'تثبيت وحفظ التسوية' : 'Commit & Save Settlement'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-400 shadow-sm flex flex-col items-center gap-3">
              <Info size={36} className="text-zinc-300" />
              <p className="font-bold text-xs">{t('settlements.prompt_select_customer')}</p>
            </div>
          )}
        </div>
      ) : (
        /* Settlement History Tab */
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-2 sm:p-2.5 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-2.5 top-2 text-zinc-400" size={14} />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'البحث برقم التسوية أو العميل...' : 'Search by settlement number or customer...'}
                  className="w-full pl-8 pr-3 py-1 bg-zinc-50 border border-zinc-200/80 rounded-lg focus:ring-1 focus:ring-emerald-500 transition-all text-xs font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div ref={tableRef} className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-zinc-50/80 text-zinc-500 text-[11px] font-bold uppercase tracking-wider border-b border-zinc-200">
                    <th className="px-2.5 py-1.5 whitespace-nowrap">{t('settlements.history_number')}</th>
                    <th className="px-2.5 py-1.5 whitespace-nowrap">{t('settlements.movement_date')}</th>
                    <th className="px-2.5 py-1.5 whitespace-nowrap">{t('discounts.column_customer')}</th>
                    <th className="px-2.5 py-1.5 whitespace-nowrap text-left">{t('settlements.history_amount')}</th>
                    <th className="px-2.5 py-1.5 whitespace-nowrap text-left">{t('settlements.history_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {historyList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-zinc-400 italic text-xs">{t('settlements.history_no_data')}</td>
                    </tr>
                  ) : (
                    historyList.map(h => (
                      <tr key={h.settlement_number} className="hover:bg-zinc-50/60 transition-colors group">
                        <td className="px-2.5 py-1 whitespace-nowrap font-mono font-bold text-xs">
                          <span
                            onClick={() => handleSettlementNumberClick(h)}
                            className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer transition-colors"
                          >
                            {h.settlement_number}
                          </span>
                        </td>
                        <td className="px-2.5 py-1 whitespace-nowrap text-zinc-500 font-medium text-xs">{formatDate(h.date)}</td>
                        <td className="px-2.5 py-1 whitespace-nowrap font-semibold text-zinc-700 text-xs">{h.entity_name}</td>
                        <td className="px-2.5 py-1 whitespace-nowrap text-left font-bold text-emerald-600 text-xs">{formatMoney(h.total_amount)} {t('common.currency')}</td>
                        <td className="px-2.5 py-1 whitespace-nowrap text-left">
                          <div className="flex items-center justify-end gap-1.5 transition-all">
                            <button
                              onClick={() => setSelectedHistory(h)}
                              className="px-2 py-0.5 text-[11px] font-bold bg-zinc-100 text-zinc-700 rounded-md hover:bg-zinc-200 transition-all"
                            >
                              {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                            </button>
                            <button
                              onClick={() => handleExportSettlementExcel(h)}
                              className="px-2 py-0.5 text-[11px] font-bold bg-white text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-all flex items-center gap-1 shadow-sm"
                            >
                              <Download size={11} />
                              {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
                            </button>
                            <button
                              onClick={() => handleDeleteSettlement(h.settlement_number, h.entity_name)}
                              className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                              title="إلغاء وحذف"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* History Details Modal */}
      <AnimatePresence>
        {selectedHistory && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-200"
            >
              <div className="p-6 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-3">
                    <span>{language === 'ar' ? 'تفاصيل التسوية:' : 'Settlement Details:'} {selectedHistory.settlement_number}</span>
                    <button
                      onClick={() => handleExportSettlementExcel(selectedHistory)}
                      className="px-3 py-1 text-xs font-bold bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Download size={12} />
                      تصدير Excel
                    </button>
                  </h3>
                  <p className="text-xs text-zinc-400 font-bold mt-1">{language === 'ar' ? 'تاريخ التسوية:' : 'Settlement Date:'} {formatDate(selectedHistory.date)} • {language === 'ar' ? 'العميل:' : 'Customer:'} {selectedHistory.entity_name}</p>
                </div>
                <button
                  onClick={() => setSelectedHistory(null)}
                  className="p-2 hover:bg-zinc-200 rounded-full transition-all text-zinc-400 hover:text-zinc-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Debits Linked */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-red-700 text-sm border-b border-zinc-100 pb-2">{language === 'ar' ? 'المستندات المدينة (الخصم من الحساب)' : 'Debit Documents (Account Deductions)'}</h4>
                    <div className="space-y-2">
                      {selectedHistory.debitDocs.map((doc: any, i: number) => (
                        <div key={i} className="p-3 bg-zinc-50 rounded-xl text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-zinc-700">{doc.number}</span>
                              <span className="text-[10px] text-zinc-400 font-semibold mr-2">{doc.type_label}</span>
                            </div>
                            <span className="font-black text-red-500">{formatMoney(doc.amount)} {t('common.currency')}</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-semibold">
                            {language === 'ar' ? 'تاريخ المستند:' : 'Doc Date:'} {formatDate(doc.date)} • {language === 'ar' ? 'رقم القيد:' : 'JE No.:'} <span 
                              onClick={() => {
                                if (doc.je_number && doc.je_number !== '-') {
                                  setPendingViewDoc({ type: 'journal', idOrNumber: doc.je_number });
                                  setCurrentPage('journal_entries');
                                  setSelectedHistory(null);
                                }
                              }}
                              className={doc.je_number && doc.je_number !== '-' ? "text-indigo-600 hover:underline cursor-pointer font-bold" : ""}
                            >
                              {doc.je_number || '-'}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              navigateToDoc(doc.page_name, doc.original_id);
                              setSelectedHistory(null);
                            }}
                            className="w-full mt-1 px-3 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                          >
                            <Edit3 size={12} />
                            {language === 'ar' ? 'انتقال وتعديل' : 'Go to Edit'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Credits Linked */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-emerald-700 text-sm border-b border-zinc-100 pb-2">{language === 'ar' ? 'المستندات الدائنة (الإيداع / السداد)' : 'Credit Documents (Deposits / Payments)'}</h4>
                    <div className="space-y-2">
                      {selectedHistory.creditDocs.map((doc: any, i: number) => (
                        <div key={i} className="p-3 bg-zinc-50 rounded-xl text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-zinc-700">{doc.number}</span>
                              <span className="text-[10px] text-zinc-400 font-semibold mr-2">{doc.type_label}</span>
                            </div>
                            <span className="font-black text-emerald-500">{formatMoney(doc.amount)} {t('common.currency')}</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-semibold">
                            تاريخ المستند: {formatDate(doc.date)} • رقم القيد: <span 
                              onClick={() => {
                                if (doc.je_number && doc.je_number !== '-') {
                                  setPendingViewDoc({ type: 'journal', idOrNumber: doc.je_number });
                                  setCurrentPage('journal_entries');
                                  setSelectedHistory(null);
                                }
                              }}
                              className={doc.je_number && doc.je_number !== '-' ? "text-indigo-600 hover:underline cursor-pointer font-bold" : ""}
                            >
                              {doc.je_number || '-'}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              navigateToDoc(doc.page_name, doc.original_id);
                              setSelectedHistory(null);
                            }}
                            className="w-full mt-1 px-3 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                          >
                            <Edit3 size={12} />
                            انتقال وتعديل
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-2xl flex justify-between items-center font-bold">
                  <span className="text-zinc-400 text-xs">{language === 'ar' ? 'الإجمالي الكلي المسوى' : 'Total Settled Amount'}</span>
                  <span className="text-xl text-emerald-400">{formatMoney(selectedHistory.total_amount)} {t('common.currency')}</span>
                </div>

                {/* Attachments Display */}
                {selectedHistory.attachments && selectedHistory.attachments.length > 0 && (
                  <div className="pt-2">
                    <AttachmentsManager
                      attachments={selectedHistory.attachments}
                      readOnly={true}
                      title={language === 'ar' ? 'المرفقات والمستندات المؤيدة' : 'Supporting Attachments & Documents'}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
