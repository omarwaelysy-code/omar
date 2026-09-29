import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { TransactionManager } from '../services/TransactionManager';
import { CashTransferSchema, JournalEntrySchema } from '../lib/schemas';
import { CashTransfer, PaymentMethod, JournalEntry, JournalEntryItem, Account, ActivityLog, Currency, Company } from '../types';
import { 
  Search, Plus, Trash2, X, ArrowLeftRight, Pencil, 
  Download, Eye, FileText, History, Printer, 
  Wallet, Calendar, Hash, Layers, Save,
  Maximize2, Minimize2, ChevronRight, ChevronLeft, RotateCcw, User, ChevronDown, LayoutGrid, List,
  Coins, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService, apiRequest } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { SmartAIInput } from '../components/SmartAIInput';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { formatNumber, formatDate, formatMoney, parseNumber } from '../utils/formatUtils';
import { ExportButtons } from '../components/ExportButtons';
import { PaginationControls } from '../components/PaginationControls';
import { AttachmentsManager, AttachmentItem } from '../components/common/AttachmentsManager';
import { useNavigation } from '../contexts/NavigationContext';
import { useLanguage } from '../contexts/LanguageContext';

export const CashTransfers: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { setPendingViewDoc, setCurrentPage } = useNavigation();
  const [transfers, setTransfers] = useState<CashTransfer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companyCurrencies, setCompanyCurrencies] = useState<Currency[]>([]);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [exchangeRateType, setExchangeRateType] = useState<'manual' | 'auto'>('manual');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<CashTransfer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState<string | null>(null);
  const [viewTransfer, setViewTransfer] = useState<CashTransfer | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [view, setView] = useState<'table' | 'card'>('table');
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverSummary, setServerSummary] = useState<any>({});
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { t, language, dir } = useLanguage();

  const getPmCurrency = (pmId: string) => {
    if (!pmId) return (companyData?.settings?.currency || 'EGP').toUpperCase();
    const pm = paymentMethods.find(p => p.id === pmId);
    return (pm?.currency || companyData?.settings?.currency || 'EGP').toUpperCase();
  };

  const loadTransferToForm = (transfer: CashTransfer) => {
    setEditingTransfer(transfer);
    setAttachments(Array.isArray(transfer.attachments) ? transfer.attachments : []);
    const fromCurr = (transfer as any).from_currency || getPmCurrency(transfer.from_payment_method_id);
    const toCurr = (transfer as any).to_currency || getPmCurrency(transfer.to_payment_method_id);
    const rate = Number((transfer as any).exchange_rate) || 1;
    const converted = Number((transfer as any).converted_amount) || Number(transfer.amount) || 0;

    setFormData({
      date: transfer.date ? transfer.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      amount: Number(transfer.amount) || 0,
      from_payment_method_id: transfer.from_payment_method_id,
      to_payment_method_id: transfer.to_payment_method_id,
      description: transfer.description,
      transfer_number: transfer.transfer_number || '',
      from_currency: fromCurr,
      to_currency: toCurr,
      exchange_rate: rate,
      converted_amount: converted
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTransfer(null);
    setAttachments([]);
    const defaultCurr = (companyData?.settings?.currency || 'EGP').toUpperCase();
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      from_payment_method_id: '',
      to_payment_method_id: '',
      description: '',
      transfer_number: '',
      from_currency: defaultCurr,
      to_currency: defaultCurr,
      exchange_rate: 1,
      converted_amount: 0
    });
  };

  const handlePrevTransfer = () => {
    if (!editingTransfer) return;
    const currentIndex = transfers.findIndex(t => t.id === editingTransfer.id);
    if (currentIndex > 0) {
      loadTransferToForm(transfers[currentIndex - 1]);
    }
  };

  const handleNextTransfer = () => {
    if (!editingTransfer) return;
    const currentIndex = transfers.findIndex(t => t.id === editingTransfer.id);
    if (currentIndex < transfers.length - 1) {
      loadTransferToForm(transfers[currentIndex + 1]);
    }
  };
  const transferRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Add Payment Method Modal State
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [paymentMethodFormData, setPaymentMethodFormData] = useState({
    code: '',
    name: '',
    type: 'cash' as 'cash' | 'bank' | 'wallet',
    account_id: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    counter_account_id: '',
    details: ''
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    from_payment_method_id: '',
    to_payment_method_id: '',
    description: '',
    transfer_number: '',
    from_currency: 'EGP',
    to_currency: 'EGP',
    exchange_rate: 1,
    converted_amount: 0
  });

  const [isAmountFocused, setIsAmountFocused] = useState(false);

  useEffect(() => {
    if (user) {
      const unsubTransfers = dbService.subscribePaginated('cash_transfers', {
          company_id: user.company_id,
          _page: page,
          _limit: limit,
          _sortBy: sortBy,
          _sortOrder: sortOrder,
          _search: searchTerm
      }, (result: any) => {
        setTransfers(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
        setLoading(false);
      });
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubCurr = dbService.subscribe<Currency>('company_currencies', user.company_id, setCompanyCurrencies);
      const unsubComp = dbService.subscribe<Company>('companies', user.company_id, (comps) => {
        if (comps && comps.length > 0) {
          setCompanyData(comps[0]);
        }
      });
      
      return () => {
        unsubTransfers();
        unsubPM();
        unsubAccounts();
        unsubCurr();
        unsubComp();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  const fetchSystemRate = async (fromCurr: string, toCurr: string, currentAmount?: number) => {
    if (!user || !fromCurr || !toCurr || fromCurr === toCurr) {
      const amt = currentAmount !== undefined ? currentAmount : formData.amount;
      setFormData(prev => ({
        ...prev,
        exchange_rate: 1,
        converted_amount: amt
      }));
      return;
    }

    try {
      const baseCurr = (companyData?.settings?.currency || 'EGP').toUpperCase();

      const getCurrencyRateVsBase = async (code: string) => {
        if (code === baseCurr) return 1;
        const currObj = companyCurrencies.find(c => c.code?.toUpperCase() === code);
        const currId = currObj?.id;

        // Auto rates
        try {
          const latestAuto = await apiRequest<Array<{ currency_id: string; rate: number | null }>>(
            `/currency-rates/latest?company_id=${user.company_id}`
          );
          if (Array.isArray(latestAuto) && currId) {
            const found = latestAuto.find(r => r.currency_id === currId);
            if (found && found.rate && Number(found.rate) > 0) {
              return Number(found.rate);
            }
          }
        } catch (e) {
          // ignore
        }

        // Manual exchange_rates table
        if (currId) {
          try {
            const manualRates = await dbService.list<any>('exchange_rates', {
              currency_id: currId,
              company_id: user.company_id,
              _limit: 1,
              _sort: 'rate_date',
              _order: 'desc'
            });
            if (manualRates && manualRates.length > 0 && Number(manualRates[0].exchange_rate) > 0) {
              return Number(manualRates[0].exchange_rate);
            }
          } catch (e) {
            // ignore
          }
        }

        // Currency table
        if (currObj && (currObj as any).exchange_rate && Number((currObj as any).exchange_rate) > 0) {
          return Number((currObj as any).exchange_rate);
        }

        return 1;
      };

      const fromRateVsBase = await getCurrencyRateVsBase(fromCurr);
      const toRateVsBase = await getCurrencyRateVsBase(toCurr);

      const rawRate = toRateVsBase > 0 ? (fromRateVsBase / toRateVsBase) : 1;
      const calculatedRate = Number(rawRate.toFixed(4)) || 1;
      const amt = currentAmount !== undefined ? currentAmount : formData.amount;
      const convertedAmt = Number((amt * calculatedRate).toFixed(4));

      setFormData(prev => ({
        ...prev,
        exchange_rate: calculatedRate,
        converted_amount: convertedAmt
      }));
      setExchangeRateType('auto');
      showNotification(
        language === 'ar' 
          ? `تم جلب سعر الصرف من النظام: 1 ${fromCurr} = ${calculatedRate} ${toCurr}` 
          : `Fetched system rate: 1 ${fromCurr} = ${calculatedRate} ${toCurr}`,
        'success'
      );
    } catch (e) {
      console.error('Error fetching system rate:', e);
      showNotification(
        language === 'ar' ? 'تعذر جلب سعر الصرف من النظام، يمكنك إدخاله يدوياً' : 'Could not fetch system rate, you can enter it manually',
        'warning'
      );
    }
  };

  const handleFromPmChange = (newFromId: string) => {
    const newFromCurr = getPmCurrency(newFromId);
    setFormData(prev => {
      const updated = {
        ...prev,
        from_payment_method_id: newFromId,
        from_currency: newFromCurr
      };
      if (newFromCurr === prev.to_currency) {
        updated.exchange_rate = 1;
        updated.converted_amount = prev.amount;
      }
      return updated;
    });
    if (newFromCurr !== formData.to_currency && formData.to_payment_method_id) {
      fetchSystemRate(newFromCurr, formData.to_currency, formData.amount);
    }
  };

  const handleToPmChange = (newToId: string) => {
    const newToCurr = getPmCurrency(newToId);
    setFormData(prev => {
      const updated = {
        ...prev,
        to_payment_method_id: newToId,
        to_currency: newToCurr
      };
      if (prev.from_currency === newToCurr) {
        updated.exchange_rate = 1;
        updated.converted_amount = prev.amount;
      }
      return updated;
    });
    if (formData.from_currency !== newToCurr && formData.from_payment_method_id) {
      fetchSystemRate(formData.from_currency, newToCurr, formData.amount);
    }
  };

  const handleAmountChange = (newAmount: number) => {
    const rate = Number(formData.exchange_rate) || 1;
    const isMulti = (formData.from_currency || 'EGP') !== (formData.to_currency || 'EGP');
    setFormData(prev => ({
      ...prev,
      amount: newAmount,
      converted_amount: isMulti ? Number((newAmount * rate).toFixed(4)) : newAmount
    }));
  };

  const handleRateChange = (newRate: number) => {
    setExchangeRateType('manual');
    setFormData(prev => ({
      ...prev,
      exchange_rate: newRate,
      converted_amount: Number((prev.amount * newRate).toFixed(4))
    }));
  };

  const handleConvertedAmountChange = (newConverted: number) => {
    setExchangeRateType('manual');
    const newRate = formData.amount > 0 ? Number((newConverted / formData.amount).toFixed(4)) : 1;
    setFormData(prev => ({
      ...prev,
      converted_amount: newConverted,
      exchange_rate: newRate
    }));
  };

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    const generatePreview = () => {
      if (formData.amount <= 0 || !formData.from_payment_method_id || !formData.to_payment_method_id) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const fromPM = paymentMethods.find(pm => pm.id === formData.from_payment_method_id);
      const toPM = paymentMethods.find(pm => pm.id === formData.to_payment_method_id);

      if (!fromPM || !toPM) return;

      const fromCurr = formData.from_currency || 'EGP';
      const toCurr = formData.to_currency || 'EGP';
      const isMulti = fromCurr !== toCurr;
      const rate = Number(formData.exchange_rate) || 1;
      const convertedAmt = Number(formData.converted_amount) || (formData.amount * rate);
      const baseCurr = (companyData?.settings?.currency || 'EGP').toUpperCase();

      let baseAmount = formData.amount;
      if (isMulti) {
        if (fromCurr === baseCurr) {
          baseAmount = formData.amount;
        } else if (toCurr === baseCurr) {
          baseAmount = convertedAmt;
        } else {
          baseAmount = Number((formData.amount * rate).toFixed(4));
        }
      }

      const journalItems: JournalEntryItem[] = [
        {
          account_id: toPM.account_id || '',
          account_name: toPM.account_name || toPM.name,
          debit: baseAmount,
          credit: 0,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${isMulti ? ` (${formData.amount} ${fromCurr} 🠚 ${convertedAmt} ${toCurr})` : ''}${formData.description ? ': ' + formData.description : ''}`,
          sub_account_id: toPM.id,
          sub_account_type: 'payment_method'
        },
        {
          account_id: fromPM.account_id || '',
          account_name: fromPM.account_name || fromPM.name,
          debit: 0,
          credit: baseAmount,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${isMulti ? ` (${formData.amount} ${fromCurr} 🠚 ${convertedAmt} ${toCurr})` : ''}${formData.description ? ': ' + formData.description : ''}`,
          sub_account_id: fromPM.id,
          sub_account_type: 'payment_method'
        }
      ];

      setPreviewJournalEntry({
        id: 'preview',
        date: formData.date,
        description: `قيد تحويل بين البنوك والخزائن${formData.description ? ': ' + formData.description : ''}`,
        reference_id: editingTransfer?.id || 'new',
        reference_type: 'cash_transfer',
        items: journalItems,
        total_debit: baseAmount,
        total_credit: baseAmount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });

      setPreviewActivityLog({
        action: editingTransfer ? 'تعديل تحويل بين البنوك والخزائن' : 'إضافة تحويل بين البنوك والخزائن',
        details: `تحويل مبلغ ${formData.amount} ${fromCurr} من ${fromPM.name} إلى ${toPM.name}${isMulti ? ` بقيمة ${convertedAmt} ${toCurr} (سعر: ${rate})` : ''}`,
        entity: ['cash_transfers', 'journal_entries']
      });
    };

    generatePreview();
  }, [isModalOpen, formData, user, paymentMethods, editingTransfer, companyData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.from_payment_method_id === formData.to_payment_method_id) {
      showNotification(language === 'ar' ? 'لا يمكن التحويل لنفس الحساب أو الخزينة' : 'Cannot transfer to the same safe or bank', 'error');
      return;
    }

    if (formData.amount <= 0) {
      showNotification(language === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount', 'error');
      return;
    }

    try {
      const fromPM = paymentMethods.find(pm => pm.id === formData.from_payment_method_id);
      const toPM = paymentMethods.find(pm => pm.id === formData.to_payment_method_id);

      if (!fromPM || !toPM) {
        showNotification(language === 'ar' ? 'يرجى اختيار البنوك أو الخزائن بشكل صحيح' : 'Please select banks or safes correctly', 'error');
        return;
      }

      const fromCurr = formData.from_currency || 'EGP';
      const toCurr = formData.to_currency || 'EGP';
      const isMulti = fromCurr !== toCurr;
      const rate = Number(formData.exchange_rate) || 1;
      const convertedAmt = Number(formData.converted_amount) || (formData.amount * rate);
      const baseCurr = (companyData?.settings?.currency || 'EGP').toUpperCase();

      let baseAmount = formData.amount;
      if (isMulti) {
        if (fromCurr === baseCurr) {
          baseAmount = formData.amount;
        } else if (toCurr === baseCurr) {
          baseAmount = convertedAmt;
        } else {
          baseAmount = Number((formData.amount * rate).toFixed(4));
        }
      }

      const data = {
        date: formData.date,
        amount: formData.amount,
        description: formData.description,
        from_payment_method_id: formData.from_payment_method_id,
        to_payment_method_id: formData.to_payment_method_id,
        from_payment_method_name: fromPM?.name || '',
        to_payment_method_name: toPM?.name || '',
        from_currency: fromCurr,
        to_currency: toCurr,
        exchange_rate: rate,
        converted_amount: convertedAmt,
        company_id: user.company_id,
        created_at: editingTransfer ? editingTransfer.created_at : new Date().toISOString(),
        created_by: editingTransfer ? editingTransfer.created_by : user.id,
        transfer_number: formData.transfer_number,
        attachments
      };

      const journalItems = [
        {
          account_id: toPM.account_id || '',
          account_name: toPM.account_name || toPM.name || '',
          debit: baseAmount,
          credit: 0,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${isMulti ? ` (${formData.amount} ${fromCurr} 🠚 ${convertedAmt} ${toCurr})` : ''}${formData.description ? ': ' + formData.description : ''}`,
          sub_account_id: toPM.id,
          sub_account_type: 'payment_method'
        },
        {
          account_id: fromPM.account_id || '',
          account_name: fromPM.account_name || fromPM.name || '',
          debit: 0,
          credit: baseAmount,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${isMulti ? ` (${formData.amount} ${fromCurr} 🠚 ${convertedAmt} ${toCurr})` : ''}${formData.description ? ': ' + formData.description : ''}`,
          sub_account_id: fromPM.id,
          sub_account_type: 'payment_method'
        }
      ];

      const journalEntryData = {
        date: formData.date,
        description: `قيد تحويل بين البنوك والخزائن${formData.description ? ': ' + formData.description : ''}`,
        reference_type: 'cash_transfer',
        items: journalItems,
        total_debit: baseAmount,
        total_credit: baseAmount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingTransfer) {
        await dbService.deleteJournalEntryByReference(editingTransfer.id, user.company_id);
        await TransactionManager.updateWithAccounting(
          'cash_transfers',
          editingTransfer.id,
          data,
          CashTransferSchema,
          journalEntryData,
          JournalEntrySchema
        );
      } else {
        await TransactionManager.saveWithAccounting(
          'cash_transfers',
          data,
          CashTransferSchema,
          journalEntryData,
          JournalEntrySchema
        );
      }

      closeModal();
      showNotification(language === 'ar' ? (editingTransfer ? 'تم تحديث التحويل بنجاح' : 'تم إضافة التحويل بنجاح') : (editingTransfer ? 'Transfer updated successfully' : 'Transfer added successfully'), 'success');

      if (!editingTransfer) {
        dbService.logActivity(
          user.id,
          user.username,
          user.company_id,
          'إضافة تحويل بين البنوك والخزائن',
          `تحويل مبلغ ${formData.amount} ${fromCurr} من ${fromPM.name} إلى ${toPM.name}${isMulti ? ` بقيمة ${convertedAmt} ${toCurr}` : ''}`,
          ['cash_transfers', 'journal_entries']
        );
      }
    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || (language === 'ar' ? 'حدث خطأ أثناء حفظ التحويل' : 'An error occurred while saving transfer'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!transferToDelete || !user) return;
    try {
      await dbService.delete('cash_transfers', transferToDelete);
      await dbService.deleteJournalEntryByReference(transferToDelete, user.company_id);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف تحويل بين البنوك والخزائن', `حذف عملية تحويل بين البنوك والخزائن رقم ${transferToDelete}`, ['cash_transfers', 'journal_entries']);
      setIsDeleteModalOpen(false);
      setTransferToDelete(null);
      showNotification(language === 'ar' ? 'تم حذف التحويل بنجاح' : 'Transfer deleted successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء حذف التحويل' : 'An error occurred while deleting transfer', 'error');
    }
  };

  const handlePaymentMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const selectedAccount = accounts.find(a => a.id === paymentMethodFormData.account_id);
      const pmId = await dbService.add('payment_methods', {
        ...paymentMethodFormData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      });
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من شاشة التحويلات: ${paymentMethodFormData.name}`, ['payment_methods', 'cash_transfers'], pmId);
      
      // Create journal entry for opening balance if not zero
      if (paymentMethodFormData.opening_balance !== 0 && paymentMethodFormData.account_id && paymentMethodFormData.counter_account_id) {
        const absBalance = Math.abs(paymentMethodFormData.opening_balance);
        const isNegative = paymentMethodFormData.opening_balance < 0;
        const counterAccount = accounts.find(a => a.id === paymentMethodFormData.counter_account_id);

        await dbService.add('journal_entries', {
          company_id: user.company_id,
          date: paymentMethodFormData.opening_balance_date,
          description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`,
          reference_id: pmId,
          reference_type: 'opening_balance',
          items: [
            {
              account_id: paymentMethodFormData.account_id,
              account_name: selectedAccount?.name || '',
              debit: isNegative ? 0 : absBalance,
              credit: isNegative ? absBalance : 0,
              description: 'رصيد افتتاحي'
            },
            {
              account_id: paymentMethodFormData.counter_account_id,
              account_name: counterAccount?.name || 'حساب الميزانية الافتتاحية',
              debit: isNegative ? absBalance : 0,
              credit: isNegative ? 0 : absBalance,
              description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`
            }
          ],
          total_debit: absBalance,
          total_credit: absBalance,
          created_at: new Date().toISOString(),
          created_by: user.id
        });
      }

      setIsPaymentMethodModalOpen(false);
      setPaymentMethodFormData({
        code: '',
        name: '',
        type: 'cash',
        account_id: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        counter_account_id: '',
        details: ''
      });
      showNotification(language === 'ar' ? 'تم إضافة الخزينة بنجاح' : 'Safe added successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء إضافة الخزينة' : 'An error occurred while adding safe', 'error');
    }
  };

  const filteredTransfers = transfers.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.from_payment_method_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.to_payment_method_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToPDF = async (transfer: CashTransfer) => {
    // Logic for single transfer PDF if needed
  };

  const handleExportExcel = () => {
    const headers = {
      'date': 'التاريخ',
      'transfer_number': 'رقم التحويل',
      'from_payment_method_name': 'من بنك / خزينة',
      'from_currency': 'عملة المصدر',
      'amount': 'المبلغ',
      'to_payment_method_name': 'إلى بنك / خزينة',
      'to_currency': 'عملة الوجهة',
      'converted_amount': 'المبلغ المحول إليه',
      'exchange_rate': 'سعر الصرف',
      'description': 'الوصف'
    };
    const formattedData = formatDataForExcel(filteredTransfers, headers);
    exportToExcel(formattedData, { filename: 'Bank_Cash_Transfers', sheetName: language === 'ar' ? 'التحويل بين البنوك والخزائن' : 'Transfers Between Banks & Safes' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Bank_Cash_Transfers', 
        orientation: 'landscape',
        reportTitle: language === 'ar' ? 'تقرير التحويل بين البنوك والخزائن' : 'Transfers Between Banks & Safes Report'
      });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">جاري التحميل...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <ArrowLeftRight size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">{language === 'ar' ? 'التحويل بين البنوك والخزائن' : 'Transfers Between Banks & Safes'}</h2>
            <p className="text-zinc-500 font-medium">{language === 'ar' ? 'إدارة عمليات التحويل بين الحسابات البنكية والخزائن وتحديد العملات وأسعار الصرف' : 'Manage transfers between bank accounts and safes with multi-currency support'}</p>
            {serverSummary.total_amount !== undefined && (
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                  {language === 'ar' ? 'إجمالي المحول:' : 'Total Transferred:'} {formatMoney(serverSummary.total_amount)} {companyData?.settings?.currency || 'EGP'}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons 
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            onPrint={() => printElement(tableRef.current, 'سندات التحويل بين البنوك والخزائن')}
          />
          <button 
            onClick={() => {
              closeModal();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            <span>{language === 'ar' ? 'تحويل جديد' : 'New Transfer'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder={language === 'ar' ? 'بحث في التحويلات...' : 'Search transfers...'} 
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 shadow-inner w-fit">
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
              title="عرض الجدول"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setView('card')}
              className={`p-1.5 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
              title="عرض الكروت"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>

        {view === 'table' ? (
          <div className="overflow-x-auto" ref={tableRef}>
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200/80">
                  <th className="px-4 py-2.5 text-xs font-bold text-zinc-700 uppercase tracking-tighter cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      التاريخ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold text-zinc-700 uppercase tracking-tighter cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('transfer_number')}>
                    <div className="flex items-center gap-1">
                      رقم التحويل
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'transfer_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold text-zinc-700 uppercase tracking-tighter cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('from_payment_method_name')}>
                    <div className="flex items-center gap-1">
                      من بنك / خزينة
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'from_payment_method_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold text-zinc-700 uppercase tracking-tighter cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('to_payment_method_name')}>
                    <div className="flex items-center gap-1">
                      إلى بنك / خزينة
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'to_payment_method_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold text-zinc-700 uppercase tracking-tighter cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('amount')}>
                    <div className="flex items-center gap-1">
                      المبلغ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</th>
                  <th className="px-4 py-2.5 text-xs font-bold text-zinc-700 uppercase tracking-tighter">{t('common.description')}</th>
                  <th className="px-4 py-2.5 text-xs font-bold text-zinc-700 uppercase tracking-tighter">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredTransfers.map((transfer) => {
                  const isMulti = transfer.from_currency && transfer.to_currency && transfer.from_currency !== transfer.to_currency;
                  return (
                    <tr 
                      key={transfer.id} 
                      className="hover:bg-zinc-50/70 transition-colors group cursor-pointer"
                      onClick={() => {
                        loadTransferToForm(transfer);
                        setIsModalOpen(true);
                      }}
                    >
                      <td className="px-4 py-2 font-bold text-zinc-900 whitespace-nowrap">{formatDate(transfer.date)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-mono text-xs bg-zinc-50 px-2 py-0.5 rounded text-zinc-600 font-bold border border-zinc-200">
                          {transfer.transfer_number || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 bg-red-50 text-red-600 rounded-md flex items-center justify-center shrink-0">
                            <Wallet size={13} />
                          </div>
                          <span className="text-zinc-800 font-bold truncate max-w-[140px]">{transfer.from_payment_method_name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 shrink-0">
                            {transfer.from_currency || 'EGP'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-md flex items-center justify-center shrink-0">
                            <Wallet size={13} />
                          </div>
                          <span className="text-zinc-800 font-bold truncate max-w-[140px]">{transfer.to_payment_method_name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            {transfer.to_currency || 'EGP'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {isMulti ? (
                          <div className="flex flex-col">
                            <span className="text-emerald-700 font-bold text-xs">{formatNumber(transfer.amount)} {transfer.from_currency}</span>
                            <span className="text-[10px] text-zinc-500 font-medium">↳ {formatNumber(transfer.converted_amount || transfer.amount)} {transfer.to_currency} <span className="text-zinc-400">({transfer.exchange_rate})</span></span>
                          </div>
                        ) : (
                          <span className="text-emerald-700 font-bold text-xs">{formatNumber(transfer.amount)} {transfer.from_currency || companyData?.settings?.currency || 'EGP'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {transfer.entry_number ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingViewDoc({ type: 'journal', idOrNumber: transfer.entry_number! });
                              setCurrentPage('journal_entries');
                            }}
                            className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50 transition-all active:scale-95 animate-in fade-in"
                          >
                            {transfer.entry_number}
                          </button>
                        ) : (
                          <span className="text-zinc-400 font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 font-medium max-w-xs truncate">{transfer.description}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewTransfer(transfer);
                              setShowSidePanel(true);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                            title="عرض التفاصيل"
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              loadTransferToForm(transfer);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                            title="تعديل"
                          >
                            <Pencil size={15} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTransferToDelete(transfer.id);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="حذف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTransfers.map((transfer) => {
              const isMulti = transfer.from_currency && transfer.to_currency && transfer.from_currency !== transfer.to_currency;
              return (
                <div 
                  key={transfer.id} 
                  className="p-5 bg-zinc-50/60 rounded-2xl border border-zinc-100 hover:border-emerald-200 hover:shadow-lg transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between"
                  onClick={() => {
                    loadTransferToForm(transfer);
                    setIsModalOpen(true);
                  }}
                >
                  <div className="absolute top-3 left-3 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewTransfer(transfer);
                        setShowSidePanel(true);
                      }}
                      className="p-1.5 bg-white text-emerald-500 rounded-lg border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                    >
                      <Eye size={14} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        loadTransferToForm(transfer);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 bg-white text-blue-500 rounded-lg border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setTransferToDelete(transfer.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1.5 bg-white text-red-500 rounded-lg border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div className="flex flex-col h-full justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <div className="flex flex-col text-right">
                          <span className="text-xs text-zinc-400 font-semibold">{formatDate(transfer.date)}</span>
                          {transfer.transfer_number && (
                            <span className="font-mono text-[10px] text-emerald-700 font-bold mt-0.5">{transfer.transfer_number}</span>
                          )}
                        </div>
                        {transfer.entry_number && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingViewDoc({ type: 'journal', idOrNumber: transfer.entry_number! });
                              setCurrentPage('journal_entries');
                            }}
                            className="font-mono text-[9px] bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded text-emerald-700 font-bold border border-emerald-100/50 transition-all active:scale-95 z-10"
                          >
                            {transfer.entry_number}
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-xs text-zinc-400">{language === 'ar' ? 'من بنك / خزينة:' : 'From Safe/Bank:'}</span>
                          <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 rounded-lg px-2 py-1 flex items-center gap-1">
                            {transfer.from_payment_method_name}
                            <span className="text-[10px] text-zinc-500 font-bold">({transfer.from_currency || 'EGP'})</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-xs text-zinc-400 font-bold text-emerald-600">{language === 'ar' ? 'إلى بنك / خزينة:' : 'To Safe/Bank:'}</span>
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1 flex items-center gap-1">
                            {transfer.to_payment_method_name}
                            <span className="text-[10px] text-emerald-600 font-bold">({transfer.to_currency || 'EGP'})</span>
                          </span>
                        </div>
                      </div>

                      {transfer.description && (
                        <p className="text-xs text-zinc-500 font-medium max-w-xs truncate border-t border-zinc-100 pt-2">{transfer.description}</p>
                      )}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-zinc-500 text-xs font-bold">{language === 'ar' ? 'المبلغ المحول' : 'Transferred Amount'}</span>
                      <div className="text-left">
                        <span className="font-black text-emerald-600 text-base">
                          {formatNumber(transfer.amount)} {transfer.from_currency || 'EGP'}
                        </span>
                        {isMulti && (
                          <div className="text-[10px] text-zinc-500 font-medium">
                            = {formatNumber(transfer.converted_amount || transfer.amount)} {transfer.to_currency}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
      </div>

      {/* Add/Edit Transfer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className={`fixed inset-0 bg-zinc-100 dark:bg-zinc-900 z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 ${isFullScreen ? 'm-0 rounded-none' : 'md:m-4 md:rounded-[2.5rem] shadow-2xl border border-white/20'}`}>
            {/* Header Block */}
            <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[90]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={closeModal}
                  className="p-3 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-400 hover:text-zinc-900 group"
                >
                  <div className="flex items-center gap-2">
                     <RotateCcw className={`w-5 h-5 transition-transform group-hover:-rotate-45`} />
                    <span className="text-sm font-bold">عودة</span>
                  </div>
                </button>
                <div className="w-px h-6 bg-zinc-200 mx-2" />
                <button
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    showSidePanel 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' 
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 border-transparent'
                  } border`}
                >
                  <History size={18} />
                  <span>{language === 'ar' ? 'قيد اليومية \\ سجل التعديلات' : 'Journal Entry \\ Activity Log'}</span>
                </button>
              </div>

              <div className="flex items-center gap-4">
                {editingTransfer && (
                  <div className="hidden lg:flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl">
                    <button 
                      type="button"
                      onClick={handlePrevTransfer}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                      disabled={transfers.findIndex(t => t.id === editingTransfer.id) === 0}
                    >
                      <ChevronRight size={16} />
                      {language === 'ar' ? 'السابق' : 'Prev'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleNextTransfer}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                      disabled={transfers.findIndex(t => t.id === editingTransfer.id) === transfers.length - 1}
                    >
                      {language === 'ar' ? 'التالي' : 'Next'}
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-xl transition-all hidden md:block"
                  title={isFullScreen ? 'تصغير' : 'تكبير'}
                >
                  {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
                <h3 className="text-lg md:text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                  {editingTransfer 
                    ? (language === 'ar' ? 'تعديل التحويل بين البنوك والخزائن' : 'Edit Transfer Between Banks & Safes') 
                    : (language === 'ar' ? 'تحويل جديد بين البنوك والخزائن' : 'New Transfer Between Banks & Safes')}
                </h3>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
              {/* Side Panel for Activity Log and Journal Entry */}
              <AnimatePresence>
                {showSidePanel && (
                  <motion.div 
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="absolute inset-y-0 right-0 z-[80] w-full lg:w-[28rem] shadow-2xl lg:shadow-none lg:relative lg:inset-auto"
                  >
                    <div className="h-full bg-white border-l border-zinc-100 flex flex-col">
                      <div className="p-4 border-b border-zinc-100 flex items-center justify-between lg:hidden">
                        <h3 className="font-bold text-zinc-900 italic">{language === 'ar' ? 'سجل النشاط والقيد' : 'Activity & Journal Log'}</h3>
                        <button onClick={() => setShowSidePanel(false)} className="p-2 text-zinc-400 hover:text-zinc-600">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <TransactionSidePanel 
                          documentId={editingTransfer?.id} 
                          category="cash_transfers"
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col">
                <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl mx-auto w-full pb-32 md:pb-8">
                  <SmartAIInput 
                    onDataExtracted={(data) => {
                      if (data.amount) handleAmountChange(data.amount!);
                      if (data.date) setFormData(prev => ({ ...prev, date: data.date! }));
                      if (data.description) setFormData(prev => ({ ...prev, description: data.description! }));
                      if (data.fromAccount) {
                        const pm = paymentMethods.find(p => p.name.includes(data.fromAccount!) || data.fromAccount!.includes(p.name));
                        if (pm) handleFromPmChange(pm.id);
                      }
                      if (data.toAccount) {
                        const pm = paymentMethods.find(p => p.name.includes(data.toAccount!) || data.toAccount!.includes(p.name));
                        if (pm) handleToPmChange(pm.id);
                      }
                    }}
                    transactionType="cash_transfer"
                  />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Basic Details Card */}
                    <section className="bg-white p-4 md:p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-4 relative pt-10 overflow-hidden">
                      <div className="absolute top-3 right-4 flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'التفاصيل الأساسية' : 'Basic Details'}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-zinc-500 uppercase px-1">{language === 'ar' ? 'رقم التحويل' : 'Transfer No.'}</label>
                          <div className="relative group">
                            <Hash className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-emerald-500 pointer-events-none transition-colors`} />
                            <input 
                              readOnly
                              type="text" 
                              className="w-full ps-9 pe-3 h-9 bg-emerald-50/50 border border-transparent rounded-xl outline-none transition-all font-mono font-bold text-emerald-800 text-xs"
                              value={formData.transfer_number || (language === 'ar' ? 'تلقائي' : 'Automatic')}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-zinc-500 uppercase px-1">{language === 'ar' ? 'تاريخ التحويل' : 'Transfer Date'}</label>
                          <div className="relative group">
                            <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-zinc-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors`} />
                            <input 
                              required
                              type="date" 
                              className="w-full ps-9 pe-3 h-9 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500 outline-none transition-all font-bold text-zinc-800 text-xs"
                              value={formData.date}
                              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                          </div>
                        </div>

                        {editingTransfer?.entry_number && (
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-zinc-500 uppercase px-1">{language === 'ar' ? 'رقم القيد المرتبط' : 'Linked Journal Entry'}</label>
                            <div className="relative group">
                              <Layers className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-emerald-500 pointer-events-none transition-colors`} />
                              <input 
                                readOnly
                                type="text" 
                                className="w-full ps-9 pe-3 h-9 bg-emerald-50 border border-transparent rounded-xl outline-none transition-all font-bold text-emerald-800 text-xs"
                                value={editingTransfer.entry_number}
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center justify-between px-1">
                            <label className="block text-[11px] font-bold text-zinc-500 uppercase">{t('common.amount')}</label>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                              {formData.from_currency}
                            </span>
                          </div>
                          <div className="relative group">
                            <Coins className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-zinc-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors`} />
                            <input 
                              required
                              type="text" 
                              placeholder="0.00"
                              className="w-full ps-9 pe-3 h-9 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500 outline-none transition-all font-black text-emerald-600 text-sm"
                              value={isAmountFocused ? (formData.amount || '') : formatNumber(formData.amount)}
                              onFocus={() => setIsAmountFocused(true)}
                              onBlur={() => {
                                setIsAmountFocused(false);
                                const cleanVal = parseNumber(formData.amount);
                                handleAmountChange(cleanVal);
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^[0-9.,]*$/.test(val)) {
                                  const parsed = parseNumber(val);
                                  handleAmountChange(parsed);
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-zinc-500 uppercase px-1">{t('common.notes')}</label>
                        <div className="relative group">
                          <FileText className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-zinc-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors`} />
                          <textarea 
                            className="w-full ps-9 pe-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500 outline-none transition-all font-medium text-zinc-800 text-xs min-h-[60px] resize-none"
                            rows={2}
                            placeholder={language === 'ar' ? 'وصف إضافي لعملية التحويل...' : 'Additional description for the transfer...'}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          />
                        </div>
                      </div>
                    </section>

                    {/* Treasury / Bank Selection Cards */}
                    <div className="space-y-3">
                      <section className="bg-white p-4 md:p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-3 relative pt-10 overflow-hidden">
                        <div className="absolute top-3 right-4 flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100">
                          <Wallet className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'من بنك / خزينة (المصدر)' : 'From Bank / Safe (Source)'}</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-zinc-500 uppercase px-1">{language === 'ar' ? 'اختر المصدر' : 'Select Source'}</label>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">
                                {formData.from_currency}
                              </span>
                              <button 
                                type="button"
                                onClick={() => setIsPaymentMethodModalOpen(true)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg transition-colors"
                              >
                                <Plus size={12} />
                                {language === 'ar' ? 'إضافة بنك / خزينة' : 'Add Bank / Safe'}
                              </button>
                            </div>
                          </div>
                          <div className="relative group">
                            <Wallet className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-zinc-400 pointer-events-none group-focus-within:text-red-500 transition-colors`} />
                            <select
                              required
                              className="w-full ps-9 pe-8 h-9 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:bg-white focus:border-red-500 outline-none transition-all appearance-none font-bold text-zinc-800 text-xs"
                              value={formData.from_payment_method_id}
                              onChange={(e) => handleFromPmChange(e.target.value)}
                            >
                              <option value="">{language === 'ar' ? 'اختر المصدر...' : 'Select Source...'}</option>
                              {paymentMethods.map(pm => (
                                <option key={pm.id} value={pm.id}>
                                  {pm.name} ({getPmCurrency(pm.id)})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-2.5 w-4 h-4 text-zinc-400 transition-transform group-focus-within:rotate-180`} />
                          </div>
                        </div>
                      </section>

                      <section className="bg-white p-4 md:p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-3 relative pt-10 overflow-hidden">
                        <div className="absolute top-3 right-4 flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                          <Wallet className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'إلى بنك / خزينة (الوجهة)' : 'To Bank / Safe (Destination)'}</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-zinc-500 uppercase px-1">{language === 'ar' ? 'اختر الوجهة' : 'Select Destination'}</label>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {formData.to_currency}
                            </span>
                          </div>
                          <div className="relative group">
                            <Wallet className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-zinc-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors`} />
                            <select
                              required
                              className="w-full ps-9 pe-8 h-9 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500 outline-none transition-all appearance-none font-bold text-zinc-800 text-xs"
                              value={formData.to_payment_method_id}
                              onChange={(e) => handleToPmChange(e.target.value)}
                            >
                              <option value="">{language === 'ar' ? 'اختر الوجهة...' : 'Select Destination...'}</option>
                              {paymentMethods.map(pm => (
                                <option key={pm.id} value={pm.id}>
                                  {pm.name} ({getPmCurrency(pm.id)})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-2.5 w-4 h-4 text-zinc-400 transition-transform group-focus-within:rotate-180`} />
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>

                  {/* Multi-Currency Conversion Card (Shown when currencies differ) */}
                  {formData.from_currency !== formData.to_currency && formData.from_payment_method_id && formData.to_payment_method_id && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-amber-50/70 border border-amber-200/90 rounded-2xl p-4 shadow-sm space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
                        <div className="flex items-center gap-2 text-amber-900">
                          <Coins className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-black">
                            {language === 'ar' ? 'تحويل بين عملات مختلفة' : 'Cross-Currency Transfer'}: ({formData.from_currency} ➔ {formData.to_currency})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchSystemRate(formData.from_currency, formData.to_currency, formData.amount)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 w-fit"
                          title="تحديث سعر الصرف تلقائياً من إعدادات النظام"
                        >
                          <RotateCcw size={12} />
                          <span>{language === 'ar' ? '🔄 سعر الصرف من النظام' : '🔄 System Rate'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-amber-950">
                            {language === 'ar' ? 'سعر الصرف' : 'Exchange Rate'}
                            <span className="text-[10px] text-zinc-500 font-normal ms-1">
                              (1 {formData.from_currency} = {formData.exchange_rate} {formData.to_currency})
                            </span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.0001"
                              min="0.0001"
                              className="w-full h-9 px-3 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-mono font-bold text-amber-900"
                              value={formData.exchange_rate || ''}
                              onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-amber-950">
                            {language === 'ar' ? `المبلغ المحول إليه (${formData.to_currency})` : `Converted Amount (${formData.to_currency})`}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full h-9 px-3 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-mono font-black text-emerald-700"
                              value={formData.converted_amount || ''}
                              onChange={(e) => handleConvertedAmountChange(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-amber-200/50 flex flex-wrap items-center justify-between text-xs font-semibold text-amber-900 gap-2">
                        <span>
                          {language === 'ar' ? 'المبلغ المخصوم:' : 'Debited:'}{' '}
                          <strong className="font-mono text-red-600">{formatNumber(formData.amount)} {formData.from_currency}</strong>
                        </span>
                        <span className="text-zinc-400">➔</span>
                        <span>
                          {language === 'ar' ? 'المبلغ المودع:' : 'Credited:'}{' '}
                          <strong className="font-mono text-emerald-600">{formatNumber(formData.converted_amount)} {formData.to_currency}</strong>
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Attachments Section */}
                  <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm max-w-4xl mx-auto w-full mt-6">
                    <AttachmentsManager
                      attachments={attachments}
                      onChange={setAttachments}
                    />
                  </div>

                  {/* Action Footer */}
                  <div className="flex gap-4 p-6 bg-transparent border-t border-zinc-100 sticky bottom-4 z-[90] mt-auto max-w-4xl mx-auto w-full">
                    <button 
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-4 bg-white text-zinc-600 rounded-[1.5rem] font-bold border border-zinc-200 hover:bg-zinc-100 transition-all active:scale-95 shadow-lg shadow-black/5"
                    >
                      {t('common.cancel')}
                    </button>
                    <button 
                      type="submit"
                      disabled={formData.amount <= 0 || !formData.from_payment_method_id || !formData.to_payment_method_id}
                      className="flex-[2] py-4 bg-emerald-500 text-white rounded-[1.5rem] font-black uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/30 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                    >
                      <Save className="w-6 h-6 animate-pulse" />
                      <span>{editingTransfer ? t('common.save') : (language === 'ar' ? 'إبرام التحويل' : 'Execute Transfer')}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">{language === 'ar' ? 'حذف التحويل؟' : 'Delete Transfer?'}</h3>
              <p className="text-zinc-500 mb-8 font-medium">{language === 'ar' ? 'هل أنت متأكد من حذف هذه العملية؟ سيتم حذف القيد المحاسبي المرتبط بها أيضاً.' : 'Are you sure you want to delete this transfer? The associated journal entry will also be deleted.'}</p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all active:scale-95"
                >
                  {language === 'ar' ? 'نعم، احذف' : 'Yes, Delete'}
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Payment Method Modal (Treasury) */}
      <AnimatePresence>
        {isPaymentMethodModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-zinc-900">{language === 'ar' ? 'إضافة خزينة جديدة' : 'Add New Safe'}</h3>
                <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
              </div>
              
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <form onSubmit={handlePaymentMethodSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'كود الخزينة' : 'Safe Code'}</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input
                          required
                          type="text"
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                          value={paymentMethodFormData.code}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, code: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'اسم الخزينة' : 'Safe Name'}</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input
                          required
                          type="text"
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                          value={paymentMethodFormData.name}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'النوع' : 'Type'}</label>
                      <div className="relative">
                        <Layers className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <select
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none font-bold"
                          value={paymentMethodFormData.type}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, type: e.target.value as any })}
                        >
                          <option value="cash">{language === 'ar' ? 'نقدي (خزينة)' : 'Cash Safe'}</option>
                          <option value="bank">{language === 'ar' ? 'بنكي' : 'Bank Account'}</option>
                          <option value="wallet">{language === 'ar' ? 'محفظة إلكترونية' : 'Electronic Wallet'}</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'الحساب المحاسبي' : 'Ledger Account'}</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                        value={paymentMethodFormData.account_id}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, account_id: e.target.value })}
                      >
                        <option value="">{language === 'ar' ? 'اختر الحساب...' : 'Select Account...'}</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                          value={paymentMethodFormData.opening_balance}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'تاريخ الرصيد' : 'Opening Date'}</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="date" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                          value={paymentMethodFormData.opening_balance_date}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {paymentMethodFormData.opening_balance !== 0 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'حساب الطرف الآخر (للرصيد الافتتاحي)' : 'Counter Account (Opening)'}</label>
                        <select
                          required
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all border-emerald-200 bg-emerald-50/30 font-bold"
                          value={paymentMethodFormData.counter_account_id}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, counter_account_id: e.target.value })}
                        >
                          <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select Counter Account...'}</option>
                          {accounts.map(account => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {paymentMethodFormData.counter_account_id && paymentMethodFormData.account_id && (
                        <JournalEntryPreview 
                          title={language === 'ar' ? 'معاينة قيد الرصيد الافتتاحي' : 'Preview Opening Balance JE'}
                          items={[
                            {
                              account_name: accounts.find(a => a.id === paymentMethodFormData.account_id)?.name || 'حساب طريقة الدفع',
                              debit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                              credit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                              description: 'رصيد افتتاحي'
                            },
                            {
                              account_name: accounts.find(a => a.id === paymentMethodFormData.counter_account_id)?.name || 'حساب الطرف الآخر',
                              debit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                              credit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                              description: `رصيد افتتاحي للخزينة: ${paymentMethodFormData.name}`
                            }
                          ]}
                        />
                      )}
                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      حفظ الخزينة
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsPaymentMethodModalOpen(false)}
                      className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Side Panel for View */}
      <AnimatePresence>
        {showSidePanel && viewTransfer && (
          <div className="fixed inset-0 z-[110] flex justify-end bg-zinc-900/20 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">{language === 'ar' ? 'تفاصيل التحويل بين البنوك والخزائن' : 'Transfer Details'}</h3>
                <button onClick={() => setShowSidePanel(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-tighter mb-1">{language === 'ar' ? 'المبلغ المحول' : 'Transferred Amount'}</p>
                    <p className="text-2xl font-black text-emerald-600">
                      {formatNumber(viewTransfer.amount)} {viewTransfer.from_currency || 'EGP'}
                    </p>
                    {viewTransfer.from_currency && viewTransfer.to_currency && viewTransfer.from_currency !== viewTransfer.to_currency && (
                      <p className="text-xs text-zinc-500 font-medium mt-1">
                        ↳ {language === 'ar' ? 'المستلم:' : 'Received:'} {formatNumber(viewTransfer.converted_amount || viewTransfer.amount)} {viewTransfer.to_currency} <span className="text-zinc-400">({language === 'ar' ? 'سعر الصرف:' : 'Rate:'} {viewTransfer.exchange_rate || 1})</span>
                      </p>
                    )}
                  </div>
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                    <ArrowLeftRight size={28} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-100">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{language === 'ar' ? 'من بنك / خزينة' : 'From Bank/Safe'}</p>
                    <p className="font-bold text-zinc-900 text-xs">{viewTransfer.from_payment_method_name}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200/70 text-zinc-700">
                      {viewTransfer.from_currency || 'EGP'}
                    </span>
                  </div>
                  <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-100">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{language === 'ar' ? 'إلى بنك / خزينة' : 'To Bank/Safe'}</p>
                    <p className="font-bold text-zinc-900 text-xs">{viewTransfer.to_payment_method_name}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {viewTransfer.to_currency || 'EGP'}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  {viewTransfer.transfer_number && (
                    <div className="flex items-center gap-3 text-zinc-600">
                      <Hash size={18} className="text-zinc-400" />
                      <span className="font-bold">رقم التحويل:</span>
                      <span className="font-mono font-bold bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100">
                        {viewTransfer.transfer_number}
                      </span>
                    </div>
                  )}
                  {viewTransfer.entry_number && (
                    <div className="flex items-center gap-3 text-zinc-600">
                      <Layers size={18} className="text-zinc-400" />
                      <span className="font-bold">رقم القيد:</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSidePanel(false);
                          setPendingViewDoc({ type: 'journal', idOrNumber: viewTransfer.entry_number! });
                          setCurrentPage('journal_entries');
                        }}
                        className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50"
                      >
                        {viewTransfer.entry_number}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-zinc-600">
                    <Calendar size={18} className="text-zinc-400" />
                    <span className="font-bold">التاريخ: {formatDate(viewTransfer.date)}</span>
                  </div>
                  <div className="flex items-start gap-3 text-zinc-600">
                    <FileText size={18} className="text-zinc-400 mt-1" />
                    <div className="flex-1">
                      <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">الوصف</p>
                      <p className="font-medium leading-relaxed">{viewTransfer.description}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-100">
                  <AttachmentsManager
                    attachments={viewTransfer.attachments || []}
                    readOnly={true}
                  />
                </div>

                <div className="pt-6 border-t border-zinc-100">
                  <h4 className="text-sm font-black text-zinc-900 mb-4 flex items-center gap-2">
                    <History size={16} className="text-emerald-500" />
                    سجل الحركات المرتبطة
                  </h4>
                  <InlineActivityLog category="cash_transfers" documentId={viewTransfer.id} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
