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
  openTab: (id: string, label: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  resetNavigation: () => void;
  pendingViewDoc: { type: string; idOrNumber: string } | null;
  setPendingViewDoc: (doc: { type: string; idOrNumber: string } | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const pageLabels: { [key: string]: string } = {
  'dashboard': 'لوحة التحكم',
  'super_admin_dashboard': 'لوحة تحكم المدير العام',
  'customers': 'العملاء',
  'suppliers': 'الموردين',
  'products': 'الأصناف',
  'employees': 'الموظفين',
  'expenses': 'بنود المصروفات',
  'payment_methods': 'طرق السداد',
  'invoices': 'فواتير مبيعات',
  'sales_orders': 'أوامر بيع',
  'purchase_invoices': 'فواتير مشتريات',
  'purchase_orders': 'أوامر شراء',
  'receipts': 'سندات القبض',
  'payment_vouchers': 'سندات الصرف',
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
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSuperAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [openTabs, setOpenTabs] = useState<Tab[]>([{ id: 'dashboard', label: 'لوحة التحكم' }]);
  const [activeTabId, setActiveTabId] = useState('dashboard');
  const [pendingViewDoc, setPendingViewDoc] = useState<{ type: string; idOrNumber: string } | null>(null);

  const openTab = (id: string, label: string) => {
    setOpenTabs(prev => {
      if (prev.find(tab => tab.id === id)) return prev;
      return [...prev, { id, label }];
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
  };

  // Reset tabs when user changes (login/logout/switch company)
  useEffect(() => {
    resetNavigation();
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
      setPendingViewDoc
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
