import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface Tab {
  id: string;
  label: string;
}

interface NavigationContextType {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  openTabs: Tab[];
  activeTabId: string;
  openTab: (id: string, label?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  resetNavigation: () => void;
  pendingViewDoc: { type: string; idOrNumber: string } | null;
  setPendingViewDoc: (doc: { type: string; idOrNumber: string } | null) => void;
  pendingLedgerParams: { accountId: string; startDate: string; endDate: string } | null;
  setPendingLedgerParams: (params: { accountId: string; startDate: string; endDate: string } | null) => void;
  pendingAccountTypeEditId: string | null;
  setPendingAccountTypeEditId: (id: string | null) => void;
  pendingEtaSupplierForCreation: { name: string; taxNumber: string; address?: string; phone?: string } | null;
  setPendingEtaSupplierForCreation: (val: { name: string; taxNumber: string; address?: string; phone?: string } | null) => void;
  pendingEtaSupplierForLinking: { name: string; taxNumber: string; address?: string } | null;
  setPendingEtaSupplierForLinking: (val: { name: string; taxNumber: string; address?: string } | null) => void;
  pendingEtaProductForCreation: {
    itemCode: string;
    itemName?: string;
    itemType?: string;
    unit?: string;
    salePrice?: number;
    costPrice?: number;
    description?: string;
  } | null;
  setPendingEtaProductForCreation: (val: {
    itemCode: string;
    itemName?: string;
    itemType?: string;
    unit?: string;
    salePrice?: number;
    costPrice?: number;
    description?: string;
  } | null) => void;
  pendingEtaProductForLinking: {
    itemCode: string;
    itemName?: string;
    itemType?: string;
  } | null;
  setPendingEtaProductForLinking: (val: {
    itemCode: string;
    itemName?: string;
    itemType?: string;
  } | null) => void;
  pendingEtaInvoiceForPurchase: any | null;
  setPendingEtaInvoiceForPurchase: (val: any | null) => void;
  pendingEtaInvoiceForReturn: any | null;
  setPendingEtaInvoiceForReturn: (val: any | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const pageLabels: { [key: string]: string } = {
  'dashboard': 'لوحة التحكم',
  'dashboard_designer': 'مصمم لوحات التحكم',
  'super_admin_dashboard': 'لوحة تحكم المدير العام',
  'contact_messages': 'رسائل التواصل',
  'customers': 'العملاء',
  'suppliers': 'الموردين',
  'products': 'الأصناف',
  'employees': 'الموظفين',
  'expenses': 'بنود المصروفات',
  'payment_methods': 'طرق السداد',
  'invoices': 'فواتير مبيعات',
  'sales_orders': 'أوامر بيع',
  'purchase_invoices': 'فواتير مشتريات',
  'goods_receipts': 'إذن استلام المخزون',
  'purchase_orders': 'أوامر شراء',
  'receipts': 'سند القبض / قبض من عميل',
  'payment_vouchers': 'سند الصرف / صرف لمورد',
  'supplier_payment_vouchers': 'سند صرف مورد',
  'issued_cheques': 'الشيكات الصادرة',
  'returns': 'مرتجع مبيعات',
  'purchase_returns': 'مرتجع مشتريات',
  'customer_discounts': 'خصم عملاء',
  'supplier_discounts': 'خصم موردين',
  'users': 'إدارة المستخدمين',
  'customer_statement': 'كشف حساب العميل',
  'supplier_statement': 'كشف حساب المورد',
  'customer_balances': 'أرصدة العملاء',
  'supplier_balances': 'أرصدة الموردين',
  'sales_report': 'تقرير المبيعات',
  'expenses_report': 'تقرير المصروفات',
  'cash_report': 'تقرير الخزينة',
  'account_types': 'أنواع الحسابات',
  'accounts': 'دليل الحسابات',
  'chart_of_accounts': 'شجرة الحسابات',
  'journal_entries': 'قيود اليومية',
  'create_journal_entry': 'إضافة قيد يومية',
  'general_ledger_report': 'حساب الأستاذ',
  'trial_balance': 'ميزان المراجعة',
  'income_statement': 'قائمة الدخل',
  'balance_sheet': 'المركز المالي',
  'discount_settings': 'إعدادات الخصومات',
  'activity_log': 'سجل النشاط',
  'companies': 'إدارة الشركات',
  'system_check': 'فحص النظام',
  'backup_restore': 'النسخ الاحتياطي والاستعادة',
  'audit_logs': 'سجل الرقابة',
  'stock_card_report': 'كارت الصنف',
  'templates': 'القوالب',
  'create_template': 'إنشاء قالب',
  'warehouses': 'المستودعات',
  'item_groups': 'مجموعات الأصناف',
  'customer_settlements': 'تسويات العملاء',
  'supplier_settlements': 'تسويات الموردين',
  'cash_transfers': 'حوالات الخزينة',
  'warehouse_transfers': 'حوالات المستودعات',
  'opening_stock_balances': 'أرصدة أول المدة للمخزون',
  'stock_adjustments': 'تسويات المخزون',
  'stock_balances_report': 'تقرير أرصدة المخزون',
  'general_stock_movements_report': 'تقرير حركة المخزون العامة',
  'cash_balances': 'أرصدة النقدية',
  'detailed_journal_entries': 'دفتر اليومية المفصل',
  'integrity_dashboard': 'فحص سلامة البيانات',
  'currencies': 'العملات',
  'operation_categories': 'فئات العمليات',
  'operation_fields': 'حقول العمليات',
  'operations': 'العمليات',
  'departments': 'الأقسام',
  'cost_centers': 'مراكز التكلفة',
  'company_settings': 'إعدادات الشركة',
  'quotations': 'عروض الأسعار',
  'pos_connected_branches': 'الفروع المتصلة',
  'pos_branch_linking': 'ربط الفرع',
  'eta_dashboard': 'نظرة عامة (ETA Dashboard)',
  'eta_received_invoices': 'الوثائق الإلكترونية',
  'eta_detailed_invoices': 'الوثائق الإلكترونية بالتفصيل',
  'eta_supplier_mapping': 'ربط الموردين (ETA)',
  'eta_item_mapping': 'ربط الأصناف المستلمة (ETA)',
  'eta_sent_item_mapping': 'ربط الأصناف الصادرة (ETA)',
  'eta_tax_types': 'دليل أنواع الضرائب والرسوم (ETA)',
};

const getStorageKey = (companyId?: string) => {
  const cid = companyId || localStorage.getItem('current_company_id') || 'default';
  return `obrain_tabs_state_${cid}`;
};

const getSavedNavState = (companyId?: string) => {
  try {
    const raw = localStorage.getItem(getStorageKey(companyId));
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.openTabs) && data.openTabs.length > 0 && typeof data.activeTabId === 'string') {
        const validTabs: Tab[] = data.openTabs.filter(
          (t: any) => t && typeof t.id === 'string'
        );
        if (validTabs.length > 0) {
          const hasDashboard = validTabs.some(t => t.id === 'dashboard');
          const finalTabs = hasDashboard 
            ? validTabs 
            : [{ id: 'dashboard', label: pageLabels['dashboard'] || 'لوحة التحكم' }, ...validTabs];

          const activeId = finalTabs.some(t => t.id === data.activeTabId)
            ? data.activeTabId
            : finalTabs[finalTabs.length - 1].id;

          return {
            openTabs: finalTabs,
            activeTabId: activeId,
            currentPage: activeId
          };
        }
      }
    }
  } catch (e) {
    console.error('Error reading saved navigation state:', e);
  }

