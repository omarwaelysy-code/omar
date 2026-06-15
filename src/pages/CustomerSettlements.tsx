import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Customer, Account } from '../types';
import { Search, Trash2, X, Layers, User, Calendar, RotateCcw, ChevronDown, Check, AlertCircle, Info, ArrowLeftRight, LayoutGrid, SlidersHorizontal, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { useNavigation } from '../contexts/NavigationContext';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';

interface Movement {
  id: string; // unique composite key (e.g. "INV_ID" or "VOU_ID-itemIdx")
  original_id: string; // doc database ID
  date: string;
  type_label: string;
  number: string;
  page_name: string; // 'invoices', 'receipts', 'returns', 'journal_entries'
  original_amount: number;
  open_amount: number;
  settled_amount: number; // user editable
  notes: string;
  je_number?: string;
  selected: boolean;
}

export const CustomerSettlements: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage, setPendingViewDoc } = useNavigation();

  // Database states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [allReturns, setAllReturns] = useState<any[]>([]);
  const [allPurchaseReturns, setAllPurchaseReturns] = useState<any[]>([]);
  const [allJournalEntries, setAllJournalEntries] = useState<any[]>([]);
  const [allPurchaseInvoices, setAllPurchaseInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active states
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState<string>('');

  // UI layout and search states
  const [layoutMode, setLayoutMode] = useState<'split' | 'unified'>('split');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSearchType, setFilterSearchType] = useState<string>('number');
  const [filterDocNumbers, setFilterDocNumbers] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);

  // Movements state
  const [debitMovements, setDebitMovements] = useState<Movement[]>([]);
  const [creditMovements, setCreditMovements] = useState<Movement[]>([]);

  // History Detail modal
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  // Subscribe to all required DB collections
  useEffect(() => {
    if (user) {
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubInvoices = dbService.subscribe<any>('invoices', user.company_id, setAllInvoices);
      const unsubReceipts = dbService.subscribe<any>('receipt_vouchers', user.company_id, setAllReceipts);
      const unsubReturns = dbService.subscribe<any>('returns', user.company_id, setAllReturns);
      const unsubPR = dbService.subscribe<any>('purchase_returns', user.company_id, setAllPurchaseReturns);
      const unsubJEs = dbService.subscribe<any>('journal_entries', user.company_id, setAllJournalEntries);
      const unsubPI = dbService.subscribe<any>('purchase_invoices', user.company_id, setAllPurchaseInvoices);

      setLoading(false);

      return () => {
        unsubCustomers();
        unsubInvoices();
        unsubReceipts();
        unsubReturns();
        unsubPR();
        unsubJEs();
        unsubPI();
      };
    }
  }, [user]);

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
                  type_label: 'سند قبض',
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
          type_label: 'مرتجع مبيعات',
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
              type_label: 'قيد يومية',
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
            type_label: s.type_label || 'تسوية',
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

  // Clickable badge navigation to document details
  const navigateToDoc = (pageName: string, docId: string) => {
    let pageId = pageName;
    let docType = pageName;
    if (pageName === 'receipts' || pageName === 'receipt_vouchers') {
      pageId = 'receipts';
      docType = 'receipt';
    } else if (pageName === 'payment_vouchers') {
      pageId = 'payment_vouchers';
      docType = 'payment_vouchers';
    } else if (pageName === 'journal_entries' || pageName === 'journal') {
      pageId = 'journal_entries';
      docType = 'journal';
    } else if (pageName === 'returns') {
      pageId = 'returns';
      docType = 'returns';
    } else if (pageName === 'invoices') {
      pageId = 'invoices';
      docType = 'invoice';
    }

    setCurrentPage(pageId);
    setPendingViewDoc({ type: docType, idOrNumber: docId });
  };

  // Build list of movements when customer selection changes
  useEffect(() => {
    if (!selectedCustomerId) {
      setDebitMovements([]);
      setCreditMovements([]);
      return;
    }

    // --- DEBIT MOVEMENTS (Sales Invoices & Debit JE Lines) ---
    const debits: Movement[] = [];

    // 1. Sales Invoices
    allInvoices.forEach(inv => {
      if (inv.customer_id === selectedCustomerId && inv.payment_type !== 'cash') {
        const settlements = getInvoiceSettlements(inv);
        const settledAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
        const originalAmount = Number(inv.total_amount) || 0;
        const openAmount = originalAmount - settledAmount;

        if (openAmount > 0.01) {
          debits.push({
            id: inv.id,
            original_id: inv.id,
            date: inv.date,
            type_label: 'فاتورة مبيعات',
            number: inv.invoice_number,
            page_name: 'invoices',
            original_amount: originalAmount,
            open_amount: openAmount,
            settled_amount: 0,
            notes: inv.description || inv.notes || '',
            selected: false
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
        if (matchesEntity && Number(item.debit) > 0 && item.account_id === customer?.account_id) {
          const originalAmount = Number(item.debit) || 0;
          const settled = getSettlementsForTarget(`${je.id}-${idx}`, je.reference_type);
          const openAmount = originalAmount - settled;

          if (openAmount > 0.01) {
            const isDiscount = je.reference_type === 'customer_discount';
            const isOpBal = je.reference_type === 'opening_balance';
            debits.push({
              id: `${je.id}-${idx}`,
              original_id: je.id,
              date: je.date,
              type_label: isOpBal ? 'قيد رصيد أول' : (isDiscount ? 'خصم مسموح به' : 'قيد يومية (مدين)'),
              number: je.entry_number || je.id.slice(0, 8),
              page_name: isDiscount ? 'discounts' : 'journal_entries',
              original_amount: originalAmount,
              open_amount: openAmount,
              settled_amount: 0,
              notes: item.description || je.description || '',
              je_number: je.entry_number || je.id.slice(0, 8),
              selected: false
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
            let totalSettled = 0;
            const countedInvoiceIds = new Set<string>();

            if (item.settlements && Array.isArray(item.settlements)) {
              item.settlements.forEach((s: any) => {
                totalSettled += Number(s.settled_amount || s.amount || 0);
                countedInvoiceIds.add(s.target_id);
              });
            }

            // Gathers invoice-side settlements targeting this voucher item
            allInvoices.forEach(inv => {
              if (inv.settlements && Array.isArray(inv.settlements)) {
                inv.settlements.forEach((s: any) => {
                  if (s.target_id === `${v.id}-${idx}` && !countedInvoiceIds.has(inv.id)) {
                    totalSettled += Number(s.settled_amount || s.amount || 0);
                  }
                });
              }
            });

            const originalAmount = Number(item.amount) || 0;
            const openAmount = originalAmount - totalSettled;

            if (openAmount > 0.01) {
              credits.push({
                id: `${v.id}-${idx}`,
                original_id: v.id,
                date: v.date,
                type_label: 'سند قبض',
                number: v.voucher_number || v.number || v.id,
                page_name: 'receipts',
                original_amount: originalAmount,
                open_amount: openAmount,
                settled_amount: 0,
                notes: v.description || v.notes || '',
                je_number: v.entry_number || '',
                selected: false
              });
            }
          }
        });
      }
    });

    // 2. Sales Returns
    allReturns.forEach(r => {
      if (r.customer_id === selectedCustomerId && r.payment_type !== 'cash') {
        const settled = getSettlementsForTarget(r.id);
        const originalAmount = Number(r.total_amount) || 0;
        const openAmount = originalAmount - settled;

        if (openAmount > 0.01) {
          credits.push({
            id: r.id,
            original_id: r.id,
            date: r.date,
            type_label: 'مرتجع مبيعات',
            number: r.return_number || r.id,
            page_name: 'returns',
            original_amount: originalAmount,
            open_amount: openAmount,
            settled_amount: 0,
            notes: r.description || r.notes || '',
            je_number: r.entry_number || '',
            selected: false
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
        if (matchesEntity && Number(item.credit) > 0 && item.account_id === customer?.account_id) {
          const originalAmount = Number(item.credit) || 0;
          const settled = getSettlementsForTarget(`${je.id}-${idx}`, je.reference_type);
          const openAmount = originalAmount - settled;

          if (openAmount > 0.01) {
            const isDiscount = je.reference_type === 'customer_discount';
            const isOpBal = je.reference_type === 'opening_balance';
            credits.push({
              id: `${je.id}-${idx}`,
              original_id: je.id,
              date: je.date,
              type_label: isOpBal ? 'قيد رصيد أول' : (isDiscount ? 'خصم مسموح به' : 'قيد يومية (دائن)'),
              number: je.entry_number || je.id.slice(0, 8),
              page_name: isDiscount ? 'discounts' : 'journal_entries',
              original_amount: originalAmount,
              open_amount: openAmount,
              settled_amount: 0,
              notes: item.description || je.description || '',
              je_number: je.entry_number || je.id.slice(0, 8),
              selected: false
            });
          }
        }
      });
    });

    setDebitMovements(debits.sort((a, b) => b.date.localeCompare(a.date)));
    setCreditMovements(credits.sort((a, b) => b.date.localeCompare(a.date)));
  }, [selectedCustomerId, allInvoices, allReceipts, allReturns, allJournalEntries, customers]);

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
            if (filterSearchType === 'je_number') {
              return !!(m.je_number && m.je_number.toLowerCase().includes(query));
            }
            if (filterSearchType === 'date') {
              return m.date.slice(0, 10).includes(query);
            }
            if (filterSearchType === 'original_amount') {
              const numVal = parseFloat(query);
              return !isNaN(numVal) && Math.abs(m.original_amount - numVal) < 0.01;
            }
            if (filterSearchType === 'open_amount') {
              const numVal = parseFloat(query);
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

      // 4. Basic search bar (searchTerm)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesQuery = m.number.toLowerCase().includes(query) || 
                             m.type_label.toLowerCase().includes(query) || 
                             m.notes.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      return true;
    });
  };

  const processedDebitMovements = useMemo(() => {
    return applyFilters(debitMovements);
  }, [debitMovements, filterDocNumbers, filterSearchType, filterFromDate, filterToDate, filterTypes, searchTerm]);

  const processedCreditMovements = useMemo(() => {
    return applyFilters(creditMovements);
  }, [creditMovements, filterDocNumbers, filterSearchType, filterFromDate, filterToDate, filterTypes, searchTerm]);

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
        return { ...m, selected: checked, settled_amount: checked ? m.open_amount : 0 };
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
        return { ...m, selected: checked, settled_amount: checked ? m.open_amount : 0 };
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
        return { ...m, selected: checked, settled_amount: checked ? m.open_amount : 0 };
      }
      return m;
    }));

    setCreditMovements(prev => prev.map(m => {
      if (visibleCreditIds.has(m.id)) {
        return { ...m, selected: checked, settled_amount: checked ? m.open_amount : 0 };
      }
      return m;
    }));
  };

  // Handlers for checkboxes & inputs
  const handleToggleDebit = (id: string, checked: boolean) => {
    setDebitMovements(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, selected: checked, settled_amount: checked ? m.open_amount : 0 };
      }
      return m;
    }));
  };

  const handleToggleCredit = (id: string, checked: boolean) => {
    setCreditMovements(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, selected: checked, settled_amount: checked ? m.open_amount : 0 };
      }
      return m;
    }));
  };

  const handleDebitAmountChange = (id: string, amount: number) => {
    setDebitMovements(prev => prev.map(m => {
      if (m.id === id) {
        const val = Math.max(0, Math.min(m.open_amount, amount));
        return { ...m, settled_amount: val, selected: val > 0 };
      }
      return m;
    }));
  };

  const handleCreditAmountChange = (id: string, amount: number) => {
    setCreditMovements(prev => prev.map(m => {
      if (m.id === id) {
        const val = Math.max(0, Math.min(m.open_amount, amount));
        return { ...m, settled_amount: val, selected: val > 0 };
      }
      return m;
    }));
  };

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
    
    // Check Invoices settlements
    allInvoices.forEach(inv => {
      if (inv.settlements && Array.isArray(inv.settlements)) {
        inv.settlements.forEach((s: any) => {
          if (s.settlement_number && s.settlement_number.startsWith(prefix)) {
            const parts = s.settlement_number.split('-');
            if (parts.length >= 4) {
              const seq = parseInt(parts[parts.length - 1], 10);
              if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
          }
        });
      }
    });

    // Check Vouchers settlements
    allReceipts.forEach(v => {
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach(item => {
          if (item.settlements && Array.isArray(item.settlements)) {
            item.settlements.forEach((s: any) => {
              if (s.settlement_number && s.settlement_number.startsWith(prefix)) {
                const parts = s.settlement_number.split('-');
                if (parts.length >= 4) {
                  const seq = parseInt(parts[parts.length - 1], 10);
                  if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                }
              }
            });
          }
        });
      }
    });

    const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
    return `${prefix}-${nextSeq}`;
  };

  const autoSettlementNumber = useMemo(() => {
    return generateSettlementSerial(settlementDate);
  }, [settlementDate, allInvoices, allReceipts]);

  // Submit Save Settlement
  const handleSaveSettlement = async () => {
    if (!user) return;
    if (!selectedCustomerId) return;
    if (totalSettledDebit <= 0) {
      showNotification('المبلغ المسوى يجب أن يكون أكبر من الصفر', 'error');
      return;
    }
    if (Math.abs(totalSettledDebit - totalSettledCredit) > 0.01) {
      showNotification('الحركات غير متوازنة، يرجى ضبط الفروقات قبل الحفظ', 'error');
      return;
    }

    try {
      const settlementNumber = autoSettlementNumber;

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
              settlement_date: settlementDate
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
              settlement_date: settlementDate
            });
          }
        }
      }

      // Execute Updates in DB
      for (const [id, inv] of invoiceUpdates.entries()) {
        await dbService.update('invoices', id, inv);
      }
      for (const [id, v] of voucherUpdates.entries()) {
        await dbService.update('receipt_vouchers', id, v);
      }

      showNotification('تم حفظ التسوية بنجاح وتوزيع الأرصدة', 'success');

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
    } catch (err: any) {
      console.error(err);
      showNotification('حدث خطأ أثناء حفظ التسوية', 'error');
    }
  };

  // Build History list
  const historyList = useMemo(() => {
    const historyMap = new Map<string, {
      settlement_number: string;
      date: string;
      entity_name: string;
      entity_id: string;
      total_amount: number;
      debitDocs: { number: string; type_label: string; amount: number; page_name: string; original_id: string }[];
      creditDocs: { number: string; type_label: string; amount: number; page_name: string; original_id: string }[];
    }>();

    // 1. Scan Invoices
    allInvoices.forEach(inv => {
      if (inv.settlements && Array.isArray(inv.settlements)) {
        inv.settlements.forEach((s: any) => {
          if (s.settlement_number) {
            const num = s.settlement_number;
            let entry = historyMap.get(num);
            if (!entry) {
              entry = {
                settlement_number: num,
                date: s.settlement_date || inv.date,
                entity_name: inv.customer_name || '',
                entity_id: inv.customer_id || '',
                total_amount: 0,
                debitDocs: [],
                creditDocs: []
              };
              historyMap.set(num, entry);
            }
            if (!entry.debitDocs.some(d => d.number === inv.invoice_number)) {
              entry.debitDocs.push({
                number: inv.invoice_number,
                type_label: 'فاتورة مبيعات',
                amount: Number(s.settled_amount) || 0,
                page_name: 'invoices',
                original_id: inv.id
              });
            }
            if (!entry.creditDocs.some(c => c.number === s.reference_number)) {
              const targetOriginalId = (s.target_id || '').split('-')[0];
              entry.creditDocs.push({
                number: s.reference_number,
                type_label: s.type_label || 'تسوية',
                amount: Number(s.settled_amount) || 0,
                page_name: s.type || 'receipts',
                original_id: targetOriginalId
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
                let entry = historyMap.get(num);
                if (!entry) {
                  entry = {
                    settlement_number: num,
                    date: s.settlement_date || v.date,
                    entity_name: item.entity_name || v.customer_name || '',
                    entity_id: item.entity_id || v.customer_id || '',
                    total_amount: 0,
                    debitDocs: [],
                    creditDocs: []
                  };
                  historyMap.set(num, entry);
                }
                if (!entry.creditDocs.some(c => c.number === (v.voucher_number || v.number))) {
                  entry.creditDocs.push({
                    number: v.voucher_number || v.number || v.id,
                    type_label: 'سند قبض',
                    amount: Number(s.settled_amount) || 0,
                    page_name: 'receipts',
                    original_id: v.id
                  });
                }
                if (!entry.debitDocs.some(d => d.number === s.reference_number)) {
                  entry.debitDocs.push({
                    number: s.reference_number,
                    type_label: s.type_label || 'تسوية',
                    amount: Number(s.settled_amount) || 0,
                    page_name: s.type || 'invoices',
                    original_id: s.target_id
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

  // Rollback Settlement
  const handleDeleteSettlement = async (settlementNumber: string, customerName: string) => {
    if (!user) return;
    if (!window.confirm(`هل أنت متأكد من إلغاء وحذف التسوية رقم ${settlementNumber}؟`)) return;

    try {
      // 1. Update Invoices
      for (const inv of allInvoices) {
        if (inv.settlements && Array.isArray(inv.settlements)) {
          const hasMatch = inv.settlements.some((s: any) => s.settlement_number === settlementNumber);
          if (hasMatch) {
            const updated = inv.settlements.filter((s: any) => s.settlement_number !== settlementNumber);
            await dbService.update('invoices', inv.id, { ...inv, settlements: updated });
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

      showNotification('تم حذف التسوية واستعادة الأرصدة المستحقة', 'success');

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
      showNotification('حدث خطأ أثناء حذف التسوية', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Title block */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">تسويات العملاء</h2>
          <p className="text-zinc-500 text-sm">إجراء تسويات حرّة ومباشرة للعميل لربط الحركات المدينة بالدائنة بالتزامن الكامل.</p>
        </div>
        
        {/* Tab Switcher & Layout Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {selectedCustomerId && activeTab === 'new' && (
            <button
              onClick={handleToggleLayout}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-all rounded-xl font-bold text-xs shadow-sm"
            >
              <LayoutGrid size={16} className="text-emerald-600" />
              <span>{layoutMode === 'split' ? 'عرض الجدول الموحد' : 'عرض الجداول المنفصلة'}</span>
            </button>
          )}

          <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200/50 shadow-inner w-fit">
            <button
              onClick={() => setActiveTab('new')}
              className={`p-2 px-6 rounded-xl transition-all font-bold text-sm ${activeTab === 'new' ? 'bg-white text-emerald-600 shadow-sm border border-zinc-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              تسوية جديدة
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`p-2 px-6 rounded-xl transition-all font-bold text-sm ${activeTab === 'history' ? 'bg-white text-emerald-600 shadow-sm border border-zinc-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              سجل التسويات
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'new' ? (
        <div className="space-y-6">
          {/* Customer Selection Card */}
          <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div>
                <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">العميل</label>
                <div className="relative group">
                  <User className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                  <select 
                    required
                    className={`w-full ${dir === 'rtl' ? 'ps-10 pe-12' : 'pe-10 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">اختر العميل...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                  <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">تاريخ التسوية</label>
                <div className="relative group">
                  <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                  <input 
                    required
                    type="date" 
                    className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">رقم التسوية التلقائي</label>
                <div className="relative group">
                  <input 
                    readOnly
                    type="text" 
                    className="w-full px-4 py-3 bg-zinc-100 border border-zinc-200 rounded-2xl font-black text-emerald-600 text-sm outline-none cursor-default"
                    value={selectedCustomerId ? autoSettlementNumber : '-'}
                  />
                </div>
              </div>

              {selectedCustomerId && (
                <div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center justify-center gap-2 w-full py-3 border rounded-2xl font-bold text-xs transition-all shadow-sm ${showFilters ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
                  >
                    <SlidersHorizontal size={16} />
                    <span>تصفية وبحث متقدم</span>
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
                  <div className="pt-4 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Bulk numbers search */}
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase">البحث المتعدد</label>
                        <select
                          className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border-0 rounded-lg outline-none py-0.5 px-2 cursor-pointer"
                          value={filterSearchType}
                          onChange={(e) => setFilterSearchType(e.target.value)}
                        >
                          <option value="number">رقم المستند</option>
                          <option value="je_number">رقم القيد</option>
                          <option value="date">التاريخ (YYYY-MM-DD)</option>
                          <option value="original_amount">المبلغ الأصلي</option>
                          <option value="open_amount">المبلغ المتبقي</option>
                          <option value="notes">ملاحظات / وصف</option>
                        </select>
                      </div>
                      <textarea
                        rows={3}
                        className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-mono"
                        placeholder={
                          filterSearchType === 'number' ? 'INV-2026-06-000005\nINV-2026-06-000003' :
                          filterSearchType === 'je_number' ? 'JV-2026-0001\nJV-2026-0002' :
                          filterSearchType === 'date' ? '2026-06-01\n2026-06-05' :
                          filterSearchType === 'original_amount' ? '1500\n3400.50' :
                          filterSearchType === 'open_amount' ? '500\n1000' : 'وصف أو ملاحظة القيد'
                        }
                        value={filterDocNumbers}
                        onChange={(e) => setFilterDocNumbers(e.target.value)}
                      />
                    </div>

                    {/* Date range search */}
                    <div className="space-y-4">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 px-1 uppercase">البحث بنطاق تاريخى</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 mb-1">من تاريخ</label>
                          <input
                            type="date"
                            className="w-full p-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                            value={filterFromDate}
                            onChange={(e) => setFilterFromDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 mb-1">إلى تاريخ</label>
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
                      <label className="block text-[10px] font-bold text-zinc-400 mb-2 px-1 uppercase">تصفية حسب نوع المستند</label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { key: 'invoices', label: 'فواتير مبيعات' },
                          { key: 'receipts', label: 'سندات قبض' },
                          { key: 'returns', label: 'مرتجعات' },
                          { key: 'journal_entries', label: 'قيود يومية' },
                          { key: 'discounts', label: 'الخصومات' }
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
                      
                      {/* Clear filters button */}
                      <button
                        onClick={() => {
                          setFilterDocNumbers('');
                          setFilterSearchType('number');
                          setFilterFromDate('');
                          setFilterToDate('');
                          setFilterTypes([]);
                          setSearchTerm('');
                        }}
                        className="mt-4 text-[10px] font-bold text-red-500 hover:text-red-600 underline text-right block ml-auto"
                      >
                        إعادة تعيين كافة المرشحات
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {selectedCustomerId ? (
            <div className="space-y-6">
              {layoutMode === 'split' ? (
                /* 1. CURRENT SPLIT TABLE LAYOUT with Compact Spreadsheet styling */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Debit Side Column */}
                  <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                    <div className="p-3 bg-red-50/60 border-b border-red-100 flex items-center justify-between">
                      <span className="font-bold text-red-700 text-xs flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        الجانب المدين (المستندات المطلوبة)
                      </span>
                      <span className="bg-red-100 text-red-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                        إجمالي المسوى: {formatMoney(totalSettledDebit)} ج.م
                      </span>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs border border-zinc-200">
                        <thead>
                          <tr className="bg-zinc-100 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-1.5 border border-zinc-200 w-20 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input 
                                  type="checkbox"
                                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                  checked={isAllDebitSelected}
                                  onChange={(e) => handleSelectAllDebits(e.target.checked)}
                                />
                                <span>تحديد</span>
                              </div>
                            </th>
                            <th className="p-1.5 border border-zinc-200">نوع الحركة</th>
                            <th className="p-1.5 border border-zinc-200">رقم المستند</th>
                            <th className="p-1.5 border border-zinc-200">التاريخ</th>
                            <th className="p-1.5 border border-zinc-200 text-left">المبلغ</th>
                            <th className="p-1.5 border border-zinc-200 text-left">المتبقي</th>
                            <th className="p-1.5 border border-zinc-200 w-28 text-left">المبلغ المسوى</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {processedDebitMovements.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-zinc-400 italic">لا توجد حركات مدينة تطابق البحث</td>
                            </tr>
                          ) : (
                            processedDebitMovements.map(m => (
                              <tr key={m.id} className={`hover:bg-zinc-50 transition-colors ${m.selected ? 'bg-emerald-50/15' : ''}`}>
                                <td className="p-1 text-center border border-zinc-200">
                                  <input 
                                    type="checkbox" 
                                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4.5 w-4.5 cursor-pointer"
                                    checked={m.selected}
                                    onChange={(e) => handleToggleDebit(m.id, e.target.checked)}
                                  />
                                </td>
                                <td className="p-1 px-2 border border-zinc-200 font-semibold text-zinc-500">{m.type_label}</td>
                                <td className="p-1 px-2 border border-zinc-200 font-bold">
                                  <button
                                    onClick={() => navigateToDoc(m.page_name, m.original_id)}
                                    className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 focus:outline-none"
                                  >
                                    <span>{m.number}</span>
                                    <ExternalLink size={10} className="opacity-40" />
                                  </button>
                                </td>
                                <td className="p-1 px-2 border border-zinc-200 text-zinc-500">{formatDate(m.date)}</td>
                                <td className="p-1 px-2 border border-zinc-200 text-left font-semibold text-zinc-500">{formatNumber(m.original_amount)}</td>
                                <td className="p-1 px-2 border border-zinc-200 text-left font-bold text-zinc-800">{formatNumber(m.open_amount)}</td>
                                <td className="p-0.5 border border-zinc-200 text-left">
                                  <input 
                                    type="number"
                                    step="any"
                                    className="w-full px-2 py-1 bg-transparent border-0 text-left font-black text-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none text-xs"
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
                  <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                    <div className="p-3 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
                      <span className="font-bold text-emerald-700 text-xs flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        الجانب الدائن (دفعات / مرتجعات / إعفاءات)
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                        إجمالي المسوى: {formatMoney(totalSettledCredit)} ج.م
                      </span>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs border border-zinc-200">
                        <thead>
                          <tr className="bg-zinc-100 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-1.5 border border-zinc-200 w-20 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input 
                                  type="checkbox"
                                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                  checked={isAllCreditSelected}
                                  onChange={(e) => handleSelectAllCredits(e.target.checked)}
                                />
                                <span>تحديد</span>
                              </div>
                            </th>
                            <th className="p-1.5 border border-zinc-200">نوع الحركة</th>
                            <th className="p-1.5 border border-zinc-200">رقم المستند</th>
                            <th className="p-1.5 border border-zinc-200">التاريخ</th>
                            <th className="p-1.5 border border-zinc-200 text-left">المبلغ</th>
                            <th className="p-1.5 border border-zinc-200 text-left">المتبقي</th>
                            <th className="p-1.5 border border-zinc-200 w-28 text-left">المبلغ المسوى</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {processedCreditMovements.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-zinc-400 italic">لا توجد حركات دائنة تطابق البحث</td>
                            </tr>
                          ) : (
                            processedCreditMovements.map(m => (
                              <tr key={m.id} className={`hover:bg-zinc-50 transition-colors ${m.selected ? 'bg-emerald-50/15' : ''}`}>
                                <td className="p-1 text-center border border-zinc-200">
                                  <input 
                                    type="checkbox" 
                                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4.5 w-4.5 cursor-pointer"
                                    checked={m.selected}
                                    onChange={(e) => handleToggleCredit(m.id, e.target.checked)}
                                  />
                                </td>
                                <td className="p-1 px-2 border border-zinc-200 font-semibold text-zinc-500">{m.type_label}</td>
                                <td className="p-1 px-2 border border-zinc-200 font-bold">
                                  <button
                                    onClick={() => navigateToDoc(m.page_name, m.original_id)}
                                    className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 focus:outline-none"
                                  >
                                    <span>{m.number}</span>
                                    <ExternalLink size={10} className="opacity-40" />
                                  </button>
                                </td>
                                <td className="p-1 px-2 border border-zinc-200 text-zinc-500">{formatDate(m.date)}</td>
                                <td className="p-1 px-2 border border-zinc-200 text-left font-semibold text-zinc-500">{formatNumber(m.original_amount)}</td>
                                <td className="p-1 px-2 border border-zinc-200 text-left font-bold text-zinc-800">{formatNumber(m.open_amount)}</td>
                                <td className="p-0.5 border border-zinc-200 text-left">
                                  <input 
                                    type="number"
                                    step="any"
                                    className="w-full px-2 py-1 bg-transparent border-0 text-left font-black text-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none text-xs"
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
                /* 2. NEW UNIFIED SINGLE TABLE LAYOUT with separate debit/credit columns and compact spreadsheet styling */
                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                  <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                    <span className="font-bold text-zinc-700 text-xs flex items-center gap-2">
                      <SlidersHorizontal size={16} className="text-emerald-600" />
                      عرض الجدول الموحد المحاسبي (Excel Grid)
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100 font-bold">
                        مدين: {formatMoney(totalSettledDebit)}
                      </span>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 font-bold">
                        دائن: {formatMoney(totalSettledCredit)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs border border-zinc-200">
                      <thead>
                        <tr className="bg-zinc-100 text-zinc-600 font-black text-[10px] uppercase">
                          <th className="p-2 border border-zinc-200 w-20 text-center" rowSpan={2}>
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <input 
                                type="checkbox"
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                checked={isAllUnifiedSelected}
                                onChange={(e) => handleSelectAllUnified(e.target.checked)}
                              />
                              <span>تحديد الكل</span>
                            </div>
                          </th>
                          <th className="p-2 border border-zinc-200" rowSpan={2}>التاريخ</th>
                          <th className="p-2 border border-zinc-200" rowSpan={2}>نوع الحركة</th>
                          <th className="p-2 border border-zinc-200" rowSpan={2}>رقم المستند</th>
                          <th className="p-1 border border-zinc-200 text-center bg-red-50/50 text-red-700 font-bold" colSpan={2}>الحركات المدينة (Debit)</th>
                          <th className="p-1 border border-zinc-200 text-center bg-emerald-50/50 text-emerald-700 font-bold" colSpan={2}>الحركات الدائنة (Credit)</th>
                        </tr>
                        <tr className="bg-zinc-100 text-zinc-500 text-[9px] uppercase">
                          <th className="p-1.5 border border-zinc-200 text-left w-24 bg-red-50/30">المتبقي</th>
                          <th className="p-1.5 border border-zinc-200 text-left w-32 bg-red-50/30">المسوى</th>
                          <th className="p-1.5 border border-zinc-200 text-left w-24 bg-emerald-50/30">المتبقي</th>
                          <th className="p-1.5 border border-zinc-200 text-left w-32 bg-emerald-50/30">المسوى</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {unifiedMovements.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-zinc-400 italic">لا توجد حركات تطابق خيارات التصفية والبحث</td>
                          </tr>
                        ) : (
                          unifiedMovements.map(m => (
                            <tr key={m.id} className={`hover:bg-zinc-50 transition-colors ${m.selected ? 'bg-emerald-50/15' : ''}`}>
                              <td className="p-1 text-center border border-zinc-200">
                                <input 
                                  type="checkbox" 
                                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4.5 w-4.5 cursor-pointer"
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
                              <td className="p-1 px-2 border border-zinc-200 text-zinc-500 font-semibold">{formatDate(m.date)}</td>
                              <td className="p-1 px-2 border border-zinc-200 text-zinc-500 font-bold">{m.type_label}</td>
                              <td className="p-1 px-2 border border-zinc-200 font-bold">
                                <button
                                  onClick={() => navigateToDoc(m.page_name, m.original_id)}
                                  className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 focus:outline-none"
                                >
                                  <span>{m.number}</span>
                                  <ExternalLink size={10} className="opacity-40" />
                                </button>
                              </td>
                              
                              {/* Debit columns */}
                              <td className="p-1 px-2 border border-zinc-200 text-left bg-red-50/5 text-red-600 font-semibold">
                                {m.isDebit ? formatNumber(m.open_amount) : '-'}
                              </td>
                              <td className="p-0.5 border border-zinc-200 text-left bg-red-50/5">
                                {m.isDebit ? (
                                  <input 
                                    type="number"
                                    step="any"
                                    className="w-full px-2 py-1 bg-transparent border-0 text-left font-black text-red-600 focus:ring-1 focus:ring-red-500 outline-none text-xs"
                                    value={m.settled_amount || ''}
                                    placeholder="0.00"
                                    onChange={(e) => handleDebitAmountChange(m.id, parseFloat(e.target.value) || 0)}
                                  />
                                ) : '-'}
                              </td>

                              {/* Credit columns */}
                              <td className="p-1 px-2 border border-zinc-200 text-left bg-emerald-50/5 text-emerald-600 font-semibold">
                                {!m.isDebit ? formatNumber(m.open_amount) : '-'}
                              </td>
                              <td className="p-0.5 border border-zinc-200 text-left bg-emerald-50/5">
                                {!m.isDebit ? (
                                  <input 
                                    type="number"
                                    step="any"
                                    className="w-full px-2 py-1 bg-transparent border-0 text-left font-black text-emerald-600 focus:ring-1 focus:ring-emerald-500 outline-none text-xs"
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

              {/* Summary Bottom Actions Card */}
              <div className="bg-slate-900 p-6 rounded-3xl text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">إجمالي المدين المسوى</span>
                    <p className="text-xl font-black text-red-400">{formatMoney(totalSettledDebit)} ج.م</p>
                  </div>
                  <div className="w-px h-10 bg-zinc-800 hidden md:block" />
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">إجمالي الدائن المسوى</span>
                    <p className="text-xl font-black text-emerald-400">{formatMoney(totalSettledCredit)} ج.م</p>
                  </div>
                  <div className="w-px h-10 bg-zinc-800 hidden md:block" />
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">الفرق</span>
                    <p className={`text-xl font-black ${difference === 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {formatMoney(difference)} ج.م
                    </p>
                  </div>
                </div>

                <div>
                  <button
                    onClick={handleSaveSettlement}
                    disabled={difference > 0.01 || totalSettledDebit === 0}
                    className="w-full md:w-auto px-8 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    تثبيت وحفظ التسوية
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center text-zinc-400 shadow-sm flex flex-col items-center gap-4">
              <Info size={48} className="text-zinc-300" />
              <p className="font-bold">يرجى اختيار العميل لعرض الحركات المعلقة وبدء التسوية</p>
            </div>
          )}
        </div>
      ) : (
        /* Settlement History Tab */
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                <input
                  type="text"
                  placeholder="البحث برقم التسوية أو العميل..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-semibold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">رقم التسوية</th>
                    <th className="px-6 py-4">التاريخ</th>
                    <th className="px-6 py-4">العميل</th>
                    <th className="px-6 py-4 text-left">المبلغ الإجمالي المسوى</th>
                    <th className="px-6 py-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {historyList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد تسويات مسجلة</td>
                    </tr>
                  ) : (
                    historyList.map(h => (
                      <tr key={h.settlement_number} className="hover:bg-zinc-50/50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-zinc-900">{h.settlement_number}</td>
                        <td className="px-6 py-4 text-zinc-500 font-semibold">{formatDate(h.date)}</td>
                        <td className="px-6 py-4 font-bold text-zinc-700">{h.entity_name}</td>
                        <td className="px-6 py-4 text-left font-black text-emerald-600">{formatMoney(h.total_amount)} ج.م</td>
                        <td className="px-6 py-4 text-left">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setSelectedHistory(h)}
                              className="px-3 py-1 text-xs font-bold bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200 transition-all"
                            >
                              عرض التفاصيل
                            </button>
                            <button
                              onClick={() => handleDeleteSettlement(h.settlement_number, h.entity_name)}
                              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="إلغاء وحذف"
                            >
                              <Trash2 size={16} />
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
                  <h3 className="text-lg font-bold text-zinc-900">تفاصيل التسوية: {selectedHistory.settlement_number}</h3>
                  <p className="text-xs text-zinc-400 font-bold mt-1">تاريخ التسوية: {formatDate(selectedHistory.date)} • العميل: {selectedHistory.entity_name}</p>
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
                    <h4 className="font-bold text-red-700 text-sm border-b border-zinc-100 pb-2">المستندات المدينة (الخصم من الحساب)</h4>
                    <div className="space-y-2">
                      {selectedHistory.debitDocs.map((doc: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl text-xs">
                          <div>
                            <button
                              onClick={() => {
                                navigateToDoc(doc.page_name, doc.original_id);
                                setSelectedHistory(null);
                              }}
                              className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 focus:outline-none"
                            >
                              <span>{doc.number}</span>
                              <ExternalLink size={10} className="opacity-40" />
                            </button>
                            <span className="text-[10px] text-zinc-400 font-semibold">{doc.type_label}</span>
                          </div>
                          <span className="font-black text-red-500">{formatMoney(doc.amount)} ج.م</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Credits Linked */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-emerald-700 text-sm border-b border-zinc-100 pb-2">المستندات الدائنة (الإيداع / السداد)</h4>
                    <div className="space-y-2">
                      {selectedHistory.creditDocs.map((doc: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl text-xs">
                          <div>
                            <button
                              onClick={() => {
                                navigateToDoc(doc.page_name, doc.original_id);
                                setSelectedHistory(null);
                              }}
                              className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 focus:outline-none"
                            >
                              <span>{doc.number}</span>
                              <ExternalLink size={10} className="opacity-40" />
                            </button>
                            <span className="text-[10px] text-zinc-400 font-semibold">{doc.type_label}</span>
                          </div>
                          <span className="font-black text-emerald-500">{formatMoney(doc.amount)} ج.م</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-2xl flex justify-between items-center font-bold">
                  <span className="text-zinc-400 text-xs">الإجمالي الكلي المسوى</span>
                  <span className="text-xl text-emerald-400">{formatMoney(selectedHistory.total_amount)} ج.م</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
