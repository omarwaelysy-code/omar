import { apiRequest } from './dbService';
import { Account } from '../types';

export interface DefaultAccountItem {
  id: string; // key
  key: string;
  defaultCode: string;
  nameAr: string;
  nameEn: string;
  classificationAr: string;
  accountUsage: string;
  targetScreen: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  isCustom?: boolean;
}

export const DEFAULT_ACCOUNTS_CONFIG: Omit<DefaultAccountItem, 'id' | 'accountId' | 'accountCode' | 'accountName' | 'isCustom'>[] = [
  {
    key: 'main_cash',
    defaultCode: '110101',
    nameAr: 'الصندوق الرئيسي',
    nameEn: 'Main Cash',
    classificationAr: 'الميزانية / أصول متداولة',
    accountUsage: 'cash',
    targetScreen: 'شاشة طرق الدفع والخزائن'
  },
  {
    key: 'bank',
    defaultCode: '110103',
    nameAr: 'البنك',
    nameEn: 'Bank',
    classificationAr: 'الميزانية / أصول متداولة',
    accountUsage: 'bank',
    targetScreen: 'شاشة طرق الدفع والبنوك'
  },
  {
    key: 'customer',
    defaultCode: '110201',
    nameAr: 'العملاء',
    nameEn: 'Accounts Receivable',
    classificationAr: 'الميزانية / أصول متداولة',
    accountUsage: 'customer',
    targetScreen: 'شاشة البيانات الأساسية للعملاء'
  },
  {
    key: 'inventory',
    defaultCode: '110301',
    nameAr: 'مخزون بضاعة',
    nameEn: 'Goods Inventory',
    classificationAr: 'الميزانية / أصول متداولة',
    accountUsage: 'inventory',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'input_vat',
    defaultCode: '110402',
    nameAr: 'ضريبة القيمة المضافة - مدخلات',
    nameEn: 'Input VAT',
    classificationAr: 'الميزانية / أصول متداولة',
    accountUsage: 'vat',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'withholding_tax_customers',
    defaultCode: '110403',
    nameAr: 'ضرائب خصم من العملاء (أ.ت.ص)',
    nameEn: 'Tax Withheld by Customers',
    classificationAr: 'الميزانية / أصول متداولة',
    accountUsage: 'withholding_tax_customers',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'supplier',
    defaultCode: '210101',
    nameAr: 'الموردون',
    nameEn: 'Accounts Payable',
    classificationAr: 'الميزانية / التزامات متداولة',
    accountUsage: 'supplier',
    targetScreen: 'شاشة البيانات الأساسية للموردين'
  },
  {
    key: 'output_vat',
    defaultCode: '210202',
    nameAr: 'ضريبة القيمة المضافة - مخرجات',
    nameEn: 'Output VAT',
    classificationAr: 'الميزانية / التزامات متداولة',
    accountUsage: 'vat',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'withholding_tax_suppliers',
    defaultCode: '210203',
    nameAr: 'ضرائب خصم على الموردين (أ.ت.ص)',
    nameEn: 'Tax Withheld for Suppliers',
    classificationAr: 'الميزانية / التزامات متداولة',
    accountUsage: 'withholding_tax_suppliers',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'capital',
    defaultCode: '3101',
    nameAr: 'رأس المال',
    nameEn: 'Capital',
    classificationAr: 'الميزانية / حقوق ملكية',
    accountUsage: 'capital',
    targetScreen: 'شاشة إعدادات الشركة'
  },
  {
    key: 'retained_earnings',
    defaultCode: '3103',
    nameAr: 'أرباح مبقاة (مرحلة)',
    nameEn: 'Retained Earnings',
    classificationAr: 'الميزانية / حقوق ملكية',
    accountUsage: 'retained_earnings',
    targetScreen: 'شاشة إعدادات الحسابات الافتراضية'
  },
  {
    key: 'opening_balance',
    defaultCode: '3104',
    nameAr: 'رصيد افتتاحي (وسيط الافتتاح)',
    nameEn: 'Opening Balance Equity',
    classificationAr: 'الميزانية / حقوق ملكية',
    accountUsage: 'opening_balance',
    targetScreen: 'شاشة الأرصدة الافتتاحية'
  },
  {
    key: 'sales_revenue',
    defaultCode: '4101',
    nameAr: 'إيرادات مبيعات بضاعة',
    nameEn: 'Sales Revenue',
    classificationAr: 'قائمة الدخل / إيرادات',
    accountUsage: 'sales_revenue',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'sales_returns',
    defaultCode: '4103',
    nameAr: 'مردودات مبيعات',
    nameEn: 'Sales Returns',
    classificationAr: 'قائمة الدخل / إيرادات',
    accountUsage: 'sales_returns',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'customer_discount',
    defaultCode: '4104',
    nameAr: 'خصم مسموح به (خصم عملاء)',
    nameEn: 'Sales / Customer Discount',
    classificationAr: 'قائمة الدخل / إيرادات',
    accountUsage: 'earned_discounts',
    targetScreen: 'شاشة إعدادات الخصم'
  },
  {
    key: 'cost_of_sales',
    defaultCode: '5101',
    nameAr: 'تكلفة البضاعة المباعة',
    nameEn: 'Cost of Goods Sold (COGS)',
    classificationAr: 'قائمة الدخل / تكاليف',
    accountUsage: 'cost_of_sales',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'purchases',
    defaultCode: '5103',
    nameAr: 'المشتريات',
    nameEn: 'Purchases',
    classificationAr: 'قائمة الدخل / تكاليف',
    accountUsage: 'purchases',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'purchase_returns',
    defaultCode: '5104',
    nameAr: 'مردودات مشتريات',
    nameEn: 'Purchase Returns',
    classificationAr: 'قائمة الدخل / تكاليف',
    accountUsage: 'purchase_returns',
    targetScreen: 'شاشة بطاقة الصنف'
  },
  {
    key: 'supplier_discount',
    defaultCode: '5105',
    nameAr: 'خصم مكتسب (خصم موردين)',
    nameEn: 'Purchase / Supplier Discount',
    classificationAr: 'قائمة الدخل / تكاليف',
    accountUsage: 'granted_discounts',
    targetScreen: 'شاشة إعدادات الخصم'
  },
  {
    key: 'realized_forex_gain',
    defaultCode: '420201',
    nameAr: 'أرباح فروق عملة محققة',
    nameEn: 'Realized Forex Gain',
    classificationAr: 'قائمة الدخل / إيرادات أخرى',
    accountUsage: 'realized_forex_gain',
    targetScreen: 'شاشة إعدادات الحسابات الافتراضية'
  },
  {
    key: 'realized_forex_loss',
    defaultCode: '630201',
    nameAr: 'خسائر فروق عملة محققة',
    nameEn: 'Realized Forex Loss',
    classificationAr: 'قائمة الدخل / مصروفات مالية',
    accountUsage: 'realized_forex_loss',
    targetScreen: 'شاشة إعدادات الحسابات الافتراضية'
  },
  {
    key: 'unrealized_forex_gain',
    defaultCode: '420202',
    nameAr: 'أرباح فروق عملة غير محققة',
    nameEn: 'Unrealized Forex Gain',
    classificationAr: 'قائمة الدخل / إيرادات أخرى',
    accountUsage: 'unrealized_forex_gain',
    targetScreen: 'شاشة إعدادات الحسابات الافتراضية'
  },
  {
    key: 'unrealized_forex_loss',
    defaultCode: '630202',
    nameAr: 'خسائر فروق عملة غير محققة',
    nameEn: 'Unrealized Forex Loss',
    classificationAr: 'قائمة الدخل / مصروفات مالية',
    accountUsage: 'unrealized_forex_loss',
    targetScreen: 'شاشة إعدادات الحسابات الافتراضية'
  }
];

