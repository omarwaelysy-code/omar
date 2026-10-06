import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Account, AccountType, JournalEntry } from '../types';
import { Search, Plus, Trash2, Edit2, X, History, Sparkles, Hash, FileText, BookOpen, User, Layers, AlertCircle, LayoutGrid, List, ChevronRight, ChevronLeft, Save, ChevronDown, CheckCircle2, Upload, Wallet, Calendar, Lock } from 'lucide-react';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { parseAccount } from '../services/geminiService';
import { ExportButtons } from '../components/ExportButtons';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { useRef } from 'react';
import { useViewPreference } from '../hooks/useViewPreference';
import { useNavigation } from '../contexts/NavigationContext';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { ACCOUNT_USAGE_OPTIONS, getAccountUsageLabel, ACCOUNT_USAGE_GROUPS } from '../utils/accountUsageUtils';
import { generateDefaultCOA } from '../services/coaService';
import { AccountExcelImportModal } from '../components/AccountExcelImportModal';

export const Accounts: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { setCurrentPage, setPendingAccountTypeEditId } = useNavigation();
  const [view, setView] = useViewPreference('accounts', 'card');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [types, setTypes] = useState<AccountType[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiText, setAiText] = useState('');
  const [isUsageDropdownOpen, setIsUsageDropdownOpen] = useState(false);
  const [usageSearchTerm, setUsageSearchTerm] = useState('');
  const [isCoaWizardOpen, setIsCoaWizardOpen] = useState(false);
  const [coaBusinessType, setCoaBusinessType] = useState<'commercial' | 'service' | 'all'>('all');
  const [coaLanguage, setCoaLanguage] = useState<'ar' | 'en'>(language || 'ar');
  const [isGeneratingCoa, setIsGeneratingCoa] = useState(false);
  const [coaProgress, setCoaProgress] = useState('');
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [defaultAccountMap, setDefaultAccountMap] = useState<Record<string, string>>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const usageDropdownRef = useRef<HTMLDivElement>(null);

  const getClassificationLabel = (classification?: string) => {
    if (!classification) return '';
    switch (classification) {
      case 'asset': return language === 'ar' ? 'أصل' : 'Asset';
      case 'liability': return language === 'ar' ? 'التزام' : 'Liability';
      case 'equity': return language === 'ar' ? 'حقوق ملكية' : 'Equity';
      case 'liability_equity': return language === 'ar' ? 'التزام/حقوق ملكية' : 'Liability/Equity';
      case 'cash_and_equivalents': return language === 'ar' ? 'نقدية وما في حكمها' : 'Cash & Cash Equivalents';
      case 'receivables': return language === 'ar' ? 'عملاء' : 'Customers / Receivables';
      case 'payables': return language === 'ar' ? 'موردين' : 'Suppliers / Payables';
      case 'revenue': return language === 'ar' ? 'إيراد' : 'Revenue';
      case 'cost': return language === 'ar' ? 'تكلفة' : 'Cost';
      case 'expense': return language === 'ar' ? 'مصروف' : 'Expense';
      case 'interest_expense': return language === 'ar' ? 'فوائد مدينة' : 'Debit Interest';
      case 'depreciation': return language === 'ar' ? 'إهلاكات' : 'Depreciation';
      case 'other_revenue': return language === 'ar' ? 'إيرادات أخرى' : 'Other Revenues';
      case 'other_expense': return language === 'ar' ? 'مصروفات أخرى' : 'Other Expenses';
      default: return classification;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (usageDropdownRef.current && !usageDropdownRef.current.contains(event.target as Node)) {
        setIsUsageDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const groupedAndFilteredOptions = React.useMemo(() => {
    return ACCOUNT_USAGE_GROUPS.map(group => {
      const filteredItems = ACCOUNT_USAGE_OPTIONS.filter(opt => {
        if (!group.keys.includes(opt.key)) return false;
        if (!usageSearchTerm.trim()) return true;
        const query = usageSearchTerm.toLowerCase();
        return opt.ar.toLowerCase().includes(query) || opt.en.toLowerCase().includes(query) || opt.key.toLowerCase().includes(query);
      });
      return {
        ...group,
        items: filteredItems
      };
    });
  }, [usageSearchTerm]);

  const macroGroupedOptions = React.useMemo(() => {
    const map = new Map<string, { macroAr: string; macroEn: string; groups: typeof groupedAndFilteredOptions }>();
    
    groupedAndFilteredOptions.forEach(group => {
      if (group.items.length === 0) return;
      const key = group.macroAr;
      if (!map.has(key)) {
        map.set(key, {
          macroAr: group.macroAr,
          macroEn: group.macroEn,
          groups: []
        });
      }
      map.get(key)!.groups.push(group);
    });
    
    return Array.from(map.values());
  }, [groupedAndFilteredOptions]);

  const formatMoney = (val: number) => {
    return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const accountBalances = React.useMemo(() => {
    const balances: Record<string, { current: number; debit: number; credit: number }> = {};
    accounts.forEach(acc => {
      balances[acc.id] = {
        current: Number(acc.opening_balance || 0),
        debit: 0,
        credit: 0
      };
    });

    entries.forEach(entry => {
      const itemsList = (entry.items && Array.isArray(entry.items)) ? entry.items : ((entry as any).lines || []);
      itemsList.forEach((item: any) => {
        if (item.account_id && balances[item.account_id]) {
          balances[item.account_id].debit += Number(item.debit || 0);
          balances[item.account_id].credit += Number(item.credit || 0);
        }
      });
    });

    accounts.forEach(acc => {
      const type = types.find(t => t.id === acc.type_id);
      const classification = type?.classification || '';
      const b = balances[acc.id];
      if (!b) return;
      const isDebitNormal = ['asset', 'expense', 'cost', 'cash_and_equivalents', 'receivables', 'interest_expense', 'depreciation', 'other_expense'].includes(classification);
      const opening = Number(acc.opening_balance || 0);
      if (isDebitNormal) {
        b.current = opening + (b.debit - b.credit);
      } else {
        b.current = opening + (b.credit - b.debit);
      }
    });

    return balances;
  }, [accounts, entries, types]);

  // Enterprise Audit Trail Lock for Accounts
  const isAccountLocked = useMemo(() => {
    if (!editingAccount) return false;
    const hasTx = entries.some(entry => {
      const itemsList = (entry.items && Array.isArray(entry.items)) ? entry.items : ((entry as any).lines || []);
      return itemsList.some((item: any) => item.account_id === editingAccount.id);
    });
    const bal = accountBalances[editingAccount.id];
    const hasBalance = bal && (bal.debit !== 0 || bal.credit !== 0);
    const hasChildren = accounts.some(a => a.parent_id === editingAccount.id);
    return Boolean(hasTx || hasBalance || hasChildren);
  }, [editingAccount, entries, accountBalances, accounts]);

  const handleExportExcel = () => {
    const headers = {
      'code': language === 'ar' ? 'كود الحساب' : 'Account Code',
      'name': language === 'ar' ? 'اسم الحساب' : 'Account Name',
      'type_name': language === 'ar' ? 'نوع الحساب' : 'Account Type',
      'type_code': language === 'ar' ? 'كود النوع' : 'Type Code',
      'statement_type': language === 'ar' ? 'التابعية (القائمة)' : 'Statement',
      'classification': language === 'ar' ? 'التصنيف' : 'Classification',
      'account_usage_label': language === 'ar' ? 'استخدام الحساب' : 'Account Usage',
      'parent_name': language === 'ar' ? 'الحساب الأب' : 'Parent Account',
      'opening_balance': language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance',
      'opening_balance_date': language === 'ar' ? 'تاريخ الرصيد' : 'Opening Date',
      'current_balance': language === 'ar' ? 'الرصيد الحالي' : 'Current Balance',
      'status': language === 'ar' ? 'الحالة' : 'Status'
    };
    const mappedAccounts = accounts.map(a => {
      const type = types.find(t => t.id === a.type_id);
      const parent = accounts.find(p => p.id === a.parent_id);
      const bal = accountBalances[a.id]?.current ?? Number(a.opening_balance || 0);
      return {
        ...a,
        type_name: type?.name || a.type_name || '',
        type_code: type?.code || '',
        statement_type: type?.statement_type === 'balance_sheet' 
          ? (language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet') 
          : (type?.statement_type === 'income_statement' ? (language === 'ar' ? 'قائمة الدخل' : 'Income Statement') : ''),
        classification: getClassificationLabel(type?.classification),
        account_usage_label: getAccountUsageLabel(a.account_usage, language),
        parent_name: parent ? `${parent.code} - ${parent.name}` : '-',
        opening_balance: Number(a.opening_balance || 0),
        opening_balance_date: a.opening_balance_date || '-',
        current_balance: bal,
        status: a.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'معطل' : 'Inactive')
      };
    });
    const formattedData = formatDataForExcel(mappedAccounts, headers);
    exportToExcel(formattedData, { filename: 'Accounts_List', sheetName: language === 'ar' ? 'دليل الحسابات' : 'Accounts' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Accounts_List',
        reportTitle: t('accounts.title')
      });
    }
  };

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type_id: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    counter_account_id: '',
    required_sub_account: false,
    parent_id: '',
    is_active: true,
    account_usage: ''
  });

  useEffect(() => {
    if (user?.company_id) {
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubTypes = dbService.subscribe<AccountType>('account_types', user.company_id, setTypes);
      const unsubJournals = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, setEntries);
      const unsubDefaults = dbService.subscribe<any>('default_account_mappings', user.company_id, (data) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r: any) => { if (r.setting_key && r.account_id) map[r.setting_key] = r.account_id; });
        setDefaultAccountMap(map);
      });
      setLoading(false);
      return () => {
        unsubAccounts();
        unsubTypes();
        unsubJournals();
        unsubDefaults();
      };
    }
  }, [user?.company_id]);

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setIsAiParsing(true);
    try {
      const result = await parseAccount(aiText);
      if (result) {
        const matchingType = types.find(t => t.name.includes(result.typeName) || result.typeName.includes(t.name));
        setFormData({
          code: result.code || '',
          name: result.name || '',
          type_id: matchingType?.id || '',
          opening_balance: 0,
          opening_balance_date: new Date().toISOString().slice(0, 10),
          counter_account_id: '',
          required_sub_account: result.name?.toLowerCase().includes('عملاء') || result.name?.toLowerCase().includes('موردين') || false,
          parent_id: '',
          is_active: true,
          account_usage: ''
        });
        showNotification(t('common.ai_parse_success'), 'success');
        setAiText('');
      }
    } catch (error) {
      console.error(error);
      showNotification(t('common.ai_parse_error'), 'error');
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleGenerateCOA = async () => {
    if (!user) return;
    try {
      setIsGeneratingCoa(true);
      await generateDefaultCOA(user.company_id, user.id, user.username, coaLanguage, coaBusinessType, setCoaProgress);
      setIsCoaWizardOpen(false);
      showNotification(language === 'ar' ? 'تم توليد الدليل المحاسبي بنجاح' : 'Chart of Accounts generated successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء بناء الدليل' : 'Error generating COA', 'error');
    } finally {
      setIsGeneratingCoa(false);
      setCoaProgress('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.account_usage || formData.account_usage === 'other' || formData.account_usage === 'none') {
      showNotification(language === 'ar' ? 'يرجى اختيار استخدام الحساب من القائمة (إلزامي)' : 'Please select account usage from the list (required)', 'error');
      return;
    }

    if (editingAccount && isAccountLocked) {
      if (formData.code !== editingAccount.code || formData.type_id !== editingAccount.type_id || formData.account_usage !== editingAccount.account_usage) {
        showNotification(language === 'ar' ? 'لا يمكن تعديل كود أو نوع أو استخدام الحساب لوجود حركات وقيود مسجلة عليه - حفاظاً على توازن ميزان المراجعة.' : 'Cannot alter account code, type, or usage when transactions exist.', 'error');
        return;
      }
    }

    const selectedType = types.find(t => t.id === formData.type_id);
    const accountData = {
      ...formData,
      type_name: selectedType?.name || '',
      company_id: user.company_id
    };

    try {
      let id = '';
      if (editingAccount) {
        const fieldsToTrack = [
          { field: 'code', label: 'الكود' },
          { field: 'name', label: 'الاسم' },
          { field: 'type_id', label: 'نوع الحساب' },
          { field: 'required_sub_account', label: 'يلزم حساب فرعي' },
          { field: 'is_active', label: 'نشط' },
          { field: 'account_usage', label: 'استخدام الحساب' }
        ];
        await dbService.updateWithLog(
          'accounts',
          editingAccount.id,
          accountData,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل حساب',
          'accounts',
          fieldsToTrack
        );
        id = editingAccount.id;
        showNotification('تم تحديث بيانات الحساب بنجاح', 'success');
      } else {
        id = await dbService.add('accounts', accountData);
        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة حساب', `إضافة حساب جديد: ${formData.name}`, 'accounts', id);
        showNotification('تم إضافة الحساب بنجاح', 'success');
      }

      // Handle automatic opening balance journal entry
      if (formData.opening_balance !== 0) {
        await dbService.deleteJournalEntryByReference(id, user.company_id);
        const absBalance = Math.abs(formData.opening_balance);
        const isNegative = formData.opening_balance < 0;
        const counterAcc = accounts.find(a => a.id === formData.counter_account_id) || 
                           accounts.find(a => ['opening_balance', 'capital', 'equity', 'retained_earnings'].includes(a.account_usage || ''));

        if (counterAcc) {
          await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: formData.opening_balance_date || new Date().toISOString().slice(0, 10),
            description: `رصيد افتتاحي لحساب: ${formData.name}`,
            reference_id: id,
            reference_type: 'opening_balance',
            items: [
              {
                account_id: id,
                account_name: formData.name,
                debit: isNegative ? 0 : absBalance,
                credit: isNegative ? absBalance : 0,
                description: `رصيد افتتاحي: ${formData.name}`
              },
              {
                account_id: counterAcc.id,
                account_name: counterAcc.name,
                debit: isNegative ? absBalance : 0,
                credit: isNegative ? 0 : absBalance,
                description: `الطرف المقابل للرصيد الافتتاحي: ${formData.name}`
              }
            ],
            total_debit: absBalance,
            total_credit: absBalance,
            created_at: new Date().toISOString(),
            created_by: user.id
          });
        }
      } else if (editingAccount) {
        await dbService.deleteJournalEntryByReference(editingAccount.id, user.company_id);
      }

      closeModal();
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  const isDefaultAccount = (account: Account) => {
    const isMapped = Object.values(defaultAccountMap).includes(account.id);
    const CORE_DEFAULT_CODES = [
      '110101', '110103', '110201', '110301', '110402', '110403',
      '210101', '210202', '210203', '3101', '3103', '3104',
      '4101', '4103', '4104', '5101', '5103', '5104', '5105',
      '420201', '630201', '420202', '630202'
    ];
    return isMapped || CORE_DEFAULT_CODES.includes(account.code);
  };

  const handleDelete = (id: string) => {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    if (isDefaultAccount(account)) {
      showNotification('لا يمكن حذف هذا الحساب لأنه حساب افتراضي معتمد ومحمي من الحذف.', 'error');
      return;
    }

    // 1. Check if account has sub-accounts / children
    const hasChildren = accounts.some(a => a.parent_id === account.id);
    if (hasChildren) {
      showNotification(language === 'ar' ? `لا يمكن حذف الحساب "${account.name}" لأنه حساب رئيسي تتبعه حسابات فرعية.` : `Cannot delete account "${account.name}" because it has child accounts.`, 'error');
      return;
    }

    // 2. Check if account has recorded movements/transactions in journal entries
    const hasTransactions = entries.some(entry => {
      const itemsList = (entry.items && Array.isArray(entry.items)) ? entry.items : ((entry as any).lines || []);
      return itemsList.some((item: any) => item.account_id === id);
    });
    const bal = accountBalances[id];
    const hasMovements = hasTransactions || (bal && (bal.debit !== 0 || bal.credit !== 0));
    if (hasMovements) {
      showNotification(language === 'ar' ? `لا يمكن حذف الحساب "${account.name}" لوجود حركات وقيود مسجلة عليه حالياً.` : `Cannot delete account "${account.name}" because it has recorded transactions.`, 'error');
      return;
    }

    setAccountToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete || !user) return;
    try {
      const account = accounts.find(a => a.id === accountToDelete);
      if (!account) return;

      // Double-check constraints
      const hasChildren = accounts.some(a => a.parent_id === account.id);
      if (hasChildren) {
        showNotification(language === 'ar' ? `لا يمكن حذف الحساب "${account.name}" لأنه حساب رئيسي تتبعه حسابات فرعية.` : `Cannot delete account "${account.name}" because it has child accounts.`, 'error');
        setIsDeleteModalOpen(false);
        setAccountToDelete(null);
        return;
      }

      const hasTransactions = entries.some(entry => {
        const itemsList = (entry.items && Array.isArray(entry.items)) ? entry.items : ((entry as any).lines || []);
        return itemsList.some((item: any) => item.account_id === account.id);
      });
      const bal = accountBalances[account.id];
      const hasMovements = hasTransactions || (bal && (bal.debit !== 0 || bal.credit !== 0));
      if (hasMovements) {
        showNotification(language === 'ar' ? `لا يمكن حذف الحساب "${account.name}" لوجود حركات وقيود مسجلة عليه حالياً.` : `Cannot delete account "${account.name}" because it has recorded transactions.`, 'error');
        setIsDeleteModalOpen(false);
        setAccountToDelete(null);
        return;
      }

      await dbService.delete('accounts', accountToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف حساب', `حذف الحساب: ${account?.name}`, 'accounts', accountToDelete);
      setIsDeleteModalOpen(false);
      setAccountToDelete(null);
      showNotification('تم حذف الحساب بنجاح', 'success');
    } catch (e: any) {
      console.error(e);
      showNotification(e?.message || 'حدث خطأ أثناء الحذف', 'error');
    }
  };

  const openModal = (account?: Account) => {
    setIsUsageDropdownOpen(false);
    setUsageSearchTerm('');
    if (account) {
      // Robust boolean conversion for Postgres (handles true, 'true', 1, 't', etc.)
      const rawVal = (account as any).required_sub_account;
      const requiredSubAccount = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === 't' || rawVal === '1';

      setEditingAccount(account);
      const linkedJe = entries.find(e => 
        (e.reference_id === account.id || e.reference_number === account.code || e.description?.includes(account.name)) && 
        e.reference_type === 'opening_balance'
      );
      const counterLine = linkedJe?.items?.find((it: any) => it.account_id !== account.id);

      const newFormData = {
        code: account.code,
        name: account.name,
        type_id: account.type_id,
        opening_balance: account.opening_balance || 0,
        opening_balance_date: linkedJe?.date ? new Date(linkedJe.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        counter_account_id: counterLine?.account_id || '',
        required_sub_account: requiredSubAccount,
        parent_id: account.parent_id || '',
        is_active: account.is_active !== false,
        account_usage: account.account_usage || ''
      };

      setFormData(newFormData);
    } else {
      setEditingAccount(null);
      setFormData({
        code: '',
        name: '',
        type_id: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        counter_account_id: '',
        required_sub_account: false,
        parent_id: '',
        is_active: true,
        account_usage: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setAiText('');
    setIsUsageDropdownOpen(false);
    setUsageSearchTerm('');
  };

  const sortedFilteredAccounts = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = accounts.filter(a => {
      if (!term) return true;
      const type = types.find(t => t.id === a.type_id);
      const parent = accounts.find(p => p.id === a.parent_id);
      const usage = getAccountUsageLabel(a.account_usage, language);
      const classification = type ? getClassificationLabel(type.classification) : '';
      return (
        a.name.toLowerCase().includes(term) ||
        a.code.toLowerCase().includes(term) ||
        (type?.name && type.name.toLowerCase().includes(term)) ||
        (type?.code && type.code.toLowerCase().includes(term)) ||
        (parent?.name && parent.name.toLowerCase().includes(term)) ||
        (parent?.code && parent.code.toLowerCase().includes(term)) ||
        usage.toLowerCase().includes(term) ||
        classification.toLowerCase().includes(term)
      );
    });

    return [...filtered].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [accounts, searchTerm, types, language]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500 max-w-[1600px] mx-auto p-3 md:p-6" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 italic serif">{t('accounts.title')}</h2>
            <p className="text-xs text-slate-500 font-medium">{t('accounts.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => {
              setActivityLogDocumentId(undefined);
              setIsActivityLogOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-xs text-xs"
            title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
          >
            <History size={16} />
            <span className="hidden md:inline">{language === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
          </button>
          <ExportButtons 
            onExportExcel={handleExportExcel} 
            onExportPDF={handleExportPDF} 
          />
          <button 
            onClick={() => setIsExcelImportModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 transition-all active:scale-95 shadow-xs text-xs"
            title={language === 'ar' ? 'استيراد دليل الحسابات والأنواع من إكسيل' : 'Import Accounts from Excel'}
          >
            <Upload size={16} className="text-emerald-600" />
            <span className="hidden md:inline">{language === 'ar' ? 'استيراد إكسيل' : 'Import Excel'}</span>
          </button>
          {accounts.length === 0 && (
            <button 
              onClick={() => setIsCoaWizardOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-all active:scale-95 border border-indigo-200 text-xs"
              title={language === 'ar' ? 'إنشاء دليل محاسبي افتراضي' : 'Generate Default COA'}
            >
              <Sparkles size={16} />
              <span className="hidden md:inline">{language === 'ar' ? 'دليل آلي' : 'Auto COA'}</span>
            </button>
          )}
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20 active:scale-95 border border-emerald-500/50 text-xs"
          >
            <Plus size={16} />
            {t('accounts.add')}
          </button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 group w-full">
          <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={16} />
          <input 
            type="text" 
            placeholder={language === 'ar' ? 'بحث باسم الحساب، الكود، النوع، التصنيف أو الاستخدام...' : t('accounts.search_placeholder')}
            className={`w-full ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all font-bold text-xs text-slate-900 placeholder:text-slate-400`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex bg-zinc-100 p-1 rounded-xl gap-1 shrink-0">
          <button 
            type="button"
            onClick={() => setView('card')} 
            className={`p-1.5 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-400 hover:text-slate-700'}`}
            title="عرض كروت"
          >
            <LayoutGrid size={16} />
          </button>
          <button 
            type="button"
            onClick={() => setView('table')} 
            className={`p-1.5 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-400 hover:text-slate-700'}`}
            title="عرض جدول"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {view === 'table' && !loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs" dir={dir}>
          <div className="overflow-x-auto custom-scrollbar">
            <table ref={tableRef} className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold whitespace-nowrap">
                  <th className="py-1.5 px-1.5 w-7 text-center text-slate-400">#</th>
                  <th className="py-1.5 px-1.5 w-20">كود الحساب</th>
                  <th className="py-1.5 px-2 min-w-[130px]">اسم الحساب</th>
                  <th className="py-1.5 px-1.5 w-16 text-center text-slate-800">كود النوع</th>
                  <th className="py-1.5 px-1.5 min-w-[100px]">نوع الحساب</th>
                  <th className="py-1.5 px-1.5 w-24 text-center">تابع لـ (القائمة)</th>
                  <th className="py-1.5 px-1.5 w-20 text-center">التصنيف</th>
                  <th className="py-1.5 px-1.5 min-w-[95px]">استخدام الحساب</th>
                  <th className="py-1.5 px-1.5 min-w-[100px]">الحساب الأب</th>
                  <th className="py-1.5 px-1.5 w-24 text-center">الرصيد الافتتاحي</th>
                  <th className="py-1.5 px-1.5 w-20 text-center">تاريخ الرصيد</th>
                  <th className="py-1.5 px-1.5 w-24 text-center">الرصيد الحالي</th>
                  <th className="py-1.5 px-1 w-12 text-center">فرعي</th>
                  <th className="py-1.5 px-1 w-12 text-center">الحالة</th>
                  <th className="py-1.5 px-1 w-16 text-center no-pdf">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {sortedFilteredAccounts.map((account, index) => {
                  const type = types.find(t => t.id === account.type_id);
                  const parent = accounts.find(p => p.id === account.parent_id);
                  const bal = accountBalances[account.id]?.current ?? Number(account.opening_balance || 0);
                  const opening = Number(account.opening_balance || 0);
                  const isOpeningDebit = opening > 0;

                  return (
                    <tr 
                      key={account.id}
                      onClick={() => openModal(account)}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    >
                      {/* 1. Index */}
                      <td className="py-0.5 px-1.5 text-center font-mono text-[10px] text-slate-400">
                        {index + 1}
                      </td>

                      {/* 2. Code */}
                      <td className="py-0.5 px-1.5 font-mono font-bold text-emerald-600 text-xs whitespace-nowrap">
                        {account.code}
                      </td>

                      {/* 3. Name */}
                      <td className="py-0.5 px-2 font-bold text-slate-900 text-xs whitespace-nowrap">
                        {account.name}
                      </td>

                      {/* NEW: Type Code */}
                      <td className="py-0.5 px-1.5 text-center font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
                        {type?.code || '-'}
                      </td>

                      {/* 4. Type Name */}
                      <td 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingAccountTypeEditId(account.type_id);
                          setCurrentPage('account_types');
                        }}
                        className="py-0.5 px-1.5 text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer font-bold whitespace-nowrap text-xs"
                        title="انتقل إلى أنواع الحسابات"
                      >
                        {type ? type.name : (account.type_name || '-')}
                      </td>

                      {/* 5. Statement Type */}
                      <td className="py-0.5 px-1.5 text-center whitespace-nowrap">
                        {type?.statement_type ? (
                          <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                            type.statement_type === 'balance_sheet'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-purple-50 text-purple-700 border border-purple-200/60'
                          }`}>
                            {type.statement_type === 'balance_sheet' ? 'الميزانية العمومية' : 'قائمة الدخل'}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 6. Classification */}
                      <td className="py-0.5 px-1.5 text-center whitespace-nowrap">
                        {type?.classification ? (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                            {getClassificationLabel(type.classification)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 7. Usage */}
                      <td className="py-0.5 px-1.5 whitespace-nowrap">
                        {account.account_usage ? (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            {getAccountUsageLabel(account.account_usage, language)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 8. Parent */}
                      <td className="py-0.5 px-1.5 text-slate-600 whitespace-nowrap text-[11px]">
                        {parent ? (
                          <span title={`${parent.code} - ${parent.name}`}>
                            <span className="font-mono text-[9.5px] text-slate-400 font-bold">{parent.code}</span> {parent.name}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 9. Opening Balance */}
                      <td className="py-0.5 px-1.5 text-center font-mono whitespace-nowrap text-[11px]">
                        <span className={`font-bold ${opening !== 0 ? (isOpeningDebit ? 'text-blue-700' : 'text-amber-700') : 'text-slate-400'}`}>
                          {formatMoney(Math.abs(opening))}
                        </span>
                        {opening !== 0 && (
                          <span className="text-[8.5px] text-slate-400 mr-1">
                            ({isOpeningDebit ? 'مدين' : 'دائن'})
                          </span>
                        )}
                      </td>

                      {/* 10. Opening Date */}
                      <td className="py-0.5 px-1.5 text-center font-mono text-[9.5px] text-slate-500 whitespace-nowrap">
                        {account.opening_balance_date || '-'}
                      </td>

                      {/* 11. Current Balance */}
                      <td className="py-0.5 px-1.5 text-center font-mono font-black whitespace-nowrap text-[11px]">
                        <span className={bal > 0 ? 'text-emerald-700' : (bal < 0 ? 'text-rose-700' : 'text-slate-500')}>
                          {formatMoney(bal)}
                        </span>
                      </td>

                      {/* 12. Required Sub Account */}
                      <td className="py-0.5 px-1 text-center whitespace-nowrap">
                        {account.required_sub_account ? (
                          <span className="inline-flex px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">نعم</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 13. Status */}
                      <td className="py-0.5 px-1 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                          account.is_active !== false 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {account.is_active !== false ? 'نشط' : 'معطل'}
                        </span>
                      </td>

                      {/* 14. Actions */}
                      <td className="py-0.5 px-1 text-center no-pdf whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivityLogDocumentId(account.id);
                              setIsActivityLogOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
                          >
                            <History size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(account);
                            }}
                            className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                            title={language === 'ar' ? 'تعديل الحساب' : 'Edit Account'}
                          >
                            <Edit2 size={14} />
                          </button>
                          {isDefaultAccount(account) ? (
                            <span className="p-1 text-amber-500" title="حساب افتراضي محمي من الحذف">
                              <Lock size={14} />
                            </span>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(account.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="حذف الحساب"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-3xl border border-slate-200" />)
          ) : sortedFilteredAccounts.map(account => {
            const type = types.find(t => t.id === account.type_id);
            return (
              <div key={account.id} className="group bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-emerald-200 transition-all duration-300 flex flex-col justify-between gap-4" dir={dir}>
                <div className="flex items-start justify-between gap-4">
                   <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse text-left'}`}>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-sm">
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight group-hover:text-emerald-700 transition-colors">{account.name}</h3>
                        <div className={`flex items-center gap-2 mt-1.5 flex-wrap ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                          <span className="font-mono text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider border border-slate-200">{account.code}</span>
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingAccountTypeEditId(account.type_id);
                              setCurrentPage('account_types');
                            }}
                            className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider cursor-pointer hover:bg-emerald-100 transition-colors"
                          >
                            {type?.name || account.type_name || '-'}
                          </span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${account.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {account.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                      </span>
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {getAccountUsageLabel(account.account_usage, language)}
                      </span>
                    </div>
                  </div>
               </div>
               
               <div className={`flex gap-1 no-pdf opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(account.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
                >
                  <History size={16} />
                </button>
                <button onClick={() => openModal(account)} className="p-2 text-slate-300 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all">
                  <Edit2 size={16} />
                </button>
                {isDefaultAccount(account) ? (
                  <span className="p-2 text-slate-300" title="حساب افتراضي محمي من الحذف">
                    <Lock size={16} />
                  </span>
                ) : (
                  <button onClick={() => handleDelete(account.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="حذف الحساب">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">Accounting Balance</span>
               <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-emerald-500 transition-all duration-500 group-hover:scale-125" />
            </div>
          </div>
        );
      })}
    </div>
  )}

      </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[85vh] relative">
          <div className="p-2 md:p-2.5 md:px-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[70] flex-wrap gap-2" dir={dir}>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                type="button"
                onClick={closeModal} 
                className="flex items-center gap-1 px-2.5 py-0.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all font-bold text-[11px] whitespace-nowrap"
              >
                {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                <span>{language === 'ar' ? 'العودة للقائمة' : 'Return to List'}</span>
              </button>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap w-full md:w-auto flex-1 justify-center md:justify-end">
              <h3 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-none font-sans mr-auto md:mr-0">
                {editingAccount ? t('accounts.edit') : t('accounts.add')}
              </h3>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                type="button"
                onClick={closeModal}
                className="w-20 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 transition-all flex items-center gap-1 justify-center active:scale-95 border border-zinc-200 shadow-sm text-[11px] whitespace-nowrap font-sans"
              >
                <X size={12} />
                <span>{language === 'ar' ? 'إلغاء' : 'Cancel'}</span>
              </button>
              <button 
                type="button"
                onClick={() => {
                  const form = document.getElementById('account-form') as HTMLFormElement;
                  if (form) {
                    if (form.requestSubmit) {
                      form.requestSubmit();
                    } else {
                      document.getElementById('hidden-account-submit')?.click();
                    }
                  }
                }}
                className="w-20 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 justify-center active:scale-95 shadow-sm text-[11px] whitespace-nowrap font-sans"
              >
                <Save size={12} />
                <span>{language === 'ar' ? 'حفظ' : 'Save'}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-5 bg-slate-50/50">
            <div className="w-full max-w-6xl mx-auto space-y-4">
              <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-emerald-100 shadow-xs">
                <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold text-xs">
                  <Sparkles size={16} />
                  <span>{t('accounts.ai_input')}</span>
                </div>
                <div className="flex flex-col md:flex-row gap-2.5">
                  <input 
                    type="text"
                    placeholder={t('accounts.ai_placeholder')}
                    className="flex-1 px-4 py-2 bg-zinc-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs font-bold transition-all"
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAiParse()}
                  />
                  <button 
                    onClick={handleAiParse}
                    disabled={isAiParsing || !aiText.trim()}
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-xs active:scale-95 whitespace-nowrap flex gap-1.5 items-center justify-center"
                  >
                    {isAiParsing ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles size={14} />}
                    {isAiParsing ? t('accounts.ai_analyzing') : t('accounts.ai_analyze')}
                  </button>
                </div>
              </div>

              <form id="account-form" onSubmit={handleSubmit} className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <button type="submit" id="hidden-account-submit" className="hidden" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">{t('accounts.form_name')}</label>
                    <div className="relative group">
                      <FileText className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={16} />
                      <input 
                        required
                        type="text" 
                        className={`w-full ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-bold text-sm`}
                        placeholder={language === 'ar' ? 'مثال: البنك الأهلي، الموردين، المبيعات' : 'e.g., National Bank, Suppliers, Sales'}
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-widest flex items-center justify-between">
                      <span>{t('accounts.form_code')}</span>
                      {isAccountLocked && <Lock size={12} className="text-amber-500" />}
                    </label>
                    <div className="relative group">
                      <Hash className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={16} />
                      <input 
                        required
                        disabled={isAccountLocked}
                        type="text" 
                        className={`w-full ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 rounded-xl outline-none transition-all font-mono font-bold text-sm ${
                          isAccountLocked 
                            ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed' 
                            : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500/20'
                        }`}
                        placeholder="1101"
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-widest flex items-center justify-between">
                      <span>{t('accounts.form_type') || (language === 'ar' ? 'نوع الحساب' : 'Account Type')}</span>
                      {isAccountLocked && <Lock size={12} className="text-amber-500" />}
                    </label>
                    <select 
                      required
                      disabled={isAccountLocked}
                      className={`w-full px-3.5 py-2.5 rounded-xl outline-none transition-all appearance-none font-bold text-sm ${
                        isAccountLocked 
                          ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed' 
                          : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500/20'
                      }`}
                      value={formData.type_id}
                      onChange={(e) => setFormData({...formData, type_id: e.target.value})}
                    >
                      <option value="">{language === 'ar' ? 'اختر نوع الحساب...' : 'Select Account Type...'}</option>
                      {types.map(type => (
                        <option key={type.id} value={type.id}>{type.name} ({type.code})</option>
                      ))}
                    </select>

                    {/* Account Type Details Card */}
                    {(() => {
                      const selectedType = types.find(t => t.id === formData.type_id);
                      if (!selectedType) return null;
                      return (
                        <div className="mt-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs animate-in fade-in duration-200">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block">اسم النوع:</span>
                              <span className="font-black text-slate-800 text-xs">{selectedType.name}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block">كود النوع:</span>
                              <span className="font-mono font-black text-emerald-700 text-xs">{selectedType.code}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block">تابع لـ:</span>
                              <span className="font-black text-indigo-700 text-xs">
                                {selectedType.statement_type === 'balance_sheet' 
                                  ? (language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet') 
                                  : (language === 'ar' ? 'قائمة الدخل' : 'Income Statement')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block">التصنيف:</span>
                              <span className="font-black text-emerald-800 text-xs">
                                {getClassificationLabel(selectedType.classification)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="relative" ref={usageDropdownRef}>
                    <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-widest flex items-center justify-between">
                      <span>{language === 'ar' ? 'استخدام الحساب (إلزامي)' : 'Account Usage (Required)'}</span>
                      {isAccountLocked && <Lock size={12} className="text-amber-500" />}
                    </label>
                    <button
                      type="button"
                      disabled={isAccountLocked}
                      onClick={() => !isAccountLocked && setIsUsageDropdownOpen(!isUsageDropdownOpen)}
                      className={`w-full px-3.5 py-2.5 rounded-xl outline-none transition-all flex items-center justify-between font-bold text-sm ${
                        isAccountLocked
                          ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                          : !formData.account_usage ? 'bg-slate-50 border-amber-300 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500/20'
                      }`}
                    >
                      <span>
                        {formData.account_usage ? getAccountUsageLabel(formData.account_usage, language) : (language === 'ar' ? 'اختر استخدام الحساب من القائمة (إلزامي)...' : 'Select Account Usage (Required)...')}
                      </span>
                      <ChevronDown size={18} className="text-slate-400" />
                    </button>

                    {/* Golden Lock Informative Alert */}
                    {isAccountLocked && (
                      <div className="mt-2.5 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center gap-2">
                        <Lock size={14} className="text-amber-600 shrink-0" />
                        <span>
                          {language === 'ar' 
                            ? 'تم قفل كود الحساب ونوعه واستخدامه المحاسبي لوجود قيود مسجلة أو حسابات فرعية تابعة له، حفاظاً على مسار التدقيق وتوازن القوائم المالية.' 
                            : 'Account code, type, and usage are locked due to recorded journal entries or child accounts.'}
                        </span>
                      </div>
                    )}
                    
                    <AnimatePresence>
                      {isUsageDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className={`absolute ${dir === 'rtl' ? 'right-0' : 'left-0'} top-full mt-2 w-[800px] max-w-[90vw] md:max-w-[800px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 z-[160] overflow-hidden`}
                        >
                          <div className="p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                            <div className="relative">
                              <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                              <input
                                type="text"
                                placeholder={language === 'ar' ? 'البحث في استخدامات الحساب...' : 'Search account usages...'}
                                className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold`}
                                value={usageSearchTerm}
                                onChange={(e) => setUsageSearchTerm(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="max-h-[65vh] overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-8">
                            {macroGroupedOptions.map((macro, mIdx) => (
                              <div key={mIdx} className="space-y-4 bg-slate-50/70 p-4 md:p-5 rounded-3xl border border-slate-200 shadow-sm">
                                {/* Macro Category Header */}
                                <div className="flex items-center gap-2.5 pb-2.5 border-b-2 border-slate-900/10">
                                  <div className="w-3 h-3 rounded-full bg-emerald-600 shadow-sm" />
                                  <h3 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                                    {language === 'ar' ? macro.macroAr : macro.macroEn}
                                  </h3>
                                </div>

                                {/* Sub-groups within Macro Category */}
                                <div className="space-y-6 pt-1">
                                  {macro.groups.map((group, gIdx) => (
                                    <div key={gIdx} className="space-y-3 pb-5 border-b-2 border-slate-200/80 last:border-b-0 last:pb-0">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                          <span>{language === 'ar' ? group.labelAr : group.labelEn}</span>
                                        </h4>
                                        <span className="text-[10px] font-bold bg-white text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200">
                                          {group.items.length} {language === 'ar' ? 'عنصر' : 'items'}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {group.items.map(opt => (
                                          <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => {
                                              setFormData({...formData, account_usage: opt.key as any});
                                              setIsUsageDropdownOpen(false);
                                              setUsageSearchTerm('');
                                            }}
                                            className={`w-full text-start px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between ${
                                              formData.account_usage === opt.key
                                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                                                : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
                                            }`}
                                          >
                                            <span>{language === 'ar' ? opt.ar : opt.en}</span>
                                            {formData.account_usage === opt.key && <CheckCircle2 size={16} />}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                            {macroGroupedOptions.length === 0 && (
                              <div className="py-8 text-center text-slate-500 font-bold">
                                {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Opening Balance Section */}
                <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-200/70 space-y-3">
                  {(() => {
                    const linkedJe = entries.find(e => 
                      (e.reference_id === editingAccount?.id || e.reference_number === editingAccount?.code || e.description?.includes(formData.name)) && 
                      e.reference_type === 'opening_balance'
                    );
                    return (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-amber-500 text-white rounded-md flex items-center justify-center shadow-xs">
                            <Wallet size={13} />
                          </div>
                          <h4 className="text-xs font-black text-slate-900">
                            {language === 'ar' ? 'الرصيد الافتتاحي للحساب' : 'Account Opening Balance'}
                          </h4>
                        </div>
                        {linkedJe?.entry_number && (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 font-mono text-xs font-black shadow-xs">
                            <FileText size={13} className="text-indigo-600" />
                            <span>{language === 'ar' ? `رقم القيد: ${linkedJe.entry_number}` : `JE #: ${linkedJe.entry_number}`}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                        {language === 'ar' ? 'الرصيد الافتتاحي (مدين بالموجب / دائن بالسالب)' : 'Opening Balance'}
                      </label>
                      <div className="relative group">
                        <Wallet className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-emerald-500 pointer-events-none`} size={13} />
                        <FormattedNumberInput
                          className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-black text-emerald-700 outline-none focus:ring-1 focus:ring-emerald-500 ps-7"
                          value={formData.opening_balance}
                          onChange={(val) => setFormData({ ...formData, opening_balance: val })}
                          dir={dir === 'rtl' ? 'rtl' : 'ltr'}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                        {language === 'ar' ? 'تاريخ الرصيد' : 'As of Date'}
                      </label>
                      <div className="relative group">
                        <Calendar className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400 pointer-events-none`} size={13} />
                        <input
                          type="date"
                          className="w-full pr-7 pl-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                          value={formData.opening_balance_date}
                          onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>

                    {formData.opening_balance !== 0 && (
                      <div className="sm:col-span-2 p-2.5 bg-white rounded-xl border border-slate-200 space-y-2 shadow-xs">
                        <h5 className="text-xs font-black text-slate-900 leading-none">
                          {language === 'ar' ? 'إعدادات قيد الموازنة الافتتاحية' : 'Opening Journal Settings'}
                        </h5>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                            {language === 'ar' ? 'حساب الطرف الآخر للقيد (الرصيد الافتتاحي / حقوق الملكية)' : 'Counter Account'}
                          </label>
                          <select
                            required
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            value={formData.counter_account_id}
                            onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}
                          >
                            <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select counter account...'}</option>
                            {accounts
                              .filter(acc => acc.id !== editingAccount?.id && ['opening_balance', 'capital', 'equity', 'retained_earnings', 'other'].includes(acc.account_usage || ''))
                              .map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                              ))}
                          </select>
                        </div>

                        {formData.counter_account_id && (() => {
                          const accCounter = accounts.find(a => a.id === formData.counter_account_id);
                          const linkedJe = entries.find(e => 
                            (e.reference_id === editingAccount?.id || e.reference_number === editingAccount?.code || e.description?.includes(formData.name)) && 
                            e.reference_type === 'opening_balance'
                          );

                          return (
                            <div className="rounded-lg overflow-hidden border border-slate-100 shadow-xs">
                              <JournalEntryPreview
                                title={language === 'ar' ? 'معاينة قيد الرصيد الافتتاحي' : 'Opening Entry Preview'}
                                entry_number={linkedJe?.entry_number}
                                items={[
                                  {
                                    account_code: formData.code,
                                    account_name: formData.name || 'هذا الحساب',
                                    debit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                    credit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                    description: `رصيد افتتاحي: ${formData.name}`
                                  },
                                  {
                                    account_code: accCounter?.code || '',
                                    account_name: accCounter?.name || '',
                                    debit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                    credit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                    description: `الطرف المقابل: ${formData.name}`
                                  }
                                ]}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 leading-none mb-1">{language === 'ar' ? 'حالة النشاط' : 'Activity Status'}</h4>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{language === 'ar' ? 'تحديد ما إذا كان الحساب نشطاً في النظام أم لا' : 'Specify whether the account is active in the system or not'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.is_active ? 'bg-emerald-600' : 'bg-slate-200'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_active ? (dir === 'rtl' ? '-translate-x-6' : 'translate-x-6') : (dir === 'rtl' ? '-translate-x-1' : 'translate-x-1')}`}
                    />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
{isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir={dir}>
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
               <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{t('common.delete_confirm')}</h3>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا الحساب؟ ستفقد كافة البيانات المرتبطة بالحركات المالية لهذا الحساب.' : 'Are you sure you want to delete this account? You will lose all data associated with the financial movements of this account.'}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setAccountToDelete(null);
                }}
                className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                {language === 'ar' ? 'تأكيد الحذف' : 'Delete Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCoaWizardOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir={dir}>
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {language === 'ar' ? 'الدليل المحاسبي الآلي' : 'Auto Chart of Accounts'}
              </h3>
              <button 
                onClick={() => setIsCoaWizardOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-all"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-slate-500 mb-6 font-medium text-sm leading-relaxed">
              {language === 'ar' 
                ? 'سيقوم النظام بإنشاء شجرة حسابات قياسية متكاملة مناسبة لنشاطك التجاري.'
                : 'The system will generate a standard integrated chart of accounts suitable for your business activity.'}
            </p>

            {/* Language Selection */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 mb-2">
                {language === 'ar' ? 'لغة الدليل المحاسبي:' : 'COA Language:'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCoaLanguage('ar')}
                  className={`py-3 px-4 rounded-xl font-bold text-sm border transition-all ${coaLanguage === 'ar' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  العربية (Arabic)
                </button>
                <button
                  type="button"
                  onClick={() => setCoaLanguage('en')}
                  className={`py-3 px-4 rounded-xl font-bold text-sm border transition-all ${coaLanguage === 'en' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <label className="block text-xs font-bold text-slate-500 mb-1">
                {language === 'ar' ? 'نوع النشاط التجاري:' : 'Business Activity Type:'}
              </label>
              <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500">
                <input 
                  type="radio" 
                  name="businessType" 
                  value="all"
                  checked={coaBusinessType === 'all'}
                  onChange={() => setCoaBusinessType('all')}
                  className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-sm">
                    {language === 'ar' ? 'شامل (تجاري وخدمي)' : 'Comprehensive (Commercial & Service)'}
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500">
                <input 
                  type="radio" 
                  name="businessType" 
                  value="commercial"
                  checked={coaBusinessType === 'commercial'}
                  onChange={() => setCoaBusinessType('commercial')}
                  className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-sm">
                    {language === 'ar' ? 'تجاري فقط' : 'Commercial Only'}
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500">
                <input 
                  type="radio" 
                  name="businessType" 
                  value="service"
                  checked={coaBusinessType === 'service'}
                  onChange={() => setCoaBusinessType('service')}
                  className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-sm">
                    {language === 'ar' ? 'خدمي فقط' : 'Service Only'}
                  </span>
                </div>
              </label>
            </div>

            {coaProgress && (
              <div className="mb-6 p-4 bg-indigo-50 rounded-xl flex items-center gap-3 border border-indigo-100">
                <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                <span className="text-sm font-bold text-indigo-700">{coaProgress}</span>
              </div>
            )}

            <button 
              onClick={handleGenerateCOA}
              disabled={isGeneratingCoa}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGeneratingCoa ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{language === 'ar' ? 'جاري البناء...' : 'Building...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>{language === 'ar' ? 'بناء الدليل الآن' : 'Generate COA Now'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <AccountExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        onSuccess={() => {
          // Real-time subscription will automatically reflect the changes
        }}
        existingAccounts={accounts}
        existingTypes={types}
      />

      <PageActivityLog 
        isOpen={isActivityLogOpen} 
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }} 
        category="accounts"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
