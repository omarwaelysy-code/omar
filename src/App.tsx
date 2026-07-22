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
import { SalesOrders } from './pages/SalesOrders';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { GoodsReceipts } from './pages/GoodsReceipts';
import { CustomerDiscounts } from './pages/CustomerDiscounts';
import { SupplierDiscounts } from './pages/SupplierDiscounts';
import { CustomerSettlements } from './pages/CustomerSettlements';
import { SupplierSettlements } from './pages/SupplierSettlements';
import { CashTransfers } from './pages/CashTransfers';
import { WarehouseTransfers } from './pages/WarehouseTransfers';
import { OpeningStockBalances } from './pages/OpeningStockBalances';
import { StockAdjustments } from './pages/StockAdjustments';
import { Users } from './pages/Users';
import { CustomerStatement } from './pages/CustomerStatement';
import { SupplierStatement } from './pages/SupplierStatement';
import { StockCardReport } from './pages/StockCardReport';
import { StockBalancesReport } from './pages/StockBalancesReport';
import { CustomerBalances } from './pages/CustomerBalances';
import { SupplierBalances } from './pages/SupplierBalances';
import { ExpensesReport } from './pages/ExpensesReport';
// import { CashReport } from './pages/CashReport';
import { CashBalances } from './pages/CashBalances';
import { CompanySettings } from './pages/CompanySettings';
import Currencies from './pages/Currencies';
import { AccountTypes } from './pages/AccountTypes';
import { Accounts } from './pages/Accounts';
import { ChartOfAccounts } from './pages/ChartOfAccounts';
import { JournalEntries } from './pages/JournalEntries';
import { IntegrityDashboard } from './pages/IntegrityDashboard';
import { DiscountSettings } from './pages/DiscountSettings';
import { BackupRestore } from './pages/BackupRestore';
import { PeriodClosing } from './pages/PeriodClosing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { DashboardBuilder } from './pages/DashboardBuilder';
import { LandingPage } from './pages/LandingPage';
import { NotFound } from './pages/NotFound';

// Lazy load heavy screens for optimized bundle size & faster initial load
const Invoices = React.lazy(() => import('./pages/Invoices').then(m => ({ default: m.Invoices })));
const PurchaseInvoices = React.lazy(() => import('./pages/PurchaseInvoices').then(m => ({ default: m.PurchaseInvoices })));
const Receipts = React.lazy(() => import('./pages/Receipts').then(m => ({ default: m.Receipts })));
const PaymentVouchers = React.lazy(() => import('./pages/PaymentVouchers').then(m => ({ default: m.PaymentVouchers })));
const Returns = React.lazy(() => import('./pages/Returns').then(m => ({ default: m.Returns })));
const PurchaseReturns = React.lazy(() => import('./pages/PurchaseReturns').then(m => ({ default: m.PurchaseReturns })));
const GeneralStockMovementsReport = React.lazy(() => import('./pages/GeneralStockMovementsReport').then(m => ({ default: m.GeneralStockMovementsReport })));
const SalesReport = React.lazy(() => import('./pages/SalesReport').then(m => ({ default: m.SalesReport })));
const ActivityLogPage = React.lazy(() => import('./pages/ActivityLog').then(m => ({ default: m.ActivityLogPage })));
const DetailedJournalEntries = React.lazy(() => import('./pages/DetailedJournalEntries').then(m => ({ default: m.DetailedJournalEntries })));
const CreateJournalEntry = React.lazy(() => import('./pages/CreateJournalEntry').then(m => ({ default: m.CreateJournalEntry })));
const GeneralLedger = React.lazy(() => import('./pages/GeneralLedger').then(m => ({ default: m.GeneralLedger })));
const TrialBalance = React.lazy(() => import('./pages/TrialBalance').then(m => ({ default: m.TrialBalance })));
const IncomeStatement = React.lazy(() => import('./pages/IncomeStatement').then(m => ({ default: m.IncomeStatement })));
const BalanceSheet = React.lazy(() => import('./pages/BalanceSheet').then(m => ({ default: m.BalanceSheet })));

import { useNavigation } from './contexts/NavigationContext';
import { useLanguage } from './contexts/LanguageContext';

import { AIAssistant } from './components/AIAssistant';
import DatabaseError from './components/DatabaseError';

import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { SystemCheck } from './pages/SystemCheck';
import { MaintenanceModeGuard } from './components/MaintenanceModeGuard';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { OperationCategories } from './pages/OperationCategories';
import { OperationFields } from './pages/OperationFields';
import { Operations } from './pages/Operations';
import { Departments } from './pages/Departments';
import { CostCenters } from './pages/CostCenters';
import { Templates } from './pages/Templates';
import { UnifiedPrintEngine } from './components/UnifiedPrintEngine';

import { LoadingScreen } from './components/LoadingScreen';
import { AnimatePresence } from 'framer-motion';

