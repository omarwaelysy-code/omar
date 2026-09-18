export type AssetStatus = 
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'FULLY_DEPRECIATED'
  | 'UNDER_MAINTENANCE'
  | 'DISPOSED'
  | 'SOLD'
  | 'SCRAPPED'
  | 'SUSPENDED';

export type DepreciationMethod = 
  | 'STRAIGHT_LINE'
  | 'DECLINING_BALANCE'
  | 'DOUBLE_DECLINING'
  | 'UNITS_OF_PRODUCTION';

export interface AssetCategory {
  id: string;
  company_id: string;
  parent_id?: string | null;
  parent_name?: string | null;
  code: string;
  name: string;
  name_en?: string | null;
  description?: string | null;
  asset_account_id?: string | null;
  asset_account_name?: string | null;
  accumulated_depreciation_account_id?: string | null;
  accumulated_depreciation_account_name?: string | null;
  depreciation_expense_account_id?: string | null;
  depreciation_expense_account_name?: string | null;
  gain_account_id?: string | null;
  gain_account_name?: string | null;
  loss_account_id?: string | null;
  loss_account_name?: string | null;
  default_depreciation_method: DepreciationMethod;
  default_useful_life: number;
  default_salvage_value: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AssetComponent {
  id?: string;
  asset_id?: string;
  name: string;
  serial_number?: string;
  cost: number;
  useful_life?: number;
  depreciation_method?: DepreciationMethod;
  depreciation_start_date?: string;
  status?: string;
}

export interface FixedAsset {
  id: string;
  company_id: string;
  asset_number: string;
  name: string;
  name_ar?: string | null;
  name_en?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  category_code?: string | null;
  description?: string | null;
  serial_number?: string | null;
  barcode?: string | null;
  manufacturer?: string | null;
  model?: string | null;

  acquisition_date: string;
  capitalization_date?: string | null;
  depreciation_start_date?: string | null;
  last_depreciation_date?: string | null;

  acquisition_cost: number;
  additional_cost: number;
  capitalized_cost: number;
  salvage_value: number;

  useful_life: number;
  useful_life_unit: 'YEARS' | 'MONTHS';
  depreciation_method: DepreciationMethod;

  accumulated_depreciation: number;
  net_book_value: number;

  warehouse_id?: string | null;
  warehouse_name?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  cost_center_id?: string | null;
  cost_center_name?: string | null;
  location_name?: string | null;
  custodian_id?: string | null;
  custodian_name?: string | null;
  custody_date?: string | null;

  supplier_id?: string | null;
  supplier_name?: string | null;
  purchase_invoice_id?: string | null;
  purchase_invoice_number?: string | null;
  purchase_order_number?: string | null;
  invoice_date?: string | null;

  asset_account_id?: string | null;
  asset_account_name?: string | null;
  accumulated_depreciation_account_id?: string | null;
  accumulated_depreciation_account_name?: string | null;
  depreciation_expense_account_id?: string | null;
  depreciation_expense_account_name?: string | null;
  gain_account_id?: string | null;
  gain_account_name?: string | null;
  loss_account_id?: string | null;
  loss_account_name?: string | null;

  status: AssetStatus;
  capitalization_journal_entry_id?: string | null;
  capitalization_journal_entry_number?: string | null;
  disposal_journal_entry_id?: string | null;
  disposal_journal_entry_number?: string | null;
  attachments?: any[];
  components?: AssetComponent[];
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AssetDepreciationRun {
  id: string;
  company_id: string;
  run_number: string;
  period_name: string;
  from_date: string;
  to_date: string;
  total_assets: number;
  total_depreciation: number;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  journal_entry_id?: string | null;
  journal_entry_number?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
  items?: AssetDepreciationItem[];
}

export interface AssetDepreciationItem {
  id: string;
  run_id: string;
  asset_id: string;
  asset_number?: string;
  asset_name?: string;
  category_name?: string;
  opening_nbv: number;
  depreciation_amount: number;
  accumulated_depreciation: number;
  closing_nbv: number;
  journal_entry_id?: string | null;
  created_at?: string;
}

export interface AssetTransfer {
  id: string;
  company_id: string;
  asset_id: string;
  asset_number?: string;
  asset_name?: string;
  transfer_date: string;
  from_warehouse_id?: string | null;
  from_warehouse_name?: string | null;
  to_warehouse_id?: string | null;
  to_warehouse_name?: string | null;
  from_department_id?: string | null;
  from_department_name?: string | null;
  to_department_id?: string | null;
  to_department_name?: string | null;
  from_cost_center_id?: string | null;
  from_cost_center_name?: string | null;
  to_cost_center_id?: string | null;
  to_cost_center_name?: string | null;
  from_custodian_id?: string | null;
  from_custodian_name?: string | null;
  to_custodian_id?: string | null;
  to_custodian_name?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface AssetMaintenance {
  id: string;
  company_id: string;
  asset_id: string;
  asset_number?: string;
  asset_name?: string;
  maintenance_date: string;
  maintenance_type: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  cost: number;
  description?: string | null;
  invoice_number?: string | null;
  next_maintenance_date?: string | null;
  is_capitalized: boolean;
  journal_entry_id?: string | null;
  journal_entry_number?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface AssetRevaluation {
  id: string;
  company_id: string;
  asset_id: string;
  asset_number?: string;
  asset_name?: string;
  revaluation_date: string;
  old_value: number;
  new_value: number;
  difference: number;
  reason?: string | null;
  journal_entry_id?: string | null;
  journal_entry_number?: string | null;
  status: string;
  created_by?: string | null;
  created_at?: string;
}

export interface AssetDisposal {
  id: string;
  company_id: string;
  asset_id: string;
  asset_number?: string;
  asset_name?: string;
  disposal_date: string;
  disposal_type: 'SALE' | 'SCRAP' | 'WRITE_OFF' | 'DONATION' | 'OTHER';
  original_cost: number;
  accumulated_depreciation: number;
  net_book_value: number;
  disposal_proceeds: number;
  gain_loss_amount: number;
  buyer_name?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  payment_account_id?: string | null;
  payment_account_name?: string | null;
  invoice_number?: string | null;
  journal_entry_id?: string | null;
  journal_entry_number?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface AssetDashboardStats {
  total_assets: number;
  total_acquisition_cost: number;
  total_accumulated_depreciation: number;
  total_net_book_value: number;
  fully_depreciated_count: number;
  under_maintenance_count: number;
  disposed_count: number;
  added_this_month_count: number;
  depreciation_this_month: number;
  category_distribution: Array<{ category_name: string; count: number; total_cost: number; total_nbv: number }>;
  warehouse_distribution: Array<{ warehouse_name: string; count: number; total_cost: number }>;
  department_distribution: Array<{ department_name: string; count: number; total_cost: number }>;
  monthly_depreciation_trend: Array<{ month: string; amount: number }>;
}

export interface DepreciationScheduleItem {
  period: string; // e.g. "2026-01"
  period_name: string; // e.g. "يناير 2026"
  opening_nbv: number;
  depreciation: number;
  accumulated_depreciation: number;
  closing_nbv: number;
  is_posted: boolean;
}
