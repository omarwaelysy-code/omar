import React, { useState, useEffect } from 'react';
import { AIAssistant } from './AIAssistant';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users as UsersIcon, 
  Package, 
  FileText, 
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
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  PieChart,
  Shield,
  Building2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Bell,
  Languages
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { notificationService } from '../services/notificationService';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate: (page: string) => void;
  currentPage: string;
}

import { useNavigation } from '../contexts/NavigationContext';

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentPage }) => {
  const { language, setLanguage, t, dir } = useLanguage();
  const { logout, user, userMemberships, switchCompany, isSuperAdmin, isCompanyAdmin, isManager, isStandardUser, hasPermission } = useAuth();
  const { unreadCount, setIsCenterOpen, addPersistentNotification, showNotification } = useNotification();
  const { openTabs, activeTabId, openTab, closeTab, setActiveTab } = useNavigation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = React.useState(false);
  const [expandedMenus, setExpandedMenus] = React.useState<string[]>(['transactions']);
  
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
  }, [user]);

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

  const navItems = [
    ...(isSuperAdmin ? [{ id: 'super_admin_dashboard', label: t('nav.super_admin_dashboard'), icon: Shield, path: '/super-admin@m@r2020' }] : []),
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { 
      id: 'master_data', 
      label: t('nav.master_data'), 
      icon: Database,
      subItems: [
        { id: 'customers', label: t('nav.customers'), icon: UsersIcon },
        { id: 'suppliers', label: t('nav.suppliers'), icon: Truck },
        { id: 'products', label: t('nav.products'), icon: Package },
        { id: 'expenses', label: t('nav.expenses'), icon: Wallet },
        { id: 'payment_methods', label: t('nav.payment_methods'), icon: CreditCard },
        { id: 'discount_settings', label: t('nav.discount_settings'), icon: Settings },
      ]
    },
    { 
      id: 'transactions', 
      label: t('nav.transactions'), 
      icon: ArrowLeftRight,
      subItems: [
        { id: 'invoices', label: t('nav.invoices'), icon: ArrowUpFromLine },
        { id: 'returns', label: t('nav.returns'), icon: RotateCcw },
        { id: 'purchase_invoices', label: t('nav.purchase_invoices'), icon: ArrowDownToLine },
        { id: 'purchase_returns', label: t('nav.purchase_returns'), icon: RotateCcw },
        { id: 'customer_discounts', label: t('nav.customer_discounts'), icon: Tags },
        { id: 'supplier_discounts', label: t('nav.supplier_discounts'), icon: Tags },
        { id: 'receipts', label: t('nav.receipts'), icon: Receipt },
        { id: 'payment_vouchers', label: t('nav.payment_vouchers'), icon: CreditCard },
        { id: 'cash_transfers', label: t('nav.cash_transfers'), icon: ArrowLeftRight },
      ]
    },
    { 
      id: 'general_ledger', 
      label: t('nav.general_ledger'), 
      icon: BookOpen,
      subItems: [
        { id: 'account_types', label: t('nav.account_types'), icon: PieChart },
        { id: 'accounts', label: t('nav.accounts'), icon: BookOpen },
        { id: 'chart_of_accounts', label: t('nav.chart_of_accounts'), icon: PieChart },
        { id: 'create_journal_entry', label: t('nav.create_journal_entry'), icon: Plus },
        { id: 'journal_entries', label: t('nav.journal_entries'), icon: FileText },
        { id: 'general_ledger_report', label: t('nav.general_ledger_report'), icon: BookOpen },
        { id: 'trial_balance', label: t('nav.trial_balance'), icon: BarChart3 },
        { id: 'income_statement', label: t('nav.income_statement'), icon: BarChart3 },
        { id: 'balance_sheet', label: t('nav.balance_sheet'), icon: Shield },
      ]
    },
    {
      id: 'reports',
      label: t('nav.reports'),
      icon: BarChart3,
      subItems: [
        { id: 'customer_statement', label: t('nav.customer_statement'), icon: FileText },
        { id: 'supplier_statement', label: t('nav.supplier_statement'), icon: FileText },
        { id: 'customer_balances', label: t('nav.customer_balances'), icon: BarChart3 },
        { id: 'supplier_balances', label: t('nav.supplier_balances'), icon: BarChart3 },
        { id: 'sales_report', label: t('nav.sales_report'), icon: BarChart3 },
        { id: 'expenses_report', label: t('nav.expenses_report'), icon: BarChart3 },
        { id: 'cash_report', label: t('nav.cash_report'), icon: BarChart3 },
        { id: 'cash_balances', label: t('nav.cash_balances'), icon: BarChart3 },
      ]
    },
    {
      id: 'admin',
      label: t('nav.admin'),
      icon: Settings,
      subItems: [
        { id: 'users', label: t('nav.users'), icon: UsersIcon },
        { id: 'integrity_dashboard', label: t('nav.integrity_check') || 'Integrity Check', icon: ShieldCheck },
        { id: 'backup_restore', label: t('nav.backup_restore'), icon: Database },
        { id: 'activity_log', label: t('nav.activity_log'), icon: History },
      ]
    }
  ];

  const superAdminNavItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'companies', label: t('nav.companies'), icon: Building2 },
    { id: 'users', label: t('nav.users'), icon: UsersIcon },
    { id: 'system_check', label: 'System Integrity Check', icon: ShieldCheck },
  ];
  
  const filteredNavItems = React.useMemo(() => {
    if (!user) return [];
    if (isSuperAdmin) return superAdminNavItems;
    if (isCompanyAdmin) return navItems;

    return navItems.map(item => {
      // Check if top-level item should be visible
      const canView = hasPermission(item.id, 'view');
      
      if (item.subItems) {
        const visibleSubItems = item.subItems.filter(sub => hasPermission(sub.id, 'view'));
        if (visibleSubItems.length > 0) {
          return { ...item, subItems: visibleSubItems };
        }
        return null;
      }
      
      return canView ? item : null;
    }).filter(Boolean) as typeof navItems;
  }, [user, isSuperAdmin, isCompanyAdmin, hasPermission]);

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
    <div className={`min-h-screen bg-stone-100 flex flex-col overflow-hidden font-sans selection:bg-emerald-500/30 ${language === 'en' ? 'font-sans' : ''}`} dir={dir}>
      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`p-8 border-b border-zinc-100 bg-stone-50 flex items-center gap-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <Lock size={24} />
              </div>
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <h3 className="text-xl font-black text-zinc-900">{t('common.change_password')}</h3>
                <p className="text-xs text-zinc-500 font-bold">{t('common.must_change_password_hint')}</p>
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
                  <Lock className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
                  <input
                    required
                    type={showNewPassword ? "text" : "password"}
                    placeholder={t('common.new_password')}
                    className={`w-full ${dir === 'rtl' ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-4 text-zinc-400 hover:text-zinc-600`}
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="relative">
                  <Lock className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400`} size={20} />
                  <input
                    required
                    type={showNewPassword ? "text" : "password"}
                    placeholder={t('common.confirm_password')}
                    className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl disabled:opacity-50"
              >
                {passwordLoading ? t('common.loading') : t('common.update_password_and_continue')}
              </button>
              
              <button
                type="button"
                onClick={logout}
                className="w-full py-3 text-zinc-400 text-xs font-bold hover:text-red-500 transition-colors"
              >
                {t('common.logout_and_return_later')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Desktop Top Navigation */}
      <header className="hidden md:flex sticky top-0 z-30 bg-zinc-900 text-white h-20 items-center px-8 shadow-2xl border-b border-white/5">
        <div className={`flex items-center gap-4 ${dir === 'rtl' ? 'ml-12' : 'mr-12'}`}>
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-emerald-500/20">
            {t('common.app_name')[0]}
          </div>
          <h1 className="text-xl font-black tracking-tight whitespace-nowrap">{t('common.app_name')}</h1>
        </div>

        <nav className="flex items-center gap-1 flex-1">
          {filteredNavItems.map((item: any) => {
            const isActive = item.subItems 
              ? item.subItems.some((sub: any) => sub.id === currentPage)
              : currentPage === item.id;
            
            if (item.subItems) {
              return (
                <div key={item.id} className="relative group px-1">
                  <button
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm
                      ${isActive ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                    `}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                    <ChevronDown size={14} className="opacity-50 group-hover:rotate-180 transition-transform" />
                  </button>
                  
                  {/* Dropdown */}
                  <div className={`absolute top-full ${dir === 'rtl' ? 'right-0' : 'left-0'} pt-2 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-[70]`}>
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 min-w-[220px]">
                      {item.subItems.map((sub: any) => (
                        <button
                          key={sub.id}
                          onClick={() => handleNavClick(sub.id, sub.label, sub.path)}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}
                            ${currentPage === sub.id 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                          `}
                        >
                          <sub.icon size={16} />
                          <span className="text-sm font-bold">{sub.label}</span>
                        </button>
                      ))}
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
                  flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm
                  ${currentPage === item.id ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                `}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={`flex items-center gap-4 ${dir === 'rtl' ? 'mr-auto' : 'ml-auto'}`}>
          <button 
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all group flex items-center gap-2"
            title={language === 'ar' ? 'English' : 'العربية'}
          >
            <Languages size={20} />
            <span className="text-xs font-bold">{language === 'ar' ? 'EN' : 'AR'}</span>
          </button>

          <button 
            onClick={() => setIsCenterOpen(true)}
            className="relative p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all group"
          >
            <Bell size={20} className="group-hover:rotate-12 transition-transform" />
            {unreadCount > 0 && (
              <span className={`absolute -top-1 ${dir === 'rtl' ? '-right-1' : '-left-1'} w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-zinc-900`}>
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
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"
              >
                <Building2 size={16} className="text-emerald-500" />
                <span className="text-xs font-bold text-zinc-300 truncate max-w-[120px]">
                  {user?.company_name || t('common.switch_company')}
                </span>
                <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isCompanyMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isCompanyMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[65]" 
                      onClick={() => setIsCompanyMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className={`absolute top-full ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-[70]`}
                    >
                      <p className="text-[10px] font-black text-zinc-500 px-3 py-2 uppercase tracking-widest">{t('common.switch_company')}</p>
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
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
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

          <div className="flex items-center gap-3">
            <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
              <p className="font-black text-sm text-white leading-none">{user?.username}</p>
              <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-1">
                {isSuperAdmin ? t('common.role_super_admin') : isCompanyAdmin ? t('common.role_company_admin') : t('common.role_user')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-white shadow-lg shadow-emerald-500/20">
              {user?.username[0].toUpperCase()}
            </div>
          </div>

          <button 
            onClick={logout}
            className="p-2.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all group border border-white/5"
            title={t('common.logout')}
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar for Open Tabs */}
        <aside 
          className={`
            hidden md:flex flex-col bg-white ${dir === 'rtl' ? 'border-l' : 'border-r'} border-zinc-200 shadow-sm z-20 transition-all duration-300
            ${isSidebarCollapsed ? 'w-16' : 'w-64'}
          `}
        >
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-stone-50/50 overflow-hidden">
            {!isSidebarCollapsed && (
              <motion.h2 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-black text-zinc-900 flex items-center gap-2 whitespace-nowrap"
              >
                <RotateCcw size={18} className="text-emerald-500" />
                <span>{t('common.open_screens')}</span>
              </motion.h2>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1 hover:bg-zinc-100 rounded-md text-zinc-400 transition-colors"
            >
              {isSidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar overflow-x-hidden">
            {openTabs.map((tab) => (
              <div 
                key={tab.id}
                className={`
                  group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer
                  ${activeTabId === tab.id 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                    : 'text-zinc-500 hover:bg-stone-100'}
                  ${isSidebarCollapsed ? 'justify-center px-0' : ''}
                `}
                onClick={() => setActiveTab(tab.id)}
                title={isSidebarCollapsed ? tab.label : ''}
              >
                {!isSidebarCollapsed ? (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{tab.label}</p>
                    </div>
                    
                    {tab.id !== 'dashboard' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                        className={`
                          p-1 rounded-md transition-all
                          ${activeTabId === tab.id 
                            ? 'hover:bg-white/20 text-white/70 hover:text-white' 
                            : 'hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600'}
                        `}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-current opacity-10 flex items-center justify-center font-black text-[10px]">
                    {tab.label[0]}
                  </div>
                )}
                
                {activeTabId === tab.id && !isSidebarCollapsed && (
                  <motion.div 
                    layoutId="active-tab-indicator"
                    className="absolute right-0 top-1/4 bottom-1/4 w-1 bg-white rounded-l-full"
                  />
                )}
              </div>
            ))}
          </div>

          {!isSidebarCollapsed && (
            <div className="p-4 border-t border-zinc-100 bg-stone-50/50 space-y-1">
              <p className="text-[10px] text-zinc-400 font-bold text-center">
                {t('common.switch_screens_hint')}
              </p>
              <p className="text-[9px] text-zinc-300 font-black text-center uppercase tracking-widest">
                ERP V2 Baseline • v2.0.0
              </p>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Mobile Header */}
          <header className="md:hidden sticky top-0 z-30 bg-white/70 backdrop-blur-2xl border-b border-zinc-200/50 p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-emerald-500/20">
                {t('common.app_name')[0]}
              </div>
              <h1 className="text-xl font-black text-zinc-900 tracking-tight">{t('common.app_name')}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="p-3 text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-2xl transition-all active:scale-90"
              >
                <Languages size={24} />
              </button>
              <button 
                onClick={() => setIsCenterOpen(true)}
                className="relative p-3 text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-2xl transition-all active:scale-90"
              >
                <Bell size={24} />
                {unreadCount > 0 && (
                  <span className={`absolute top-2 ${dir === 'rtl' ? 'right-2' : 'left-2'} w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white`}>
                    {unreadCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-3 text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-2xl transition-all active:scale-90"
              >
                <Menu size={28} />
              </button>
            </div>
          </header>

          {/* Mobile Tabs Bar */}
          <div className="md:hidden flex overflow-x-auto bg-white border-b border-zinc-100 p-2 gap-2 custom-scrollbar">
            {openTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold transition-all
                  ${activeTabId === tab.id 
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                    : 'bg-stone-100 text-zinc-500'}
                `}
              >
                <span>{tab.label}</span>
                {tab.id !== 'dashboard' && (
                  <X 
                    size={12} 
                    className="opacity-50 hover:opacity-100" 
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-36 md:pb-10">
            {children}
          </div>

          {/* Mobile Bottom Navigation - Floating Pill */}
          <div className="md:hidden fixed bottom-8 left-0 right-0 px-8 z-40">
            <nav className="bg-zinc-950/90 backdrop-blur-3xl border border-white/10 px-6 py-4 flex items-center justify-between rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
              <button 
                onClick={() => handleNavClick('dashboard', t('nav.dashboard'))}
                className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${currentPage === 'dashboard' ? 'text-emerald-400 scale-110' : 'text-zinc-500'}`}
              >
                <LayoutDashboard size={24} />
                <span className="text-[10px] font-black tracking-tighter">{t('common.home')}</span>
              </button>
              
              <button 
                onClick={() => handleNavClick('receipts', t('nav.receipts'))}
                className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${currentPage === 'receipts' ? 'text-emerald-400 scale-110' : 'text-zinc-500'}`}
              >
                <Receipt size={24} />
                <span className="text-[10px] font-black tracking-tighter">{t('common.bonds')}</span>
              </button>
              
              <div className="relative -top-12">
                <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-40 rounded-full scale-150 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-emerald-400 to-emerald-600 p-2 rounded-full shadow-[0_0_40px_rgba(16,185,129,0.5)] ring-[8px] ring-zinc-950/50">
                  <AIAssistant onNavigate={onNavigate} isMobileFloating={true} />
                </div>
              </div>

              <button 
                onClick={() => handleNavClick('reports', t('nav.reports'))}
                className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${currentPage === 'reports' ? 'text-emerald-400 scale-110' : 'text-zinc-500'}`}
              >
                <BarChart3 size={24} />
                <span className="text-[10px] font-black tracking-tighter">{t('nav.reports')}</span>
              </button>
              
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex flex-col items-center gap-1.5 text-zinc-500 active:scale-110 transition-all duration-300"
              >
                <Menu size={24} />
                <span className="text-[10px] font-black tracking-tighter">{t('common.more')}</span>
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
                  className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-[60] md:hidden"
                />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  className="fixed inset-y-0 right-0 w-[85%] max-w-sm bg-white z-[70] md:hidden flex flex-col shadow-2xl"
                >
                  <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-stone-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-emerald-500/20">
                        {t('common.app_name')[0]}
                      </div>
                      <span className="font-black text-xl text-zinc-900">{t('common.app_name')}</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
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
                                ${item.subItems.some((s: any) => s.id === currentPage) ? 'bg-emerald-500/10 text-emerald-600' : 'text-zinc-600 hover:bg-stone-100'}
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
                                  className="overflow-hidden mr-4 border-r-2 border-zinc-100 pr-4 space-y-1"
                                >
                                  {item.subItems.map((sub: any) => (
                                    <button
                                      key={sub.id}
                                      onClick={() => handleNavClick(sub.id, sub.label, sub.path)}
                                      className={`
                                        w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right font-bold text-sm
                                        ${currentPage === sub.id ? 'text-emerald-600 bg-emerald-50' : 'text-zinc-500 hover:bg-stone-50'}
                                      `}
                                    >
                                      <sub.icon size={16} />
                                      <span>{sub.label}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        ) : (
                          <button
                            onClick={() => handleNavClick(item.id, item.label, item.path)}
                            className={`
                              w-full flex items-center gap-3 p-4 rounded-2xl transition-all font-bold
                              ${currentPage === item.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-600 hover:bg-stone-100'}
                            `}
                          >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-6 border-t border-zinc-100 bg-stone-50">
                    {/* Mobile Company Switcher */}
                    {!isSuperAdmin && userMemberships.length > 1 && (
                      <div className="mb-6 space-y-2">
                        <p className="text-[10px] font-black text-zinc-400 px-1 uppercase tracking-widest">{t('common.switch_company')}</p>
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
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                  : 'bg-white border-zinc-100 text-zinc-600 hover:bg-stone-50'}
                              `}
                            >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${user?.company_id === membership.company_id ? 'bg-white/20 text-white' : 'bg-stone-100 text-zinc-400'}`}>
                                <Building2 size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black truncate">{membership.company_name}</p>
                                <p className={`text-[10px] font-bold ${user?.company_id === membership.company_id ? 'text-white/70' : 'text-zinc-400'}`}>
                                  {membership.role === 'admin' ? t('common.role_admin') : t('common.role_user')}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="h-px bg-zinc-100 my-4" />
                      </div>
                    )}

                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center font-black text-white shadow-lg shadow-emerald-500/20 text-xl">
                        {user?.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-zinc-900">{user?.username}</p>
                        <p className="text-xs text-emerald-600 font-bold">
                          {isSuperAdmin ? t('common.role_super_admin') : isCompanyAdmin ? t('common.role_admin') : isManager ? 'مشرف' : t('common.role_user')}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={logout}
                      className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all"
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
