import React, { useState, useEffect } from 'react';
import { AIAssistant } from './AIAssistant';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users as UsersIcon, 
  Package, 
  FileText, 
  FileSpreadsheet,
  Receipt, 
  Settings, 
  LogOut,
  Menu,
  Plus,
  X,
  RotateCcw,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Database,
  ShieldCheck,
  BarChart3,
  Truck,
  Wallet,
  CreditCard,
  History,
  Tags,
  Folder,
  List,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  PackageCheck,
  BookOpen,
  PieChart,
  Shield,
  Building2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Bell,
  Languages,
  Sun,
  Moon,
  Search,
  Coins,
  Home,
  ListPlus,
  Sliders,
  LayoutTemplate
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { notificationService } from '../services/notificationService';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { Company } from '../types';

import { Logo } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate: (page: string) => void;
  currentPage: string;
}

import { useNavigation } from '../contexts/NavigationContext';

const getTabIcon = (id: string) => {
  const iconProps = { size: 16 };
  switch (id) {
    case 'super_admin_dashboard': return <Shield {...iconProps} />;
    case 'dashboard': return <LayoutDashboard {...iconProps} />;
    case 'customers':
    case 'employees':
    case 'users':
      return <UsersIcon {...iconProps} />;
    case 'suppliers': return <Truck {...iconProps} />;
    case 'expenses': return <Wallet {...iconProps} />;
    case 'payment_methods':
    case 'payment_vouchers':
      return <CreditCard {...iconProps} />;
    case 'discount_settings':
    case 'operation_fields':
      return <Settings {...iconProps} />;
    case 'products': return <Package {...iconProps} />;
    case 'item_groups':
    case 'operation_categories':
      return <Folder {...iconProps} />;
    case 'warehouses': return <Home {...iconProps} />;
    case 'warehouse_transfers':
    case 'cash_transfers':
      return <ArrowLeftRight {...iconProps} />;
    case 'opening_stock_balances': return <ListPlus {...iconProps} />;
    case 'stock_adjustments': return <Sliders {...iconProps} />;
    case 'invoices': return <ArrowUpFromLine {...iconProps} />;
    case 'sales_orders':
    case 'purchase_orders':
    case 'journal_entries':
    case 'customer_statement':
    case 'supplier_statement':
      return <FileText {...iconProps} />;
    case 'returns':
    case 'purchase_returns':
      return <RotateCcw {...iconProps} />;
    case 'customer_discounts':
    case 'supplier_discounts':
      return <Tags {...iconProps} />;
    case 'customer_settlements':
    case 'supplier_settlements':
    case 'flexible_operations':
      return <Layers {...iconProps} />;
    case 'purchase_invoices': return <ArrowDownToLine {...iconProps} />;
    case 'goods_receipts': return <PackageCheck {...iconProps} />;
    case 'receipts': return <Receipt {...iconProps} />;
    case 'operations': return <List {...iconProps} />;
    case 'departments':
    case 'company_settings':
    case 'companies':
      return <Building2 {...iconProps} />;
    case 'cost_centers':
    case 'account_types':
    case 'chart_of_accounts':
      return <PieChart {...iconProps} />;
    case 'accounts':
    case 'general_ledger_report':
      return <BookOpen {...iconProps} />;
    case 'currencies': return <Coins {...iconProps} />;
    case 'create_journal_entry': return <Plus {...iconProps} />;
    case 'detailed_journal_entries': return <FileSpreadsheet {...iconProps} />;
    case 'stock_card_report':
    case 'general_stock_movements_report':
    case 'activity_log':
      return <History {...iconProps} />;
    case 'stock_balances_report':
    case 'customer_balances':
    case 'sales_report':
    case 'supplier_balances':
    // case 'cash_report':
    case 'cash_balances':
    case 'expenses_report':
    case 'trial_balance':
    case 'income_statement':
      return <BarChart3 {...iconProps} />;
    case 'balance_sheet': return <Shield {...iconProps} />;
    case 'integrity_dashboard':
    case 'system_check':
      return <ShieldCheck {...iconProps} />;
    case 'backup_restore': return <Database {...iconProps} />;
    case 'templates':
    case 'create_template':
      return <LayoutTemplate {...iconProps} />;
    default: return <Folder {...iconProps} />;
  }
};

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentPage }) => {
  const { language, setLanguage, t, dir } = useLanguage();
  const { logout, user, userMemberships, switchCompany, isSuperAdmin, isCompanyAdmin, isManager, isStandardUser, hasPermission } = useAuth();
  const { unreadCount, setIsCenterOpen, addPersistentNotification, showNotification } = useNotification();
  const { openTabs, activeTabId, openTab, closeTab, setActiveTab } = useNavigation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = React.useState(false);
  const [expandedMenus, setExpandedMenus] = React.useState<string[]>(['sales']);
  const [company, setCompany] = useState<Company | null>(null);
  
  // Change Password Modal State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (user?.must_change_password) {
      setShowChangePasswordModal(true);
    }
    
    if (!user?.company_id) return;

    // Use onSnapshot for real-time company updates
    const unsubscribe = dbService.listen<Company>('companies', user.company_id, (compData) => {
      if (compData) {
        setCompany(compData);
      }
    });
    
    return () => unsubscribe();
  }, [user?.company_id]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(t('common.passwords_not_matching'));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t('common.password_min_length'));
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    try {
      const response = await fetch('/api/erp/auth/update-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ newPassword })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('common.password_change_failed'));
      }

      await dbService.update('users', user!.id, { must_change_password: false });
      showNotification(t('common.password_change_success'));
      setShowChangePasswordModal(false);
    } catch (e: any) {
      setPasswordError(e.message || t('common.password_change_failed'));
    } finally {
      setPasswordLoading(false);
    }
  };

  // Periodic checks for notifications
  React.useEffect(() => {
    if (!user || isSuperAdmin) return;

    const runChecks = async () => {
      // Check low stock
      const lowStockProducts = await notificationService.checkLowStock(user.company_id);
      lowStockProducts.forEach(p => {
        addPersistentNotification({
          id: `low-stock-${p.id}`,
          title: t('common.low_stock'),
          message: t('common.low_stock_msg')
            .replace('{name}', p.name)
            .replace('{stock}', p.stock.toString()),
          type: 'warning',
          category: 'stock',
          path: 'products'
        });
      });

      // Check overdue invoices
      const overdueInvoices = await notificationService.checkOverdueInvoices(user.company_id);
      overdueInvoices.forEach(inv => {
        addPersistentNotification({
          id: `overdue-${inv.id}`,
          title: t('common.overdue_invoice'),
          message: t('common.overdue_invoice_msg')
            .replace('{number}', inv.invoice_number)
            .replace('{customer}', inv.customer_name),
          type: 'error',
          category: 'invoice',
          path: 'invoices'
        });
      });
    };

    runChecks();
    const interval = setInterval(runChecks, 1000 * 60 * 30); // Every 30 minutes
    return () => clearInterval(interval);
  }, [user, isSuperAdmin, addPersistentNotification]);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const filteredNavItems = React.useMemo(() => {
    if (!user) return [];

    const navItems = [
      ...(isSuperAdmin ? [{ id: 'super_admin_dashboard', label: t('nav.super_admin_dashboard'), icon: Shield, path: '/super-admin@m@r2020' }] : []),
      { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
      { 
        id: 'master_data', 
        label: t('nav.master_data'), 
        icon: Database,
        subItems: [
          { id: 'customers', label: t('nav.customers'), icon: UsersIcon },
          { id: 'employees', label: t('nav.employees') || 'الموظفين', icon: UsersIcon },
          { id: 'suppliers', label: t('nav.suppliers'), icon: Truck },
          { id: 'expenses', label: t('nav.expenses'), icon: Wallet },
          { id: 'payment_methods', label: t('nav.payment_methods'), icon: CreditCard },
          { id: 'discount_settings', label: t('nav.discount_settings'), icon: Settings },
        ]
      },
      {
        id: 'warehouses_menu',
        label: t('nav.warehouses_menu') || 'المخازن',
        icon: Home,
        subItems: [
          { id: 'products', label: t('nav.products'), icon: Package },
          { id: 'item_groups', label: t('nav.item_groups'), icon: Folder },
          { id: 'warehouses', label: t('nav.warehouses'), icon: Home },
          { id: 'goods_receipts', label: t('nav.goods_receipts') || 'إذن استلام المخزون', icon: PackageCheck },
          { id: 'warehouse_transfers', label: t('nav.warehouse_transfers') || 'تحويل بين المخازن', icon: ArrowLeftRight },
          { id: 'opening_stock_balances', label: t('nav.opening_stock_balances') || 'أرصدة أول المدة للمخزون', icon: ListPlus },
          { id: 'stock_adjustments', label: t('nav.stock_adjustments') || 'تسوية الأصناف', icon: Sliders }
        ]
      },
      {
        id: 'sales',
        label: t('nav.sales'),
        icon: ArrowUpFromLine,
        subItems: [
          { id: 'invoices', label: t('nav.invoices'), icon: ArrowUpFromLine },
          { id: 'sales_orders', label: t('nav.sales_orders'), icon: FileText },
          { id: 'returns', label: t('nav.returns'), icon: RotateCcw },
          { id: 'customer_discounts', label: t('nav.customer_discounts'), icon: Tags },
          { id: 'customer_settlements', label: t('nav.customer_settlements') || 'تسويات العملاء', icon: Layers }
        ]
      },
      {
        id: 'purchases',
        label: t('nav.purchases'),
        icon: ArrowDownToLine,
        subItems: [
          { id: 'purchase_invoices', label: t('nav.purchase_invoices'), icon: ArrowDownToLine },
          ...(company?.purchase_workflow_mode && company.purchase_workflow_mode !== 'Simple' ? [
            { id: 'goods_receipts', label: t('nav.goods_receipts') || (language === 'ar' ? 'استلام البضائع' : 'Goods Receipts'), icon: PackageCheck }
          ] : []),
          { id: 'purchase_orders', label: t('nav.purchase_orders'), icon: FileText },
          { id: 'purchase_returns', label: t('nav.purchase_returns'), icon: RotateCcw },
          { id: 'supplier_discounts', label: t('nav.supplier_discounts'), icon: Tags },
          { id: 'supplier_settlements', label: t('nav.supplier_settlements') || 'تسويات الموردين', icon: Layers }
        ]
      },
      {
        id: 'cash',
        label: t('nav.cash'),
        icon: Coins,
        subItems: [
          { id: 'receipts', label: t('nav.receipts'), icon: Receipt },
          { id: 'payment_vouchers', label: t('nav.payment_vouchers'), icon: CreditCard },
          { id: 'cash_transfers', label: t('nav.cash_transfers'), icon: ArrowLeftRight }
        ]
      },
      {
        id: 'flexible_operations',
        label: t('nav.flexible_operations') || 'نظام العمليات',
        icon: Layers,
        subItems: [
          { id: 'operations', label: t('nav.operations') || 'العمليات', icon: List },
          { id: 'departments', label: t('nav.departments') || 'الإدارات والهيكل', icon: Building2 },
          { id: 'cost_centers', label: t('nav.cost_centers') || 'مراكز التكلفة', icon: PieChart },
          { id: 'operation_categories', label: t('nav.operation_categories') || 'تصنيفات العمليات', icon: Folder },
          { id: 'operation_fields', label: t('nav.operation_fields') || 'حقول البيانات', icon: Settings },
        ]
      },
      { 
        id: 'general_ledger', 
        label: t('nav.general_ledger'), 
        icon: BookOpen,
        subItems: [
          { id: 'account_types', label: t('nav.account_types'), icon: PieChart },
          { id: 'accounts', label: t('nav.accounts'), icon: BookOpen },
          ...(company?.settings?.enable_multi_currency || isSuperAdmin ? [{ id: 'currencies', label: t('nav.currencies'), icon: Coins }] : []),
          { id: 'chart_of_accounts', label: t('nav.chart_of_accounts'), icon: PieChart },
          { id: 'create_journal_entry', label: t('nav.create_journal_entry'), icon: Plus },
          { id: 'journal_entries', label: t('nav.journal_entries'), icon: FileText },
          { id: 'detailed_journal_entries', label: t('nav.detailed_journal_entries') || 'قيود يومية تفصيلية', icon: FileSpreadsheet }
        ]
      },
      {
        id: 'templates_menu',
        label: t('nav.templates') || 'القوالب',
        icon: LayoutTemplate,
        subItems: [
          { id: 'templates', label: t('nav.templates_list') || 'جميع القوالب', icon: FileText },
          { id: 'create_template', label: t('nav.create_template') || 'إنشاء قالب', icon: Plus }
        ]
      },
      {
        id: 'reports_menu',
        label: t('nav.reports') || 'التقارير',
        icon: BarChart3,
        subItems: [
          { id: 'h_inv', label: language === 'ar' ? 'المستودع والمخازن' : 'Warehouse & Inventory', isHeader: true },
          { id: 'stock_card_report', label: t('nav.stock_card_report'), icon: History },
          { id: 'stock_balances_report', label: t('nav.stock_balances_report') || 'أرصدة المخزون خلال فترة', icon: BarChart3 },
          { id: 'general_stock_movements_report', label: t('nav.general_stock_movements_report') || 'حركة المخزن العامة لجميع الأصناف', icon: History },
          { id: 'div_inv', isDivider: true },
          { id: 'h_sales', label: language === 'ar' ? 'العملاء والمبيعات' : 'Customers & Sales', isHeader: true },
          { id: 'customer_statement', label: t('nav.customer_statement'), icon: FileText },
          { id: 'customer_balances', label: t('nav.customer_balances'), icon: BarChart3 },
          { id: 'sales_report', label: t('nav.sales_report'), icon: BarChart3 },
          { id: 'div_sales', isDivider: true },
          { id: 'h_purchases', label: language === 'ar' ? 'الموردين والمشتريات' : 'Suppliers & Purchases', isHeader: true },
          { id: 'supplier_statement', label: t('nav.supplier_statement'), icon: FileText },
          { id: 'supplier_balances', label: t('nav.supplier_balances'), icon: BarChart3 },
          { id: 'div_purchases', isDivider: true },
          { id: 'h_cash', label: language === 'ar' ? 'النقدية والمصروفات' : 'Cash & Expenses', isHeader: true },
          // { id: 'cash_report', label: t('nav.cash_report'), icon: BarChart3 },
          { id: 'cash_balances', label: t('nav.cash_balances'), icon: BarChart3 },
          { id: 'expenses_report', label: t('nav.expenses_report'), icon: BarChart3 },
          { id: 'div_cash', isDivider: true },
          { id: 'h_acct', label: language === 'ar' ? 'التقارير المالية والمحاسبية' : 'Financial Accounting', isHeader: true },
          { id: 'general_ledger_report', label: t('nav.general_ledger_report'), icon: BookOpen },
          { id: 'trial_balance', label: t('nav.trial_balance'), icon: BarChart3 },
          { id: 'income_statement', label: t('nav.income_statement'), icon: BarChart3 },
          { id: 'balance_sheet', label: t('nav.balance_sheet'), icon: Shield }
        ]
      },
      {
        id: 'admin',
        label: t('nav.admin'),
        icon: Settings,
        subItems: [
          { id: 'company_settings', label: t('nav.company_settings'), icon: Building2 },
          { id: 'users', label: t('nav.users'), icon: UsersIcon },
          { id: 'integrity_dashboard', label: t('nav.integrity_check') || 'Integrity Check', icon: ShieldCheck },
          { id: 'backup_restore', label: t('nav.backup_restore'), icon: Database },
          { id: 'activity_log', label: t('nav.activity_log'), icon: History },
          ...(company?.settings?.enable_multi_currency || (company?.settings as any)?.enable_multi_currency === 'true' || isSuperAdmin ? [{ id: 'currencies', label: t('nav.currencies'), icon: Coins }] : [])
        ]
      }
    ];

    const superAdminNavItems = [
      { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
      { id: 'companies', label: t('nav.companies'), icon: Building2 },
      { id: 'users', label: t('nav.users'), icon: UsersIcon },
      { id: 'system_check', label: 'System Integrity', icon: ShieldCheck },
      { id: 'activity_log', label: 'Audit Logs', icon: History },
    ];

    if (isSuperAdmin) {
      // For Super Admin, we merge both menus to give them full control
      const superAdminSpecificItems = superAdminNavItems.filter(s => !navItems.some(n => n.id === s.id));
      return [...superAdminSpecificItems, ...navItems];
    }
    if (isCompanyAdmin) return navItems;

    return navItems.map(item => {
      // Check if top-level item should be visible
      const canView = hasPermission(item.id, 'view') || item.id === 'currencies' || item.id === 'templates_menu';
      
      if (item.subItems) {
        const visibleSubItems = item.subItems.filter(sub => {
          if (sub.isDivider || sub.isHeader) return true;
          if (sub.id === 'currencies' || sub.id === 'templates' || sub.id === 'create_template') return true;
          return hasPermission(sub.id, 'view');
        });
        
        // Clean up empty headers and trailing dividers
        const cleanedSubItems = visibleSubItems.filter((sub, idx) => {
          if (sub.isHeader) {
            const slice = visibleSubItems.slice(idx + 1);
            const nextDividerIdx = slice.findIndex(s => s.isDivider);
            const sectionItems = nextDividerIdx === -1 ? slice : slice.slice(0, nextDividerIdx);
            return sectionItems.some(s => !s.isDivider && !s.isHeader);
          }
          if (sub.isDivider) {
            const slice = visibleSubItems.slice(idx + 1);
            return slice.some(s => !s.isDivider && !s.isHeader);
          }
          return true;
        });

        if (cleanedSubItems.length > 0) {
          return { ...item, subItems: cleanedSubItems };
        }
        return null;
      }
      
      return canView ? item : null;
    }).filter(Boolean) as typeof navItems;
  }, [user, isSuperAdmin, isCompanyAdmin, hasPermission, company, t, language]);


  // Update nav item click to use openTab
  const handleNavClick = (id: string, label: string, path?: string) => {
    if (path) {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    openTab(id, label);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  return (
    <div className={`min-h-screen bg-[#f8fafc] flex flex-col overflow-hidden font-sans selection:bg-brand-primary/20 ${language === 'en' ? 'font-sans' : ''}`} dir={dir}>
      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className={`p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <Lock size={24} />
              </div>
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <h3 className="text-xl font-bold text-slate-900">{t('common.change_password')}</h3>
                <p className="text-xs text-slate-500 font-medium">{t('common.must_change_password_hint')}</p>
              </div>
            </div>
            
            <form onSubmit={handleChangePassword} className="p-8 space-y-6">
              {passwordError && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 flex items-center gap-2">
                  <AlertCircle size={18} />
                  {passwordError}
                </div>
              )}

              <div className="space-y-4">
                <div className="relative">
                  <Lock className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-400`} size={20} />
                  <input
                    required
                    type={showNewPassword ? "text" : "password"}
                    placeholder={t('common.new_password')}
                    className={`w-full ${dir === 'rtl' ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-4 text-slate-400 hover:text-slate-600`}
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="relative">
                  <Lock className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-400`} size={20} />
                  <input
                    required
                    type={showNewPassword ? "text" : "password"}
                    placeholder={t('common.confirm_password')}
                    className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
              >
                {passwordLoading ? t('common.loading') : t('common.update_password_and_continue')}
              </button>
              
              <button
                type="button"
                onClick={logout}
                className="w-full py-3 text-slate-400 text-xs font-bold hover:text-red-500 transition-colors"
              >
                {t('common.logout_and_return_later')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Desktop Top Navigation */}
      <header className="hidden md:flex sticky top-0 z-[150] bg-white border-b border-slate-200 h-16 items-center px-4 xl:px-8 shadow-sm">
        <div className={`flex items-center gap-1.5 xl:gap-3 ${dir === 'rtl' ? 'ml-1.5 xl:ml-4' : 'mr-1.5 xl:mr-4'}`}>
          {company?.logo_url ? (
            <div className="flex items-center gap-2 xl:gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center">
                <img 
                  src={company.logo_url} 
                  alt={company.name} 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-black text-slate-900 tracking-tight text-sm xl:text-lg truncate max-w-[80px] xl:max-w-[200px]">{company.name}</span>
            </div>
          ) : (
            <Logo variant="full" className="h-8" />
          )}
        </div>

        <nav className="flex items-center gap-px xl:gap-0.5 flex-1">
          {filteredNavItems.map((item: any) => {
            const isActive = item.subItems 
              ? item.subItems.some((sub: any) => sub.id === currentPage)
              : currentPage === item.id;
            
            if (item.subItems) {
              return (
                <div key={item.id} className="relative group px-px">
                  <button
                    className={`
                      flex items-center gap-0.5 xl:gap-1 px-1 xl:px-1 py-1 rounded-lg transition-all font-semibold text-[11px] xl:text-xs
                      ${isActive ? 'bg-brand-primary/10 text-brand-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                    `}
                  >
                    <item.icon size={14} className="shrink-0" />
                    <span>{item.label}</span>
                    <ChevronDown size={12} className="opacity-50 group-hover:rotate-180 transition-transform shrink-0" />
                  </button>
                  
                  {/* Dropdown */}
                  <div className={`absolute top-full ${dir === 'rtl' ? 'right-0' : 'left-0'} pt-2 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-[160]`}>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[260px]">
                      {item.subItems.map((sub: any) => {
                        if (sub.isDivider) {
                           return (
                             <div key={sub.id} className="h-px bg-slate-100 my-1.5 mx-2" />
                           );
                        }
                        if (sub.isHeader) {
                          return (
                            <div key={sub.id} className={`px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {sub.label}
                            </div>
                          );
                        }
                        return (
                          <button
                            key={sub.id}
                            onClick={() => handleNavClick(sub.id, sub.label, sub.path)}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}
                              ${currentPage === sub.id 
                                ? 'bg-brand-primary text-white shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                            `}
                          >
                            <sub.icon size={16} />
                            <span className="text-sm font-semibold">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id, item.label, item.path)}
                className={`
                  flex items-center gap-0.5 xl:gap-1 px-1 xl:px-1 py-1 rounded-lg transition-all font-semibold text-[11px] xl:text-xs
                  ${currentPage === item.id ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                <item.icon size={14} className="shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={`flex items-center gap-0.5 xl:gap-1.5 ${dir === 'rtl' ? 'mr-auto' : 'ml-auto'}`}>
          <button 
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="p-1 text-slate-500 hover:bg-slate-100 rounded-lg transition-all group flex items-center gap-1"
            title={language === 'ar' ? 'English' : 'العربية'}
          >
            <Languages size={18} />
            <span className="text-xs font-bold">{language === 'ar' ? 'EN' : 'AR'}</span>
          </button>

          <button 
            onClick={() => setIsCenterOpen(true)}
            className="relative p-1 text-slate-500 hover:bg-slate-100 rounded-lg transition-all group"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className={`absolute top-1 ${dir === 'rtl' ? 'right-1' : 'left-1'} w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white`}>
                {unreadCount}
              </span>
            )}
          </button>

          <div className="h-8 w-px bg-white/10 mx-2" />

          {/* Company Switcher */}
          {!isSuperAdmin && userMemberships.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setIsCompanyMenuOpen(!isCompanyMenuOpen)}
                className="flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 shadow-sm"
              >
                <Building2 size={16} className="text-emerald-600" />
                <span className="text-xs font-bold text-slate-600 truncate max-w-[60px] xl:max-w-[120px]">
                  {user?.company_name || t('common.switch_company')}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isCompanyMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isCompanyMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[155]" 
                      onClick={() => setIsCompanyMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className={`absolute top-full ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-[160]`}
                    >
                      <p className="text-[10px] font-black text-slate-400 px-3 py-2 uppercase tracking-widest">{t('common.switch_company')}</p>
                      <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                        {userMemberships.map((membership) => (
                          <button
                            key={membership.company_id}
                            onClick={() => {
                              switchCompany(membership.company_id);
                              setIsCompanyMenuOpen(false);
                            }}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}
                              ${user?.company_id === membership.company_id 
                                ? 'bg-emerald-50 text-emerald-600' 
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                            `}
                          >
                            <Building2 size={16} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{membership.company_name}</p>
                              <p className="text-[10px] opacity-50">{membership.role === 'admin' ? t('common.role_admin') : t('common.role_user')}</p>
                            </div>
                            {user?.company_id === membership.company_id && (
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex items-center gap-1.5 xl:gap-2">
            <div className={`hidden xl:block ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
              <p className="font-bold text-xs text-slate-800 leading-none">{user?.username}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                {isSuperAdmin ? t('common.role_super_admin') : isCompanyAdmin ? t('common.role_company_admin') : t('common.role_user')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center font-bold text-brand-primary shadow-sm">
              {user?.username[0].toUpperCase()}
            </div>
          </div>

          <button 
            onClick={logout}
            className="p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all group"
            title={t('common.logout')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar for Open Tabs */}
        <aside 
          className={`
            hidden md:flex flex-col bg-white ${dir === 'rtl' ? 'border-l' : 'border-r'} border-slate-200 z-20 transition-all duration-300
            ${isSidebarCollapsed ? 'w-16' : 'w-64'}
          `}
        >
          <div className={`p-4 border-b border-slate-100 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isSidebarCollapsed && (
              <motion.h2 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-bold text-slate-900 text-sm flex items-center gap-2 whitespace-nowrap"
              >
                <div className="w-7 h-7 rounded bg-slate-50 flex items-center justify-center border border-slate-100">
                  <RotateCcw size={14} className="text-slate-400" />
                </div>
                <span>{t('common.open_screens')}</span>
              </motion.h2>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`
                p-2 rounded-xl transition-all duration-200 shadow-sm border border-slate-200/80
                ${isSidebarCollapsed 
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:scale-105 active:scale-95 shadow-emerald-500/5' 
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:scale-105 active:scale-95'}
              `}
              title={isSidebarCollapsed 
                ? (language === 'ar' ? 'توسيع القائمة' : 'Expand menu') 
                : (language === 'ar' ? 'طي القائمة' : 'Collapse menu')
              }
            >
              {isSidebarCollapsed ? <Menu size={18} /> : <X size={18} />}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar overflow-x-hidden bg-slate-50/30">
            {openTabs.map((tab) => {
              const displayLabel = t('nav.' + tab.id) !== 'nav.' + tab.id ? t('nav.' + tab.id) : tab.label;
              return (
                <div 
                  key={tab.id}
                  className={`
                    group relative flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all cursor-pointer border
                    ${activeTabId === tab.id 
                      ? 'bg-white text-emerald-600 shadow-sm border-emerald-100 ring-4 ring-emerald-500/5' 
                      : 'text-slate-500 hover:bg-white hover:text-slate-700 border-transparent hover:border-slate-100 hover:shadow-sm'}
                    ${isSidebarCollapsed ? 'justify-center mx-1' : 'mx-1'}
                  `}
                  onClick={() => setActiveTab(tab.id)}
                  title={isSidebarCollapsed ? displayLabel : ''}
                >
                  {!isSidebarCollapsed ? (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${activeTabId === tab.id ? 'text-emerald-700' : 'text-slate-600 group-hover:text-slate-900'}`}>{displayLabel}</p>
                      </div>
                      
                      {tab.id !== 'dashboard' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id);
                          }}
                          className={`
                            p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100
                            ${activeTabId === tab.id ? 'opacity-40 hover:opacity-100' : ''}
                          `}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className={`w-9 h-9 rounded-xl ${activeTabId === tab.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white border border-slate-200 text-slate-400 group-hover:border-slate-300'} flex items-center justify-center font-black text-xs transition-all`}>
                      {getTabIcon(tab.id)}
                    </div>
                  )}
                  
                  {activeTabId === tab.id && !isSidebarCollapsed && (
                    <div className={`absolute ${dir === 'rtl' ? '-right-1' : '-left-1'} top-3 bottom-3 w-1 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
                  )}
                </div>
              );
            })}
          </div>

          {!isSidebarCollapsed && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm text-center">
                <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
                  Obrain ERP • v2.0
                </span>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Mobile Header */}
          <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {company?.logo_url ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 p-1 flex items-center justify-center">
                    <img 
                      src={company.logo_url} 
                      alt={company.name} 
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="font-bold text-slate-900 truncate max-w-[120px]">{company.name}</span>
                </div>
              ) : (
                <Logo variant="full" className="h-8" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="p-2.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
              >
                <Languages size={20} />
              </button>
              <button 
                onClick={() => setIsCenterOpen(true)}
                className="relative p-2.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className={`absolute top-2 ${dir === 'rtl' ? 'right-2' : 'left-2'} w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white`}>
                    {unreadCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
              >
                <Menu size={24} />
              </button>
            </div>
          </header>

          {/* Mobile Tabs Bar */}
          <div className="md:hidden flex overflow-x-auto bg-white border-b border-slate-100 p-2 gap-2 custom-scrollbar">
            {openTabs.map((tab) => {
              const displayLabel = t('nav.' + tab.id) !== 'nav.' + tab.id ? t('nav.' + tab.id) : tab.label;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold transition-all
                    ${activeTabId === tab.id 
                      ? 'bg-brand-primary text-white shadow-sm' 
                      : 'bg-slate-50 text-slate-500'}
                  `}
                >
                  <span>{displayLabel}</span>
                  {tab.id !== 'dashboard' && (
                    <X 
                      size={10} 
                      className="opacity-60" 
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div 
            key={`${user?.id}-${user?.company_id}`}
            className="flex-1 overflow-y-auto p-4 md:p-6 pb-36 md:pb-10"
          >
            {children}
          </div>

          {/* Mobile Bottom Navigation - Floating Pill */}
          <div className="md:hidden fixed bottom-6 left-0 right-0 px-6 z-40">
            <nav className="bg-white border border-slate-200 px-6 py-3 flex items-center justify-between rounded-full shadow-xl">
              <button 
                onClick={() => handleNavClick('dashboard', t('nav.dashboard'))}
                className={`flex flex-col items-center gap-1 transition-all duration-300 ${currentPage === 'dashboard' ? 'text-brand-primary scale-105' : 'text-slate-400'}`}
              >
                <LayoutDashboard size={20} />
                <span className="text-[9px] font-bold uppercase">{t('common.home')}</span>
              </button>
              
              <button 
                onClick={() => handleNavClick('receipts', t('nav.receipts'))}
                className={`flex flex-col items-center gap-1 transition-all duration-300 ${currentPage === 'receipts' ? 'text-brand-primary scale-105' : 'text-slate-400'}`}
              >
                <Receipt size={20} />
                <span className="text-[9px] font-bold uppercase">{t('common.bonds')}</span>
              </button>
              
              <div className="relative -top-10">
                <div className="absolute inset-0 bg-brand-primary blur-2xl opacity-20 rounded-full scale-150 animate-pulse"></div>
                <div className="relative bg-brand-primary p-2.5 rounded-full shadow-lg shadow-brand-primary/30 ring-4 ring-white">
                  <AIAssistant onNavigate={onNavigate} isMobileFloating={true} />
                </div>
              </div>

              <button 
                onClick={() => handleNavClick('reports', t('nav.reports'))}
                className={`flex flex-col items-center gap-1 transition-all duration-300 ${currentPage === 'reports' ? 'text-brand-primary scale-105' : 'text-slate-400'}`}
              >
                <BarChart3 size={20} />
                <span className="text-[9px] font-bold uppercase">{t('nav.reports')}</span>
              </button>
              
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex flex-col items-center gap-1 text-slate-400 active:scale-105 transition-all duration-300"
              >
                <Menu size={20} />
                <span className="text-[9px] font-bold uppercase">{t('common.more')}</span>
              </button>
            </nav>
          </div>

          <div className="hidden md:block">
            <AIAssistant onNavigate={onNavigate} />
          </div>

          {/* Mobile Menu Drawer */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] md:hidden"
                />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  className="fixed inset-y-0 right-0 w-[85%] max-w-sm bg-white z-[210] md:hidden flex flex-col shadow-2xl"
                >
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-emerald-600/20">
                        {t('common.app_name')[0]}
                      </div>
                      <span className="font-bold text-xl text-slate-900">{t('common.app_name')}</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filteredNavItems.map((item: any) => (
                      <div key={item.id} className="space-y-1">
                        {item.subItems ? (
                          <>
                            <button
                              onClick={() => toggleMenu(item.id)}
                              className={`
                                w-full flex items-center justify-between p-4 rounded-2xl transition-all font-bold
                                ${item.subItems.some((s: any) => s.id === currentPage) ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'}
                              `}
                            >
                              <div className="flex items-center gap-3">
                                <item.icon size={20} />
                                <span>{item.label}</span>
                              </div>
                              {expandedMenus.includes(item.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            
                            <AnimatePresence>
                              {expandedMenus.includes(item.id) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden mr-4 border-r-2 border-slate-100 pr-4 space-y-1"
                                >
                                  {item.subItems.map((sub: any) => {
                                    if (sub.isDivider) {
                                      return (
                                        <div key={sub.id} className="h-px bg-slate-100 my-2 mx-4" />
                                      );
                                    }
                                    if (sub.isHeader) {
                                      return (
                                        <div key={sub.id} className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                                          {sub.label}
                                        </div>
                                      );
                                    }
                                    return (
                                      <button
                                        key={sub.id}
                                        onClick={() => handleNavClick(sub.id, sub.label, sub.path)}
                                        className={`
                                          w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right font-bold text-sm
                                          ${currentPage === sub.id ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'}
                                        `}
                                      >
                                        <sub.icon size={16} />
                                        <span>{sub.label}</span>
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        ) : (
                          <button
                            onClick={() => handleNavClick(item.id, item.label, item.path)}
                            className={`
                              w-full flex items-center gap-3 p-4 rounded-2xl transition-all font-bold
                              ${currentPage === item.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-600 hover:bg-slate-50'}
                            `}
                          >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50">
                    {/* Mobile Company Switcher */}
                    {!isSuperAdmin && userMemberships.length > 1 && (
                      <div className="mb-6 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-widest">{t('common.switch_company')}</p>
                        <div className="flex flex-col gap-2">
                          {userMemberships.map((membership) => (
                            <button
                              key={membership.company_id}
                              onClick={() => {
                                switchCompany(membership.company_id);
                                setIsMobileMenuOpen(false);
                              }}
                              className={`
                                w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-right border
                                ${user?.company_id === membership.company_id 
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}
                              `}
                            >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${user?.company_id === membership.company_id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                <Building2 size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold truncate">{membership.company_name}</p>
                                <p className={`text-[10px] font-bold ${user?.company_id === membership.company_id ? 'text-white/70' : 'text-slate-400'}`}>
                                  {membership.role === 'admin' ? t('common.role_admin') : t('common.role_user')}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="h-px bg-slate-200 my-4" />
                      </div>
                    )}

                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center font-black text-white shadow-lg shadow-emerald-600/20 text-xl font-mono">
                        {user?.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{user?.username}</p>
                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-tighter">
                          {isSuperAdmin ? t('common.role_super_admin') : isCompanyAdmin ? t('common.role_admin') : isManager ? t('common.manager') : t('common.role_user')}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={logout}
                      className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all border border-red-100"
                    >
                      <LogOut size={20} />
                      <span>{t('common.logout')}</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