export default function App() {
  const { t, dir } = useLanguage();
  const { isAuthenticated, loading: authLoading, isSuperAdmin, user } = useAuth();
  const { currentPage, setCurrentPage, openTabs, activeTabId } = useNavigation();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

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
      <UnifiedPrintEngine />
      <AnimatePresence mode="wait">
        {loading ? (
          <LoadingScreen key="loading" />
        ) : (
          <MaintenanceModeGuard key="app">
            <ChangePasswordModal />
            {!isAuthenticated ? (
              currentPath === '/login' ? (
                <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
                  {authMode === 'login' ? (
                    <Login onToggle={() => setAuthMode('register')} />
                  ) : (
                    <Register onToggle={() => setAuthMode('login')} />
                  )}
                </div>
              ) : currentPath === '/' ? (
                <LandingPage
                  onGetStarted={() => navigateTo('/login')}
                  onLogin={() => navigateTo('/login')}
                />
              ) : (
                <NotFound onGoHome={() => navigateTo('/')} />
              )
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
                        <React.Suspense fallback={
                          <div className="flex items-center justify-center p-20 w-full h-full min-h-[300px]">
                            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        }>
                          {getPageComponent(tab.id)}
                        </React.Suspense>
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
    // Super Admin specific pages
    if (isSuperAdmin) {
      if (id === 'dashboard' || id === 'super_admin_dashboard') return <SuperAdminDashboard />;
      if (id === 'companies') return <SuperAdminDashboard initialTab="companies" />;
      if (id === 'users') return <SuperAdminDashboard initialTab="users" />;
      if (id === 'subscriptions') return <SuperAdminDashboard initialTab="subscriptions" />;
      if (id === 'system_settings') return <SuperAdminDashboard initialTab="settings" />;
      if (id === 'activity_log') return <SuperAdminDashboard initialTab="audit" />;
      if (id === 'system_check') return <SuperAdminDashboard initialTab="system" />;
      if (id === 'monitoring') return <SuperAdminDashboard initialTab="monitoring" />;
      if (id === 'backup_restore') return <BackupRestore />;
      if (id === 'global_reports') return <SuperAdminDashboard initialTab="reports" />;
      
      // Prevent any company ERP route from loading for Super Admin
      return <SuperAdminDashboard />;
    }

    switch (id) {
      case 'dashboard': return <Dashboard />;
      case 'dashboard_designer': return <DashboardBuilder />;
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
      case 'goods_receipts': return <GoodsReceipts />;
      case 'purchase_orders': return <PurchaseOrders />;
      case 'receipts': return <Receipts />;
      case 'payment_vouchers': return <PaymentVouchers />;
      case 'returns': return <Returns />;
      case 'purchase_returns': return <PurchaseReturns />;
      case 'customer_discounts': return <CustomerDiscounts />;
      case 'supplier_discounts': return <SupplierDiscounts />;
      case 'customer_settlements': return <CustomerSettlements />;
      case 'supplier_settlements': return <SupplierSettlements />;
      case 'cash_transfers': return <CashTransfers />;
      case 'warehouse_transfers': return <WarehouseTransfers />;
      case 'opening_stock_balances': return <OpeningStockBalances />;
      case 'stock_adjustments': return <StockAdjustments />;
      case 'users': return <Users />;
      case 'customer_statement': return <CustomerStatement />;
      case 'supplier_statement': return <SupplierStatement />;
      case 'stock_card_report': return <StockCardReport />;
      case 'stock_balances_report': return <StockBalancesReport />;
      case 'general_stock_movements_report': return <GeneralStockMovementsReport />;
      case 'customer_balances': return <CustomerBalances />;
      case 'supplier_balances': return <SupplierBalances />;
      case 'sales_report': return <SalesReport />;
      case 'expenses_report': return <ExpensesReport />;
      // case 'cash_report': return <CashReport />;
      case 'cash_balances': return <CashBalances />;
      case 'account_types': return <AccountTypes />;
      case 'accounts': return <Accounts />;
      case 'chart_of_accounts': return <ChartOfAccounts />;
      case 'journal_entries': return <JournalEntries />;
      case 'detailed_journal_entries': return <DetailedJournalEntries />;
      case 'create_journal_entry': return <CreateJournalEntry />;
      case 'general_ledger_report': return <GeneralLedger />;
      case 'trial_balance': return <TrialBalance />;
      case 'income_statement': return <IncomeStatement />;
      case 'balance_sheet': return <BalanceSheet />;
      case 'discount_settings': return <DiscountSettings />;
      case 'backup_restore': return <BackupRestore />;
      case 'period_closing': return <PeriodClosing />;
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
      case 'templates': return <Templates initialView="list" />;
      case 'create_template': return <Templates initialView="create" />;
      default: return <Dashboard />;
    }
  }
}

