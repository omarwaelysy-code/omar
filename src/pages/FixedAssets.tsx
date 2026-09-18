import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Plus, Search, Filter, RefreshCw, Printer, FileSpreadsheet, 
  Calculator, User, DollarSign, Layers, ChevronLeft, ChevronRight,
  TrendingUp, Tool, AlertTriangle, CheckCircle2, Clock, MoreVertical,
  Eye, Edit3, Trash2, ArrowRightLeft, ShieldCheck, BarChart3, HelpCircle
} from 'lucide-react';
import { FixedAsset, AssetCategory, AssetDashboardStats, AssetDepreciationRun } from '../types/fixedAssets';
import { fixedAssetService } from '../services/fixedAssetService';
import { dbService } from '../services/dbService';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

import { AssetFormModal } from '../components/fixed-assets/AssetFormModal';
import { AssetDetailsModal } from '../components/fixed-assets/AssetDetailsModal';
import { 
  AssetCapitalizeModal, 
  AssetTransferModal, 
  AssetMaintenanceModal, 
  AssetRevaluationModal, 
  AssetDisposalModal 
} from '../components/fixed-assets/AssetOperationsModals';
import { AssetDepreciationRunModal } from '../components/fixed-assets/AssetDepreciationRunModal';
import { AssetCategoriesTab } from '../components/fixed-assets/AssetCategoriesTab';
import { FixedAssetsReportsTab } from '../components/fixed-assets/FixedAssetsReportsTab';
import * as XLSX from 'xlsx';

interface FixedAssetsProps {
  initialTab?: 'dashboard' | 'register' | 'categories' | 'depreciation' | 'reports';
}

