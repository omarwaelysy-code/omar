import React, { createContext, useContext, useState } from 'react';

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
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const pageLabels: { [key: string]: string } = {
  'dashboard': 'لوحة التحكم',
  'customers': 'العملاء',
  'suppliers': 'الموردين',
  'products': 'الأصناف',
  'expenses': 'بنود المصروفات',
  'payment_methods': 'طرق السداد',
  'invoices': 'فواتير مبيعات',
  'purchase_invoices': 'فواتير مشتريات',
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
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [openTabs, setOpenTabs] = useState<Tab[]>([{ id: 'dashboard', label: 'لوحة التحكم' }]);
  const [activeTabId, setActiveTabId] = useState('dashboard');

  const openTab = (id: string, label: string) => {
    setOpenTabs(prev => {
      if (prev.find(tab => tab.id === id)) return prev;
      return [...prev, { id, label }];
    });
    setActiveTabId(id);
    setCurrentPage(id);
  };

  const closeTab = (id: string) => {
    if (id === 'dashboard') return; // Don't close dashboard
    
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
      setActiveTab
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