  const initialId = 'dashboard';
  return {
    openTabs: [{ id: initialId, label: pageLabels[initialId] || 'لوحة التحكم' }],
    activeTabId: initialId,
    currentPage: initialId
  };
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSuperAdmin } = useAuth();
  
  const [initialNavState] = useState(() => getSavedNavState(user?.company_id));
  const [currentPage, setCurrentPage] = useState<string>(initialNavState.currentPage);
  const [openTabs, setOpenTabs] = useState<Tab[]>(initialNavState.openTabs);
  const [activeTabId, setActiveTabId] = useState<string>(initialNavState.activeTabId);
  const lastUserCompanyRef = React.useRef<string | null>(null);

  // Auto-save tabs state on changes to localStorage so Ctrl+F5 or reload preserves them
  useEffect(() => {
    if (openTabs && openTabs.length > 0 && activeTabId) {
      try {
        const key = getStorageKey(user?.company_id);
        localStorage.setItem(key, JSON.stringify({
          openTabs,
          activeTabId
        }));
      } catch (e) {
        console.error('Failed to save nav state:', e);
      }
    }
  }, [openTabs, activeTabId, user?.company_id]);

  const [pendingViewDoc, setPendingViewDoc] = useState<{ type: string; idOrNumber: string } | null>(null);
  const [pendingLedgerParams, setPendingLedgerParams] = useState<{ accountId: string; startDate: string; endDate: string } | null>(null);
  const [pendingAccountTypeEditId, setPendingAccountTypeEditId] = useState<string | null>(null);
  const [pendingEtaSupplierForCreation, setPendingEtaSupplierForCreation] = useState<{ name: string; taxNumber: string; address?: string; phone?: string } | null>(null);
  const [pendingEtaSupplierForLinking, setPendingEtaSupplierForLinking] = useState<{ name: string; taxNumber: string; address?: string } | null>(null);
  const [pendingEtaProductForCreation, setPendingEtaProductForCreation] = useState<{
    itemCode: string;
    itemName?: string;
    itemType?: string;
    unit?: string;
    salePrice?: number;
    costPrice?: number;
    description?: string;
  } | null>(null);
  const [pendingEtaProductForLinking, setPendingEtaProductForLinking] = useState<{
    itemCode: string;
    itemName?: string;
    itemType?: string;
  } | null>(null);
  const [pendingEtaInvoiceForPurchase, setPendingEtaInvoiceForPurchase] = useState<any | null>(null);
  const [pendingEtaInvoiceForReturn, setPendingEtaInvoiceForReturn] = useState<any | null>(null);

  const openTab = (id: string, label?: string) => {
    const tabLabel = label || pageLabels[id] || id;
    setOpenTabs(prev => {
      if (prev.find(tab => tab.id === id)) return prev;
      return [...prev, { id, label: tabLabel }];
    });
    setActiveTabId(id);
    setCurrentPage(id);
  };

  useEffect(() => {
    const handleNavigate = (e: any) => {
      const { page } = e.detail;
      const label = pageLabels[page] || page;
      openTab(page, label);
    };
    window.addEventListener('navigate-to', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate-to', handleNavigate as EventListener);
  }, []);

  const resetNavigation = () => {
    const initialId = isSuperAdmin ? 'dashboard' : 'dashboard';
    const initialLabel = pageLabels[initialId] || 'لوحة التحكم';
    setCurrentPage(initialId);
    setOpenTabs([{ id: initialId, label: initialLabel }]);
    setActiveTabId(initialId);
    try {
      localStorage.removeItem(getStorageKey(user?.company_id));
    } catch (e) {}
  };

  // Only reset/restore tabs when user switches company or different user logs in
  useEffect(() => {
    if (!user) return;
    const currentKey = `${user.id}_${user.company_id}`;

    if (lastUserCompanyRef.current && lastUserCompanyRef.current !== currentKey) {
      const state = getSavedNavState(user.company_id);
      setOpenTabs(state.openTabs);
      setActiveTabId(state.activeTabId);
      setCurrentPage(state.activeTabId);
    }

    lastUserCompanyRef.current = currentKey;
  }, [user?.id, user?.company_id]);

  const closeTab = (id: string) => {
    if (id === 'dashboard') return;
    
    setOpenTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== id);
      if (activeTabId === id) {
        const lastTab = newTabs[newTabs.length - 1];
        setActiveTabId(lastTab.id);
        setCurrentPage(lastTab.id);
      }
      return newTabs;
    });
  };

  const setActiveTab = (id: string) => {
    setActiveTabId(id);
    setCurrentPage(id);
  };

  return (
    <NavigationContext.Provider value={{ 
      currentPage, 
      setCurrentPage: (id) => {
        const label = pageLabels[id] || id;
        openTab(id, label);
      },
      openTabs,
      activeTabId,
      openTab,
      closeTab,
      setActiveTab,
      resetNavigation,
      pendingViewDoc,
      setPendingViewDoc,
      pendingLedgerParams,
      setPendingLedgerParams,
      pendingAccountTypeEditId,
      setPendingAccountTypeEditId,
      pendingEtaSupplierForCreation,
      setPendingEtaSupplierForCreation,
      pendingEtaSupplierForLinking,
      setPendingEtaSupplierForLinking,
      pendingEtaProductForCreation,
      setPendingEtaProductForCreation,
      pendingEtaProductForLinking,
      setPendingEtaProductForLinking,
      pendingEtaInvoiceForPurchase,
      setPendingEtaInvoiceForPurchase,
      pendingEtaInvoiceForReturn,
      setPendingEtaInvoiceForReturn
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
