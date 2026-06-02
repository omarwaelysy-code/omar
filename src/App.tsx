import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Employees } from './pages/Employees';
import { Products } from './pages/Products';
import { Warehouses } from './pages/Warehouses';
import { ItemGroups } from './pages/ItemGroups';
import { Suppliers } from './pages/Suppliers';
import { Expenses } from './pages/Expenses';
import { PaymentMethods } from './pages/PaymentMethods';
import { Invoices } from './pages/Invoices';
import { PurchaseInvoices } from './pages/PurchaseInvoices';
import { SalesOrders } from './pages/SalesOrders';
import { PurchaseOrders } from './pages/PurchaseOrders';
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
import { StockCardReport } from './pages/StockCardReport';
import { CustomerBalances } from './pages/CustomerBalances';
import { SupplierBalances } from './pages/SupplierBalances';
import { SalesReport } from './pages/SalesReport';
import { ExpensesReport } from './pages/ExpensesReport';
import { CashReport } from './pages/CashReport';
import { CashBalances } from './pages/CashBalances';
import { ActivityLogPage } from './pages/ActivityLog';
import { CompanySettings } from './pages/CompanySettings';
import Currencies from './pages/Currencies';
import { AccountTypes } from './pages/AccountTypes';
import { Accounts } from './pages/Accounts';
import { ChartOfAccounts } from './pages/ChartOfAccounts';
import { JournalEntries } from './pages/JournalEntries';
import { CreateJournalEntry } from './pages/CreateJournalEntry';
import { GeneralLedger } from './pages/GeneralLedger';
import { TrialBalance } from './pages/TrialBalance';
import { IncomeStatement } from './pages/IncomeStatement';
import { BalanceSheet } from './pages/BalanceSheet';
import { IntegrityDashboard } from './pages/IntegrityDashboard';
import { DiscountSettings } from './pages/DiscountSettings';
import { BackupRestore } from './pages/BackupRestore';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

import { useNavigation } from './contexts/NavigationContext';
import { useLanguage } from './contexts/LanguageContext';

import { AIAssistant } from './components/AIAssistant';
import DatabaseError from './components/DatabaseError';

import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { SystemCheck } from './pages/SystemCheck';
import { MaintenanceModeGuard } from './components/MaintenanceModeGuard';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { Toaster } from 'react-hot-toast';
import { OperationCategories } from './pages/OperationCategories';
import { OperationFields } from './pages/OperationFields';
import { Operations } from './pages/Operations';
import { Departments } from './pages/Departments';
import { CostCenters } from './pages/CostCenters';

import { LoadingScreen } from './components/LoadingScreen';
import { AnimatePresence } from 'framer-motion';

export default function App() {
  const { t, dir } = useLanguage();
  const { isAuthenticated, loading: authLoading, isSuperAdmin, user } = useAuth();
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
          // Add a slight delay for smooth transition
          setTimeout(() => setLoading(false), 500);
        }
      }
    };

    checkHealth();
  }, [authLoading]);

  if (dbError) {
    return <DatabaseError error={dbError} />;
  }

  return (
    <div className={`min-h-screen ${dir === 'rtl' ? 'font-sans' : 'font-sans'}`} dir={dir}>
      <Toaster position="top-center" />
      <AnimatePresence mode="wait">
        {loading ? (
          <LoadingScreen key="loading" />
        ) : (
          <MaintenanceModeGuard key="app">
            <ChangePasswordModal />
            {!isAuthenticated ? (
              <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
                {authMode === 'login' ? (
                  <Login onToggle={() => setAuthMode('register')} />
                ) : (
                  <Register onToggle={() => setAuthMode('login')} />
                )}
              </div>
            ) : (
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
            )}
          </MaintenanceModeGuard>
        )}
      </AnimatePresence>
    </div>
  );

  function getPageComponent(id: string) {
    // Role-based access control for pages
    // Super Admin specific pages
    if (isSuperAdmin) {
      if (id === 'super_admin_dashboard') return <SuperAdminDashboard />;
      if (id === 'companies') return <SuperAdminDashboard initialTab="companies" />;
      if (id === 'system_check') return <SuperAdminDashboard initialTab="system" />;
      if (id === 'currencies') return <Currencies />;
      // Only show Super Admin dashboard for 'dashboard' if no specific company is selected or explicitly requested
      if (id === 'dashboard' && (!user?.company_id || user.company_id === 'system')) return <SuperAdminDashboard />;
    }

    switch (id) {
      case 'dashboard': return <Dashboard />;
      case 'customers': return <Customers />;
      case 'employees': return <Employees />;
      case 'products': return <Products />;
      case 'warehouses': return <Warehouses />;
      case 'item_groups': return <ItemGroups />;
      case 'suppliers': return <Suppliers />;
      case 'expenses': return <Expenses />;
      case 'payment_methods': return <PaymentMethods />;
      case 'invoices': return <Invoices />;// Invoices page
      case 'sales_orders': return <SalesOrders />;
      case 'purchase_invoices': return <PurchaseInvoices />;
      case 'purchase_orders': return <PurchaseOrders />;
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
      case 'stock_card_report': return <StockCardReport />;
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
      case 'integrity_dashboard': return <IntegrityDashboard />;
      case 'activity_log': return <ActivityLogPage />;
      case 'company_settings': return <CompanySettings />;
      case 'currencies': return <Currencies />;
      case 'operation_categories': return <OperationCategories />;
      case 'operation_fields': return <OperationFields />;
      case 'operations': return <Operations />;
      case 'departments': return <Departments />;
      case 'cost_centers': return <CostCenters />;
      case 'system_check': return <SystemCheck />;
      default: return <Dashboard />;
    }
  }
}

