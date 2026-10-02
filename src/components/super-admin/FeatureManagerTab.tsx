import React, { useState, useEffect, useMemo } from 'react';
import { Company, User } from '../../types';
import { subscriptionApiService } from '../../services/SubscriptionApiService';
import { 
  Search, 
  Check, 
  Minus, 
  RefreshCw, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Mail, 
  LayoutDashboard, 
  Database, 
  Package, 
  ShoppingCart, 
  Truck, 
  Receipt, 
  Coins, 
  Landmark, 
  Layers, 
  BookOpen, 
  Briefcase, 
  LayoutTemplate, 
  BarChart3, 
  Radio, 
  Settings, 
  Sparkles,
  ChevronDown,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeatureManagerTabProps {
  companies: Company[];
  users?: User[];
}

interface FeatureItem {
  id: string;
  nameAr: string;
  nameEn: string;
  isReport?: boolean;
}

interface FeatureCategory {
  id: string;
  systemKey: string;
  nameAr: string;
  nameEn: string;
  icon: any;
  color: {
    bg: string;
    text: string;
    border: string;
    badge: string;
  };
  modules: FeatureItem[];
  reports?: FeatureItem[];
}

// All System Features arranged in sequential order from Dashboard to Admin with their dedicated reports
const SYSTEM_FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'dashboard',
    systemKey: 'dashboard',
    nameAr: 'لوحة التحكم',
    nameEn: 'Dashboard',
    icon: LayoutDashboard,
    color: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-500' },
    modules: [
      { id: 'dashboard', nameAr: 'لوحة التحكم والمؤشرات', nameEn: 'Main Dashboard' },
      { id: 'ai', nameAr: 'المساعد الذكي (AI)', nameEn: 'AI Assistant Engine' }
    ]
  },
  {
    id: 'master_data',
    systemKey: 'master_data',
    nameAr: 'البيانات الأساسية',
    nameEn: 'Master Data',
    icon: Database,
    color: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-500' },
    modules: [
      { id: 'master_data', nameAr: 'نظام البيانات الأساسية', nameEn: 'Core Master Data' },
      { id: 'customers', nameAr: 'العملاء', nameEn: 'Customers' },
      { id: 'suppliers', nameAr: 'الموردين', nameEn: 'Suppliers' },
      { id: 'employees', nameAr: 'الموظفين', nameEn: 'Employees' },
      { id: 'expenses', nameAr: 'المصروفات', nameEn: 'Expenses' },
      { id: 'crm', nameAr: 'إدارة علاقات العملاء (CRM)', nameEn: 'CRM' },
      { id: 'payment_methods', nameAr: 'طرق الدفع', nameEn: 'Payment Methods' },
      { id: 'discount_settings', nameAr: 'إعدادات الخصم', nameEn: 'Discount Settings' }
    ]
  },
  {
    id: 'inventory',
    systemKey: 'inventory',
    nameAr: 'المخازن والمستودعات',
    nameEn: 'Warehouses & Inventory',
    icon: Package,
    color: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', badge: 'bg-amber-500' },
    modules: [
      { id: 'inventory', nameAr: 'نظام المخازن الرئيسي', nameEn: 'Core Inventory' },
      { id: 'products', nameAr: 'دليل الأصناف والمنتجات', nameEn: 'Products' },
      { id: 'item_groups', nameAr: 'مجموعات الأصناف', nameEn: 'Item Groups' },
      { id: 'warehouses', nameAr: 'المستودعات', nameEn: 'Warehouses' },
      { id: 'goods_receipts', nameAr: 'أذون استلام المخزون', nameEn: 'Goods Receipts' },
      { id: 'warehouse_transfers', nameAr: 'التحويل بين المخازن', nameEn: 'Stock Transfers' },
      { id: 'opening_stock_balances', nameAr: 'أرصدة أول المدة', nameEn: 'Opening Balances' },
      { id: 'stock_adjustments', nameAr: 'تسوية وجرد الأصناف', nameEn: 'Stock Adjustments' },
      { id: 'manufacturing', nameAr: 'إدارة التصنيع والتشغيل', nameEn: 'Manufacturing' }
    ],
    reports: [
      { id: 'stock_card_report', nameAr: 'كارت حركة وتكلفة الصنف', nameEn: 'Stock Card Report', isReport: true },
      { id: 'stock_balances_report', nameAr: 'أرصدة المخزون خلال فترة', nameEn: 'Stock Balances Report', isReport: true },
      { id: 'general_stock_movements_report', nameAr: 'حركة المخزن العامة للأصناف', nameEn: 'General Stock Movements', isReport: true }
    ]
  },
  {
    id: 'sales',
    systemKey: 'sales',
    nameAr: 'المبيعات والعملاء',
    nameEn: 'Sales & Invoicing',
    icon: ShoppingCart,
    color: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', badge: 'bg-emerald-600' },
    modules: [
      { id: 'sales', nameAr: 'نظام المبيعات الرئيسي', nameEn: 'Core Sales' },
      { id: 'invoices', nameAr: 'فواتير المبيعات', nameEn: 'Sales Invoices' },
      { id: 'sales_orders', nameAr: 'أوامر البيع وعروض الأسعار', nameEn: 'Sales Orders' },
      { id: 'returns', nameAr: 'مرتجعات المبيعات', nameEn: 'Sales Returns' },
      { id: 'sales_import', nameAr: 'استيراد مستندات بيع', nameEn: 'Import Sales' },
      { id: 'customer_discounts', nameAr: 'خصومات العملاء', nameEn: 'Customer Discounts' },
      { id: 'customer_settlements', nameAr: 'تسويات العملاء', nameEn: 'Customer Settlements' }
    ],
    reports: [
      { id: 'customer_statement', nameAr: 'كشف حساب العميل', nameEn: 'Customer Statement', isReport: true },
      { id: 'customer_balances', nameAr: 'أرصدة العملاء', nameEn: 'Customer Balances', isReport: true },
      { id: 'customer_aging_report', nameAr: 'أعمار ديون العملاء', nameEn: 'Customer Aging Report', isReport: true },
      { id: 'sales_report', nameAr: 'تقرير المبيعات', nameEn: 'Sales Report', isReport: true }
    ]
  },
  {
    id: 'purchases',
    systemKey: 'purchases',
    nameAr: 'المشتريات والموردين',
    nameEn: 'Purchases & Procurement',
    icon: Truck,
    color: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', badge: 'bg-indigo-600' },
    modules: [
      { id: 'purchases', nameAr: 'نظام المشتريات الرئيسي', nameEn: 'Core Purchases' },
      { id: 'purchase_invoices', nameAr: 'فواتير المشتريات', nameEn: 'Purchase Invoices' },
      { id: 'purchase_orders', nameAr: 'أوامر الشراء', nameEn: 'Purchase Orders' },
      { id: 'purchase_returns', nameAr: 'مرتجعات المشتريات', nameEn: 'Purchase Returns' },
      { id: 'purchases_import', nameAr: 'استيراد مستندات شراء', nameEn: 'Import Purchases' },
      { id: 'supplier_discounts', nameAr: 'خصومات الموردين', nameEn: 'Supplier Discounts' },
      { id: 'supplier_settlements', nameAr: 'تسويات الموردين', nameEn: 'Supplier Settlements' }
    ],
    reports: [
      { id: 'supplier_statement', nameAr: 'كشف حساب المورد', nameEn: 'Supplier Statement', isReport: true },
      { id: 'supplier_balances', nameAr: 'أرصدة الموردين', nameEn: 'Supplier Balances', isReport: true },
      { id: 'supplier_aging_report', nameAr: 'أعمار ديون الموردين', nameEn: 'Supplier Aging Report', isReport: true }
    ]
  },
  {
    id: 'eta',
    systemKey: 'eta_integration',
    nameAr: 'الفاتورة والضرائب الإلكترونية (ETA)',
    nameEn: 'Egyptian Tax Authority (ETA)',
    icon: Receipt,
    color: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', badge: 'bg-rose-600' },
    modules: [
      { id: 'eta_integration', nameAr: 'الربط المباشر مع الضرائب', nameEn: 'Direct ETA Integration' },
      { id: 'eta_received_invoices', nameAr: 'الوثائق الإلكترونية المستلمة', nameEn: 'Received E-Docs' },
      { id: 'eta_detailed_invoices', nameAr: 'الوثائق الإلكترونية بالتفصيل', nameEn: 'Detailed E-Docs' },
      { id: 'eta_mapping', nameAr: 'ربط الموردين والأصناف (Mapping)', nameEn: 'ETA Mapping' },
      { id: 'eta_tax_types', nameAr: 'دليل أنواع الضرائب والرسوم', nameEn: 'Tax Types Guide' }
    ]
  },
  {
    id: 'cash',
    systemKey: 'cash',
    nameAr: 'النقدية والبنوك',
    nameEn: 'Cash & Banking',
    icon: Coins,
    color: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200', badge: 'bg-teal-600' },
    modules: [
      { id: 'cash', nameAr: 'حركات النقدية والخزائن', nameEn: 'Cash Management' },
      { id: 'receipts', nameAr: 'سندات القبض', nameEn: 'Receipt Vouchers' },
      { id: 'payment_vouchers', nameAr: 'سندات الصرف', nameEn: 'Payment Vouchers' },
      { id: 'cash_transfers', nameAr: 'التحويلات النقدية والبنكية', nameEn: 'Cash Transfers' },
      { id: 'egyptian_banks', nameAr: 'دليل البنوك المصرية', nameEn: 'Egyptian Banks' }
    ],
    reports: [
      { id: 'cash_balances', nameAr: 'تقرير النقدية والخزائن والبنوك', nameEn: 'Cash & Bank Balances', isReport: true },
      { id: 'expenses_report', nameAr: 'تقرير المصروفات', nameEn: 'Expenses Report', isReport: true }
    ]
  },
  {
    id: 'cheques',
    systemKey: 'cheques',
    nameAr: 'الشيكات المصرفية',
    nameEn: 'Bank Cheques',
    icon: Landmark,
    color: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200', badge: 'bg-cyan-600' },
    modules: [
      { id: 'cheques', nameAr: 'نظام إدارة الشيكات', nameEn: 'Cheques Module' },
      { id: 'issued_cheques', nameAr: 'إدارة الشيكات الصادرة', nameEn: 'Issued Cheques' },
      { id: 'received_cheques', nameAr: 'إدارة الشيكات الواردة', nameEn: 'Received Cheques' }
    ]
  },
  {
    id: 'operations',
    systemKey: 'flexible_operations',
    nameAr: 'العمليات المرنة',
    nameEn: 'Flexible Operations',
    icon: Layers,
    color: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', badge: 'bg-purple-600' },
    modules: [
      { id: 'flexible_operations', nameAr: 'نظام العمليات المرنة', nameEn: 'Operations Framework' },
      { id: 'departments', nameAr: 'الإدارات والهيكل التنظيمي', nameEn: 'Departments' },
      { id: 'cost_centers', nameAr: 'مراكز التكلفة', nameEn: 'Cost Centers' },
      { id: 'operation_categories', nameAr: 'تصنيفات وسجلات العمليات', nameEn: 'Categories & Fields' }
    ]
  },
  {
    id: 'accounting',
    systemKey: 'accounting',
    nameAr: 'الحسابات العامة والقيود',
    nameEn: 'General Ledger & Accounting',
    icon: BookOpen,
    color: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-300', badge: 'bg-blue-700' },
    modules: [
      { id: 'accounting', nameAr: 'النظام المحاسبي العام', nameEn: 'General Ledger' },
      { id: 'chart_of_accounts', nameAr: 'شجرة ودليل الحسابات', nameEn: 'Chart of Accounts' },
      { id: 'journal_entries', nameAr: 'قيود اليومية العامة', nameEn: 'Journal Entries' },
      { id: 'detailed_journal_entries', nameAr: 'القيود اليومية التفصيلية', nameEn: 'Detailed Entries' },
      { id: 'multi_currency', nameAr: 'العملات المتعددة وفروق الصرف', nameEn: 'Multi-Currency' },
      { id: 'ifrs_guide', nameAr: 'دليل معايير IFRS 2026', nameEn: 'IFRS Standards' }
    ],
    reports: [
      { id: 'general_ledger_report', nameAr: 'حساب الأستاذ العام', nameEn: 'General Ledger Report', isReport: true },
      { id: 'trial_balance', nameAr: 'ميزان المراجعة', nameEn: 'Trial Balance', isReport: true },
      { id: 'income_statement', nameAr: 'قائمة الدخل', nameEn: 'Income Statement', isReport: true },
      { id: 'balance_sheet', nameAr: 'الميزانية والمركز المالي', nameEn: 'Balance Sheet', isReport: true }
    ]
  },
  {
    id: 'fixed_assets',
    systemKey: 'fixed_assets',
    nameAr: 'الأصول الثابتة',
    nameEn: 'Fixed Assets',
    icon: Briefcase,
    color: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', badge: 'bg-orange-600' },
    modules: [
      { id: 'fixed_assets', nameAr: 'سجل الأصول الثابتة', nameEn: 'Fixed Assets Register' },
      { id: 'asset_categories', nameAr: 'تصنيفات الأصول', nameEn: 'Asset Categories' },
      { id: 'asset_depreciation', nameAr: 'تشغيل الإهلاك المحاسبي', nameEn: 'Depreciation Engine' }
    ],
    reports: [
      { id: 'fixed_assets_reports', nameAr: 'تقارير الأصول الثابتة', nameEn: 'Fixed Assets Reports', isReport: true }
    ]
  },
  {
    id: 'templates',
    systemKey: 'templates',
    nameAr: 'القوالب والتصميم',
    nameEn: 'Document Templates',
    icon: LayoutTemplate,
    color: { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200', badge: 'bg-slate-600' },
    modules: [
      { id: 'templates', nameAr: 'إدارة وتخصيص القوالب', nameEn: 'Templates Manager' },
      { id: 'create_template', nameAr: 'مصمم القوالب الجديد', nameEn: 'Template Designer' }
    ]
  },
  {
    id: 'reports',
    systemKey: 'reports',
    nameAr: 'قائمة التقارير العامة',
    nameEn: 'Reports Center',
    icon: BarChart3,
    color: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200', badge: 'bg-sky-600' },
    modules: [
      { id: 'reports', nameAr: 'قائمة التقارير الرئيسية', nameEn: 'Main Reports Menu' },
      { id: 'financial_reports', nameAr: 'حزمة التقارير المالية', nameEn: 'Financial Reports Suite' },
      { id: 'inventory_reports', nameAr: 'حزمة تقارير المخازن', nameEn: 'Inventory Reports Suite' },
      { id: 'partner_reports', nameAr: 'حزمة تقارير الحسابات', nameEn: 'Partner Reports Suite' }
    ]
  },
  {
    id: 'pos',
    systemKey: 'pos',
    nameAr: 'نقاط البيع (POS)',
    nameEn: 'Point of Sale',
    icon: Radio,
    color: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', badge: 'bg-emerald-700' },
    modules: [
      { id: 'pos', nameAr: 'نظام نقاط البيع والكاشير', nameEn: 'POS System' },
      { id: 'pos_branches', nameAr: 'الفروع المتصلة وربط الأجهزة', nameEn: 'Connected POS Branches' }
    ]
  },
  {
    id: 'admin',
    systemKey: 'admin',
    nameAr: 'الإدارة والأمان وإعدادات النظام',
    nameEn: 'Administration & System',
    icon: Settings,
    color: { bg: 'bg-stone-50', text: 'text-stone-800', border: 'border-stone-300', badge: 'bg-stone-700' },
    modules: [
      { id: 'admin', nameAr: 'لوحة إعدادات الشركة', nameEn: 'Company Settings' },
      { id: 'user_management', nameAr: 'إدارة المستخدمين والأدوار', nameEn: 'Users & Permissions' },
      { id: 'period_closing', nameAr: 'إغلاق الفترات والسنوات المالية', nameEn: 'Period Closing' },
      { id: 'data_integrity', nameAr: 'فحص وتدقيق سلامة البيانات', nameEn: 'Data Integrity Audit' },
      { id: 'backup_restore', nameAr: 'النسخ الاحتياطي واستعادة البيانات', nameEn: 'Backup & Restore' },
      { id: 'activity_logs', nameAr: 'سجلات الرقابة والنشاط', nameEn: 'Audit & Activity Logs' },
      { id: 'api', nameAr: 'الربط البرمجي الخارجي (API)', nameEn: 'API Integration' },
      { id: 'hr', nameAr: 'الموارد البشرية وشؤون الموظفين (HR)', nameEn: 'HR Management' }
    ]
  }
];

