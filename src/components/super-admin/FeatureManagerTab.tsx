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
  ChevronDown
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
  description?: string;
}

interface FeatureCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: any;
  color: {
    bg: string;
    text: string;
    border: string;
    badge: string;
  };
  features: FeatureItem[];
}

// All System Features arranged in sequential order from Dashboard to Admin
const SYSTEM_FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'dashboard',
    nameAr: 'لوحة التحكم',
    nameEn: 'Dashboard',
    icon: LayoutDashboard,
    color: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-500' },
    features: [
      { id: 'dashboard', nameAr: 'لوحة التحكم والمؤشرات العامة', nameEn: 'Main Dashboard & KPIs', description: 'عرض البطاقات والرسوم البيانية وملخص الحركات' },
      { id: 'ai', nameAr: 'المساعد الذكي (AI Assistant)', nameEn: 'AI Intelligence Engine', description: 'المحادثة الذكية وتحليل البيانات والتقارير' }
    ]
  },
  {
    id: 'master_data',
    nameAr: 'البيانات الأساسية',
    nameEn: 'Master Data',
    icon: Database,
    color: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-500' },
    features: [
      { id: 'customers', nameAr: 'إدارة العملاء', nameEn: 'Customers Directory', description: 'سجل العملاء، الأرصدة الافتتاحية، وحدود الائتمان' },
      { id: 'suppliers', nameAr: 'إدارة الموردين', nameEn: 'Suppliers Directory', description: 'سجل الموردين وبيانات الاتصال والتعاملات' },
      { id: 'employees', nameAr: 'إدارة الموظفين', nameEn: 'Employees Register', description: 'بيانات الموظفين والمسؤولين' },
      { id: 'expenses', nameAr: 'تصنيفات المصروفات', nameEn: 'Expense Categories', description: 'دليل بنود وتصنيفات المصروفات التشغيلية' },
      { id: 'crm', nameAr: 'إدارة علاقات العملاء (CRM)', nameEn: 'Customer Relationship Mgmt', description: 'سجل التواصل والفرص والمهام' },
      { id: 'payment_methods', nameAr: 'طرق ووسائل الدفع', nameEn: 'Payment Methods', description: 'تحديد قنوات وطرق السداد المعتمدة' }
    ]
  },
  {
    id: 'inventory',
    nameAr: 'المخازن والمستودعات',
    nameEn: 'Warehouses & Inventory',
    icon: Package,
    color: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', badge: 'bg-amber-500' },
    features: [
      { id: 'inventory', nameAr: 'نظام إدارة المخازن الرئيسي', nameEn: 'Core Inventory System', description: 'تفعيل كامل لمنظومة المخزون وحساب التكلفة' },
      { id: 'products', nameAr: 'دليل الأصناف والمنتجات', nameEn: 'Product Catalog', description: 'تسجيل المنتجات، الأسعار، الوحدات، والباركود' },
      { id: 'item_groups', nameAr: 'مجموعات وتصنيفات الأصناف', nameEn: 'Item Categories & Groups', description: 'الهيكل الشجري لتصنيف الأصناف' },
      { id: 'warehouses', nameAr: 'المستودعات والمخازن', nameEn: 'Warehouses Setup', description: 'إنشاء المستودعات وربطها بالفروع' },
      { id: 'goods_receipts', nameAr: 'أذون استلام المخزون', nameEn: 'Goods Receipts', description: 'استلام وفحص بضائع الموردين' },
      { id: 'warehouse_transfers', nameAr: 'التحويل بين المخازن', nameEn: 'Inter-warehouse Transfers', description: 'نقل الأصناف بين الفروع والمستودعات' },
      { id: 'opening_stock_balances', nameAr: 'أرصدة أول المدة للمخزون', nameEn: 'Opening Stock Balances', description: 'إدخال جرد البداية وكمياته' },
      { id: 'stock_adjustments', nameAr: 'تسوية وجرد الأصناف', nameEn: 'Stock Adjustments & Counts', description: 'تسوية الفروقات الجردية والعجز والزيادة' },
      { id: 'manufacturing', nameAr: 'إدارة التصنيع والتشغيل', nameEn: 'Manufacturing & Assembly', description: 'أوامر الإنتاج ومعادلات التصنيع' }
    ]
  },
  {
    id: 'sales',
    nameAr: 'المبيعات والعملاء',
    nameEn: 'Sales & Invoicing',
    icon: ShoppingCart,
    color: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', badge: 'bg-emerald-600' },
    features: [
      { id: 'sales', nameAr: 'نظام المبيعات الرئيسي', nameEn: 'Core Sales Module', description: 'تفعيل مسار عمليات المبيعات بالكامل' },
      { id: 'invoices', nameAr: 'فواتير المبيعات', nameEn: 'Sales Invoices', description: 'إصدار وطباعة وترحيل فواتير البيع' },
      { id: 'sales_orders', nameAr: 'أوامر البيع وعروض الأسعار', nameEn: 'Sales Orders & Quotes', description: 'إدارة طلبيات البيع قبل إصدار الفواتير' },
      { id: 'returns', nameAr: 'مرتجعات المبيعات', nameEn: 'Sales Returns', description: 'إرجاع البضائع ورد قيمتها وحساباتها' },
      { id: 'sales_import', nameAr: 'استيراد مستندات بيع إلكترونياً', nameEn: 'Import Sales Documents', description: 'استيراد الفواتير من ملفات خارجية وExcel' },
      { id: 'customer_discounts', nameAr: 'خصومات وتسويات العملاء', nameEn: 'Customer Discounts & Adjustments', description: 'إشعارات الخصم والتسويات الائتمانية' }
    ]
  },
  {
    id: 'purchases',
    nameAr: 'المشتريات والموردين',
    nameEn: 'Purchases & Procurement',
    icon: Truck,
    color: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', badge: 'bg-indigo-600' },
    features: [
      { id: 'purchases', nameAr: 'نظام المشتريات الرئيسي', nameEn: 'Core Purchases Module', description: 'تفعيل دورة الشراء وإدارة التوريدات' },
      { id: 'purchase_invoices', nameAr: 'فواتير المشتريات', nameEn: 'Purchase Invoices', description: 'تسجيل فواتير المشتريات وحساب الضرائب' },
      { id: 'purchase_orders', nameAr: 'أوامر الشراء', nameEn: 'Purchase Orders', description: 'طلبات التوريد والمتابعة مع الموردين' },
      { id: 'purchase_returns', nameAr: 'مرتجعات المشتريات', nameEn: 'Purchase Returns', description: 'رد البضائع المشتراة وتسوية حساب المورد' },
      { id: 'purchases_import', nameAr: 'استيراد مستندات شراء', nameEn: 'Import Purchase Documents', description: 'استيراد الفواتير من ملفات خارجية' },
      { id: 'supplier_discounts', nameAr: 'خصومات وتسويات الموردين', nameEn: 'Supplier Discounts & Adjustments', description: 'إشعارات الخصم المكتسب والتسويات' }
    ]
  },
  {
    id: 'eta',
    nameAr: 'الفاتورة والضرائب الإلكترونية (ETA)',
    nameEn: 'Egyptian Tax Authority (ETA)',
    icon: Receipt,
    color: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', badge: 'bg-rose-600' },
    features: [
      { id: 'eta_integration', nameAr: 'الربط المباشر مع الضرائب المصرية', nameEn: 'Direct ETA Integration', description: 'إرسال واستلام الوثائق المعتمدة إلكترونياً' },
      { id: 'eta_received_invoices', nameAr: 'الوثائق الإلكترونية المستلمة', nameEn: 'ETA Received Documents', description: 'استعراض فواتير المشتريات المستلمة من المنظومة' },
      { id: 'eta_detailed_invoices', nameAr: 'الوثائق الإلكترونية بالتفصيل', nameEn: 'ETA Detailed Invoices', description: 'تفاصيل البنود والضرائب والفروقات' },
      { id: 'eta_mapping', nameAr: 'ربط الموردين والأصناف (ETA Mapping)', nameEn: 'ETA Item & Partner Mapping', description: 'مطابقة الأكواد وضبط الضرائب والرسوم' }
    ]
  },
  {
    id: 'cash',
    nameAr: 'النقدية والبنوك',
    nameEn: 'Cash & Banking',
    icon: Coins,
    color: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200', badge: 'bg-teal-600' },
    features: [
      { id: 'cash', nameAr: 'حركات النقدية والخزائن', nameEn: 'Cash Register Management', description: 'إدارة الخزائن النقدية وحسابات الصندوق' },
      { id: 'receipts', nameAr: 'سندات القبض', nameEn: 'Receipt Vouchers', description: 'تحصيل النقدية من العملاء وجهات أخرى' },
      { id: 'payment_vouchers', nameAr: 'سندات الصرف', nameEn: 'Payment Vouchers', description: 'صرف النقدية للموردين والمصروفات' },
      { id: 'cash_transfers', nameAr: 'التحويلات النقدية والبنكية', nameEn: 'Cash Transfers', description: 'تحويل الأموال بين الخزائن والحسابات' },
      { id: 'egyptian_banks', nameAr: 'دليل البنوك المصرية', nameEn: 'Egyptian Banks Directory', description: 'قائمة البنوك وأكواد الفروع' }
    ]
  },
  {
    id: 'cheques',
    nameAr: 'الشيكات المصرفية',
    nameEn: 'Bank Cheques',
    icon: Landmark,
    color: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200', badge: 'bg-cyan-600' },
    features: [
      { id: 'cheques', nameAr: 'نظام إدارة الشيكات', nameEn: 'Core Cheques Module', description: 'تتبع حركة ومحافظ الشيكات بالكامل' },
      { id: 'issued_cheques', nameAr: 'إدارة الشيكات الصادرة', nameEn: 'Issued Cheques', description: 'شيكات الموردين والتحرير والمقاصة' },
      { id: 'received_cheques', nameAr: 'إدارة الشيكات الواردة', nameEn: 'Received Cheques', description: 'استلام شيكات العملاء، التحصيل، والارتداد' }
    ]
  },
  {
    id: 'operations',
    nameAr: 'العمليات المرنة',
    nameEn: 'Flexible Operations',
    icon: Layers,
    color: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', badge: 'bg-purple-600' },
    features: [
      { id: 'flexible_operations', nameAr: 'نظام العمليات المرنة', nameEn: 'Operations Framework', description: 'سجلات العمليات والحركات الديناميكية' },
      { id: 'departments', nameAr: 'الإدارات والهيكل التنظيمي', nameEn: 'Departments & Hierarchy', description: 'هيكل الإدارات والوحدات الإدارية' },
      { id: 'cost_centers', nameAr: 'مراكز التكلفة', nameEn: 'Cost Centers', description: 'تحليل المصروفات والإيرادات حسب المراكز' },
      { id: 'operation_categories', nameAr: 'تصنيفات وحقول العمليات', nameEn: 'Custom Fields & Categories', description: 'حقول البيانات المخصصة وسجلات التتبع' }
    ]
  },
  {
    id: 'accounting',
    nameAr: 'الحسابات العامة والقيود',
    nameEn: 'General Ledger & Accounting',
    icon: BookOpen,
    color: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-300', badge: 'bg-blue-700' },
    features: [
      { id: 'accounting', nameAr: 'النظام المحاسبي العام', nameEn: 'General Ledger System', description: 'تفعيل كامل للدورة المحاسبية والأستاذ' },
      { id: 'chart_of_accounts', nameAr: 'شجرة ودليل الحسابات', nameEn: 'Chart of Accounts', description: 'بناء وتعديل دليل الحسابات المالي' },
      { id: 'journal_entries', nameAr: 'قيود اليومية العامة', nameEn: 'Journal Entries', description: 'إنشاء وترحيل ومراجعة القيود المحاسبية' },
      { id: 'detailed_journal_entries', nameAr: 'القيود اليومية التفصيلية', nameEn: 'Detailed Journal Entries', description: 'استعراض الحركات التفصيلية للأطراف' },
      { id: 'multi_currency', nameAr: 'العملات المتعددة وفروق الصرف', nameEn: 'Multi-Currency Engine', description: 'التعامل بأكثر من عملة وتحديث الأسعار' },
      { id: 'ifrs_guide', nameAr: 'دليل معايير IFRS 2026', nameEn: 'IFRS Standards Guide', description: 'دليل معايير المحاسبة الدولية والمصرية' }
    ]
  },
  {
    id: 'fixed_assets',
    nameAr: 'الأصول الثابتة',
    nameEn: 'Fixed Assets',
    icon: Briefcase,
    color: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', badge: 'bg-orange-600' },
    features: [
      { id: 'fixed_assets', nameAr: 'سجل الأصول الثابتة', nameEn: 'Fixed Assets Register', description: 'إضافة ومتابعة الأصول الثابتة وقيمتها' },
      { id: 'asset_categories', nameAr: 'تصنيفات ومجموعات الأصول', nameEn: 'Asset Categories', description: 'نسب الإهلاك ومجموعات الأصول' },
      { id: 'asset_depreciation', nameAr: 'تشغيل الإهلاك المحاسبي', nameEn: 'Depreciation Engine', description: 'حساب الإهلاك الآلي وتوليد القيود' }
    ]
  },
  {
    id: 'templates',
    nameAr: 'القوالب والتصميم',
    nameEn: 'Document Templates',
    icon: LayoutTemplate,
    color: { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200', badge: 'bg-slate-600' },
    features: [
      { id: 'templates', nameAr: 'إدارة وتخصيص القوالب', nameEn: 'Templates Manager', description: 'تخصيص قوالب طباعة الفواتير والسندات' },
      { id: 'create_template', nameAr: 'مصمم القوالب الجديد', nameEn: 'Template Designer', description: 'إنشاء قوالب طباعة مخصصة بالشعار والتصميم' }
    ]
  },
  {
    id: 'reports',
    nameAr: 'التقارير المالية والتشغيلية',
    nameEn: 'Reports & Analytics',
    icon: BarChart3,
    color: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200', badge: 'bg-sky-600' },
    features: [
      { id: 'reports', nameAr: 'مركز التقارير العام', nameEn: 'Reports Center', description: 'الوصول لكافة التقارير المتقدمة' },
      { id: 'financial_reports', nameAr: 'التقارير المالية (قائمة الدخل، الميزانية، ميزان المراجعة)', nameEn: 'Financial Reports', description: 'المركز المالي، الأرباح والخسائر، والأستاذ العام' },
      { id: 'inventory_reports', nameAr: 'تقارير حركة وكارت الصنف والمخزون', nameEn: 'Inventory Movements Reports', description: 'أرصدة المخزن خلال فترة وكارت الصنف' },
      { id: 'partner_reports', nameAr: 'كشوف الحسابات وأعمار الديون', nameEn: 'Partner Statements & Aging', description: 'كشف حساب العميل والمورد وتقارير التحصيل' }
    ]
  },
  {
    id: 'pos',
    nameAr: 'نقاط البيع (POS)',
    nameEn: 'Point of Sale',
    icon: Radio,
    color: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', badge: 'bg-emerald-700' },
    features: [
      { id: 'pos', nameAr: 'نظام نقاط البيع والكاشير', nameEn: 'POS System', description: 'شاشة الكاشير السريع وطباعة الإيصالات' },
      { id: 'pos_branches', nameAr: 'الفروع المتصلة وربط الأجهزة', nameEn: 'Connected POS Devices', description: 'ربط ومزامنة أجهزة الكاشير بالفروع' }
    ]
  },
  {
    id: 'admin',
    nameAr: 'الإدارة والأمان وإعدادات النظام',
    nameEn: 'Administration & System',
    icon: Settings,
    color: { bg: 'bg-stone-50', text: 'text-stone-800', border: 'border-stone-300', badge: 'bg-stone-700' },
    features: [
      { id: 'admin', nameAr: 'لوحة إعدادات الشركة', nameEn: 'Company Settings', description: 'البيانات الضريبية، الشعار، والسياسات' },
      { id: 'user_management', nameAr: 'إدارة المستخدمين والأدوار', nameEn: 'Users & Permissions', description: 'إضافة المستخدمين وتعيين الصلاحيات' },
      { id: 'period_closing', nameAr: 'إغلاق الفترات والسنوات المالية', nameEn: 'Period Closing', description: 'إقفال الأشهر والسنوات وترحيل الأرصدة' },
      { id: 'data_integrity', nameAr: 'فحص وتدقيق سلامة البيانات', nameEn: 'Data Integrity Audit', description: 'التحقق الآلي من تطابق القيود والوثائق' },
      { id: 'backup_restore', nameAr: 'النسخ الاحتياطي واستعادة البيانات', nameEn: 'Backup & Restore', description: 'أخذ وحفظ واسترجاع النسخ الاحتياطية' },
      { id: 'activity_logs', nameAr: 'سجلات الرقابة والنشاط', nameEn: 'Audit & Activity Logs', description: 'تتبع كافة التعديلات وعمليات الحذف والطباعة' },
      { id: 'api', nameAr: 'الربط البرمجي الخارجي (API)', nameEn: 'External API Integration', description: 'تكامل النظام مع المنصات والأنظمة الخارجية' },
      { id: 'hr', nameAr: 'الموارد البشرية وشؤون الموظفين (HR)', nameEn: 'Human Resources (HR)', description: 'الرواتب والعهد والإجازات' }
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
      // Populate defaults for all known categories
      SYSTEM_FEATURE_CATEGORIES.forEach(cat => {
        cat.features.forEach(f => {
          map[f.id] = true; // Default to enabled
        });
      });

      // Override with DB data
      if (Array.isArray(data)) {
        data.forEach(item => {
          map[item.feature_name] = item.is_enabled;
        });
      }

      setFeatureMap(map);
      setInitialFeatureMap({ ...map });
    } catch (err: any) {
      console.error('Failed to load features:', err);
      showToast(err.message || 'فشل في تحميل ميزات الشركة، يرجى إعادة المحاولة.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle single feature
  const toggleFeature = (featureId: string) => {
    setFeatureMap(prev => ({
      ...prev,
      [featureId]: !prev[featureId]
    }));
  };

  // Toggle entire category
  const toggleCategory = (category: FeatureCategory) => {
    const allEnabled = category.features.every(f => featureMap[f.id] === true);
    const targetState = !allEnabled;

    setFeatureMap(prev => {
      const updated = { ...prev };
      category.features.forEach(f => {
        updated[f.id] = targetState;
      });
      return updated;
    });
  };

  // Select all features in the whole system
  const handleSelectAllSystemFeatures = () => {
    setFeatureMap(prev => {
      const updated = { ...prev };
      SYSTEM_FEATURE_CATEGORIES.forEach(cat => {
        cat.features.forEach(f => {
          updated[f.id] = true;
        });
      });
      return updated;
    });
  };

  // Deselect all features in the whole system
  const handleDeselectAllSystemFeatures = () => {
    setFeatureMap(prev => {
      const updated = { ...prev };
      SYSTEM_FEATURE_CATEGORIES.forEach(cat => {
        cat.features.forEach(f => {
          updated[f.id] = false;
        });
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
    return SYSTEM_FEATURE_CATEGORIES.reduce((acc, cat) => acc + cat.features.length, 0);
  }, []);

  const enabledFeaturesCount = useMemo(() => {
    return Object.values(featureMap).filter(Boolean).length;
  }, [featureMap]);

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-[85vh] flex flex-col font-sans" dir="rtl">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 font-bold text-sm ${
              toastMessage.type === 'success' 
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' 
                : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
            }`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar: Company Selector & Global Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 md:p-5 transition-all space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Header Title */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">إدارة ميزات النظام (Feature Flags)</h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  حدد الشركة لتخصيص وتفعيل أو إيقاف الميزات بالترتيب المنهجي للنظام
                </p>
              </div>
            </div>
          </div>

          {/* Search & Company Select Dropdown */}
          <div className="relative flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input 
                type="text" 
                placeholder="ابحث عن شركة (بالاسم، كود الشركة، أو إيميل المدير)..." 
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl pr-10 pl-10 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-xs font-bold text-slate-800 placeholder:text-slate-400 shadow-2xs"
              />
              <button 
                type="button" 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown Results */}
            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsDropdownOpen(false)} 
                />
                <div className="absolute top-full right-0 left-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-30 max-h-72 overflow-y-auto custom-scrollbar p-2 animate-in fade-in-50 zoom-in-95 duration-150">
                  {filteredCompanies.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold">
                      لا توجد شركة مطابقة لبحثك
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
                          className={`w-full text-right p-3 rounded-xl transition-all flex items-center justify-between mb-1 cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-50/80 border border-blue-200 text-blue-900 shadow-2xs' 
                              : 'hover:bg-slate-50 border border-transparent text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              <Building2 size={15} />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                                <span>{c.name}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                                  {c.code}
                                </span>
                              </div>
                              {managerEmail && (
                                <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                                  <Mail size={11} />
                                  <span>{managerEmail}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-xs font-bold text-blue-600 bg-white px-2 py-0.5 rounded-md border border-blue-200">
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
          <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 bg-blue-50 text-blue-900 px-3 py-1.5 rounded-xl border border-blue-200/80">
                <Building2 size={14} className="text-blue-600" />
                <span className="font-black text-xs">{selectedCompany.name}</span>
                <span className="bg-white px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-blue-700 shadow-2xs">
                  {selectedCompany.code}
                </span>
              </div>

              {getManagerEmail(selectedCompany) && (
                <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-xl border border-slate-200 text-[11px] font-mono font-bold">
                  <Mail size={12} className="text-slate-400" />
                  <span>{getManagerEmail(selectedCompany)}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>الميزات المفعلة:</span>
                <span className="font-black font-mono">{enabledFeaturesCount} / {totalFeaturesCount}</span>
              </div>

              {hasUnsavedChanges && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-300 animate-pulse">
                  يوجد تعديلات غير محفوظة
                </span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllSystemFeatures}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                تحديد الكل
              </button>
              <button
                type="button"
                onClick={handleDeselectAllSystemFeatures}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                إلغاء التحديد
              </button>
              <button
                type="button"
                onClick={() => loadFeatures(selectedCompany.id)}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={saving || !hasUnsavedChanges}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                  hasUnsavedChanges 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-95' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>حفظ التغييرات</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Body: Full Screen Features Grid */}
      {!selectedCompanyId ? (
        <div className="flex-1 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 text-slate-300">
            <Building2 size={32} />
          </div>
          <h3 className="text-base font-black text-slate-700 mb-1">يرجى اختيار شركة للبدء</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            اختر شركة من شريط البحث بالأعلى لعرض كافة الميزات والوحدات مرتبة ومصنفة من لوحة التحكم وحتى الإدارة.
          </p>
        </div>
      ) : loading ? (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-12">
          <RefreshCw size={30} className="animate-spin text-blue-600 mb-3" />
          <p className="text-xs font-bold text-slate-500">جاري تحميل ميزات الشركة المحددة...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {SYSTEM_FEATURE_CATEGORIES.map((category, catIndex) => {
            const enabledCount = category.features.filter(f => featureMap[f.id] === true).length;
            const totalCount = category.features.length;
            const isAllEnabled = enabledCount === totalCount;
            const isNoneEnabled = enabledCount === 0;
            const isPartial = !isAllEnabled && !isNoneEnabled;

            return (
              <div 
                key={category.id} 
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all hover:shadow-xs"
              >
                {/* Category Header */}
                <div className="p-3.5 md:p-4 bg-slate-50/70 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-200/80 text-slate-700 text-[11px] font-black flex items-center justify-center font-mono">
                      {catIndex + 1}
                    </span>
                    <div className={`p-2 rounded-xl ${category.color.bg} ${category.color.text} border ${category.color.border}`}>
                      <category.icon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-slate-900">{category.nameAr}</h3>
                        <span className="text-[10px] font-mono text-slate-400">{category.nameEn}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        <span>المفعل: </span>
                        <span className="font-black font-mono text-slate-800">{enabledCount}</span>
                        <span> من </span>
                        <span className="font-black font-mono text-slate-800">{totalCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Group Master Checkbox & Fast Toggles */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer shadow-2xs ${
                        isAllEnabled 
                          ? 'bg-emerald-600 text-white border-emerald-600' 
                          : isPartial 
                            ? 'bg-blue-50 text-blue-700 border-blue-300' 
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        isAllEnabled 
                          ? 'bg-white text-emerald-700 border-white' 
                          : isPartial 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white border-slate-400'
                      }`}>
                        {isAllEnabled && <Check size={11} className="stroke-[3]" />}
                        {isPartial && <Minus size={11} className="stroke-[3]" />}
                      </div>
                      <span>
                        {isAllEnabled ? 'محددة بالكامل' : isPartial ? 'محددة جزئياً' : 'تحديد القائمة كاملة'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Features Cards Grid */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-white">
                  {category.features.map(feature => {
                    const isEnabled = featureMap[feature.id] === true;
                    return (
                      <div
                        key={feature.id}
                        onClick={() => toggleFeature(feature.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isEnabled 
                            ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300 shadow-2xs' 
                            : 'bg-slate-50/40 border-slate-200/80 hover:border-slate-300 opacity-70 hover:opacity-100'
                        }`}
                      >
                        {/* Custom Square Checkbox */}
                        <div 
                          className={`w-5 h-5 rounded-lg flex items-center justify-center mt-0.5 shrink-0 transition-all border ${
                            isEnabled 
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' 
                              : 'bg-white border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {isEnabled && <Check size={12} className="stroke-[3]" />}
                        </div>

                        {/* Feature Information */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-black truncate ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                              {feature.nameAr}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 font-mono ${
                              isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {isEnabled ? 'مفعلة' : 'معطلة'}
                            </span>
                          </div>
                          
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                            {feature.id}
                          </div>

                          {feature.description && (
                            <p className="text-[11px] text-slate-500 leading-snug mt-1 font-medium">
                              {feature.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
          className="sticky bottom-4 z-40 bg-slate-900 text-white p-3.5 px-6 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-slate-800"
        >
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold">
              لديك تعديلات غير محفوظة لميزات شركة ({selectedCompany?.name})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFeatureMap({ ...initialFeatureMap })}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              تراجع
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all shadow-lg shadow-emerald-500/30 active:scale-95 cursor-pointer"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>حفظ التغييرات الآن</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