export const defaultAccountsService = {
  async getDefaultAccounts(): Promise<{ mappings: Record<string, string>; accounts: DefaultAccountItem[] }> {
    try {
      const res = await apiRequest<{ success: boolean; mappings: Record<string, string>; accounts: DefaultAccountItem[] }>('/default-accounts');
      if (res && res.success) {
        return { mappings: res.mappings, accounts: res.accounts };
      }
    } catch (err) {
      console.error('Failed to fetch default accounts:', err);
    }
    return { mappings: {}, accounts: [] };
  },

  async updateDefaultAccount(key: string, accountId: string): Promise<boolean> {
    const res = await apiRequest<{ success: boolean; message?: string }>('/default-accounts', 'PUT', { key, accountId });
    return !!(res && res.success);
  },

  async saveAllDefaultAccounts(mappings: Record<string, string>): Promise<boolean> {
    const res = await apiRequest<{ success: boolean; message?: string }>('/default-accounts/bulk', 'PUT', { mappings });
    return !!(res && res.success);
  },

  async checkAndMergeDefaultAccounts(): Promise<{ success: boolean; message: string; addedAccounts: number }> {
    const res = await apiRequest<{ success: boolean; message: string; addedAccounts: number }>('/default-accounts/merge', 'POST');
    return res;
  }
};
