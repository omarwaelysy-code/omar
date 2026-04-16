import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Products } from './pages/Products';
import { Suppliers } from './pages/Suppliers';
import { Expenses } from './pages/Expenses';
import { PaymentMethods } from './pages/PaymentMethods';
import { Invoices } from './pages/Invoices';
import { PurchaseInvoices } from './pages/PurchaseInvoices';
import { Receipts } from './pages/Receipts';
import { PaymentVouchers } from './pages/PaymentVouchers';
import { Returns } from './pages/Returns';
import { PurchaseReturns } from './pages/PurchaseReturns';
import { CustomerDiscounts } from './pages/CustomerDiscounts';
import { SupplierDiscounts } from './pages/SupplierDiscounts';
import { CashTransfers } from './pages/CashTransfers';
import { Users } from './pages/Users';
import { CustomerStatement } from './pages/CustomerStatement';
import { SupplierStatement } from './pages/SupplierStatement';
import { CustomerBalances } from './pages/CustomerBalances';
import { SupplierBalances } from './pages/SupplierBalances';
import { SalesReport } from './pages/SalesReport';
import { ExpensesReport } from './pages/ExpensesReport';
import { CashReport } from './pages/CashReport';
import { CashBalances } from './pages/CashBalances';
import { ActivityLogPage } from './pages/ActivityLog';
import { AccountTypes } from './pages/AccountTypes';
import { Accounts } from './pages/Accounts';
import { ChartOfAccounts } from './pages/ChartOfAccounts';
import { JournalEntries } from './pages/JournalEntries';
import { CreateJournalEntry } from './pages/CreateJournalEntry';
import { GeneralLedger } from './pages/GeneralLedger';
import { TrialBalance } from './pages/TrialBalance';
import { IncomeStatement } from './pages/IncomeStatement';
import { BalanceSheet } from './pages/BalanceSheet';
import { DiscountSettings } from './pages/DiscountSettings';
import { BackupRestore } from './pages/BackupRestore';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

import { useNavigation } from './contexts/NavigationContext';
import { useLanguage } from './contexts/LanguageContext';

import { AIAssistant } from './components/AIAssistant';
import DatabaseError from './components/DatabaseError';

import { SuperAdminDashboard } from './pages/SuperAdminDashboard';

export default function App() {
  const { t, dir } = useLanguage();
  const { isAuthenticated, loading: authLoading, isSuperAdmin, isCompanyAdmin, isStandardUser } = useAuth();
  const { currentPage, setCurrentPage, openTabs, activeTabId } = useNavigation();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  React.useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/erp/db-health');
        if (!response.ok) {
          const data = await response.json();
          setDbError(data.error || data.message || 'Failed to connect to database');
        }
      } catch (err: any) {
        setDbError(err.message || 'Network error while connecting to database');
      } finally {
        if (!authLoading) {
          setLoading(false);
        }
      }
    };

    checkHealth();
  }, [authLoading]);

  if (dbError) {
    return <DatabaseError error={dbError} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4" dir={dir}>
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-medium text-stone-600">{t('common.loading')}</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Check for custom super admin route even when not authenticated
    if (window.location.pathname === '/super-admin@m@r2020') {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
          <Login onToggle={() => setAuthMode('register')} />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        {authMode === 'login' ? (
          <Login onToggle={() => setAuthMode('register')} />
        ) : (
          <Register onToggle={() => setAuthMode('login')} />
        )}
      </div>
    );
  }

  const getPageComponent = (id: string) => {
    // Handle custom super admin route
    if (window.location.pathname === '/super-admin@m@r2020') {
      if (isSuperAdmin) return <SuperAdminDashboard />;
      // If not super admin, redirect or show error
    }

    // Role-based access control for pages
    if (id === 'super_admin_dashboard' && !isSuperAdmin) return <Dashboard />;
    if (id === 'dashboard') return isSuperAdmin ? <SuperAdminDashboard /> : <Dashboard />;

    switch (id) {
      case 'super_admin_dashboard': return isSuperAdmin ? <SuperAdminDashboard /> : <Dashboard />;
      case 'dashboard': return isSuperAdmin ? <SuperAdminDashboard /> : <Dashboard />;
      case 'customers': return <Customers />;
      case 'products': return <Products />;
      case 'suppliers': return <Suppliers />;
      case 'expenses': return <Expenses />;
      case 'payment_methods': return <PaymentMethods />;
      case 'invoices': return <Invoices />;
      case 'purchase_invoices': return <PurchaseInvoices />;
      case 'receipts': return <Receipts />;
      case 'payment_vouchers': return <PaymentVouchers />;
      case 'returns': return <Returns />;
      case 'purchase_returns': return <PurchaseReturns />;
      case 'customer_discounts': return <CustomerDiscounts />;
      case 'supplier_discounts': return <SupplierDiscounts />;
      case 'cash_transfers': return <CashTransfers />;
      case 'users': return <Users />;
      case 'customer_statement': return <CustomerStatement />;
      case 'supplier_statement': return <SupplierStatement />;
      case 'customer_balances': return <CustomerBalances />;
      case 'supplier_balances': return <SupplierBalances />;
      case 'sales_report': return <SalesReport />;
      case 'expenses_report': return <ExpensesReport />;
      case 'cash_report': return <CashReport />;
      case 'cash_balances': return <CashBalances />;
      case 'account_types': return <AccountTypes />;
      case 'accounts': return <Accounts />;
      case 'chart_of_accounts': return <ChartOfAccounts />;
      case 'journal_entries': return <JournalEntries />;
      case 'create_journal_entry': return <CreateJournalEntry />;
      case 'general_ledger_report': return <GeneralLedger />;
      case 'trial_balance': return <TrialBalance />;
      case 'income_statement': return <IncomeStatement />;
      case 'balance_sheet': return <BalanceSheet />;
      case 'discount_settings': return <DiscountSettings />;
      case 'backup_restore': return <BackupRestore />;
      case 'activity_log': return <ActivityLogPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Layout onNavigate={setCurrentPage} currentPage={currentPage}>
        <div className="relative w-full h-full">
          {window.location.pathname === '/super-admin@m@r2020' && isSuperAdmin ? (
            <SuperAdminDashboard />
          ) : (
            openTabs.map((tab) => (
              <div 
                key={tab.id} 
                className={activeTabId === tab.id ? 'block' : 'hidden'}
              >
                {getPageComponent(tab.id)}
              </div>
            ))
          )}
        </div>
      </Layout>
    </div>
  );
}
