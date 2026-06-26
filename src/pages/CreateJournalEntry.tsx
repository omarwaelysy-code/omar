import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService, apiRequest } from '../services/dbService';
import { Account, Customer, Supplier, JournalEntry, JournalEntryItem, Department, CostCenter, Operation, Currency, AccountType, ExchangeRate } from '../types';
import { Plus, Trash2, Save, AlertCircle, CheckCircle2, ArrowRightLeft, User, Truck, Copy, X, Check, Search, Info, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '../utils/formatUtils';

const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove diacritics
    .trim()
    .toLowerCase();
};

export const CreateJournalEntry: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSupplier] = useState<Supplier[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [companyCurrencies, setCompanyCurrencies] = useState<Currency[]>([]);
  const [companyData, setCompanyData] = useState<any>(null);
  const [latestRates, setLatestRates] = useState<any[]>([]);
  const [entryNumber, setEntryNumber] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for Autocomplete searches
  const [activeRowSearch, setActiveRowSearch] = useState<{ index: number; field: 'account_code' | 'account_name' | 'operation'; query: string } | null>(null);
  const [activeHeaderSearch, setActiveHeaderSearch] = useState<string | null>(null);

  // States for Copy / Duplicate Feature
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [copySearchQuery, setCopySearchQuery] = useState('');

  // States for Header Defaults Dimensions
  const [headerDimensions, setHeaderDimensions] = useState({
    operation_id: '',
    department_id: '',
    cost_center_id: ''
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference_number: '',
    items: [
      { account_id: '', account_name: '', debit: 0, credit: 0, description: '', sub_account_id: '', sub_account_type: undefined, operation_id: '', department_id: '', cost_center_id: '', currency: 'local', exchange_rate: 1, foreign_amount: 0 },
      { account_id: '', account_name: '', debit: 0, credit: 0, description: '', sub_account_id: '', sub_account_type: undefined, operation_id: '', department_id: '', cost_center_id: '', currency: 'local', exchange_rate: 1, foreign_amount: 0 }
    ]
  });

  // Dynamic Sub-account Options
  const subAccounts = [
    ...customers.map(c => ({ id: c.id, name: c.name, type: 'customer' as const, label: `عميل: ${c.name}` })),
    ...suppliers.map(s => ({ id: s.id, name: s.name, type: 'supplier' as const, label: `مورد: ${s.name}` })),
    ...paymentMethods.map(p => ({ id: p.id, name: p.name, type: 'payment_method' as const, label: `خزينة/بنك: ${p.name}` }))
  ];

  useEffect(() => {
    if (user) {
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubAccountTypes = dbService.subscribe<AccountType>('account_types', user.company_id, setAccountTypes);
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSupplier);
      const unsubPMs = dbService.subscribe<any>('payment_methods', user.company_id, setPaymentMethods);
      const unsubDepartments = dbService.subscribe<Department>('departments', user.company_id, setDepartments);
      const unsubCostCenters = dbService.subscribe<CostCenter>('cost_centers', user.company_id, setCostCenters);
      const unsubOperations = dbService.subscribe<Operation>('operations', user.company_id, setOperations);
      const unsubCurrencies = dbService.subscribe<Currency>('currencies', user.company_id, setCompanyCurrencies);
      
      const unsubCompany = dbService.subscribe<any>('companies', user.company_id, (data) => {
        if (data && data.length > 0) setCompanyData(data[0]);
      });

      // Fetch latest rates
      apiRequest<any[]>(`/currency-rates/latest?company_id=${user.company_id}`)
        .then(setLatestRates)
        .catch(err => console.error('[ERP] Error loading latest rates:', err));

      setLoading(false);
      return () => {
        unsubAccounts();
        unsubAccountTypes();
        unsubCustomers();
        unsubSuppliers();
        unsubPMs();
        unsubDepartments();
        unsubCostCenters();
        unsubOperations();
        unsubCurrencies();
        unsubCompany();
      };
    }
  }, [user]);

  // Click outside to close active search
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveRowSearch(null);
      setActiveHeaderSearch(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Fetch automatic entry number sequence when date changes
  useEffect(() => {
    if (user && formData.date) {
      dbService.getNextSequence('journal_entries', formData.date)
        .then(setEntryNumber)
        .catch(err => console.error('[ERP] Error fetching sequence number:', err));
    }
  }, [user, formData.date]);

  // Load recent journal entries when Copy Modal is opened
  useEffect(() => {
    if (showCopyModal && user) {
      dbService.list<JournalEntry>('journal_entries', user.company_id)
        .then(data => {
          const manualEntries = data.filter(e => e.reference_type === 'manual' || !e.reference_type);
          const sorted = manualEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setRecentEntries(sorted);
        })
        .catch(err => {
          console.error('[ERP] Error loading entries for copy:', err);
          showNotification('تعذر تحميل القيود السابقة', 'error');
        });
    }
  }, [showCopyModal, user]);

  const handleCopyEntry = async (entryId: string) => {
    try {
      showNotification('جاري تحميل القيد المحدد...', 'info');
      const entry = recentEntries.find(e => e.id === entryId);
      if (!entry) return;

      const lines = await dbService.query<JournalEntryItem>('journal_entry_lines', [
        { field: 'journal_entry_id', operator: '==', value: entryId }
      ]);

      if (lines.length === 0) {
        showNotification('القيد المحدد لا يحتوي على أسطر صالحة للنسخ', 'error');
        return;
      }

      const copiedItems = lines.map(line => ({
        account_id: line.account_id || '',
        account_name: line.account_name || '',
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description || '',
        sub_account_id: line.sub_account_id || '',
        sub_account_type: line.sub_account_type || undefined,
        customer_id: line.customer_id || '',
        supplier_id: line.supplier_id || '',
        operation_id: line.operation_id || '',
        department_id: line.department_id || '',
        cost_center_id: line.cost_center_id || '',
        currency: line.currency || 'local',
        exchange_rate: Number(line.exchange_rate) || 1,
        foreign_amount: Number(line.foreign_amount) || 0
      }));

      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: entry.description || '',
        reference_number: entry.reference_number || '',
        items: copiedItems
      } as any);

      setShowCopyModal(false);
      showNotification('تم نسخ القيد بنجاح! يمكنك الآن تعديله وحفظه.', 'success');
    } catch (err) {
      console.error('[ERP] Error copying entry:', err);
      showNotification('حدث خطأ أثناء نسخ القيد', 'error');
    }
  };

  const getExchangeRateForCurrency = async (currId: string): Promise<number> => {
    const currency = companyCurrencies.find(c => c.id === currId);
    if (!currency) return 1;
    const baseCurrency = companyData?.settings?.currency || 'EGP';
    if (currency.code.toLowerCase() === baseCurrency.toLowerCase()) {
      return 1;
    }
    
    // Check auto fetched rates on mount
    const autoRate = latestRates.find(r => r.currency_id === currId);
    if (autoRate && autoRate.rate) {
      return Number(autoRate.rate);
    }

    // Check manual exchange rates table
    try {
      const dbRates = await dbService.list<ExchangeRate>('exchange_rates', {
        currency_id: currId,
        company_id: user?.company_id
      });
      if (dbRates && dbRates.length > 0) {
        const sorted = dbRates.sort((a, b) => new Date(b.rate_date).getTime() - new Date(a.rate_date).getTime());
        return Number(sorted[0].exchange_rate);
      }
    } catch (err) {
      console.error('[ERP] Error fetching rate from db:', err);
    }

    return 1.0;
  };

  const handleHeaderOperationChange = (opId: string) => {
    setHeaderDimensions(prev => {
      const updated = { ...prev, operation_id: opId };
      if (opId) {
        const op = operations.find(o => o.id === opId);
        if (op) {
          if (op.cost_center_id) updated.cost_center_id = op.cost_center_id;
          if (op.department_id) updated.department_id = op.department_id;
        }
      }
      return updated;
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          account_id: '',
          account_name: '',
          debit: 0,
          credit: 0,
          description: '',
          sub_account_id: '',
          sub_account_type: undefined,
          operation_id: headerDimensions.operation_id || '',
          department_id: headerDimensions.department_id || '',
          cost_center_id: headerDimensions.cost_center_id || '',
          currency: 'local',
          exchange_rate: 1,
          foreign_amount: 0
        }
      ]
    } as any);
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 2) {
      showNotification('يجب أن يحتوي القيد على سطرين على الأقل', 'error');
      return;
    }
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = async (index: number, field: string, value: any) => {
    const newItems = [...formData.items] as any;
    const item = newItems[index];

    if (field === 'account_id') {
      const account = accounts.find(a => a.id === value);
      item.account_id = value;
      item.account_name = account?.name || '';
      item.sub_account_id = '';
      item.sub_account_type = undefined;
      item.customer_id = '';
      item.supplier_id = '';
    } else if (field === 'sub_account_id') {
      const subAccount = subAccounts.find(s => s.id === value);
      item.sub_account_id = value;
      item.sub_account_type = subAccount?.type;
      
      if (subAccount?.type === 'customer') {
        item.customer_id = subAccount.id;
        item.supplier_id = '';
      } else if (subAccount?.type === 'supplier') {
        item.customer_id = '';
        item.supplier_id = subAccount.id;
      } else {
        item.customer_id = '';
        item.supplier_id = '';
      }
    } else if (field === 'currency') {
      item.currency = value;
      const rate = await getExchangeRateForCurrency(value);
      item.exchange_rate = rate;
      const localVal = Number(item.debit) || Number(item.credit) || 0;
      item.foreign_amount = localVal > 0 ? localVal / rate : 0;
    } else if (field === 'operation_id') {
      item.operation_id = value;
      if (value) {
        const op = operations.find(o => o.id === value);
        if (op) {
          if (op.cost_center_id) item.cost_center_id = op.cost_center_id;
          if (op.department_id) item.department_id = op.department_id;
        }
      }
    } else {
      item[field] = value;
    }

    setFormData({ ...formData, items: newItems });
  };

  const handleCalculations = (index: number, field: 'debit' | 'credit' | 'exchange_rate' | 'foreign_amount', val: number) => {
    const newItems = [...formData.items] as any;
    const item = newItems[index];

    if (field === 'debit') {
      if (val < 0) {
        const positiveVal = Math.abs(val);
        item.credit = positiveVal;
        item.debit = 0;
        const rate = Number(item.exchange_rate) || 1;
        item.foreign_amount = positiveVal / rate;
      } else {
        item.debit = val;
        if (val > 0) item.credit = 0;
        const rate = Number(item.exchange_rate) || 1;
        item.foreign_amount = val > 0 ? val / rate : 0;
      }
    } else if (field === 'credit') {
      if (val < 0) {
        const positiveVal = Math.abs(val);
        item.debit = positiveVal;
        item.credit = 0;
        const rate = Number(item.exchange_rate) || 1;
        item.foreign_amount = positiveVal / rate;
      } else {
        item.credit = val;
        if (val > 0) item.debit = 0;
        const rate = Number(item.exchange_rate) || 1;
        item.foreign_amount = val > 0 ? val / rate : 0;
      }
    } else if (field === 'exchange_rate') {
      item.exchange_rate = val;
      const rate = val || 1;
      if (item.foreign_amount > 0) {
        if (item.debit > 0) item.debit = item.foreign_amount * rate;
        if (item.credit > 0) item.credit = item.foreign_amount * rate;
      } else {
        const localVal = item.debit || item.credit || 0;
        item.foreign_amount = localVal > 0 ? localVal / rate : 0;
      }
    } else if (field === 'foreign_amount') {
      if (val < 0) {
        const positiveVal = Math.abs(val);
        item.foreign_amount = positiveVal;
        const rate = Number(item.exchange_rate) || 1;
        item.credit = positiveVal * rate;
        item.debit = 0;
      } else {
        item.foreign_amount = val;
        const rate = Number(item.exchange_rate) || 1;
        if (item.credit > 0) {
          item.credit = val * rate;
          item.debit = 0;
        } else {
          item.debit = val * rate;
          item.credit = 0;
        }
      }
    }

    setFormData({ ...formData, items: newItems });
  };

  const getAccountTypeName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return '';
    if (account.type_name) return account.type_name;
    const typeObj = accountTypes.find(t => t.id === account.type_id);
    return typeObj ? typeObj.name : '';
  };

  const totalDebit = formData.items.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
  const totalCredit = formData.items.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (totalDebit === 0 || totalCredit === 0) {
      showNotification('يجب إدخال مبالغ في القيد', 'error');
      return;
    }

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      showNotification('القيد غير متزن (إجمالي المدين يجب أن يساوي إجمالي الدائن)', 'error');
      return;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i] as any;
      const account = accounts.find(a => a.id === item.account_id);
      if (account) {
        if (account.required_sub_account && !item.sub_account_id) {
          showNotification(`يرجى اختيار الحساب الفرعي في السطر رقم ${i + 1}`, 'error');
          return;
        }
      }
    }

    setIsSubmitting(true);
    
    try {
      const journalEntry: Omit<JournalEntry, 'id'> = {
        date: formData.date,
        description: formData.description,
        reference_id: 'manual',
        reference_type: 'manual',
        reference_number: formData.reference_number || undefined,
        entry_number: entryNumber || undefined,
        total_debit: totalDebit,
        total_credit: totalCredit,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id,
        items: formData.items.map((item: any) => ({
          account_id: item.account_id,
          account_name: item.account_name,
          debit: Number(item.debit) || 0,
          credit: Number(item.credit) || 0,
          description: item.description || formData.description,
          customer_id: item.customer_id || undefined,
          customer_name: customers.find(c => c.id === item.customer_id)?.name || undefined,
          supplier_id: item.supplier_id || undefined,
          supplier_name: suppliers.find(s => s.id === item.supplier_id)?.name || undefined,
          sub_account_id: item.sub_account_id || undefined,
          sub_account_type: item.sub_account_type || undefined,
          operation_id: item.operation_id || undefined,
          department_id: item.department_id || undefined,
          cost_center_id: item.cost_center_id || undefined,
          currency: item.currency || 'local',
          exchange_rate: Number(item.exchange_rate) || 1,
          foreign_amount: Number(item.foreign_amount) || 0
        }))
      };

      const id = await dbService.add('journal_entries', journalEntry);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة قيد يومية', `إضافة قيد يومية يدوي رقم: ${id}`, 'journal_entries', id);
      
      showNotification('تم حفظ قيد اليومية بنجاح', 'success');
      
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        reference_number: '',
        items: [
          { account_id: '', account_name: '', debit: 0, credit: 0, description: '', sub_account_id: '', sub_account_type: undefined, operation_id: '', department_id: '', cost_center_id: '', currency: 'local', exchange_rate: 1, foreign_amount: 0 },
          { account_id: '', account_name: '', debit: 0, credit: 0, description: '', sub_account_id: '', sub_account_type: undefined, operation_id: '', department_id: '', cost_center_id: '', currency: 'local', exchange_rate: 1, foreign_amount: 0 }
        ]
      } as any);

      setHeaderDimensions({ operation_id: '', department_id: '', cost_center_id: '' });
      // pre-generate next entry number for the new transaction
      dbService.getNextSequence('journal_entries', formData.date)
        .then(setEntryNumber)
        .catch(err => console.error('[ERP] Error fetching sequence number:', err));
    } catch (error) {
      console.error(error);
      showNotification('حدث خطأ أثناء حفظ القيد', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsSubAccount = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.required_sub_account || false;
  };

  const filteredRecentEntries = recentEntries.filter(e => 
    (e.entry_number && e.entry_number.toLowerCase().includes(copySearchQuery.toLowerCase())) ||
    (e.description && e.description.toLowerCase().includes(copySearchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      {/* Top Header Row with Title and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-zinc-900">{language === 'ar' ? 'إضافة قيد يومية' : 'Create Journal Entry'}</h2>
          <p className="text-zinc-500 text-sm mt-1">{language === 'ar' ? 'تسجيل القيود المحاسبية اليدوية مع الفروع والعملات والتحقق التلقائي' : 'Record manual double-entry transactions with currencies'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCopyModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 border border-zinc-200"
          >
            <Copy size={18} />
            <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting || difference >= 0.01 || totalDebit === 0}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/10"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            <span>{language === 'ar' ? 'حفظ قيد اليومية' : 'Save Entry'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
        {/* Main Card with Date, Description, and Header Operations */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-6">
          <div className="flex flex-col xl:flex-row gap-8">
            {/* Right Side fields (in RTL) */}
            <div className="flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-zinc-700 mr-1">تاريخ القيد</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-sm text-zinc-800"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-zinc-700 mr-1">رقم القيد التلقائي</label>
                  <div className="w-full px-4 py-3 bg-zinc-100 border border-zinc-200 rounded-2xl font-mono text-sm text-zinc-600 font-bold select-none h-[46px] flex items-center">
                    {entryNumber || 'JE-YYYY-MM-DD-00000'}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-bold text-zinc-700 mr-1">البيان العام للقيد</label>
                  <input
                    required
                    type="text"
                    placeholder="وصف مختصر للقيد..."
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm text-zinc-800 font-medium"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-zinc-700 mr-1">رقم المرجع (اختياري)</label>
                  <input
                    type="text"
                    placeholder="رقم مرجع خارجي..."
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm text-zinc-800 font-medium"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Left Side Status and Totals (in RTL) */}
            <div className="w-full xl:w-80 flex flex-col gap-3 justify-end">
              {/* Balance status label above the numbers */}
              {difference >= 0.01 || totalDebit === 0 ? (
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 px-5 py-3 rounded-2xl text-xs font-black animate-pulse shadow-sm">
                  <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
                  <span>{language === 'ar' ? 'القيد غير متنز حالياً' : 'Entry is currently unbalanced'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-5 py-3 rounded-2xl text-xs font-black shadow-sm">
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                  <span>{language === 'ar' ? 'القيد متزن تماماً وجاهز للحفظ' : 'Entry is balanced and ready'}</span>
                </div>
              )}

              {/* Totals numbers */}
              <div className="flex items-center gap-4 bg-zinc-50 px-6 py-4 rounded-3xl border border-zinc-200 w-full justify-around shadow-sm select-none">
                <div className="text-center">
                  <p className="text-[10px] font-black text-zinc-400 uppercase mb-0.5">الفرق</p>
                  <p className={`text-base font-black ${difference < 0.01 ? 'text-emerald-600' : 'text-amber-600 animate-pulse'}`}>
                    {formatNumber(difference)}
                  </p>
                </div>
                <div className="w-px h-8 bg-zinc-200" />
                <div className="text-center">
                  <p className="text-[10px] font-black text-zinc-400 uppercase mb-0.5">دائن</p>
                  <p className="text-base font-black text-red-600">{formatNumber(totalCredit)}</p>
                </div>
                <div className="w-px h-8 bg-zinc-200" />
                <div className="text-center">
                  <p className="text-[10px] font-black text-zinc-400 uppercase mb-0.5">مدين</p>
                  <p className="text-base font-black text-emerald-600">{formatNumber(totalDebit)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Header Operations Box */}
          <div className="p-5 bg-zinc-50/50 rounded-3xl border border-zinc-200/50 space-y-4">
            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Info size={14} className="text-emerald-500" />
              <span>{language === 'ar' ? 'أبعاد العمليات الافتراضية للجدول (تطبيق كالفاتورة)' : 'Default Operational Dimensions (Apply like invoice)'}</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Default Operation with Autocomplete Search */}
              <div className="space-y-1.5 relative" onClick={(e) => e.stopPropagation()}>
                <label className="block text-xs font-bold text-zinc-600 mr-1">العملية الافتراضية</label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="ابحث عن العملية..."
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-semibold"
                      value={
                        activeHeaderSearch !== null
                          ? activeHeaderSearch
                          : (operations.find(o => o.id === headerDimensions.operation_id)?.operation_number || '')
                      }
                      onChange={(e) => setActiveHeaderSearch(e.target.value)}
                      onFocus={() => {
                        setActiveHeaderSearch(operations.find(o => o.id === headerDimensions.operation_id)?.operation_number || '');
                      }}
                    />
                    {activeHeaderSearch !== null && (
                      <div className="absolute top-full right-0 left-0 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto min-w-[200px]">
                        {(() => {
                          const queryNorm = normalizeText(activeHeaderSearch);
                          const filtered = operations.filter(o => 
                            normalizeText(o.operation_number).includes(queryNorm) || 
                            (o.description && normalizeText(o.description).includes(queryNorm))
                          );
                          if (filtered.length === 0) {
                            return (
                              <div className="p-3 text-center text-xs text-zinc-400 font-bold">
                                {language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results'}
                              </div>
                            );
                          }
                          return filtered.slice(0, 10).map(o => (
                            <button
                              key={o.id}
                              type="button"
                              className="w-full px-3 py-2 text-right hover:bg-zinc-50 transition-all text-xs font-bold flex justify-between items-center"
                              onClick={() => {
                                handleHeaderOperationChange(o.id);
                                setActiveHeaderSearch(null);
                              }}
                            >
                              <span className="text-zinc-800">{o.operation_number}</span>
                              <span className="text-zinc-400 text-[10px] truncate max-w-[120px]">{o.description}</span>
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                  {headerDimensions.operation_id && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedItems = formData.items.map(item => ({
                          ...item,
                          operation_id: headerDimensions.operation_id
                        }));
                        setFormData({ ...formData, items: updatedItems });
                        showNotification('تم تطبيق العملية على جميع الأسطر', 'success');
                      }}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-600 hover:text-emerald-700 transition-all flex-shrink-0"
                      title="تطبيق على كل الجدول"
                    >
                      <CheckCheck size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Default Cost Center with CheckCheck Button */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-600 mr-1">مركز التكلفة الافتراضي</label>
                <div className="flex items-center gap-1.5">
                  <select
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-semibold"
                    value={headerDimensions.cost_center_id}
                    onChange={(e) => setHeaderDimensions({ ...headerDimensions, cost_center_id: e.target.value })}
                  >
                    <option value="">اختر مركز التكلفة...</option>
                    {costCenters.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
                    ))}
                  </select>
                  {headerDimensions.cost_center_id && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedItems = formData.items.map(item => ({
                          ...item,
                          cost_center_id: headerDimensions.cost_center_id
                        }));
                        setFormData({ ...formData, items: updatedItems });
                        showNotification('تم تطبيق مركز التكلفة على الجدول', 'success');
                      }}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-600 hover:text-emerald-700 transition-all flex-shrink-0"
                      title="تطبيق على كل الجدول"
                    >
                      <CheckCheck size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Default Department with CheckCheck Button */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-600 mr-1">الإدارة الافتراضية</label>
                <div className="flex items-center gap-1.5">
                  <select
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-semibold"
                    value={headerDimensions.department_id}
                    onChange={(e) => setHeaderDimensions({ ...headerDimensions, department_id: e.target.value })}
                  >
                    <option value="">اختر الإدارة...</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                    ))}
                  </select>
                  {headerDimensions.department_id && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedItems = formData.items.map(item => ({
                          ...item,
                          department_id: headerDimensions.department_id
                        }));
                        setFormData({ ...formData, items: updatedItems });
                        showNotification('تم تطبيق الإدارة على الجدول', 'success');
                      }}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-600 hover:text-emerald-700 transition-all flex-shrink-0"
                      title="تطبيق على كل الجدول"
                    >
                      <CheckCheck size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Excel-Style Spreadsheet Table Grid */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-inner">
            <table className="w-full border-collapse min-w-[1700px]" dir={dir}>
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-200 text-xs font-black uppercase text-zinc-500 select-none">
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-center w-28 bg-emerald-50/20 text-emerald-700">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-center w-28 bg-red-50/20 text-red-700">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-right w-36">{language === 'ar' ? 'كود الحساب' : 'Account Code'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-right w-64">{language === 'ar' ? 'الحساب' : 'Account Name'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-right w-36 text-zinc-400 bg-zinc-50/20 font-bold">{language === 'ar' ? 'نوع الحساب' : 'Account Type'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-right w-60">{language === 'ar' ? 'الحساب الفرعي' : 'Sub-Account'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-center w-36">{language === 'ar' ? 'العملة' : 'Currency'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-center w-28">{language === 'ar' ? 'سعر الصرف' : 'Exchange Rate'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-center w-36">{language === 'ar' ? 'المبلغ بالعملة الأجنبية' : 'Foreign Amount'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-right w-48">{language === 'ar' ? 'العملية' : 'Operation'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-right w-48">{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-right w-48">{language === 'ar' ? 'الإدارة' : 'Department'}</th>
                  <th className="py-2.5 px-3 border-r border-zinc-200 text-right">{language === 'ar' ? 'البيان' : 'Row Description'}</th>
                  <th className="py-2.5 px-2 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {formData.items.map((item, index) => (
                  <tr 
                    key={index} 
                    className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/40'} hover:bg-emerald-50/15`}
                  >
                    {/* Debit Input */}
                    <td className="p-0 border-r border-zinc-200 w-28 bg-emerald-50/5">
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/20 px-3 py-2.5 text-sm font-black text-emerald-600 text-center bg-transparent outline-none transition-all shadow-inner"
                        value={item.debit || ''}
                        onChange={(e) => handleCalculations(index, 'debit', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                    
                    {/* Credit Input */}
                    <td className="p-0 border-r border-zinc-200 w-28 bg-red-50/5">
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/20 px-3 py-2.5 text-sm font-black text-red-600 text-center bg-transparent outline-none transition-all shadow-inner"
                        value={item.credit || ''}
                        onChange={(e) => handleCalculations(index, 'credit', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>

                    {/* Account Code Selector (Searchable) */}
                    <td className="p-0 border-r border-zinc-200 w-36 relative" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="رمز الحساب..."
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white px-3 py-2 text-sm bg-transparent outline-none font-mono text-right"
                        value={
                          activeRowSearch && activeRowSearch.index === index && activeRowSearch.field === 'account_code'
                            ? activeRowSearch.query
                            : (accounts.find(a => a.id === item.account_id)?.code || '')
                        }
                        onChange={(e) => setActiveRowSearch({ index, field: 'account_code', query: e.target.value })}
                        onFocus={() => {
                          setActiveRowSearch({ index, field: 'account_code', query: accounts.find(a => a.id === item.account_id)?.code || '' });
                        }}
                      />
                      {activeRowSearch && activeRowSearch.index === index && activeRowSearch.field === 'account_code' && (
                        <div className="absolute top-full right-0 left-0 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto min-w-[240px]">
                          {(() => {
                            const queryNorm = normalizeText(activeRowSearch.query);
                            const filtered = accounts.filter(a => 
                              normalizeText(a.code).includes(queryNorm) || 
                              normalizeText(a.name).includes(queryNorm)
                            );
                            if (filtered.length === 0) {
                              return (
                                <div className="p-3 text-center text-xs text-zinc-400 font-bold">
                                  {language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results'}
                                </div>
                              );
                            }
                            return filtered.slice(0, 10).map(a => (
                              <button
                                key={a.id}
                                type="button"
                                className="w-full px-3 py-2 text-right hover:bg-zinc-50 transition-all text-xs font-bold flex justify-between items-center"
                                onClick={() => {
                                  updateItem(index, 'account_id', a.id);
                                  setActiveRowSearch(null);
                                }}
                              >
                                <span className="font-mono text-zinc-500">{a.code}</span>
                                <span className="text-zinc-800">{a.name}</span>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </td>

                    {/* Account Name Selector (Searchable) */}
                    <td className="p-0 border-r border-zinc-200 w-64 relative" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="اسم الحساب..."
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white px-3 py-2 text-sm bg-transparent outline-none font-bold text-zinc-800"
                        value={
                          activeRowSearch && activeRowSearch.index === index && activeRowSearch.field === 'account_name'
                            ? activeRowSearch.query
                            : (accounts.find(a => a.id === item.account_id)?.name || '')
                        }
                        onChange={(e) => setActiveRowSearch({ index, field: 'account_name', query: e.target.value })}
                        onFocus={() => {
                          setActiveRowSearch({ index, field: 'account_name', query: accounts.find(a => a.id === item.account_id)?.name || '' });
                        }}
                      />
                      {activeRowSearch && activeRowSearch.index === index && activeRowSearch.field === 'account_name' && (
                        <div className="absolute top-full right-0 left-0 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto min-w-[240px]">
                          {(() => {
                            const queryNorm = normalizeText(activeRowSearch.query);
                            const filtered = accounts.filter(a => 
                              normalizeText(a.code).includes(queryNorm) || 
                              normalizeText(a.name).includes(queryNorm)
                            );
                            if (filtered.length === 0) {
                              return (
                                <div className="p-3 text-center text-xs text-zinc-400 font-bold">
                                  {language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results'}
                                </div>
                              );
                            }
                            return filtered.slice(0, 10).map(a => (
                              <button
                                key={a.id}
                                type="button"
                                className="w-full px-3 py-2 text-right hover:bg-zinc-50 transition-all text-xs font-bold flex justify-between items-center"
                                onClick={() => {
                                  updateItem(index, 'account_id', a.id);
                                  setActiveRowSearch(null);
                                }}
                              >
                                <span className="text-zinc-800">{a.name}</span>
                                <span className="font-mono text-zinc-400 text-[10px]">{a.code}</span>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </td>

                    {/* Account Type (Read-only) */}
                    <td className="p-3 border-r border-zinc-200 w-36 text-right text-xs font-bold text-zinc-500 bg-zinc-50/20 select-none">
                      {getAccountTypeName(item.account_id) || '---'}
                    </td>

                    {/* Sub-Account Selector (Dynamic Inline) */}
                    <td className="p-0 border-r border-zinc-200 w-60 bg-zinc-50/20">
                      {needsSubAccount(item.account_id) ? (
                        <select
                          required
                          className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/20 px-3 py-2 text-sm bg-transparent outline-none font-bold text-emerald-700 cursor-pointer"
                          value={item.sub_account_id}
                          onChange={(e) => updateItem(index, 'sub_account_id', e.target.value)}
                        >
                          <option value="">{language === 'ar' ? 'اختر الحساب الفرعي...' : 'Choose Sub-Account...'}</option>
                          {subAccounts.map(sa => (
                            <option key={sa.id} value={sa.id}>{sa.label}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="w-full h-full bg-zinc-100/50 py-2.5 px-3 text-xs text-zinc-400 italic font-medium select-none">
                          {language === 'ar' ? 'غير مطلوب' : 'Not required'}
                        </div>
                      )}
                    </td>

                    {/* Currency Selector */}
                    <td className="p-0 border-r border-zinc-200 w-36">
                      <select
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/10 px-3 py-2 text-sm bg-transparent outline-none font-semibold text-zinc-700 cursor-pointer"
                        value={item.currency || 'local'}
                        onChange={(e) => updateItem(index, 'currency', e.target.value)}
                      >
                        <option value="local">
                          {language === 'ar' ? 'العملة المحلية' : 'Local Currency'}
                        </option>
                        {companyCurrencies.filter(c => c.is_active).map(c => (
                          <option key={c.id} value={c.id}>{c.name_ar || c.name_en} ({c.code})</option>
                        ))}
                      </select>
                    </td>

                    {/* Exchange Rate */}
                    <td className="p-0 border-r border-zinc-200 w-28 bg-zinc-50/5">
                      <input
                        type="number"
                        step="any"
                        disabled={item.currency === 'local'}
                        placeholder="1.00"
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/20 px-3 py-2.5 text-sm font-bold text-zinc-700 text-center bg-transparent outline-none disabled:opacity-50 disabled:bg-zinc-100/30"
                        value={item.exchange_rate || ''}
                        onChange={(e) => handleCalculations(index, 'exchange_rate', parseFloat(e.target.value) || 1)}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>

                    {/* Foreign Currency Amount */}
                    <td className="p-0 border-r border-zinc-200 w-36 bg-zinc-50/5">
                      <input
                        type="number"
                        step="any"
                        disabled={item.currency === 'local'}
                        placeholder="0.00"
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/20 px-3 py-2.5 text-sm font-black text-emerald-700 text-center bg-transparent outline-none disabled:opacity-50 disabled:bg-zinc-100/30"
                        value={item.foreign_amount || ''}
                        onChange={(e) => handleCalculations(index, 'foreign_amount', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>

                    {/* Operation dimension select (Searchable) */}
                    <td className="p-0 border-r border-zinc-200 w-48 relative" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="ابحث..."
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-white px-3 py-2 text-xs bg-transparent outline-none font-semibold text-zinc-700"
                        value={
                          activeRowSearch && activeRowSearch.index === index && activeRowSearch.field === 'operation'
                            ? activeRowSearch.query
                            : (operations.find(o => o.id === item.operation_id)?.operation_number || '')
                        }
                        onChange={(e) => setActiveRowSearch({ index, field: 'operation', query: e.target.value })}
                        onFocus={() => {
                          setActiveRowSearch({ index, field: 'operation', query: operations.find(o => o.id === item.operation_id)?.operation_number || '' });
                        }}
                      />
                      {activeRowSearch && activeRowSearch.index === index && activeRowSearch.field === 'operation' && (
                        <div className="absolute top-full right-0 left-0 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto min-w-[200px]">
                          {(() => {
                            const queryNorm = normalizeText(activeRowSearch.query);
                            const filtered = operations.filter(o => 
                              normalizeText(o.operation_number).includes(queryNorm) || 
                              (o.description && normalizeText(o.description).includes(queryNorm))
                            );
                            if (filtered.length === 0) {
                              return (
                                <div className="p-3 text-center text-xs text-zinc-400 font-bold">
                                  {language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results'}
                                </div>
                              );
                            }
                            return filtered.slice(0, 10).map(o => (
                              <button
                                key={o.id}
                                type="button"
                                className="w-full px-3 py-2 text-right hover:bg-zinc-50 transition-all text-xs font-bold flex justify-between items-center"
                                onClick={() => {
                                  updateItem(index, 'operation_id', o.id);
                                  setActiveRowSearch(null);
                                }}
                              >
                                <span className="text-zinc-800">{o.operation_number}</span>
                                <span className="text-zinc-400 text-[10px] font-normal truncate max-w-[120px]">{o.description}</span>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </td>

                    {/* Cost center dimension select */}
                    <td className="p-0 border-r border-zinc-200 w-48">
                      <select
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/10 px-3 py-2 text-xs bg-transparent outline-none font-semibold text-zinc-700 cursor-pointer"
                        value={item.cost_center_id || ''}
                        onChange={(e) => updateItem(index, 'cost_center_id', e.target.value)}
                      >
                        <option value="">---</option>
                        {costCenters.map(cc => (
                          <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
                        ))}
                      </select>
                    </td>

                    {/* Department dimension select */}
                    <td className="p-0 border-r border-zinc-200 w-48">
                      <select
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/10 px-3 py-2 text-xs bg-transparent outline-none font-semibold text-zinc-700 cursor-pointer"
                        value={item.department_id || ''}
                        onChange={(e) => updateItem(index, 'department_id', e.target.value)}
                      >
                        <option value="">---</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                        ))}
                      </select>
                    </td>

                    {/* Row Description */}
                    <td className="p-0 border-r border-zinc-200">
                      <input
                        type="text"
                        placeholder="شرح وتفاصيل السطر..."
                        className="w-full h-full border-0 focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/20 px-3 py-2.5 text-sm bg-transparent outline-none text-zinc-800"
                        value={item.description || ''}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                    </td>

                    {/* Delete button */}
                    <td className="p-0 text-center w-12 bg-zinc-50/10">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-all mx-auto block"
                        title="حذف السطر"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Table Footer with Sum of columns and status indicator */}
              <tfoot className="bg-zinc-50 border-t-2 border-zinc-200 select-none">
                <tr className="font-bold text-sm text-zinc-700">
                  {/* Total Debit */}
                  <td className="p-2 border-r border-zinc-200 text-center font-black text-emerald-600 bg-emerald-50/10 shadow-inner">
                    {formatNumber(totalDebit)}
                  </td>
                  {/* Total Credit */}
                  <td className="p-2 border-r border-zinc-200 text-center font-black text-red-600 bg-red-50/10 shadow-inner">
                    {formatNumber(totalCredit)}
                  </td>
                  {/* Status Indicator */}
                  <td colSpan={4} className="p-2 border-r border-zinc-200 text-right bg-zinc-100/30">
                    <div className="flex items-center gap-2">
                      {difference < 0.01 && totalDebit > 0 ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-black">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span>{language === 'ar' ? 'متزن وجاهز للحفظ' : 'Balanced & Ready'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-700 text-xs font-black animate-pulse">
                          <AlertCircle size={16} className="text-amber-600" />
                          <span>{language === 'ar' ? 'غير متزن حالياً' : 'Currently unbalanced'}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td colSpan={7} className="p-2 text-zinc-500 text-xs font-black text-center bg-zinc-100/30">
                    {difference < 0.01 ? '' : `${language === 'ar' ? 'الفارق:' : 'Difference:'} ${formatNumber(difference)}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add Row Button at the bottom of the table card */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-2">
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-100 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-sm border border-zinc-200"
            >
              <Plus size={18} />
              <span>إضافة سطر جديد</span>
            </button>
          </div>
        </div>
      </form>

      {/* Copy / Duplicate Entry Modal Dialog */}
      <AnimatePresence>
        {showCopyModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] max-w-3xl w-full p-8 space-y-6 shadow-2xl max-h-[85vh] flex flex-col border border-zinc-100"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-xl font-black text-zinc-900">{language === 'ar' ? 'نسخ من قيد سابق' : 'Copy Previous Journal Entry'}</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">{language === 'ar' ? 'اختر قيداً سابقاً لنسخ بياناته وتكرار تفاصيله' : 'Select a past manual entry to duplicate lines'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search input in modal */}
              <div className="relative">
                <Search className="absolute right-3 top-3 text-zinc-400" size={18} />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'ابحث برقم القيد أو البيان...' : 'Search by entry number or description...'}
                  className="w-full pr-10 pl-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-zinc-800 font-medium"
                  value={copySearchQuery}
                  onChange={(e) => setCopySearchQuery(e.target.value)}
                />
              </div>

              {/* Entries list container */}
              <div className="overflow-y-auto flex-1 border border-zinc-100 rounded-2xl divide-y divide-zinc-100 max-h-[45vh]">
                {filteredRecentEntries.map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => handleCopyEntry(entry.id)}
                    className="p-4 hover:bg-zinc-50 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">
                          {entry.entry_number || entry.id.substring(0, 8)}
                        </span>
                        <span className="text-[10px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md font-semibold">{entry.date}</span>
                      </div>
                      <p className="text-xs text-zinc-500 font-medium line-clamp-1">{entry.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-600">{formatNumber(entry.total_debit)}</span>
                      <span className="text-[10px] block text-zinc-400 font-bold">{language === 'ar' ? 'إجمالي المدين' : 'Total'}</span>
                    </div>
                  </div>
                ))}

                {filteredRecentEntries.length === 0 && (
                  <p className="p-12 text-center text-zinc-400 font-medium italic text-sm">{language === 'ar' ? 'لا توجد قيود مطابقة متوفرة حالياً' : 'No matching entries found'}</p>
                )}
              </div>

              {/* Footer info inside modal */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="px-6 py-3 bg-zinc-100 text-zinc-700 font-bold rounded-2xl hover:bg-zinc-200 transition-all text-sm"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
