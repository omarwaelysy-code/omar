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
  Landmark,
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
  LayoutTemplate,
  Globe,
  Activity,
  Mail,
  Camera,
  Radio,
  Laptop
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
    case 'contact_messages': return <Mail {...iconProps} />;
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
    case 'pos_branch_linking': return <Radio {...iconProps} />;
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
    case 'receipts':
    case 'eta_received_invoices':
      return <Receipt {...iconProps} />;
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
    case 'period_closing': return <Lock {...iconProps} />;
    case 'templates':
    case 'create_template':
      return <LayoutTemplate {...iconProps} />;
    default: return <Folder {...iconProps} />;
  }
};

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentPage }) => {
  const { language, setLanguage, t, dir } = useLanguage();
  const { logout, user, userMemberships, switchCompany, isSuperAdmin, isSuperAdminAccount, isCompanyAdmin, isManager, isStandardUser, hasPermission, workspaceMode, setWorkspaceMode } = useAuth();
  const { unreadCount, setIsCenterOpen, addPersistentNotification, showNotification } = useNotification();
  const { openTabs, activeTabId, openTab, closeTab, setActiveTab } = useNavigation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = React.useState(false);
  const [expandedMenus, setExpandedMenus] = React.useState<string[]>(['sales']);
  const [activeDesktopMenu, setActiveDesktopMenu] = React.useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [activeFeatures, setActiveFeatures] = useState<string[]>([]);
  const [featuresLoaded, setFeaturesLoaded] = useState(false);
  const [unreadContactMessagesCount, setUnreadContactMessagesCount] = useState(0);

  const activeCompanyName = React.useMemo(() => {
    if (workspaceMode === 'super_admin' || isSuperAdmin) {
      return language === 'ar' ? 'لوحة تحكم المدير العام' : 'Super Admin Dashboard';
    }
    const matchedMem = userMemberships?.find(m => m.company_id === user?.company_id);
    if (matchedMem?.company_name) return matchedMem.company_name;
    if (user?.company_name) return user.company_name;
    if (company?.name) return company.name;
    return language === 'ar' ? 'شركة واعل' : 'Wael Company';
  }, [workspaceMode, isSuperAdmin, userMemberships, user?.company_id, user?.company_name, company?.name, language]);

  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(() => {
    if (!user?.id) return null;
    return localStorage.getItem(`user_avatar_${user.id}`);
  });

  React.useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`user_avatar_${user.id}`);
      if (saved) setAvatarUrl(saved);
    }
  }, [user?.id]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user?.id) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarUrl(result);
        localStorage.setItem(`user_avatar_${user.id}`, result);
      };
      reader.readAsDataURL(file);
    }
  };

  const profilePopoverRef = React.useRef<HTMLDivElement>(null);
  const desktopNavRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profilePopoverRef.current && !profilePopoverRef.current.contains(event.target as Node)) {
        setIsProfileModalOpen(false);
      }
    };
    if (isProfileModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileModalOpen]);

  React.useEffect(() => {
    const handleClickOutsideNav = (event: MouseEvent) => {
      if (desktopNavRef.current && !desktopNavRef.current.contains(event.target as Node)) {
        setActiveDesktopMenu(null);
        setExpandedMenus([]);
      }
    };
    if (activeDesktopMenu || expandedMenus.length > 0) {
      document.addEventListener('mousedown', handleClickOutsideNav);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideNav);
    };
  }, [activeDesktopMenu, expandedMenus]);



  useEffect(() => {
    if (!user || !isSuperAdmin) return;
    const fetchUnreadContactCount = async () => {
      try {
        const res = await dbService.getUnreadContactMessagesCount();
        setUnreadContactMessagesCount(res?.count || 0);
      } catch (e) {
        // quiet catch
      }
    };
    fetchUnreadContactCount();
    const interval = setInterval(fetchUnreadContactCount, 15000);
    return () => clearInterval(interval);
  }, [user, isSuperAdmin]);
  
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
    
    // Fetch active features
    const fetchFeatures = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const res = await fetch('/api/subscriptions/my-features', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const featuresData = await res.json();
          const active = featuresData.filter((f: any) => f.is_enabled).map((f: any) => f.feature_name);
          setActiveFeatures(active);
        }
      } catch (err) {
        console.error('Failed to fetch features', err);
      } finally {
        setFeaturesLoaded(true);
      }
    };
    
    fetchFeatures();
    
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
      prev.includes(id) ? prev.filter(m => m !== id) : [id]
    );
  };

  const filteredNavItems = React.useMemo(() => {
    if (!user) return [];

    const navItems = [
      ...(isSuperAdmin ? [{ id: 'super_admin_dashboard', label: t('nav.super_admin_dashboard'), icon: Shield, path: '/super-admin@m@r2020' }] : []),
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
        id: 'eta_menu',
        label: 'ETA',
        icon: Building2,
        subItems: [
          { 
            id: 'eta_received_invoices', 
            label: language === 'ar' ? 'الفواتير الإلكترونية المستلمة' : 'Received Electronic Invoices', 
            icon: ArrowDownToLine 
          }
        ]
      },
      {
        id: 'cash',
        label: t('nav.cash'),
        icon: Coins,
        subItems: [
          { id: 'receipts', label: t('nav.receipts'), icon: Receipt },
          { id: 'payment_vouchers', label: t('nav.payment_vouchers'), icon: CreditCard },
          { id: 'issued_cheques', label: language === 'ar' ? 'الشيكات الصادرة' : 'Issued Cheques', icon: Landmark },
          { id: 'cash_transfers', label: t('nav.cash_transfers'), icon: ArrowLeftRight }
        ]
      },
      {
        id: 'issued_cheques_menu',
        label: language === 'ar' ? 'الشيكات الصادرة' : 'Issued Cheques',
        icon: Landmark,
        subItems: [
          { id: 'issued_cheques', label: language === 'ar' ? 'إدارة الشيكات الصادرة' : 'Issued Cheques Management', icon: Landmark }
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
      ...(company?.pos_enabled === true || (company?.settings as any)?.pos_enabled === true ? [
        {
          id: 'pos_menu',
          label: language === 'ar' ? 'نقاط البيع' : 'Point of Sale (POS)',
          icon: Radio,
          subItems: [
            { 
              id: 'pos_connected_branches', 
              label: language === 'ar' ? 'الفروع المتصلة' : 'Connected Branches', 
              icon: Laptop 
            },
            { 
              id: 'pos_branch_linking', 
              label: language === 'ar' ? 'ربط الفرع' : 'Branch Linking', 
              icon: Radio 
            }
          ]
        }
      ] : []),
      {
        id: 'admin',
        label: t('nav.admin'),
        icon: Settings,
        subItems: [
          { id: 'company_settings', label: t('nav.company_settings'), icon: Building2 },
          { id: 'users', label: t('nav.users'), icon: UsersIcon },
          { id: 'period_closing', label: language === 'ar' ? 'إغلاق الفترات المحاسبية' : 'Period Closing', icon: Lock },
          { id: 'integrity_dashboard', label: t('nav.integrity_check') || 'Integrity Check', icon: ShieldCheck },
          { id: 'backup_restore', label: t('nav.backup_restore'), icon: Database },
          { id: 'activity_log', label: t('nav.activity_log'), icon: History },
          ...(company?.settings?.enable_multi_currency || (company?.settings as any)?.enable_multi_currency === 'true' || isSuperAdmin ? [{ id: 'currencies', label: t('nav.currencies'), icon: Coins }] : [])
        ]
      }
    ];

    const superAdminNavItems = [
      { id: 'contact_messages', label: t('nav.contact_messages') || 'رسائل التواصل', icon: Mail, badge: unreadContactMessagesCount },
      { id: 'companies', label: t('nav.companies'), icon: Building2 },
      { id: 'users', label: t('nav.users'), icon: UsersIcon },
      { id: 'subscriptions', label: t('nav.subscriptions') || 'Subscriptions', icon: CreditCard },
      { id: 'system_settings', label: t('nav.system_settings') || 'System Settings', icon: Settings },
      { id: 'activity_log', label: t('nav.audit_logs') || 'Audit Logs', icon: History },
      { id: 'system_check', label: t('nav.system_check') || 'System Integrity', icon: ShieldCheck },
      { id: 'monitoring', label: t('nav.monitoring') || 'Monitoring', icon: Activity },
      { id: 'backup_restore', label: t('nav.backup_restore') || 'Backups', icon: Database },
      { id: 'global_reports', label: t('nav.global_reports') || 'Global Reports', icon: Globe },
    ];

    if (isSuperAdmin) {
      // For Super Admin, we DO NOT merge company menus. Super Admins should be completely isolated from company modules.
      return superAdminNavItems;
    }

    let filteredByFeatures = navItems;
    if (featuresLoaded && activeFeatures.length > 0) {
      const featureMap: Record<string, string> = {
        'sales': 'sales',
        'purchases': 'purchases',
        'warehouses_menu': 'inventory',
        'general_ledger': 'accounting',
        'cash': 'accounting',
        'flexible_operations': 'flexible_operations'
      };
      
      filteredByFeatures = navItems.filter(item => {
        const requiredFeature = featureMap[item.id];
        if (requiredFeature) {
           return activeFeatures.includes(requiredFeature);
        }
        return true;
      });
    }

    if (isCompanyAdmin) return filteredByFeatures;

    return filteredByFeatures.map(item => {
      // Check if top-level item should be visible
      const canView = hasPermission(item.id, 'view') || item.id === 'currencies' || item.id === 'templates_menu' || item.id === 'pos_menu';
      
      if (item.subItems) {
        const visibleSubItems = (item.subItems as any[]).filter((sub: any) => {
          if (sub.isDivider || sub.isHeader) return true;
          if (sub.id === 'currencies' || sub.id === 'templates' || sub.id === 'create_template' || sub.id === 'contact_messages' || sub.id === 'pos_branch_linking' || sub.id === 'pos_connected_branches') return true;
          return hasPermission(sub.id, 'view');
        });
        
        // Clean up empty headers and trailing dividers
        const cleanedSubItems = visibleSubItems.filter((sub: any, idx: number) => {
          if (sub.isHeader) {
            const slice = visibleSubItems.slice(idx + 1);
            const nextDividerIdx = slice.findIndex((s: any) => s.isDivider);
            const sectionItems = nextDividerIdx === -1 ? slice : slice.slice(0, nextDividerIdx);
            return sectionItems.some((s: any) => !s.isDivider && !s.isHeader);
          }
          if (sub.isDivider) {
            const slice = visibleSubItems.slice(idx + 1);
            return slice.some((s: any) => !s.isDivider && !s.isHeader);
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
  }, [user, isSuperAdmin, isCompanyAdmin, hasPermission, company, t, language, featuresLoaded, activeFeatures]);


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
      <header className="hidden md:flex sticky top-0 z-[200] bg-white border-b border-slate-200 h-16 items-center px-1.5 2xl:px-4 shadow-sm">
        <div className={`flex items-center gap-1 ${dir === 'rtl' ? 'ml-1 2xl:ml-2' : 'mr-1 2xl:mr-2'} shrink-0`}>
          {company?.logo_url ? (
            <div className="flex items-center gap-1 2xl:gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 p-0.5 flex items-center justify-center">
                <img 
                  src={company.logo_url} 
                  alt={company.name} 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-black text-slate-900 tracking-tight text-xs 2xl:text-sm truncate max-w-[70px] 2xl:max-w-[140px]">{company.name}</span>
            </div>
          ) : (
            <Logo variant="full" size="md" />
          )}
        </div>

        <nav 
          ref={desktopNavRef} 
          onMouseLeave={() => setActiveDesktopMenu(null)}
          className="flex items-center gap-0 xl:gap-[1px] 2xl:gap-0.5 flex-1 min-w-0 py-0.5"
        >
          {/* Company Switcher (Only rendered if user has multiple companies or is super_admin) */}
          {(isSuperAdminAccount || (userMemberships && userMemberships.length > 1)) && (
            <div className="relative shrink-0 mr-0.5 ml-0.5">
              <button
                type="button"
                onClick={() => setIsCompanyMenuOpen(!isCompanyMenuOpen)}
                className="flex items-center gap-0.5 px-1 py-0.5 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-900 rounded-md transition-all border border-emerald-200/80 shadow-2xs cursor-pointer text-[9.5px] xl:text-[10.5px] 2xl:text-[11.5px] font-extrabold tracking-tighter"
                title={language === 'ar' ? 'تبديل الشركة' : 'Switch Company'}
              >
                <Building2 size={11} className="text-emerald-600 shrink-0" />
                <span className="truncate max-w-[65px] xl:max-w-[100px] 2xl:max-w-[140px]">
                  {activeCompanyName}
                </span>
                <ChevronDown size={8} className={`text-emerald-600/70 transition-transform shrink-0 ${isCompanyMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isCompanyMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[180]" 
                      onClick={() => setIsCompanyMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className={`absolute top-full ${dir === 'rtl' ? 'right-0' : 'left-0'} mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-[220]`}
                    >
                      <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common.switch_company')}</p>
                        <p className="text-xs font-bold text-emerald-700 truncate mt-0.5">{activeCompanyName}</p>
                      </div>
                      <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                        {isSuperAdminAccount && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (setWorkspaceMode) setWorkspaceMode('super_admin');
                                setIsCompanyMenuOpen(false);
                              }}
                              className={`
                                w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'} text-xs font-bold
                                ${workspaceMode === 'super_admin'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'text-indigo-600 hover:bg-indigo-50/50'}
                              `}
                            >
                              <ShieldCheck size={15} className="shrink-0" />
                              <span className="truncate flex-1">
                                {language === 'ar' ? 'لوحة تحكم المدير العام' : 'Super Admin Dashboard'}
                              </span>
                            </button>
                            <div className="h-px bg-slate-100 my-1" />
                          </>
                        )}
                        {userMemberships && userMemberships.length > 0 ? (
                          userMemberships.map((membership) => {
                            const isSelected = user?.company_id === membership.company_id && workspaceMode !== 'super_admin';
                            return (
                              <button
                                key={membership.company_id}
                                type="button"
                                onClick={() => {
                                  switchCompany(membership.company_id);
                                  setIsCompanyMenuOpen(false);
                                }}
                                className={`
                                  w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'} text-xs
                                  ${isSelected 
                                    ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/60' 
                                    : 'text-slate-700 hover:bg-slate-50'}
                                `}
                              >
                                <Building2 size={15} className={isSelected ? 'text-emerald-600 shrink-0' : 'text-slate-400 shrink-0'} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold truncate">{membership.company_name || activeCompanyName}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    {membership.role === 'admin' || user?.role === 'super_admin' || isCompanyAdmin
                                      ? (language === 'ar' ? 'مدير شركة' : 'Company Admin') 
                                      : (language === 'ar' ? 'مستخدم' : 'User')}
                                  </p>
                                </div>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl flex items-center gap-2">
                            <Building2 size={15} className="text-emerald-600 shrink-0" />
                            <span className="truncate">{activeCompanyName}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {filteredNavItems.map((item: any) => {
            const isActive = item.subItems 
              ? item.subItems.some((sub: any) => sub.id === currentPage)
              : currentPage === item.id;
            const isOpen = activeDesktopMenu === item.id;
            
            if (item.subItems) {
              return (
                <div 
                  key={item.id} 
                  className="relative shrink-0"
                  onMouseEnter={() => setActiveDesktopMenu(item.id)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDesktopMenu(prev => prev === item.id ? null : item.id);
                    }}
                    className={`
                      flex items-center gap-[2px] xl:gap-0.5 px-1 xl:px-1.5 py-0.5 rounded-md transition-all font-bold text-[9.5px] xl:text-[10.5px] 2xl:text-[11.5px] whitespace-nowrap cursor-pointer tracking-tighter
                      ${isActive || isOpen ? 'bg-brand-primary/10 text-brand-primary' : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'}
                    `}
                  >
                    <item.icon size={11} className="shrink-0 opacity-80" />
                    <span>{item.label}</span>
                    <ChevronDown size={8} className={`opacity-50 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Dropdown Menu */}
                  <div className={`absolute top-full ${dir === 'rtl' ? 'right-0' : 'left-0'} pt-2 transition-all duration-150 z-[220] ${
                    isOpen 
                      ? 'opacity-100 translate-y-0 pointer-events-auto' 
                      : 'opacity-0 translate-y-1 pointer-events-none'
                  }`}>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 min-w-[240px]">
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
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavClick(sub.id, sub.label, sub.path);
                              setActiveDesktopMenu(null);
                            }}
                            className={`
                              w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all cursor-pointer ${dir === 'rtl' ? 'text-right' : 'text-left'}
                              ${currentPage === sub.id 
                                ? 'bg-brand-primary text-white shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                            `}
                          >
                            <sub.icon size={14} />
                            <span className="text-xs font-semibold">{sub.label}</span>
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
                type="button"
                onMouseEnter={() => setActiveDesktopMenu(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavClick(item.id, item.label, item.path);
                  setActiveDesktopMenu(null);
                }}
                className={`
                  flex items-center gap-[2px] xl:gap-0.5 px-1 xl:px-1.5 py-0.5 rounded-md transition-all font-bold text-[9.5px] xl:text-[10.5px] 2xl:text-[11.5px] whitespace-nowrap shrink-0 cursor-pointer tracking-tighter
                  ${currentPage === item.id ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'}
                `}
              >
                <item.icon size={11} className="shrink-0 opacity-80" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={`flex items-center gap-0.5 xl:gap-1.5 ${dir === 'rtl' ? 'mr-auto' : 'ml-auto'} shrink-0`}>
          <button 
            type="button"
            onClick={() => setIsCenterOpen(true)}
            className="relative p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-all group cursor-pointer"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className={`absolute top-1 ${dir === 'rtl' ? 'right-1' : 'left-1'} w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white`}>
                {unreadCount}
              </span>
            )}
          </button>

          <div 
            onClick={() => setIsProfileModalOpen(!isProfileModalOpen)}
            className="flex items-center cursor-pointer group p-1 rounded-full hover:bg-slate-100 transition-all select-none"
            title={language === 'ar' ? 'الملف الشخصي' : 'Profile'}
          >
            <div className="w-8 h-8 rounded-full bg-[#c8d6c5] border border-[#a8b8a5] text-[#2d3a2a] flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.username?.[0]?.toUpperCase() || 'W'
              )}
            </div>
          </div>




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
                <Logo variant="full" size="md" />
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
                                          w-full flex items-center justify-between p-3 rounded-xl transition-all text-right font-bold text-sm
                                          ${currentPage === sub.id ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'}
                                        `}
                                      >
                                        <div className="flex items-center gap-3">
                                          <sub.icon size={16} />
                                          <span>{sub.label}</span>
                                        </div>
                                        {sub.badge && sub.badge > 0 ? (
                                          <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-600 text-white rounded-full shadow-xs">
                                            {sub.badge}
                                          </span>
                                        ) : null}
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
                              w-full flex items-center justify-between p-4 rounded-2xl transition-all font-bold
                              ${currentPage === item.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-600 hover:bg-slate-50'}
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon size={20} />
                              <span>{item.label}</span>
                            </div>
                            {item.badge && item.badge > 0 ? (
                              <span className="px-2.5 py-0.5 text-xs font-extrabold bg-emerald-500 text-white rounded-full shadow-xs">
                                {item.badge}
                              </span>
                            ) : null}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50">
                    {/* Mobile Company Switcher */}
                    {(isSuperAdminAccount || userMemberships.length > 1) && (
                      <div className="mb-6 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 px-1 uppercase tracking-widest">{t('common.switch_company')}</p>
                        <div className="flex flex-col gap-2">
                          {isSuperAdminAccount && (
                            <button
                              onClick={() => {
                                if (setWorkspaceMode) setWorkspaceMode('super_admin');
                                setIsMobileMenuOpen(false);
                              }}
                              className={`
                                w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-right border
                                ${workspaceMode === 'super_admin'
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-bold'
                                  : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50'}
                              `}
                            >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${workspaceMode === 'super_admin' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                <ShieldCheck size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">
                                  {language === 'ar' ? 'لوحة تحكم المدير العام' : 'Super Admin Dashboard'}
                                </p>
                              </div>
                            </button>
                          )}
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
                                  {user?.role === 'super_admin' 
                                    ? t('common.role_super_admin') 
                                    : (membership.role === 'admin' ? t('common.role_admin') : t('common.role_user'))}
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
                          {user?.role === 'super_admin' ? t('common.role_super_admin') : isCompanyAdmin ? t('common.role_admin') : isManager ? t('common.manager') : t('common.role_user')}
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

      {/* User Profile Popup Modal matching Google Chrome Profile style */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-start justify-end p-4 md:p-6 pt-16 pointer-events-none">
            {/* Google Profile Popup Box */}
            <motion.div
              ref={profilePopoverRef}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="relative bg-[#e9eee4] text-slate-800 rounded-[32px] p-6 shadow-2xl border border-[#d2dcd0] max-w-sm w-full font-sans pointer-events-auto"
              dir={dir}
            >
              {/* Top Header Actions (Camera Upload + Close Button) */}
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="profile-avatar-upload-input"
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-full transition-all cursor-pointer"
                  title={language === 'ar' ? 'تعديل الصورة الشخصية' : 'Change profile picture'}
                >
                  <Camera size={18} />
                </label>
                <input
                  id="profile-avatar-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-full transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Avatar Circle & User Header */}
              <div className="flex flex-col items-center text-center space-y-2 mb-5">
                <div className="w-20 h-20 rounded-full bg-[#007a87] text-white flex items-center justify-center font-bold text-3xl shadow-md overflow-hidden select-none border-2 border-white/80">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.username?.[0]?.toUpperCase() || 'W'
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
                  {(user as any)?.display_name || (user?.username ? (user.username[0].toUpperCase() + user.username.slice(1)) : 'Wael')}
                </h3>

                <p className="text-xs font-semibold text-slate-700 dir-ltr font-mono">
                  {user?.email || user?.username || ''}
                </p>

                <div className="mt-1 px-3 py-1 bg-[#233527]/10 text-[#233527] border border-[#233527]/20 font-bold text-[11px] rounded-full">
                  {isSuperAdminAccount
                    ? (language === 'ar' ? 'المشرف العام' : 'Super Admin')
                    : isCompanyAdmin
                    ? (language === 'ar' ? 'مدير الشركة' : 'Company Admin')
                    : (language === 'ar' ? 'مستخدم' : 'User')}
                </div>
              </div>

              {/* Menu Options Box (100% Working Real Actions) */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 border border-[#d8e2d4] space-y-0.5 text-xs font-semibold text-slate-700">
                {/* 1. Change Photo */}
                <label
                  htmlFor="profile-avatar-upload-input"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100/80 transition-all text-right cursor-pointer"
                >
                  <span className="text-base">📷</span>
                  <span>{language === 'ar' ? 'تغيير صورة الملف الشخصي' : 'Change profile photo'}</span>
                </label>

                {/* 2. Company Settings */}
                {(isCompanyAdmin || isSuperAdminAccount) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      onNavigate('company_settings');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100/80 transition-all text-right cursor-pointer"
                  >
                    <span className="text-base">🏢</span>
                    <span>{language === 'ar' ? 'إعدادات الشركة والحساب' : 'Company & Account Settings'}</span>
                  </button>
                )}

                {/* Language Switcher */}
                <button
                  type="button"
                  onClick={() => {
                    setLanguage(language === 'ar' ? 'en' : 'ar');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100/80 transition-all text-right cursor-pointer text-slate-700 font-semibold"
                >
                  <div className="flex items-center gap-3">
                    <Globe size={16} className="text-emerald-600 shrink-0" />
                    <span>{language === 'ar' ? 'تغيير اللغة' : 'Change Language'}</span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                    {language === 'ar' ? 'English (EN)' : 'العربية (AR)'}
                  </span>
                </button>

                <div className="h-px bg-slate-200/80 my-1" />

                {/* 3. Close Popup */}
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100/80 transition-all text-right cursor-pointer text-slate-600"
                >
                  <span className="text-base">❌</span>
                  <span>{language === 'ar' ? 'إغلاق النافذة' : 'Close popup'}</span>
                </button>

                {/* 4. Sign Out */}
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 transition-all text-right cursor-pointer font-bold"
                >
                  <LogOut size={16} />
                  <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
                </button>
              </div>

              {/* Other Profiles / Company Switcher Section */}
              {userMemberships && userMemberships.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#d8e2d4]">
                  <p className="text-[11px] font-bold text-slate-600 mb-2 px-1">
                    {language === 'ar' ? 'حسابات وشركات أخرى' : 'Other profiles'}
                  </p>

                  <div className="space-y-1">
                    {userMemberships.map((membership) => (
                      <button
                        key={membership.company_id}
                        type="button"
                        onClick={() => {
                          switchCompany(membership.company_id);
                          setIsProfileModalOpen(false);
                        }}
                        className={`
                          w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer
                          ${user?.company_id === membership.company_id
                            ? 'bg-[#233527] text-white'
                            : 'bg-white/60 hover:bg-white text-slate-700 border border-[#d8e2d4]'}
                        `}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${user?.company_id === membership.company_id ? 'bg-white/20 text-white' : 'bg-teal-600 text-white'}`}>
                          {membership.company_name?.[0]?.toUpperCase() || 'O'}
                        </div>
                        <span className="truncate flex-1 text-right">{membership.company_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