export const FixedAssets: React.FC<FixedAssetsProps> = ({ initialTab = 'dashboard' }) => {
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'register' | 'categories' | 'depreciation' | 'reports'>(initialTab);

  // Data States
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [deprRuns, setDeprRuns] = useState<AssetDepreciationRun[]>([]);
  const [stats, setStats] = useState<AssetDashboardStats | null>(null);

  // Organizational master data
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [custodianFilter, setCustodianFilter] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<FixedAsset | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [isDeprRunModalOpen, setIsDeprRunModalOpen] = useState(false);

  const [isCapitalizeModalOpen, setIsCapitalizeModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isRevaluationModalOpen, setIsRevaluationModalOpen] = useState(false);
  const [isDisposalModalOpen, setIsDisposalModalOpen] = useState(false);
  const [operationAsset, setOperationAsset] = useState<FixedAsset | null>(null);

  // Load all master data and assets
  const loadData = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const [
        assetsData,
        catsData,
        runsData,
        statsData,
        whData,
        deptData,
        ccData,
        empData,
        suppData,
        accData
      ] = await Promise.all([
        fixedAssetService.listAssets(),
        fixedAssetService.getCategories(),
        fixedAssetService.getDepreciationRuns().catch(() => []),
        fixedAssetService.getDashboardStats().catch(() => null),
        dbService.list<any>('warehouses', { company_id: user.company_id }).catch(() => []),
        dbService.list<any>('departments', { company_id: user.company_id }).catch(() => []),
        dbService.list<any>('cost_centers', { company_id: user.company_id }).catch(() => []),
        dbService.list<any>('employees', { company_id: user.company_id }).catch(() => []),
        dbService.list<any>('suppliers', { company_id: user.company_id }).catch(() => []),
        dbService.list<any>('accounts', { company_id: user.company_id }).catch(() => [])
      ]);

      setAssets(assetsData || []);
      setCategories(catsData || []);
      setDeprRuns(runsData || []);
      setStats(statsData);
      setWarehouses(whData || []);
      setDepartments(deptData || []);
      setCostCenters(ccData || []);
      setEmployees(empData || []);
      setSuppliers(suppData || []);
      setAccounts(accData || []);
    } catch (e: any) {
      console.error(e);
      showError('فشل تحميل بيانات الأصول الثابتة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleRefresh = (e: any) => {
      if (e.detail?.collection === 'fixed_assets' || e.detail?.collection === 'asset_categories') {
        loadData();
      }
    };
    window.addEventListener('db-refresh', handleRefresh);
    return () => window.removeEventListener('db-refresh', handleRefresh);
  }, [user?.company_id]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      if (categoryFilter && asset.category_id !== categoryFilter) return false;
      if (statusFilter && asset.status !== statusFilter) return false;
      if (warehouseFilter && asset.warehouse_id !== warehouseFilter) return false;
      if (departmentFilter && asset.department_id !== departmentFilter) return false;
      if (custodianFilter && asset.custodian_id !== custodianFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = (asset.name || '').toLowerCase().includes(q);
        const matchesNum = (asset.asset_number || '').toLowerCase().includes(q);
        const matchesSerial = (asset.serial_number || '').toLowerCase().includes(q);
        const matchesBarcode = (asset.barcode || '').toLowerCase().includes(q);
        const matchesCust = (asset.custodian_name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesNum && !matchesSerial && !matchesBarcode && !matchesCust) {
          return false;
        }
      }
      return true;
    });
  }, [assets, categoryFilter, statusFilter, warehouseFilter, departmentFilter, custodianFilter, searchTerm]);

  // Actions
  const handleOpenAdd = () => {
    setAssetToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (asset: FixedAsset) => {
    setAssetToEdit(asset);
    setIsFormModalOpen(true);
  };

  const handleOpenDetails = (asset: FixedAsset) => {
    setSelectedAssetId(asset.id);
    setIsDetailsModalOpen(true);
  };

  const handleDelete = async (asset: FixedAsset) => {
    if (asset.status !== 'DRAFT') {
      showError('لا يمكن حذف هذا الأصل لأن حالته ليست مسودة (DRAFT).');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف مسودة الأصل (${asset.name})؟`)) return;

    try {
      await fixedAssetService.deleteAsset(asset.id);
      showSuccess('تم حذف الأصل بنجاح');
      loadData();
    } catch (e: any) {
      showError(e.message || 'فشل حذف الأصل');
    }
  };

  const exportRegisterExcel = () => {
    if (filteredAssets.length === 0) return;
    const exportRows = filteredAssets.map(a => ({
      'رقم الأصل': a.asset_number,
      'اسم الأصل': a.name,
      'التصنيف': a.category_name || 'غير مصنف',
      'الفرع / المخزن': a.warehouse_name || 'المركز الرئيسي',
      'القسم': a.department_name || 'عام',
      'العهدة': a.custodian_name || '---',
      'تاريخ الشراء': a.acquisition_date,
      'تاريخ الرسملة': a.capitalization_date || '---',
      'التكلفة المرسملة': a.capitalized_cost,
      'مجمع الإهلاك': a.accumulated_depreciation,
      'صافي القيمة الدفترية': a.net_book_value,
      'القيمة التخريدية': a.salvage_value,
      'العمر الإنتاجي': `${a.useful_life} ${a.useful_life_unit === 'MONTHS' ? 'شهور' : 'سنوات'}`,
      'طريقة الإهلاك': a.depreciation_method,
      'الحالة': a.status
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FixedAssets');
    XLSX.writeFile(wb, `سجل_الأصول_الثابتة_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; bg: string; text: string }> = {
      DRAFT: { label: 'مسودة', bg: 'bg-slate-700/60', text: 'text-slate-300' },
      PENDING_APPROVAL: { label: 'قيد الاعتماد', bg: 'bg-amber-500/10 border border-amber-500/20', text: 'text-amber-400' },
      ACTIVE: { label: 'نشط ويعمل', bg: 'bg-emerald-500/10 border border-emerald-500/20', text: 'text-emerald-400' },
      FULLY_DEPRECIATED: { label: 'منتهي الإهلاك', bg: 'bg-blue-500/10 border border-blue-500/20', text: 'text-blue-400' },
      UNDER_MAINTENANCE: { label: 'تحت الصيانة', bg: 'bg-purple-500/10 border border-purple-500/20', text: 'text-purple-400' },
      DISPOSED: { label: 'مستبعد', bg: 'bg-rose-500/10 border border-rose-500/20', text: 'text-rose-400' },
      SOLD: { label: 'مباع', bg: 'bg-orange-500/10 border border-orange-500/20', text: 'text-orange-400' },
      SCRAPPED: { label: 'مخرّد', bg: 'bg-red-500/10 border border-red-500/20', text: 'text-red-400' },
      SUSPENDED: { label: 'موقوف مؤقتاً', bg: 'bg-zinc-700', text: 'text-zinc-300' }
    };
    const c = config[status] || { label: status, bg: 'bg-slate-700', text: 'text-slate-300' };
    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl shadow-inner">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">إدارة الأصول الثابتة</h1>
              <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-full">
                Enterprise Fixed Assets
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              إدارة دورة حياة الأصول بالكامل، الإهلاك الدوري المركزي، حركات النقل والعهدة، الصيانة، والربط التلقائي بدفتر اليومية العام
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsDeprRunModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600 border border-amber-500/30 text-amber-300 hover:text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/10"
          >
            <Calculator className="w-4 h-4" />
            تشغيل الإهلاك الدوري
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            إضافة أصل جديد
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
        {[
          { id: 'dashboard', label: 'لوحة المؤشرات والتحليل', icon: BarChart3 },
          { id: 'register', label: `سجل الأصول الثابتة (${filteredAssets.length})`, icon: Building2 },
          { id: 'categories', label: `تصنيفات الأصول (${categories.length})`, icon: Layers },
          { id: 'depreciation', label: `دورات الإهلاك المرحلة (${deprRuns.length})`, icon: Calculator },
          { id: 'reports', label: 'التقارير المالية والتحليلية (10)', icon: FileSpreadsheet }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DASHBOARD */}
      {/* ========================================================= */}
      {activeTab === 'dashboard' && stats && (
        <div className="space-y-6">
          {/* Main KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-400">إجمالي الأصول المسجلة</span>
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl"><Building2 className="w-4 h-4" /></div>
              </div>
              <p className="text-2xl font-black text-white mt-3 font-mono">{stats.total_assets}</p>
              <p className="text-[11px] text-slate-400 mt-1">أصل مسجل في النظام</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-400">القيمة التاريخية المرسملة</span>
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><DollarSign className="w-4 h-4" /></div>
              </div>
              <p className="text-xl font-black text-white mt-3 font-mono">
                {stats.total_acquisition_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
              </p>
              <p className="text-[11px] text-slate-400 mt-1">التكلفة التاريخية الإجمالية</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-400">مجمع الإهلاك المتراكم</span>
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl"><Calculator className="w-4 h-4" /></div>
              </div>
              <p className="text-xl font-black text-amber-400 mt-3 font-mono">
                {stats.total_accumulated_depreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
              </p>
              <p className="text-[11px] text-slate-400 mt-1">الإهلاك المستهلك دفترياً</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-400">صافي القيمة الدفترية (NBV)</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><TrendingUp className="w-4 h-4" /></div>
              </div>
              <p className="text-xl font-black text-emerald-400 mt-3 font-mono">
                {stats.total_net_book_value.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
              </p>
              <p className="text-[11px] text-emerald-400/80 mt-1">القيمة الحالية الدفترية الصافية</p>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
              <div>
                <span className="text-[11px] text-slate-400 block">أصول منتهية الإهلاك</span>
                <strong className="text-lg text-white font-mono">{stats.fully_depreciated_count}</strong>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg"><Tool className="w-5 h-5" /></div>
              <div>
                <span className="text-[11px] text-slate-400 block">أصول تحت الصيانة</span>
                <strong className="text-lg text-white font-mono">{stats.under_maintenance_count}</strong>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
              <div>
                <span className="text-[11px] text-slate-400 block">أصول مستبعدة / مباعة</span>
                <strong className="text-lg text-white font-mono">{stats.disposed_count}</strong>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg"><Clock className="w-5 h-5" /></div>
              <div>
                <span className="text-[11px] text-slate-400 block">إهلاك هذا الشهر</span>
                <strong className="text-lg text-amber-400 font-mono">
                  {stats.depreciation_this_month.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          {/* Distribution Breakdown Charts/Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                توزيع الأصول حسب التصنيفات
              </h3>
              <div className="space-y-3">
                {stats.category_distribution?.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">لا توجد بيانات مسجلة.</p>
                ) : (
                  stats.category_distribution.map((cat, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-200">{cat.category_name} ({cat.count})</span>
                        <span className="text-emerald-400 font-mono">{cat.total_nbv.toLocaleString()} EGP</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, (cat.total_cost / (stats.total_acquisition_cost || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Department Breakdown */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                توزيع الأصول حسب الأقسام
              </h3>
              <div className="space-y-3">
                {stats.department_distribution?.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">لا توجد بيانات مسجلة.</p>
                ) : (
                  stats.department_distribution.map((dept, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-200">{dept.department_name} ({dept.count})</span>
                        <span className="text-indigo-400 font-mono">{dept.total_cost.toLocaleString()} EGP</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${Math.min(100, (dept.total_cost / (stats.total_acquisition_cost || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ASSET REGISTER */}
      {/* ========================================================= */}
      {activeTab === 'register' && (
        <div className="space-y-4">
          
          {/* Search & Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث برقم الأصل، الاسم، السيريال، الباركود..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">-- كل التصنيفات --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">-- كل الحالات --</option>
                <option value="DRAFT">مسودة (DRAFT)</option>
                <option value="ACTIVE">نشط ويعمل (ACTIVE)</option>
                <option value="FULLY_DEPRECIATED">منتهي الإهلاك</option>
                <option value="UNDER_MAINTENANCE">تحت الصيانة</option>
                <option value="DISPOSED">مستبعد (DISPOSED)</option>
                <option value="SOLD">مباع (SOLD)</option>
                <option value="SCRAPPED">مخرّد (SCRAPPED)</option>
              </select>
            </div>

            <div>
              <select
                value={warehouseFilter}
                onChange={e => setWarehouseFilter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">-- كل الفروع / المخازن --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={custodianFilter}
                onChange={e => setCustodianFilter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">-- كل مسؤولي العهدة --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Export & Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">إجمالي النتائج: <strong className="text-white">{filteredAssets.length}</strong> أصل</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-colors"
                title="تحديث"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={exportRegisterExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                تصدير Excel
              </button>
            </div>
          </div>

          {/* Asset Register Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/60 shadow-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">رقم الأصل</th>
                  <th className="p-3.5">اسم الأصل</th>
                  <th className="p-3.5">التصنيف</th>
                  <th className="p-3.5">الفرع / الموقع</th>
                  <th className="p-3.5">العهدة</th>
                  <th className="p-3.5">تاريخ الشراء</th>
                  <th className="p-3.5">التكلفة المرسملة</th>
                  <th className="p-3.5">مجمع الإهلاك</th>
                  <th className="p-3.5">صافي القيمة (NBV)</th>
                  <th className="p-3.5 text-center">الحالة</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-slate-400">جاري تحميل سجل الأصول...</td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-slate-500">
                      لا توجد أصول مطابقة لمعايير البحث.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-white">
                        <button
                          onClick={() => handleOpenDetails(asset)}
                          className="hover:text-blue-400 hover:underline transition-colors"
                        >
                          {asset.asset_number}
                        </button>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-200">
                        {asset.name}
                        {asset.serial_number && (
                          <span className="block text-[10px] font-mono text-slate-400">سيريال: {asset.serial_number}</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-300">{asset.category_name || 'غير مصنف'}</td>
                      <td className="p-3.5 text-slate-400">{asset.location_name || asset.warehouse_name || 'المركز الرئيسي'}</td>
                      <td className="p-3.5 text-amber-400 font-medium">{asset.custodian_name || 'بدون عهدة'}</td>
                      <td className="p-3.5 text-slate-400">{asset.acquisition_date}</td>
                      <td className="p-3.5 font-mono font-bold text-white">
                        {Number(asset.capitalized_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 font-mono text-amber-400">
                        {Number(asset.accumulated_depreciation || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 font-mono font-black text-emerald-400">
                        {Number(asset.net_book_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-center">{getStatusBadge(asset.status)}</td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Details Button */}
                          <button
                            onClick={() => handleOpenDetails(asset)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="بطاقة الأصل 360"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Capitalize Button (if Draft) */}
                          {asset.status === 'DRAFT' && (
                            <button
                              onClick={() => { setOperationAsset(asset); setIsCapitalizeModalOpen(true); }}
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="اعتماد ورسملة الأصل"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Operations (if Active) */}
                          {asset.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => { setOperationAsset(asset); setIsTransferModalOpen(true); }}
                                className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                title="نقل وتغيير العهدة"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setOperationAsset(asset); setIsMaintenanceModalOpen(true); }}
                                className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                                title="تسجيل صيانة"
                              >
                                <Tool className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setOperationAsset(asset); setIsDisposalModalOpen(true); }}
                                className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                                title="استبعاد / بيع"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Edit Button */}
                          {asset.status !== 'DISPOSED' && asset.status !== 'SOLD' && (
                            <button
                              onClick={() => handleOpenEdit(asset)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete Button (Draft only) */}
                          {asset.status === 'DRAFT' && (
                            <button
                              onClick={() => handleDelete(asset)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CATEGORIES */}
      {/* ========================================================= */}
      {activeTab === 'categories' && (
        <AssetCategoriesTab
          categories={categories}
          onRefresh={loadData}
          accounts={accounts}
        />
      )}

      {/* ========================================================= */}
      {/* TAB 4: DEPRECIATION RUNS */}
      {/* ========================================================= */}
      {activeTab === 'depreciation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">سجل دورات الإهلاك الدوري السابقة</h3>
              <p className="text-xs text-slate-400">كافة دورات الإهلاك التي تم تشغيلها وترحيل قيودها بدفتر اليومية العام</p>
            </div>
            <button
              onClick={() => setIsDeprRunModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/20"
            >
              <Calculator className="w-4 h-4" />
              تشغيل دورة إهلاك جديدة
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/60">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">رقم الدورة</th>
                  <th className="p-3">الفترة المحاسبية</th>
                  <th className="p-3">من تاريخ</th>
                  <th className="p-3">إلى تاريخ</th>
                  <th className="p-3">عدد الأصول</th>
                  <th className="p-3">إجمالي الإهلاك المرحل</th>
                  <th className="p-3">رقم قيد اليومية</th>
                  <th className="p-3">المستخدم</th>
                  <th className="p-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {deprRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-500">
                      لم يتم تشغيل أي دورات إهلاك سابقة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  deprRuns.map(run => (
                    <tr key={run.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-white">{run.run_number}</td>
                      <td className="p-3 font-semibold text-white">{run.period_name}</td>
                      <td className="p-3 text-slate-400">{run.from_date}</td>
                      <td className="p-3 text-slate-400">{run.to_date}</td>
                      <td className="p-3 font-bold text-blue-400">{run.total_assets}</td>
                      <td className="p-3 font-mono font-extrabold text-amber-400">
                        {Number(run.total_depreciation).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </td>
                      <td className="p-3 font-mono font-semibold text-emerald-400">
                        {run.journal_entry_number || 'قيد مرحل'}
                      </td>
                      <td className="p-3 text-slate-400">{run.created_by}</td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold">
                          تم الترحيل (POSTED)
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: REPORTS */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <FixedAssetsReportsTab />
      )}

      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}

      {/* 1. Add / Edit Asset Modal */}
      <AssetFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={loadData}
        assetToEdit={assetToEdit}
        categories={categories}
        warehouses={warehouses}
        departments={departments}
        costCenters={costCenters}
        employees={employees}
        suppliers={suppliers}
        accounts={accounts}
      />

      {/* 2. Asset 360 Details Modal */}
      <AssetDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        assetId={selectedAssetId}
        onCapitalize={asset => { setIsDetailsModalOpen(false); setOperationAsset(asset); setIsCapitalizeModalOpen(true); }}
        onTransfer={asset => { setIsDetailsModalOpen(false); setOperationAsset(asset); setIsTransferModalOpen(true); }}
        onMaintain={asset => { setIsDetailsModalOpen(false); setOperationAsset(asset); setIsMaintenanceModalOpen(true); }}
        onRevalue={asset => { setIsDetailsModalOpen(false); setOperationAsset(asset); setIsRevaluationModalOpen(true); }}
        onDispose={asset => { setIsDetailsModalOpen(false); setOperationAsset(asset); setIsDisposalModalOpen(true); }}
      />

      {/* 3. Centralized Depreciation Run Modal */}
      <AssetDepreciationRunModal
        isOpen={isDeprRunModalOpen}
        onClose={() => setIsDeprRunModalOpen(false)}
        onSuccess={loadData}
      />

      {/* 4. Capitalize Modal */}
      <AssetCapitalizeModal
        isOpen={isCapitalizeModalOpen}
        onClose={() => setIsCapitalizeModalOpen(false)}
        onSuccess={loadData}
        asset={operationAsset}
        accounts={accounts}
      />

      {/* 5. Transfer Modal */}
      <AssetTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={loadData}
        asset={operationAsset}
        warehouses={warehouses}
        departments={departments}
        costCenters={costCenters}
        employees={employees}
      />

      {/* 6. Maintenance Modal */}
      <AssetMaintenanceModal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        onSuccess={loadData}
        asset={operationAsset}
        suppliers={suppliers}
        accounts={accounts}
      />

      {/* 7. Revaluation Modal */}
      <AssetRevaluationModal
        isOpen={isRevaluationModalOpen}
        onClose={() => setIsRevaluationModalOpen(false)}
        onSuccess={loadData}
        asset={operationAsset}
      />

      {/* 8. Disposal Modal */}
      <AssetDisposalModal
        isOpen={isDisposalModalOpen}
        onClose={() => setIsDisposalModalOpen(false)}
        onSuccess={loadData}
        asset={operationAsset}
        accounts={accounts}
      />

    </div>
  );
};
