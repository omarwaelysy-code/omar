import {
  AssetCategory,
  FixedAsset,
  AssetDepreciationRun,
  AssetDepreciationItem,
  AssetTransfer,
  AssetMaintenance,
  AssetRevaluation,
  AssetDisposal,
  AssetDashboardStats,
  DepreciationScheduleItem
} from '../types/fixedAssets';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const authUserStr = localStorage.getItem('auth_user');
  let companyId = localStorage.getItem('active_company_id') || '';
  if (!companyId && authUserStr) {
    try {
      const parsed = JSON.parse(authUserStr);
      companyId = parsed.company_id || '';
    } catch (e) {}
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (companyId) headers['x-company-id'] = companyId;
  return headers;
}

export const fixedAssetService = {
  // 1. Dashboard
  async getDashboardStats(): Promise<AssetDashboardStats> {
    const res = await fetch('/api/erp/fixed-assets/dashboard', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('فشل جلب إحصائيات لوحة التحكم للأصول');
    return res.json();
  },

  // 2. Categories
  async getCategories(): Promise<AssetCategory[]> {
    const res = await fetch('/api/erp/fixed-assets/categories', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('فشل جلب تصنيفات الأصول');
    return res.json();
  },

  async saveCategory(data: Partial<AssetCategory>): Promise<AssetCategory> {
    const isEdit = !!data.id;
    const url = isEdit ? `/api/erp/fixed-assets/categories/${data.id}` : '/api/erp/fixed-assets/categories';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل حفظ تصنيف الأصل');
    }
    return res.json();
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await fetch(`/api/erp/fixed-assets/categories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل حذف التصنيف');
    }
  },

  // 3. Fixed Assets Register
  async listAssets(params?: {
    category_id?: string;
    warehouse_id?: string;
    department_id?: string;
    cost_center_id?: string;
    custodian_id?: string;
    status?: string;
    search?: string;
  }): Promise<FixedAsset[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) query.append(k, String(v));
      });
    }
    const res = await fetch(`/api/erp/fixed-assets?${query.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('فشل جلب قائمة الأصول الثابتة');
    return res.json();
  },

  async getAsset(id: string): Promise<FixedAsset> {
    const res = await fetch(`/api/erp/fixed-assets/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('فشل جلب تفاصيل الأصل');
    return res.json();
  },

  async getNextAssetNumber(): Promise<string> {
    const res = await fetch('/api/erp/fixed-assets/next-number', { headers: getAuthHeaders() });
    if (!res.ok) return 'AST-000001';
    const data = await res.json();
    return data.asset_number || 'AST-000001';
  },

  async saveAsset(data: Partial<FixedAsset>): Promise<FixedAsset> {
    const isEdit = !!data.id;
    const url = isEdit ? `/api/erp/fixed-assets/${data.id}` : '/api/erp/fixed-assets';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل حفظ بيانات الأصل');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'fixed_assets' } }));
    return res.json();
  },

  async deleteAsset(id: string): Promise<void> {
    const res = await fetch(`/api/erp/fixed-assets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل حذف الأصل');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'fixed_assets' } }));
  },

  // 4. Capitalization
  async capitalizeAsset(id: string, payload: {
    capitalization_date: string;
    depreciation_start_date?: string;
    credit_account_id?: string; // e.g. supplier or cash account if not from purchase invoice
    notes?: string;
  }): Promise<{ success: boolean; journal_entry_id?: string; message: string }> {
    const res = await fetch(`/api/erp/fixed-assets/${id}/capitalize`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل رسملة واعتماد الأصل');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'fixed_assets' } }));
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
    return res.json();
  },

  // 5. Centralized Depreciation Run
  async previewDepreciation(payload: {
    from_date: string;
    to_date: string;
    period_name: string;
  }): Promise<{
    count: number;
    total_depreciation: number;
    items: Array<{
      asset_id: string;
      asset_number: string;
      asset_name: string;
      category_name: string;
      opening_nbv: number;
      depreciation_amount: number;
      accumulated_depreciation: number;
      closing_nbv: number;
    }>;
  }> {
    const res = await fetch('/api/erp/fixed-assets/depreciation/preview', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل حساب معاينة الإهلاك');
    }
    return res.json();
  },

  async runDepreciation(payload: {
    from_date: string;
    to_date: string;
    period_name: string;
    notes?: string;
  }): Promise<{ success: boolean; run_id: string; journal_entry_id?: string; message: string }> {
    const res = await fetch('/api/erp/fixed-assets/depreciation/run', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل تشغيل وترحيل الإهلاك');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'fixed_assets' } }));
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
    return res.json();
  },

  async getDepreciationRuns(): Promise<AssetDepreciationRun[]> {
    const res = await fetch('/api/erp/fixed-assets/depreciation/runs', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('فشل جلب سجل دورات الإهلاك');
    return res.json();
  },

  // 6. Transfer / Custody
  async transferAsset(id: string, payload: {
    transfer_date: string;
    to_warehouse_id?: string | null;
    to_department_id?: string | null;
    to_cost_center_id?: string | null;
    to_custodian_id?: string | null;
    to_location?: string | null;
    reason?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/erp/fixed-assets/${id}/transfer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل تسجيل حركة نقل الأصل');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'fixed_assets' } }));
    return res.json();
  },

  // 7. Maintenance
  async recordMaintenance(id: string, payload: {
    maintenance_date: string;
    maintenance_type: string;
    supplier_id?: string | null;
    cost: number;
    description?: string;
    invoice_number?: string;
    next_maintenance_date?: string;
    is_capitalized: boolean;
    credit_account_id?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/erp/fixed-assets/${id}/maintenance`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل تسجيل صيانة الأصل');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'fixed_assets' } }));
    return res.json();
  },

  // 8. Revaluation
  async revalueAsset(id: string, payload: {
    revaluation_date: string;
    new_value: number;
    reason?: string;
    counter_account_id?: string;
  }): Promise<{ success: boolean; difference: number; message: string }> {
    const res = await fetch(`/api/erp/fixed-assets/${id}/revalue`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل إعادة تقييم الأصل');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'fixed_assets' } }));
    return res.json();
  },

  // 9. Disposal & Sale
  async disposeAsset(id: string, payload: {
    disposal_date: string;
    disposal_type: 'SALE' | 'SCRAP' | 'WRITE_OFF' | 'DONATION' | 'OTHER';
    disposal_proceeds: number;
    buyer_name?: string;
    customer_id?: string;
    payment_account_id?: string;
    invoice_number?: string;
    notes?: string;
  }): Promise<{ success: boolean; gain_loss_amount: number; journal_entry_id?: string; message: string }> {
    const res = await fetch(`/api/erp/fixed-assets/${id}/dispose`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'فشل استبعاد/بيع الأصل');
    }
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'fixed_assets' } }));
    window.dispatchEvent(new CustomEvent('db-refresh', { detail: { collection: 'journal_entries' } }));
    return res.json();
  },

  // 10. Schedule & History
  async getDepreciationSchedule(id: string): Promise<DepreciationScheduleItem[]> {
    const res = await fetch(`/api/erp/fixed-assets/${id}/schedule`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('فشل جلب جدول الإهلاك للأصل');
    return res.json();
  },

  async getAssetHistory(id: string): Promise<{
    asset: FixedAsset;
    transfers: AssetTransfer[];
    maintenance: AssetMaintenance[];
    revaluations: AssetRevaluation[];
    depreciations: AssetDepreciationItem[];
    disposal: AssetDisposal | null;
  }> {
    const res = await fetch(`/api/erp/fixed-assets/${id}/history`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('فشل جلب سجل الحركات التاريخية للأصل');
    return res.json();
  },

  // 11. Reports
  async getReport(reportType: string, params?: Record<string, any>): Promise<any[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
      });
    }
    const res = await fetch(`/api/erp/fixed-assets/reports/${reportType}?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`فشل جلب بيانات التقرير: ${reportType}`);
    return res.json();
  }
};
