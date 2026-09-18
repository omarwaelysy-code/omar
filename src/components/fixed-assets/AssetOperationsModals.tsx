import React, { useState } from 'react';
import { 
  X, CheckCircle2, AlertTriangle, User, DollarSign, Wrench, 
  TrendingUp, Printer, ArrowRightLeft, ShieldCheck, AlertCircle 
} from 'lucide-react';
import { FixedAsset } from '../../types/fixedAssets';
import { fixedAssetService } from '../../services/fixedAssetService';
import { useNotification } from '../../contexts/NotificationContext';

// ========================================================
// 1. ASSET CAPITALIZE MODAL
// ========================================================
export const AssetCapitalizeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: FixedAsset | null;
  accounts: any[];
}> = ({ isOpen, onClose, onSuccess, asset, accounts }) => {
  const { showSuccess, showError } = useNotification();
  const [capDate, setCapDate] = useState(new Date().toISOString().slice(0, 10));
  const [deprStartDate, setDeprStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [creditAccountId, setCreditAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !asset) return null;

  const capCost = Number(asset.capitalized_cost) || 0;

  const handleCapitalize = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fixedAssetService.capitalizeAsset(asset.id, {
        capitalization_date: capDate,
        depreciation_start_date: deprStartDate,
        credit_account_id: creditAccountId || undefined,
        notes
      });
      showSuccess(res.message || 'تم اعتماد ورسملة الأصل بنجاح');
      onSuccess();
      onClose();
    } catch (e: any) {
      showError(e.message || 'فشل رسملة الأصل');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-5 h-5" />
            <h3>اعتماد ورسملة الأصل الثابت</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-3 bg-slate-800/60 rounded-xl text-xs space-y-1">
          <p className="text-slate-400">اسم الأصل: <strong className="text-white">{asset.name}</strong></p>
          <p className="text-slate-400">رقم الأصل: <strong className="text-white font-mono">{asset.asset_number}</strong></p>
          <p className="text-slate-400">التكلفة الإجمالية: <strong className="text-emerald-400 font-bold">{capCost.toLocaleString()} EGP</strong></p>
        </div>

        <form onSubmit={handleCapitalize} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1">تاريخ الرسملة *</label>
            <input
              type="date"
              required
              value={capDate}
              onChange={e => setCapDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">تاريخ بدء احتساب الإهلاك *</label>
            <input
              type="date"
              required
              value={deprStartDate}
              onChange={e => setDeprStartDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            />
          </div>

          {!asset.purchase_invoice_id && (
            <div>
              <label className="block text-slate-300 mb-1">حساب الدائن (المورد أو النقدية) لتوليد القيد</label>
              <select
                value={creditAccountId}
                onChange={e => setCreditAccountId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
              >
                <option value="">-- اختياري: اختر الحساب الدائن --</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all disabled:opacity-50"
            >
              {submitting ? 'جاري الاعتماد...' : 'تأكيد الرسملة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// 2. ASSET TRANSFER MODAL (with Print Handover Receipt)
// ========================================================
export const AssetTransferModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: FixedAsset | null;
  warehouses: any[];
  departments: any[];
  costCenters: any[];
  employees: any[];
}> = ({ isOpen, onClose, onSuccess, asset, warehouses, departments, costCenters, employees }) => {
  const { showSuccess, showError } = useNotification();
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [toDepartmentId, setToDepartmentId] = useState('');
  const [toCostCenterId, setToCostCenterId] = useState('');
  const [toCustodianId, setToCustodianId] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  if (!isOpen || !asset) return null;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fixedAssetService.transferAsset(asset.id, {
        transfer_date: transferDate,
        to_warehouse_id: toWarehouseId || undefined,
        to_department_id: toDepartmentId || undefined,
        to_cost_center_id: toCostCenterId || undefined,
        to_custodian_id: toCustodianId || undefined,
        to_location: toLocation || undefined,
        reason
      });
      showSuccess('تم تسجيل حركة النقل وتحديث العهدة بنجاح');
      setShowReceipt(true);
      onSuccess();
    } catch (e: any) {
      showError(e.message || 'فشل نقل الأصل');
    } finally {
      setSubmitting(false);
    }
  };

  const newEmp = employees.find(e => e.id === toCustodianId);
  const newWh = warehouses.find(w => w.id === toWarehouseId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
        
        {!showReceipt ? (
          <>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <ArrowRightLeft className="w-5 h-5" />
                <h3>نقل أصل ثابت وتغيير العهدة</h3>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl text-xs space-y-1">
              <p className="text-slate-400">الأصل: <strong className="text-white">{asset.name} ({asset.asset_number})</strong></p>
              <p className="text-slate-400">العهدة الحالية: <strong className="text-amber-400">{asset.custodian_name || 'بدون عهدة'}</strong></p>
              <p className="text-slate-400">الموقع الحالي: <strong className="text-white">{asset.location_name || asset.warehouse_name || 'المركز الرئيسي'}</strong></p>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">تاريخ النقل *</label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={e => setTransferDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">الموظف المستلم (العهدة الجديدة)</label>
                  <select
                    value={toCustodianId}
                    onChange={e => setToCustodianId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="">-- اختر الموظف المستلم --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.employee_code} - {emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">الفرع / المستودع المستلم</label>
                  <select
                    value={toWarehouseId}
                    onChange={e => setToWarehouseId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="">-- بدون تغيير --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">القسم المستلم</label>
                  <select
                    value={toDepartmentId}
                    onChange={e => setToDepartmentId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="">-- بدون تغيير --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">الموقع الفعلي الجديد</label>
                <input
                  type="text"
                  value={toLocation}
                  onChange={e => setToLocation(e.target.value)}
                  placeholder="مثال: فرع المعادي - الطابق الأول"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">سبب النقل والملاحظات</label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="إعادة توزيع عهدة / نقل لمقر فرعي..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                >
                  {submitting ? 'جاري النقل...' : 'تأكيد النقل'}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Handover Receipt Printable View */
          <div className="space-y-4 print:p-0">
            <div className="text-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">محضر استلام وتسليم عهدة أصل ثابت</h3>
              <p className="text-xs text-slate-400">تاريخ المحضر: {transferDate}</p>
            </div>

            <div className="p-4 bg-slate-800/40 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">بيانات الأصل:</span>
                <span className="font-bold text-white">{asset.name} ({asset.asset_number})</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">الطرف المسلّم (العهدة السابقة):</span>
                <span className="font-semibold text-white">{asset.custodian_name || 'إدارة الأصول'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">الطرف المستلم (العهدة الحالية):</span>
                <span className="font-bold text-emerald-400">{newEmp?.name || toCustodianId || '---'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الموقع الجديد:</span>
                <span className="font-semibold text-white">{toLocation || newWh?.name || '---'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs text-slate-400">
              <div className="border-t border-slate-700 pt-2">
                <p>توقيع الطرف المسلّم</p>
                <div className="h-12"></div>
              </div>
              <div className="border-t border-slate-700 pt-2">
                <p>توقيع الطرف المستلم</p>
                <div className="h-12"></div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs"
              >
                <Printer className="w-4 h-4" />
                طباعة المحضر
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ========================================================
// 3. ASSET MAINTENANCE MODAL
// ========================================================
export const AssetMaintenanceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: FixedAsset | null;
  suppliers: any[];
  accounts: any[];
}> = ({ isOpen, onClose, onSuccess, asset, suppliers, accounts }) => {
  const { showSuccess, showError } = useNotification();
  const [maintenanceDate, setMaintenanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [maintenanceType, setMaintenanceType] = useState('دورية');
  const [supplierId, setSupplierId] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [isCapitalized, setIsCapitalized] = useState(false);
  const [creditAccountId, setCreditAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !asset) return null;

  const handleMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cost <= 0) {
      showError('يرجى إدخال تكلفة صيانة صحيحة');
      return;
    }
    setSubmitting(true);
    try {
      await fixedAssetService.recordMaintenance(asset.id, {
        maintenance_date: maintenanceDate,
        maintenance_type: maintenanceType,
        supplier_id: supplierId || undefined,
        cost,
        description,
        invoice_number: invoiceNumber || undefined,
        next_maintenance_date: nextDate || undefined,
        is_capitalized: isCapitalized,
        credit_account_id: creditAccountId || undefined
      });
      showSuccess(isCapitalized ? 'تم تسجيل الصيانة المرسملة وزيادة تكلفة الأصل بنجاح' : 'تم تسجيل عملية الصيانة بنجاح');
      onSuccess();
      onClose();
    } catch (e: any) {
      showError(e.message || 'فشل تسجيل الصيانة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-purple-400 font-bold">
            <Wrench className="w-5 h-5" />
            <h3>تسجيل صيانة للأصل الثابت</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleMaintenance} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">تاريخ الصيانة *</label>
              <input
                type="date"
                required
                value={maintenanceDate}
                onChange={e => setMaintenanceDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">نوع الصيانة *</label>
              <select
                value={maintenanceType}
                onChange={e => setMaintenanceType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
              >
                <option value="دورية">صيانة دورية</option>
                <option value="وقائية">صيانة وقائية</option>
                <option value="طارئة">إصلاح طارئ</option>
                <option value="تجديد وعمرة">عمرة شاملة / تجديد</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">تكلفة الصيانة *</label>
              <input
                type="number"
                step="0.01"
                required
                value={cost || ''}
                onChange={e => setCost(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">رقم الفاتورة</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="INV-987"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-800/80 border border-purple-500/20 rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-white font-semibold">
              <input
                type="checkbox"
                checked={isCapitalized}
                onChange={e => setIsCapitalized(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700"
              />
              صيانة مرسملة (تزيد من القيمة الدفترية للأصل)
            </label>
            <p className="text-[11px] text-slate-400">
              إذا كانت الصيانة عمرة جوهرية تزيد من العمر الإنتاجي أو كفاءة الأصل، تضاف التكلفة إلى التكلفة المرسملة للأصل ويتم توليد قيد رأسمالي.
            </p>
          </div>

          {isCapitalized && (
            <div>
              <label className="block text-slate-300 mb-1">حساب السداد / المورد (الدائن)</label>
              <select
                value={creditAccountId}
                onChange={e => setCreditAccountId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
              >
                <option value="">-- اختر حساب السداد --</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-slate-300 mb-1">ملاحظات ووصف الصيانة</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="الأعمال التي تمت وقطع الغيار المركبة..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all disabled:opacity-50"
            >
              {submitting ? 'جاري الحفظ...' : 'تسجيل الصيانة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// 4. ASSET REVALUATION MODAL
// ========================================================
export const AssetRevaluationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: FixedAsset | null;
}> = ({ isOpen, onClose, onSuccess, asset }) => {
  const { showSuccess, showError } = useNotification();
  const [revalDate, setRevalDate] = useState(new Date().toISOString().slice(0, 10));
  const [newValue, setNewValue] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !asset) return null;

  const oldVal = Number(asset.net_book_value) || 0;
  const diff = Number((newValue - oldVal).toFixed(2));

  const handleRevalue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newValue < 0) {
      showError('القيمة لا يمكن أن تكون سالبة');
      return;
    }
    setSubmitting(true);
    try {
      await fixedAssetService.revalueAsset(asset.id, {
        revaluation_date: revalDate,
        new_value: newValue,
        reason
      });
      showSuccess('تمت إعادة تقييم الأصل وتحديث قيمته بنجاح');
      onSuccess();
      onClose();
    } catch (e: any) {
      showError(e.message || 'فشل إعادة التقييم');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <TrendingUp className="w-5 h-5" />
            <h3>إعادة تقييم الأصل الثابت</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleRevalue} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-800/60 rounded-xl space-y-1">
            <p className="text-slate-400">الأصل: <strong className="text-white">{asset.name}</strong></p>
            <p className="text-slate-400">صافي القيمة الدفترية الحالية: <strong className="text-blue-400">{oldVal.toLocaleString()} EGP</strong></p>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">تاريخ إعادة التقييم *</label>
            <input
              type="date"
              required
              value={revalDate}
              onChange={e => setRevalDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">القيمة السوقية/الدفترية الجديدة المقدرة *</label>
            <input
              type="number"
              step="0.01"
              required
              value={newValue || ''}
              onChange={e => setNewValue(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-bold text-base"
            />
          </div>

          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex justify-between items-center">
            <span className="text-slate-400">فارق التقييم:</span>
            <span className={`font-extrabold text-sm ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()} EGP
            </span>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">سبب التقييم ومستند التقدير</label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="تقرير خبير مثمن معتمد / ارتفاع القيمة السوقية..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition-all disabled:opacity-50"
            >
              {submitting ? 'جاري الحفظ...' : 'اعتماد التقييم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// 5. ASSET DISPOSAL / SALE MODAL (with Real-time Gain/Loss)
// ========================================================
export const AssetDisposalModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: FixedAsset | null;
  accounts: any[];
}> = ({ isOpen, onClose, onSuccess, asset, accounts }) => {
  const { showSuccess, showError } = useNotification();
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().slice(0, 10));
  const [disposalType, setDisposalType] = useState<'SALE' | 'SCRAP' | 'WRITE_OFF' | 'DONATION'>('SALE');
  const [proceeds, setProceeds] = useState<number>(0);
  const [buyerName, setBuyerName] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !asset) return null;

  const origCost = Number(asset.capitalized_cost) || 0;
  const accDepr = Number(asset.accumulated_depreciation) || 0;
  const nbv = Number(asset.net_book_value) || Math.max(0, origCost - accDepr);
  const gainLoss = Number((proceeds - nbv).toFixed(2));

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disposalType === 'SALE' && proceeds < 0) {
      showError('سعر البيع لا يمكن أن يكون سالباً');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fixedAssetService.disposeAsset(asset.id, {
        disposal_date: disposalDate,
        disposal_type: disposalType,
        disposal_proceeds: proceeds,
        buyer_name: buyerName || undefined,
        payment_account_id: paymentAccountId || undefined,
        invoice_number: invoiceNumber || undefined,
        notes
      });
      showSuccess(res.message || 'تم استبعاد الأصل وتوليد القيد المحاسبي بنجاح');
      onSuccess();
      onClose();
    } catch (e: any) {
      showError(e.message || 'فشل استبعاد الأصل');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-rose-400 font-bold">
            <AlertTriangle className="w-5 h-5" />
            <h3>استبعاد أو بيع أصل ثابت</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Asset summary */}
        <div className="p-3 bg-slate-800/60 rounded-xl text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">الأصل:</span>
            <span className="font-bold text-white">{asset.name} ({asset.asset_number})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">التكلفة التاريخية:</span>
            <span className="font-mono text-white">{origCost.toLocaleString()} EGP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">مجمع الإهلاك:</span>
            <span className="font-mono text-amber-400">{accDepr.toLocaleString()} EGP</span>
          </div>
          <div className="flex justify-between border-t border-slate-700 pt-1 font-bold">
            <span className="text-slate-300">صافي القيمة الدفترية (NBV):</span>
            <span className="font-mono text-emerald-400">{nbv.toLocaleString()} EGP</span>
          </div>
        </div>

        <form onSubmit={handleDispose} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">نوع الاستبعاد *</label>
              <select
                value={disposalType}
                onChange={e => {
                  const val = e.target.value as any;
                  setDisposalType(val);
                  if (val !== 'SALE') setProceeds(0);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-bold"
              >
                <option value="SALE">بيع أصل (Sale)</option>
                <option value="SCRAP">تخريد (Scrap)</option>
                <option value="WRITE_OFF">إعدام دفتري (Write-off)</option>
                <option value="DONATION">تبرع أو تنازل (Donation)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1">تاريخ الاستبعاد *</label>
              <input
                type="date"
                required
                value={disposalDate}
                onChange={e => setDisposalDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
              />
            </div>
          </div>

          {disposalType === 'SALE' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">سعر البيع / المتحصلات *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={proceeds || ''}
                    onChange={e => setProceeds(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-black text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">المشتري / الجهة</label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={e => setBuyerName(e.target.value)}
                    placeholder="اسم المشتري"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">حساب التحصيل (الخزينة أو البنك)</label>
                <select
                  value={paymentAccountId}
                  onChange={e => setPaymentAccountId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
                >
                  <option value="">-- اختر الحساب الدائن لتحصيل المبلغ --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* REAL-TIME GAIN / LOSS PREVIEW */}
          <div className={`p-3 rounded-xl border flex justify-between items-center ${
            gainLoss >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
          }`}>
            <div>
              <span className="text-[11px] block text-slate-400">النتيجة الرأسمالية المحاسبية:</span>
              <strong className={`text-xs ${gainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {gainLoss >= 0 ? 'أرباح بيع أصل ثابت (Capital Gain)' : 'خسائر بيع/استبعاد أصل (Capital Loss)'}
              </strong>
            </div>
            <span className={`text-base font-black font-mono ${gainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {gainLoss >= 0 ? `+${gainLoss.toLocaleString()}` : gainLoss.toLocaleString()} EGP
            </span>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">ملاحظات وقرار الاستبعاد</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="رقم قرار الاستبعاد / تقرير اللجنة الفنية..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold transition-all disabled:opacity-50"
            >
              {submitting ? 'جاري الاستبعاد...' : 'تأكيد الاستبعاد وتوليد القيد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
