import React, { useState } from 'react';
import { Plus, Edit3, Trash2, Tag, Layers, CheckCircle2, XCircle, Search, X } from 'lucide-react';
import { AssetCategory } from '../../types/fixedAssets';
import { fixedAssetService } from '../../services/fixedAssetService';
import { useNotification } from '../../contexts/NotificationContext';

interface AssetCategoriesTabProps {
  categories: AssetCategory[];
  onRefresh: () => void;
  accounts: any[];
}

export const AssetCategoriesTab: React.FC<AssetCategoriesTabProps> = ({
  categories,
  onRefresh,
  accounts
}) => {
  const { showSuccess, showError } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);

  const [formData, setFormData] = useState<Partial<AssetCategory>>({
    code: '',
    name: '',
    name_en: '',
    parent_id: '',
    description: '',
    asset_account_id: '',
    accumulated_depreciation_account_id: '',
    depreciation_expense_account_id: '',
    gain_account_id: '',
    loss_account_id: '',
    default_depreciation_method: 'STRAIGHT_LINE',
    default_useful_life: 5,
    default_salvage_value: 0,
    is_active: true
  });

  const [submitting, setSubmitting] = useState(false);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({
      code: `CAT-${(categories.length + 1).toString().padStart(2, '0')}`,
      name: '',
      name_en: '',
      parent_id: '',
      description: '',
      asset_account_id: '',
      accumulated_depreciation_account_id: '',
      depreciation_expense_account_id: '',
      gain_account_id: '',
      loss_account_id: '',
      default_depreciation_method: 'STRAIGHT_LINE',
      default_useful_life: 5,
      default_salvage_value: 0,
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: AssetCategory) => {
    setEditingCategory(cat);
    setFormData({ ...cat });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا التصنيف؟')) return;
    try {
      await fixedAssetService.deleteCategory(id);
      showSuccess('تم حذف التصنيف بنجاح');
      onRefresh();
    } catch (e: any) {
      showError(e.message || 'فشل حذف التصنيف');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.code?.trim()) {
      showError('كود واسم التصنيف مطلوبان');
      return;
    }
    setSubmitting(true);
    try {
      await fixedAssetService.saveCategory({
        ...formData,
        id: editingCategory?.id
      });
      showSuccess(editingCategory ? 'تم تحديث التصنيف بنجاح' : 'تم إنشاء التصنيف بنجاح');
      setIsModalOpen(false);
      onRefresh();
    } catch (e: any) {
      showError(e.message || 'فشل حفظ التصنيف');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header and Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث في التصنيفات..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          إضافة تصنيف أصول جديد
        </button>
      </div>

      {/* Categories Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/60">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-800">
            <tr>
              <th className="p-3">الكود</th>
              <th className="p-3">اسم التصنيف</th>
              <th className="p-3">التصنيف الأب</th>
              <th className="p-3">طريقة الإهلاك الافتراضية</th>
              <th className="p-3">العمر الافتراضي</th>
              <th className="p-3">حساب الأصل</th>
              <th className="p-3">حساب مجمع الإهلاك</th>
              <th className="p-3 text-center">الحالة</th>
              <th className="p-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-500">
                  لا توجد تصنيفات مطابقة للبحث.
                </td>
              </tr>
            ) : (
              filtered.map(cat => (
                <tr key={cat.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-white">{cat.code}</td>
                  <td className="p-3 font-semibold text-slate-200">
                    {cat.name}
                    {cat.name_en && <span className="block text-[10px] text-slate-400">{cat.name_en}</span>}
                  </td>
                  <td className="p-3 text-slate-400">{cat.parent_name || '--- (تصنيف رئيسي)'}</td>
                  <td className="p-3 text-blue-400 font-medium">
                    {cat.default_depreciation_method === 'STRAIGHT_LINE' ? 'القسط الثابت' : cat.default_depreciation_method}
                  </td>
                  <td className="p-3 font-mono">{cat.default_useful_life} سنوات</td>
                  <td className="p-3 text-slate-300">{cat.asset_account_name || '---'}</td>
                  <td className="p-3 text-slate-300">{cat.accumulated_depreciation_account_name || '---'}</td>
                  <td className="p-3 text-center">
                    {cat.is_active ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-bold">نشط</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full text-[10px]">معطل</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Category Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingCategory ? 'تعديل تصنيف الأصل' : 'إضافة تصنيف أصل جديد'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">كود التصنيف *</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">التصنيف الأب (للهيكل الشجري)</label>
                  <select
                    value={formData.parent_id || ''}
                    onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="">-- تصنيف رئيسي (بدون أب) --</option>
                    {categories.filter(c => c.id !== editingCategory?.id).map(c => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">اسم التصنيف بالعربي *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">اسم التصنيف بالإنجليزي</label>
                  <input
                    type="text"
                    value={formData.name_en || ''}
                    onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">طريقة الإهلاك الافتراضية</label>
                  <select
                    value={formData.default_depreciation_method || 'STRAIGHT_LINE'}
                    onChange={e => setFormData({ ...formData, default_depreciation_method: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="STRAIGHT_LINE">القسط الثابت (Straight Line)</option>
                    <option value="DECLINING_BALANCE">الرصيد المتناقص (Declining Balance)</option>
                    <option value="DOUBLE_DECLINING">الرصيد المتناقص المزدوج</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">العمر الافتراضي (سنوات)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.default_useful_life || ''}
                    onChange={e => setFormData({ ...formData, default_useful_life: parseFloat(e.target.value) || 5 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">القيمة التخريدية الافتراضية</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.default_salvage_value || ''}
                    onChange={e => setFormData({ ...formData, default_salvage_value: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              {/* Accounting Accounts defaults */}
              <div className="border-t border-slate-800 pt-3 space-y-3">
                <h4 className="font-bold text-slate-300 text-xs">الحسابات الافتراضية التلقائية للأصول التابعة</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">حساب الأصل</label>
                    <select
                      value={formData.asset_account_id || ''}
                      onChange={e => setFormData({ ...formData, asset_account_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs"
                    >
                      <option value="">-- اختر الحساب --</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">حساب مجمع الإهلاك</label>
                    <select
                      value={formData.accumulated_depreciation_account_id || ''}
                      onChange={e => setFormData({ ...formData, accumulated_depreciation_account_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs"
                    >
                      <option value="">-- اختر الحساب --</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">حساب مصروف الإهلاك</label>
                    <select
                      value={formData.depreciation_expense_account_id || ''}
                      onChange={e => setFormData({ ...formData, depreciation_expense_account_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs"
                    >
                      <option value="">-- اختر الحساب --</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ التصنيف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