export const FeatureManagerTab: React.FC<FeatureManagerTabProps> = ({ companies, users = [] }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [featureMap, setFeatureMap] = useState<Record<string, boolean>>({});
  const [initialFeatureMap, setInitialFeatureMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Helper to find manager email for a company
  const getManagerEmail = (company: Company): string => {
    const adminUser = users.find(u => u.company_id === company.id && (u.role === 'admin' || (u.role as string) === 'company_admin' || u.role === 'manager'));
    if (adminUser?.email) return adminUser.email;
    return company.email || '';
  };

  // Filter companies by name, code, or manager email
  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return companies;
    return companies.filter(c => {
      const nameMatch = c.name?.toLowerCase().includes(query);
      const codeMatch = c.code?.toLowerCase().includes(query);
      const emailMatch = c.email?.toLowerCase().includes(query);
      const managerEmail = getManagerEmail(c).toLowerCase();
      const managerMatch = managerEmail.includes(query);
      return nameMatch || codeMatch || emailMatch || managerMatch;
    });
  }, [companies, searchQuery, users]);

  // Selected company object
  const selectedCompany = useMemo(() => {
    return companies.find(c => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  // Load features when selected company changes
  useEffect(() => {
    if (selectedCompanyId) {
      loadFeatures(selectedCompanyId);
    } else {
      setFeatureMap({});
      setInitialFeatureMap({});
    }
  }, [selectedCompanyId]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadFeatures = async (companyId: string) => {
    try {
      setLoading(true);
      const data = await subscriptionApiService.getFeatures(companyId);
      
      const map: Record<string, boolean> = {};
      // Populate defaults for all known categories (modules + reports)
      SYSTEM_FEATURE_CATEGORIES.forEach(cat => {
        cat.modules.forEach(f => {
          map[f.id] = true;
        });
        if (cat.reports) {
          cat.reports.forEach(f => {
            map[f.id] = true;
          });
        }
        if (cat.systemKey) {
          map[cat.systemKey] = true;
        }
      });

      // Override with DB data
      if (Array.isArray(data)) {
        data.forEach(item => {
          map[item.feature_name] = item.is_enabled;
        });
      }

      // Synchronize systemKey according to the rule:
      // "فى حالة تحديد اى شاشة او تقرير يعنى ذلك معنه تحديد النظام نفسة والعكس فى حالة عدم تحديد اى شىء فلا معنى من تحديد النظام"
      SYSTEM_FEATURE_CATEGORIES.forEach(cat => {
        const systemKey = cat.systemKey;
        if (!systemKey) return;
        const allItems = [...cat.modules, ...(cat.reports || [])];
        const childItems = allItems.filter(item => item.id !== systemKey);
        if (childItems.length > 0) {
          const anyChildActive = childItems.some(item => map[item.id] === true);
          map[systemKey] = anyChildActive;
        }
      });

      setFeatureMap(map);
      setInitialFeatureMap({ ...map });
    } catch (err: any) {
      console.error('Failed to load features:', err);
      showToast(err.message || 'فشل في تحميل ميزات الشركة، يرجى إعادة المحاولة.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle single feature with automatic systemKey synchronization:
  // "فى حالة تحديد اى شاشة او تقرير يعنى ذلك معنه تحديد النظام نفسة والعكس فى حالة عدم تحديد اى شىء فلا معنى من تحديد النظام"
  const toggleFeature = (category: FeatureCategory, featureId: string) => {
    setFeatureMap(prev => {
      const updated = { ...prev };
      const systemKey = category.systemKey;
      const allCategoryItems = [...category.modules, ...(category.reports || [])];

      // If user toggles the master system feature itself (e.g. inventory / sales / etc.)
      if (featureId === systemKey) {
        const nextSystemState = !prev[systemKey];
        updated[systemKey] = nextSystemState;
        // Cascade to all modules & reports in this category
        allCategoryItems.forEach(item => {
          updated[item.id] = nextSystemState;
        });
        return updated;
      }

      // User toggles an individual module screen or report
      const nextFeatureState = !prev[featureId];
      updated[featureId] = nextFeatureState;

      // Check if any child item (excluding systemKey) is now enabled
      const childItems = allCategoryItems.filter(item => item.id !== systemKey);
      const isAnyChildActive = childItems.some(item => updated[item.id] === true);

      // Rule: selecting any screen or report enables the system; if nothing is selected, the system is disabled
      updated[systemKey] = isAnyChildActive;

      return updated;
    });
  };

  // Toggle entire category (both modules & reports)
  const toggleCategory = (category: FeatureCategory) => {
    const allItems = [...category.modules, ...(category.reports || [])];
    const allEnabled = allItems.every(f => featureMap[f.id] === true);
    const targetState = !allEnabled;

    setFeatureMap(prev => {
      const updated = { ...prev };
      allItems.forEach(f => {
        updated[f.id] = targetState;
      });
      if (category.systemKey) {
        updated[category.systemKey] = targetState;
      }
      return updated;
    });
  };

  // Toggle only reports in a category
  const toggleCategoryReports = (category: FeatureCategory) => {
    if (!category.reports || category.reports.length === 0) return;
    const allReportsEnabled = category.reports.every(f => featureMap[f.id] === true);
    const targetState = !allReportsEnabled;

    setFeatureMap(prev => {
      const updated = { ...prev };
      category.reports!.forEach(f => {
        updated[f.id] = targetState;
      });
      // Check if any child item in category is now enabled
      const systemKey = category.systemKey;
      const allItems = [...category.modules, ...category.reports!];
      const childItems = allItems.filter(item => item.id !== systemKey);
      const isAnyChildActive = childItems.some(item => updated[item.id] === true);
      if (systemKey) {
        updated[systemKey] = isAnyChildActive;
      }
      return updated;
    });
  };

  // Select all features in the whole system
  const handleSelectAllSystemFeatures = () => {
    setFeatureMap(prev => {
      const updated = { ...prev };
      SYSTEM_FEATURE_CATEGORIES.forEach(cat => {
        cat.modules.forEach(f => {
          updated[f.id] = true;
        });
        if (cat.reports) {
          cat.reports.forEach(f => {
            updated[f.id] = true;
          });
        }
        if (cat.systemKey) {
          updated[cat.systemKey] = true;
        }
      });
      return updated;
    });
  };

  // Deselect all features in the whole system
  const handleDeselectAllSystemFeatures = () => {
    setFeatureMap(prev => {
      const updated = { ...prev };
      SYSTEM_FEATURE_CATEGORIES.forEach(cat => {
        cat.modules.forEach(f => {
          updated[f.id] = false;
        });
        if (cat.reports) {
          cat.reports.forEach(f => {
            updated[f.id] = false;
          });
        }
        if (cat.systemKey) {
          updated[cat.systemKey] = false;
        }
      });
      return updated;
    });
  };

  // Save all changes in batch
  const handleSaveChanges = async () => {
    if (!selectedCompanyId) return;
    try {
      setSaving(true);
      const featureList = Object.entries(featureMap).map(([featureName, isEnabled]) => ({
        featureName,
        isEnabled
      }));

      await subscriptionApiService.batchUpdateFeatures(selectedCompanyId, featureList);
      setInitialFeatureMap({ ...featureMap });
      showToast('تم حفظ وتحديث ميزات الشركة بنجاح!', 'success');
    } catch (err: any) {
      console.error('Failed to save features:', err);
      showToast(err.message || 'فشل حفظ التغييرات.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    for (const key of Object.keys(featureMap)) {
      if (featureMap[key] !== initialFeatureMap[key]) {
        return true;
      }
    }
    return false;
  }, [featureMap, initialFeatureMap]);

  // Total features stats
  const totalFeaturesCount = useMemo(() => {
    return SYSTEM_FEATURE_CATEGORIES.reduce((acc, cat) => acc + cat.modules.length + (cat.reports?.length || 0), 0);
  }, []);

  const enabledFeaturesCount = useMemo(() => {
    return Object.values(featureMap).filter(Boolean).length;
  }, [featureMap]);

  return (
    <div className="p-3 md:p-5 space-y-4 min-h-[85vh] flex flex-col font-sans text-slate-800" dir="rtl">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-xl border flex items-center gap-2.5 font-bold text-xs ${
              toastMessage.type === 'success' 
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' 
                : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
            }`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar: Company Selector & Compact Global Controls */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-3 md:p-4 transition-all space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Header Title */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight">إدارة ميزات النظام والتقارير (Feature Flags)</h2>
              <p className="text-[11px] text-slate-500 font-semibold">
                حدد الشركة للتحكم الكامل في ظهور الوحدات والتقارير من لوحة التحكم وحتى الإدارة
              </p>
            </div>
          </div>

          {/* Search & Company Select Dropdown */}
          <div className="relative flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="text" 
                placeholder="ابحث عن شركة (الاسم، الكود، أو إيميل المدير)..." 
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg pr-9 pl-8 py-1.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all text-xs font-bold text-slate-800 placeholder:text-slate-400"
              />
              <button 
                type="button" 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown Results */}
            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsDropdownOpen(false)} 
                />
                <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-30 max-h-64 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in-50 zoom-in-95 duration-100">
                  {filteredCompanies.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 font-bold">
                      لا توجد شركة مطابقة
                    </div>
                  ) : (
                    filteredCompanies.map(c => {
                      const isSelected = c.id === selectedCompanyId;
                      const managerEmail = getManagerEmail(c);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCompanyId(c.id);
                            setIsDropdownOpen(false);
                            setSearchQuery(c.name);
                          }}
                          className={`w-full text-right p-2 rounded-lg transition-all flex items-center justify-between mb-0.5 cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-50/80 border border-blue-200 text-blue-900 shadow-2xs' 
                              : 'hover:bg-slate-50 border border-transparent text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 font-bold text-[10px] ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              <Building2 size={12} />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>{c.name}</span>
                                <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-mono font-bold">
                                  {c.code}
                                </span>
                              </div>
                              {managerEmail && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                  <Mail size={10} />
                                  <span>{managerEmail}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-blue-600 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                              محددة
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Selected Company Banner & Action Bar */}
        {selectedCompany && (
          <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-900 px-2.5 py-1 rounded-lg border border-blue-200/80">
                <Building2 size={13} className="text-blue-600" />
                <span className="font-black text-xs">{selectedCompany.name}</span>
                <span className="bg-white px-1 py-0.2 rounded text-[10px] font-mono font-bold text-blue-700 shadow-2xs">
                  {selectedCompany.code}
                </span>
              </div>

              {getManagerEmail(selectedCompany) && (
                <div className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-mono font-bold">
                  <Mail size={11} className="text-slate-400" />
                  <span>{getManagerEmail(selectedCompany)}</span>
                </div>
              )}

              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded-lg border border-emerald-200 text-xs font-bold">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>المفعل:</span>
                <span className="font-black font-mono">{enabledFeaturesCount} / {totalFeaturesCount}</span>
              </div>

              {hasUnsavedChanges && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                  تعديلات غير محفوظة
                </span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAllSystemFeatures}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                تحديد الكل
              </button>
              <button
                type="button"
                onClick={handleDeselectAllSystemFeatures}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                إلغاء التحديد
              </button>
              <button
                type="button"
                onClick={() => loadFeatures(selectedCompany.id)}
                disabled={loading}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={saving || !hasUnsavedChanges}
                className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                  hasUnsavedChanges 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-95' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                <span>حفظ التغييرات</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Body: Ultra-compact, Sleek Features Grid */}
      {!selectedCompanyId ? (
        <div className="flex-1 bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-300">
            <Building2 size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-700 mb-1">يرجى اختيار شركة للبدء</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            اختر شركة من شريط البحث بالأعلى لعرض كافة الميزات والتقارير مرتبة ومصنفة من لوحة التحكم وحتى الإدارة.
          </p>
        </div>
      ) : loading ? (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center p-8">
          <RefreshCw size={24} className="animate-spin text-blue-600 mb-2" />
          <p className="text-xs font-bold text-slate-500">جاري تحميل ميزات وتقارير الشركة...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {SYSTEM_FEATURE_CATEGORIES.map((category, catIndex) => {
            const allItems = [...category.modules, ...(category.reports || [])];
            const enabledCount = allItems.filter(f => featureMap[f.id] === true).length;
            const totalCount = allItems.length;
            const isAllEnabled = enabledCount === totalCount;
            const isNoneEnabled = enabledCount === 0;
            const isPartial = !isAllEnabled && !isNoneEnabled;

            const hasReports = category.reports && category.reports.length > 0;
            const enabledReportsCount = hasReports ? category.reports!.filter(f => featureMap[f.id] === true).length : 0;
            const totalReportsCount = hasReports ? category.reports!.length : 0;

            return (
              <div 
                key={category.id} 
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
              >
                {/* Category Header - Compact */}
                <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-200/80 text-slate-700 text-[10px] font-black flex items-center justify-center font-mono">
                      {catIndex + 1}
                    </span>
                    <div className={`p-1.5 rounded-lg ${category.color.bg} ${category.color.text} border ${category.color.border}`}>
                      <category.icon size={14} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-black text-xs text-slate-900">{category.nameAr}</h3>
                        <span className="text-[9px] font-mono text-slate-400">{category.nameEn}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold mr-2 bg-white px-2 py-0.5 rounded border border-slate-200">
                      <span>المفعل: </span>
                      <span className="font-black font-mono text-slate-800">{enabledCount}</span>
                      <span> من </span>
                      <span className="font-black font-mono text-slate-800">{totalCount}</span>
                    </div>
                  </div>

                  {/* Group Master Checkbox & Fast Toggles */}
                  <div className="flex items-center gap-1.5">
                    {hasReports && (
                      <button
                        type="button"
                        onClick={() => toggleCategoryReports(category)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                          enabledReportsCount === totalReportsCount
                            ? 'bg-sky-50 text-sky-800 border-sky-300'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        title="تحديد أو إلغاء تحديد كافة تقارير هذا القسم"
                      >
                        📊 التقارير ({enabledReportsCount}/{totalReportsCount})
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-[11px] transition-all cursor-pointer shadow-2xs ${
                        isAllEnabled 
                          ? 'bg-emerald-600 text-white border-emerald-600' 
                          : isPartial 
                            ? 'bg-blue-50 text-blue-700 border-blue-300' 
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                        isAllEnabled 
                          ? 'bg-white text-emerald-700 border-white' 
                          : isPartial 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white border-slate-400'
                      }`}>
                        {isAllEnabled && <Check size={10} className="stroke-[3]" />}
                        {isPartial && <Minus size={10} className="stroke-[3]" />}
                      </div>
                      <span>
                        {isAllEnabled ? 'محددة بالكامل' : isPartial ? 'محددة جزئياً' : 'تحديد القائمة كاملة'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Modules & Reports Body - Ultra Compact Cells & Tight Gap */}
                <div className="p-2.5 space-y-2.5 bg-white">
                  
                  {/* Operational Modules Grid */}
                  <div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                      {category.modules.map(feature => {
                        const isEnabled = featureMap[feature.id] === true;
                        return (
                          <div
                            key={feature.id}
                            onClick={() => toggleFeature(category, feature.id)}
                            className={`px-2 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2 select-none min-h-[38px] ${
                              isEnabled 
                                ? 'bg-emerald-50/50 border-emerald-300/80 hover:border-emerald-400 shadow-2xs' 
                                : 'bg-slate-50/50 border-slate-200/80 hover:border-slate-300 opacity-60 hover:opacity-100'
                            }`}
                            title={feature.nameAr + ' (' + feature.id + ')'}
                          >
                            {/* Custom Square Checkbox */}
                            <div 
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all border ${
                                isEnabled 
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs' 
                                  : 'bg-white border-slate-300 hover:border-slate-400'
                              }`}
                            >
                              {isEnabled && <Check size={11} className="stroke-[3]" />}
                            </div>

                            {/* Feature Text */}
                            <div className="flex-1 min-w-0">
                              <div className={`text-[11px] font-bold truncate leading-tight ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                                {feature.nameAr}
                              </div>
                              <div className="text-[8.5px] font-mono text-slate-400 truncate leading-none mt-0.5">
                                {feature.id}
                              </div>
                            </div>

                            {/* Tiny status indicator */}
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reports Sub-section within Category */}
                  {hasReports && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-black text-sky-800 uppercase tracking-wider flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          <FileSpreadsheet size={11} className="text-sky-600" />
                          <span>تقارير {category.nameAr}</span>
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          (يمكن تحديد كل تقرير أو استبعاده من القائمة)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                        {category.reports!.map(report => {
                          const isEnabled = featureMap[report.id] === true;
                          return (
                            <div
                              key={report.id}
                              onClick={() => toggleFeature(category, report.id)}
                              className={`px-2 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2 select-none min-h-[38px] ${
                                isEnabled 
                                  ? 'bg-sky-50/60 border-sky-300 hover:border-sky-400 shadow-2xs' 
                                  : 'bg-slate-50/50 border-slate-200/80 hover:border-slate-300 opacity-60 hover:opacity-100'
                              }`}
                              title={'تقرير: ' + report.nameAr + ' (' + report.id + ')'}
                            >
                              {/* Custom Square Checkbox */}
                              <div 
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all border ${
                                  isEnabled 
                                    ? 'bg-sky-600 border-sky-600 text-white shadow-2xs' 
                                    : 'bg-white border-slate-300 hover:border-slate-400'
                                }`}
                              >
                                {isEnabled && <Check size={11} className="stroke-[3]" />}
                              </div>

                              {/* Report Text */}
                              <div className="flex-1 min-w-0">
                                <div className={`text-[11px] font-bold truncate leading-tight ${isEnabled ? 'text-sky-950' : 'text-slate-600'}`}>
                                  {report.nameAr}
                                </div>
                                <div className="text-[8.5px] font-mono text-slate-400 truncate leading-none mt-0.5">
                                  {report.id}
                                </div>
                              </div>

                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isEnabled ? 'bg-sky-500' : 'bg-slate-300'}`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Save Bar if Unsaved */}
      {selectedCompanyId && hasUnsavedChanges && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-3 z-40 bg-slate-900 text-white p-3 px-5 rounded-xl shadow-2xl flex items-center justify-between gap-3 border border-slate-800"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold">
              تعديلات غير محفوظة لميزات شركة ({selectedCompany?.name})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFeatureMap({ ...initialFeatureMap })}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              تراجع
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all shadow-md shadow-emerald-500/25 active:scale-95 cursor-pointer"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              <span>حفظ التغييرات الآن</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
