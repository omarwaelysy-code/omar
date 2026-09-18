import React, { useState, useEffect } from 'react';
import { 
  X, Save, Calculator, Plus, Trash2, Paperclip, Building2, User, 
  DollarSign, Calendar, FileText, CheckCircle2, AlertCircle, RefreshCw 
} from 'lucide-react';
import { FixedAsset, AssetCategory, DepreciationMethod, AssetComponent } from '../../types/fixedAssets';
import { fixedAssetService } from '../../services/fixedAssetService';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assetToEdit?: FixedAsset | null;
  categories: AssetCategory[];
  warehouses: any[];
  departments: any[];
  costCenters: any[];
  employees: any[];
  suppliers: any[];
  accounts: any[];
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assetToEdit,
  categories,
  warehouses,
  departments,
  costCenters,
  employees,
  suppliers,
  accounts
}) => {
  const { showSuccess, showError } = useNotification();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'basic' | 'financial' | 'organization' | 'supplier' | 'accounting' | 'components' | 'attachments'>('basic');
  const [submitting, setSubmitting] = useState(false);
  const [generatingNumber, setGeneratingNumber] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<FixedAsset>>({
    asset_number: '',
    name: '',
    name_ar: '',
    name_en: '',
    category_id: '',
    description: '',
    serial_number: '',
    barcode: '',
    manufacturer: '',
    model: '',
    acquisition_date: new Date().toISOString().slice(0, 10),
    capitalization_date: '',
    depreciation_start_date: '',
    acquisition_cost: 0,
    additional_cost: 0,
    capitalized_cost: 0,
    salvage_value: 0,
    useful_life: 5,
    useful_life_unit: 'YEARS',
    depreciation_method: 'STRAIGHT_LINE',
    warehouse_id: '',
    department_id: '',
    cost_center_id: '',
    location_name: '',
    custodian_id: '',
    custodian_name: '',
    custody_date: '',
    supplier_id: '',
    purchase_invoice_id: '',
    purchase_order_number: '',
    invoice_date: '',
    asset_account_id: '',
    accumulated_depreciation_account_id: '',
    depreciation_expense_account_id: '',
    gain_account_id: '',
    loss_account_id: '',
    attachments: []
  });

  const [components, setComponents] = useState<AssetComponent[]>([]);

  // Load edit asset or reset
  useEffect(() => {
    if (assetToEdit) {
      setFormData({
        ...assetToEdit,
        acquisition_date: assetToEdit.acquisition_date ? assetToEdit.acquisition_date.slice(0, 10) : '',
        capitalization_date: assetToEdit.capitalization_date ? assetToEdit.capitalization_date.slice(0, 10) : '',
        depreciation_start_date: assetToEdit.depreciation_start_date ? assetToEdit.depreciation_start_date.slice(0, 10) : '',
        invoice_date: assetToEdit.invoice_date ? assetToEdit.invoice_date.slice(0, 10) : '',
        custody_date: assetToEdit.custody_date ? assetToEdit.custody_date.slice(0, 10) : ''
      });
      setComponents(assetToEdit.components || []);
    } else {
      setFormData({
        asset_number: '',
        name: '',
        name_ar: '',
        name_en: '',
        category_id: categories[0]?.id || '',
        description: '',
        serial_number: '',
        barcode: '',
        manufacturer: '',
        model: '',
        acquisition_date: new Date().toISOString().slice(0, 10),
        capitalization_date: '',
        depreciation_start_date: '',
        acquisition_cost: 0,
        additional_cost: 0,
        capitalized_cost: 0,
        salvage_value: 0,
        useful_life: categories[0]?.default_useful_life || 5,
        useful_life_unit: 'YEARS',
        depreciation_method: categories[0]?.default_depreciation_method || 'STRAIGHT_LINE',
        warehouse_id: warehouses[0]?.id || '',
        department_id: '',
        cost_center_id: '',
        location_name: '',
        custodian_id: '',
        custodian_name: '',
        custody_date: '',
        supplier_id: '',
        purchase_invoice_id: '',
        purchase_order_number: '',
        invoice_date: '',
        asset_account_id: categories[0]?.asset_account_id || '',
        accumulated_depreciation_account_id: categories[0]?.accumulated_depreciation_account_id || '',
        depreciation_expense_account_id: categories[0]?.depreciation_expense_account_id || '',
        gain_account_id: categories[0]?.gain_account_id || '',
        loss_account_id: categories[0]?.loss_account_id || '',
        attachments: []
      });
      setComponents([]);
      fetchNextNumber();
    }
    setActiveTab('basic');
  }, [assetToEdit, isOpen]);

  // Handle Category Change to inherit default accounts and depreciation params
  const handleCategoryChange = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    setFormData(prev => ({
      ...prev,
      category_id: catId,
      useful_life: cat?.default_useful_life || prev.useful_life || 5,
      depreciation_method: cat?.default_depreciation_method || prev.depreciation_method || 'STRAIGHT_LINE',
      salvage_value: cat?.default_salvage_value || prev.salvage_value || 0,
      asset_account_id: cat?.asset_account_id || prev.asset_account_id,
      accumulated_depreciation_account_id: cat?.accumulated_depreciation_account_id || prev.accumulated_depreciation_account_id,
      depreciation_expense_account_id: cat?.depreciation_expense_account_id || prev.depreciation_expense_account_id,
      gain_account_id: cat?.gain_account_id || prev.gain_account_id,
      loss_account_id: cat?.loss_account_id || prev.loss_account_id
    }));
  };

  const fetchNextNumber = async () => {
    setGeneratingNumber(true);
    try {
      const num = await fixedAssetService.getNextAssetNumber();
      setFormData(prev => ({ ...prev, asset_number: num }));
    } catch (e) {
    } finally {
      setGeneratingNumber(false);
    }
  };

  // Recalculate capitalized cost
  useEffect(() => {
    const acq = Number(formData.acquisition_cost) || 0;
    const add = Number(formData.additional_cost) || 0;
    setFormData(prev => ({ ...prev, capitalized_cost: acq + add }));
  }, [formData.acquisition_cost, formData.additional_cost]);

  // Custodian Name Auto-sync
  const handleCustodianChange = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    setFormData(prev => ({
      ...prev,
      custodian_id: empId,
      custodian_name: emp?.name || '',
      custody_date: prev.custody_date || new Date().toISOString().slice(0, 10)
    }));
  };

  // Component management
  const addComponent = () => {
    setComponents(prev => [
      ...prev,
      {
        name: '',
        serial_number: '',
        cost: 0,
        useful_life: formData.useful_life || 5,
        depreciation_method: formData.depreciation_method || 'STRAIGHT_LINE'
      }
    ]);
  };

  const updateComponent = (index: number, field: string, val: any) => {
    setComponents(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const removeComponent = (index: number) => {
    setComponents(prev => prev.filter((_, i) => i !== index));
  };

  // Attachment handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setFormData(prev => ({
          ...prev,
          attachments: [
            ...(prev.attachments || []),
            {
              name: file.name,
              type: file.type,
              size: file.size,
              data: base64,
              uploaded_at: new Date().toISOString()
            }
          ]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showError('يرجى إدخال اسم الأصل');
      setActiveTab('basic');
      return;
    }
    if ((Number(formData.acquisition_cost) || 0) < 0) {
      showError('تكلفة شراء الأصل لا يمكن أن تكون سالبة');
      setActiveTab('financial');
      return;
    }
    if ((Number(formData.useful_life) || 0) <= 0) {
      showError('العمر الإنتاجي يجب أن يكون أكبر من صفر');
      setActiveTab('financial');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<FixedAsset> = {
        ...formData,
        components
      };
      await fixedAssetService.saveAsset(payload);
      showSuccess(assetToEdit ? 'تم تحديث بيانات الأصل بنجاح' : 'تم إضافة الأصل الثابت بنجاح');
      onSuccess();
      onClose();
    } catch (error: any) {
      showError(error.message || 'فشل حفظ الأصل');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {assetToEdit ? 'تعديل بيانات الأصل الثابت' : 'إضافة أصل ثابت جديد'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {assetToEdit ? `رقم الأصل: ${assetToEdit.asset_number}` : 'تسجيل أصل جديد مع المعايير المالية والتنظيمية وإدارة العهدة'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-800 bg-slate-900/50 overflow-x-auto">
          {[
            { id: 'basic', label: 'البيانات الأساسية', icon: FileText },
            { id: 'financial', label: 'البيانات المالية والإهلاك', icon: DollarSign },
            { id: 'organization', label: 'الهيكل والعهدة', icon: User },
            { id: 'supplier', label: 'المشتريات والمورد', icon: Building2 },
            { id: 'accounting', label: 'الحسابات المحاسبية', icon: Calculator },
            { id: 'components', label: `المكونات (${components.length})`, icon: Plus },
            { id: 'attachments', label: `المرفقات (${formData.attachments?.length || 0})`, icon: Paperclip }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                  active
                    ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: BASIC INFORMATION */}
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم الأصل (Auto Unique) *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.asset_number || ''}
                    onChange={e => setFormData({ ...formData, asset_number: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                    placeholder="AST-000001"
                  />
                  {!assetToEdit && (
                    <button
                      type="button"
                      onClick={fetchNextNumber}
                      disabled={generatingNumber}
                      title="توليد رقم تسلسلي جديد"
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${generatingNumber ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم الأصل (عربي) *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value, name_ar: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="مثال: سيارة نقل تويوتا هايلكس"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم الأصل (إنجليزي)</label>
                <input
                  type="text"
                  value={formData.name_en || ''}
                  onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Toyota Hilux Pickup"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">تصنيف الأصل *</label>
                <select
                  value={formData.category_id || ''}
                  onChange={e => handleCategoryChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- اختر التصنيف --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name} {c.parent_name ? `(${c.parent_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">الرقم التسلسلي (Serial Number)</label>
                <input
                  type="text"
                  value={formData.serial_number || ''}
                  onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="SN-987654321"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">الباركود (Barcode)</label>
                <input
                  type="text"
                  value={formData.barcode || ''}
                  onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="123456789012"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">الشركة المصنعة (Manufacturer)</label>
                <input
                  type="text"
                  value={formData.manufacturer || ''}
                  onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="مثال: تويوتا / ديل / كوماتسو"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">الموديل (Model)</label>
                <input
                  type="text"
                  value={formData.model || ''}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="2026 Double Cabin 4x4"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">الوصف والملاحظات</label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="ملاحظات تفصيلية عن الأصل ومواصفاته الفنية وموقعه..."
                />
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIAL & DEPRECIATION */}
          {activeTab === 'financial' && (
            <div className="space-y-6">
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                <h3 className="text-sm font-bold text-blue-400 mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  التكاليف وتحديد القيمة المرسملة
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">تكلفة الشراء الأصلية *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.acquisition_cost || ''}
                      onChange={e => setFormData({ ...formData, acquisition_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white font-bold text-base focus:outline-none focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">تكاليف إضافية (شحن/تركيب/جمارك)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.additional_cost || ''}
                      onChange={e => setFormData({ ...formData, additional_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white font-bold text-base focus:outline-none focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">إجمالي التكلفة المرسملة (محسوب)</label>
                    <div className="w-full bg-slate-800/80 border border-blue-500/30 rounded-lg px-3.5 py-2.5 text-blue-400 font-extrabold text-base">
                      {((Number(formData.acquisition_cost) || 0) + (Number(formData.additional_cost) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">القيمة التخريدية (Salvage Value)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.salvage_value || ''}
                      onChange={e => setFormData({ ...formData, salvage_value: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ الشراء والاستحواذ *</label>
                    <input
                      type="date"
                      required
                      value={formData.acquisition_date || ''}
                      onChange={e => setFormData({ ...formData, acquisition_date: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ الرسملة</label>
                    <input
                      type="date"
                      value={formData.capitalization_date || ''}
                      onChange={e => setFormData({ ...formData, capitalization_date: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                <h3 className="text-sm font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  معايير وطريقة الإهلاك الدوري
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">طريقة الإهلاك *</label>
                    <select
                      value={formData.depreciation_method || 'STRAIGHT_LINE'}
                      onChange={e => setFormData({ ...formData, depreciation_method: e.target.value as DepreciationMethod })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="STRAIGHT_LINE">القسط الثابت (Straight Line)</option>
                      <option value="DECLINING_BALANCE">الرصيد المتناقص (Declining Balance)</option>
                      <option value="DOUBLE_DECLINING">الرصيد المتناقص المزدوج (Double Declining)</option>
                      <option value="UNITS_OF_PRODUCTION">وحدات الإنتاج (Units of Production)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">العمر الإنتاجي *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={formData.useful_life || ''}
                        onChange={e => setFormData({ ...formData, useful_life: parseFloat(e.target.value) || 1 })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                        placeholder="5"
                      />
                      <select
                        value={formData.useful_life_unit || 'YEARS'}
                        onChange={e => setFormData({ ...formData, useful_life_unit: e.target.value as any })}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      >
                        <option value="YEARS">سنوات</option>
                        <option value="MONTHS">شهور</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ بدء احتساب الإهلاك</label>
                    <input
                      type="date"
                      value={formData.depreciation_start_date || ''}
                      onChange={e => setFormData({ ...formData, depreciation_start_date: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ORGANIZATION & CUSTODY */}
          {activeTab === 'organization' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">الفرع / المستودع</label>
                <select
                  value={formData.warehouse_id || ''}
                  onChange={e => setFormData({ ...formData, warehouse_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- اختر الفرع / المخزن --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">القسم الإداري</label>
                <select
                  value={formData.department_id || ''}
                  onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- اختر القسم --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">مركز التكلفة</label>
                <select
                  value={formData.cost_center_id || ''}
                  onChange={e => setFormData({ ...formData, cost_center_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- اختر مركز التكلفة --</option>
                  {costCenters.map(cc => (
                    <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">الموظف المسؤول (العهدة)</label>
                <select
                  value={formData.custodian_id || ''}
                  onChange={e => handleCustodianChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- بدون عهدة محددة --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.employee_code} - {emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ تسليم العهدة</label>
                <input
                  type="date"
                  value={formData.custody_date || ''}
                  onChange={e => setFormData({ ...formData, custody_date: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">الموقع الفعلي التفصيلي</label>
                <input
                  type="text"
                  value={formData.location_name || ''}
                  onChange={e => setFormData({ ...formData, location_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="مثال: المبنى الإداري - الدور الثاني - مكتب 204"
                />
              </div>
            </div>
          )}

          {/* TAB 4: SUPPLIER & PURCHASES */}
          {activeTab === 'supplier' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">المورد</label>
                <select
                  value={formData.supplier_id || ''}
                  onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- اختر المورد --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم أمر الشراء</label>
                <input
                  type="text"
                  value={formData.purchase_order_number || ''}
                  onChange={e => setFormData({ ...formData, purchase_order_number: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="PO-2026-0012"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ الفاتورة</label>
                <input
                  type="date"
                  value={formData.invoice_date || ''}
                  onChange={e => setFormData({ ...formData, invoice_date: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 5: ACCOUNTING GL ACCOUNTS */}
          {activeTab === 'accounting' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">حساب الأصل الثابت (Fixed Asset Account)</label>
                <select
                  value={formData.asset_account_id || ''}
                  onChange={e => setFormData({ ...formData, asset_account_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- افتراضي من التصنيف --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">حساب مجمع الإهلاك (Accumulated Depreciation)</label>
                <select
                  value={formData.accumulated_depreciation_account_id || ''}
                  onChange={e => setFormData({ ...formData, accumulated_depreciation_account_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- افتراضي من التصنيف --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">حساب مصروف الإهلاك (Depreciation Expense)</label>
                <select
                  value={formData.depreciation_expense_account_id || ''}
                  onChange={e => setFormData({ ...formData, depreciation_expense_account_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- افتراضي من التصنيف --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">حساب أرباح الاستبعاد والبيع (Gain on Disposal)</label>
                <select
                  value={formData.gain_account_id || ''}
                  onChange={e => setFormData({ ...formData, gain_account_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- افتراضي من التصنيف --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">حساب خسائر الاستبعاد والبيع (Loss on Disposal)</label>
                <select
                  value={formData.loss_account_id || ''}
                  onChange={e => setFormData({ ...formData, loss_account_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- افتراضي من التصنيف --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* TAB 6: ASSET COMPONENTS */}
          {activeTab === 'components' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">مكونات الأصل المركب</h3>
                  <p className="text-xs text-slate-400">يمكن تقسيم الأصل إلى مكونات ذات تكاليف وأعمار إنتاجية منفصلة (مثل: ماكينة + محرك + وحدة تحكم)</p>
                </div>
                <button
                  type="button"
                  onClick={addComponent}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  إضافة مكون
                </button>
              </div>

              {components.length === 0 ? (
                <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-700 text-slate-500 text-xs">
                  لا توجد مكونات منفصلة مضافة لهذا الأصل حتى الآن.
                </div>
              ) : (
                <div className="space-y-3">
                  {components.map((comp, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-3 p-3 bg-slate-800/60 border border-slate-700/80 rounded-xl">
                      <div className="flex-1 min-w-[200px]">
                        <input
                          type="text"
                          required
                          placeholder="اسم المكون (مثال: محرك الديزل)"
                          value={comp.name}
                          onChange={e => updateComponent(idx, 'name', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
                        />
                      </div>
                      <div className="w-36">
                        <input
                          type="text"
                          placeholder="الرقم التسلسلي"
                          value={comp.serial_number || ''}
                          onChange={e => updateComponent(idx, 'serial_number', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono"
                        />
                      </div>
                      <div className="w-28">
                        <input
                          type="number"
                          placeholder="التكلفة"
                          value={comp.cost || ''}
                          onChange={e => updateComponent(idx, 'cost', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-bold"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          placeholder="العمر (سنة)"
                          value={comp.useful_life || ''}
                          onChange={e => updateComponent(idx, 'useful_life', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeComponent(idx)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: ATTACHMENTS */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">المستندات والوثائق المرفقة</h3>
                  <p className="text-xs text-slate-400">إرفاق الفاتورة، عقد الشراء، شهادة الضمان، صور الأصل، أو أي ملفات PDF</p>
                </div>
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors">
                  <Paperclip className="w-4 h-4" />
                  اختيار ملفات
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {(!formData.attachments || formData.attachments.length === 0) ? (
                <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-700 text-slate-500 text-xs">
                  لم يتم إرفاق أي مستندات للأصل حتى الآن.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {formData.attachments.map((att: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-white truncate">{att.name}</p>
                          <p className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'جاري الحفظ...' : assetToEdit ? 'تحديث الأصل' : 'حفظ الأصل الثابت'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
