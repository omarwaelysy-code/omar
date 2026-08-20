export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  [key: string]: boolean;
}

export interface UserPermissions {
  [moduleId: string]: ModulePermissions;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  created_at: string;
  read_at?: string;
  handled_by?: string;
  notes?: string;
}

export interface User {
  id: string;
  username: string;
  name?: string;
  role: 'super_admin' | 'admin' | 'user' | 'manager' | 'auditor';
  mobile?: string;
  email?: string;
  company_id: string;
  company_name?: string;
  permissions?: UserPermissions;
  role_ids?: string[];
  manual_permissions?: UserPermissions;
  status: 'active' | 'inactive';
  must_change_password?: boolean;
  temp_password?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource: string;
  resource_id?: string;
  changes?: {
    before: any;
    after: any;
  };
  severity: 'info' | 'warning' | 'critical';
  ip_address?: string;
  created_at: string;
  company_id: string;
}

export interface SystemConfig {
  id: string;
  maintenance_mode: boolean;
  maintenance_message?: string;
  allowed_users: string[]; // UIDs allowed during maintenance
  min_client_version: string;
  updated_at: string;
  updated_by: string;
}

export interface Company {
  id: string;
  name: string;
  code: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  tax_number?: string;
  commercial_register?: string;
  subscription_status: 'active' | 'expired' | 'trial' | 'suspended';
  subscription_plan: 'basic' | 'pro' | 'enterprise';
  subscription_expiry?: string;
  subscription_start?: string;
  subscription_end?: string;
  subscription_days?: number;
  users_limit: number;
  transactions_limit: number;
  company_status: 'active' | 'suspended';
  features: string[]; // List of enabled feature IDs
  created_at: string;
  vat_enabled?: boolean;
  wht_enabled?: boolean;
  pos_enabled?: boolean;
  settings: {
    currency: string;
    timezone: string;
    language: 'ar' | 'en';
    fiscal_year_start: string;
    enable_multi_currency?: boolean;
    exchange_rate_update_method?: 'manual' | 'auto';
    er_auto_update?: boolean;
    er_frequency?: 'daily' | 'weekly';
    er_last_update?: string | null;
    er_conn_status?: 'idle' | 'ok' | 'error';
    er_last_result?: string | null;
    inventory_cost_method?: 'wac' | 'fifo' | 'lifo';
    inventory_cost_method_level?: 'company' | 'item';
    vat_enabled?: boolean;
    wht_enabled?: boolean;
    pos_enabled?: boolean;
    purchase_workflow_mode?: 'Simple' | 'Enterprise Strict' | 'Enterprise Flexible';
    barcode_scanner?: any;
  };
  purchase_workflow_mode?: 'Simple' | 'Enterprise Strict' | 'Enterprise Flexible';
  goods_receipt_matching_mode?: 'SupplierProduct' | 'ProductOnly' | 'SupplierProductWarehouse' | 'SmartMatching';
}

export interface PosBranchLinkingCode {
  id: string;
  company_id: string;
  department_id?: string;
  department_name?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  code: string;
  status: 'pending' | 'used' | 'expired' | 'revoked';
  expires_at: string;
  created_by?: string;
  created_at: string;
  used_at?: string;
  used_by_device?: string;
}

export interface Currency {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  flag?: string;
  is_active: boolean;
  company_id: string;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  currency_id: string;
  exchange_rate: number;
  rate_date: string;
  notes?: string;
  created_by: string;
  created_at: string;
  company_id: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  mobile: string;
  email?: string;
  tax_number?: string;
  address?: string;
  opening_balance: number;
  opening_balance_date?: string;
  account_id?: string;
  account_name?: string;
  counter_account_id?: string;
  company_id: string;
  payment_method?: string;
  credit_limit?: number;
  payment_terms?: string;
  payment_terms_days?: number;
  advance_percentage?: number;
  is_active?: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  mobile: string;
  email?: string;
  tax_number?: string;
  address?: string;
  opening_balance: number;
  opening_balance_date?: string;
  account_id?: string;
  account_name?: string;
  counter_account_id?: string;
  company_id: string;
  payment_method?: string;
  credit_limit?: number;
  payment_terms?: string;
  payment_terms_days?: number;
  advance_percentage?: number;
  is_active?: boolean;
}

export interface Warehouse {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  storekeeper?: string;
  storekeeper_phone?: string;
  created_at?: string;
}

export interface OperationCategory {
  id: string;
  name: string;
  code?: string;
  parent_id: string | null;
  is_final?: boolean;
  level?: number;
  full_path?: string;
  description?: string;
  company_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface OperationField {
  id: string;
  company_id: string;
  code: string;
  name: string;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'select' | 'boolean' | 
        'textarea' | 'rich_text' | 'tags' | 'url' | 'email' | 'phone' | 
        'auto_number' | 'formula' | 'time' | 'datetime' | 'multi_select' | 'multiselect' | 
        'radio' | 'checkbox' | 'user' | 'customer' | 'supplier' | 'product' | 'category' | 
        'record_link' | 'file' | 'image' | 'barcode' | 'qr' | 'signature' | 
        'gps' | 'address' | 'city' | 'country';
  category_id: string | null;
  category_ids?: string[];
  department_id?: string | null;
  sort_order?: number;
  is_required?: boolean;
  options?: string[] | null;
  unit?: string;
  default_value?: string;
  created_at?: string;
}

export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  account_id?: string;
  account_name?: string;
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  type: 'cash' | 'bank' | 'wallet';
  opening_balance: number;
  opening_balance_date?: string;
  account_id?: string;
  account_name?: string;
  counter_account_id?: string;
  company_id: string;
}

export interface CashTransfer {
  id: string;
  date: string;
  amount: number;
  from_payment_method_id: string;
  from_payment_method_name?: string;
  to_payment_method_id: string;
  to_payment_method_name?: string;
  description: string;
  company_id: string;
  created_at: string;
  created_by: string;
  entry_number?: string;
  transfer_number?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  type: 'service' | 'finished_good' | 'raw_material' | 'commodity' | 'consumable' | 'packaging';
  sale_price: number;
  cost_price: number;
  description?: string;
  image_url?: string;
  barcode?: string;
  category?: string;
  unit?: string;
  stock: number;
  min_stock: number;
  account_id?: string;
  account_name?: string;
  revenue_account_id?: string;
  revenue_account_name?: string;
  cost_account_id?: string;
  cost_account_name?: string;
  inventory_account_id?: string;
  inventory_account_name?: string;
  vat_account_id?: string;
  vat_account_name?: string;
  vat_rate?: number;
  inventory_cost_method?: 'wac' | 'fifo' | 'lifo';
  counter_account_id?: string;
  item_group_id?: string;
  item_group_name?: string;
  company_id: string;
  barcode_settings?: any;
  allow_issue_fraction?: boolean;
  allow_receipt_fraction?: boolean;
  allow_issue_fraction_pct?: number;
  allow_receipt_fraction_pct?: number;
  is_active?: boolean;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  warehouse_id?: string;
  date: string;
  due_date?: string;
  description?: string;
  subtotal?: number;
  discount?: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount: number;
  payment_type: 'credit' | 'cash';
  payment_method_id?: string;
  payment_method_name?: string;
  status: 'paid' | 'unpaid' | 'partial';
  payment_status?: 'paid' | 'unpaid' | 'partial' | 'partially_paid';
  items?: InvoiceItem[];
  company_id: string;
  currency_id?: string;
  currency_code?: string;
  exchange_rate?: number;
  total_base_amount?: number;
  source_orders?: string;
  entry_number?: string;
  payment_terms?: string;
  payment_terms_days?: number;
  advance_percentage?: number;
  settlements?: any[];
  settlement_number?: string | null;
  settlement_date?: string | null;
  operation_id?: string | null;
  department_id?: string | null;
  cost_center_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name?: string;
  warehouse_id?: string;
  date: string;
  due_date?: string;
  description?: string;
  subtotal?: number;
  discount?: number;
  tax_amount?: number;
  total_amount: number;
  payment_type: 'credit' | 'cash';
  payment_method_id?: string;
  payment_method_name?: string;
  payment_status?: 'paid' | 'unpaid' | 'partial' | 'partially_paid';
  items?: InvoiceItem[];
  company_id: string;
  currency_id?: string;
  currency_code?: string;
  exchange_rate?: number;
  total_base_amount?: number;
  source_orders?: string;
  entry_number?: string;
  payment_terms?: string;
  payment_terms_days?: number;
  advance_percentage?: number;
  settlements?: any[];
  settlement_number?: string | null;
  settlement_date?: string | null;
  operation_id?: string | null;
  department_id?: string | null;
  cost_center_id?: string | null;
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  product_image_url?: string;
  quantity: number;
  unit_price: number;
  total: number;
  barcode?: string;
  image_url?: string;
  operation_id?: string | null;
  department_id?: string | null;
  cost_center_id?: string | null;
  vat_rate?: number;
  vat_amount?: number;
}

export interface ReceiptVoucherItem {
  type: 'customer' | 'supplier' | 'expense' | 'account';
  entity_id: string;
  entity_name?: string;
  amount: number;
  description?: string;
  sub_account_id?: string;
  sub_account_type?: string;
  settlements?: any[];
  settlement_number?: string;
  settlement_date?: string;
}

export interface ReceiptVoucher {
  id: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  voucher_number?: string;
  internal_reference?: string;
  manual_reference?: string;
  date: string;
  amount: number;
  description: string;
  payment_method_id?: string;
  payment_method_name?: string;
  account_id?: string;
  company_id: string;
  entry_number?: string;
  items?: ReceiptVoucherItem[];
  voucher_type?: string;
  created_at?: string;
  created_by?: string;
  number?: string;
}

export interface PaymentVoucherItem {
  type: 'supplier' | 'customer' | 'expense' | 'account';
  entity_id: string;
  entity_name?: string;
  amount: number;
  description?: string;
  sub_account_id?: string;
  sub_account_type?: string;
  settlements?: any[];
  settlement_number?: string;
  settlement_date?: string;
}

export interface PaymentVoucher {
  id: string;
  voucher_number?: string;
  internal_reference?: string;
  manual_reference?: string;
  supplier_id?: string;
  supplier_name?: string;
  expense_category_id?: string;
  category_name?: string;
  date: string;
  amount: number;
  description: string;
  payment_method_id: string;
  payment_method_name?: string;
  account_id?: string;
  company_id: string;
  items?: PaymentVoucherItem[];
  entry_number?: string;
  number?: string;
  voucher_type?: string;
  created_at?: string;
  created_by?: string;
}

export interface Return {
  id: string;
  return_number: string;
  customer_id: string;
  customer_name?: string;
  warehouse_id?: string;
  date: string;
  description?: string;
  notes?: string;
  discount?: number;
  tax?: number;
  shipping?: number;
  subtotal?: number;
  total_amount: number;
  payment_type: 'credit' | 'cash';
  payment_method_id?: string;
  payment_method_name?: string;
  items?: ReturnItem[];
  company_id: string;
  entry_number?: string;
  operation_id?: string | null;
  department_id?: string | null;
  cost_center_id?: string | null;
  currency_id?: string | null;
  exchange_rate?: number;
  exchange_rate_type?: 'manual' | 'auto';
  total_base_amount?: number;
}

export interface PurchaseReturn {
  id: string;
  return_number: string;
  supplier_id: string;
  supplier_name?: string;
  warehouse_id?: string;
  date: string;
  description?: string;
  notes?: string;
  discount?: number;
  tax?: number;
  shipping?: number;
  subtotal?: number;
  total_amount: number;
  payment_type: 'credit' | 'cash';
  payment_method_id?: string;
  payment_method_name?: string;
  items?: ReturnItem[];
  company_id: string;
  entry_number?: string;
}

export interface ReturnItem {
  id?: string;
  return_id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  product_image_url?: string;
  quantity: number;
  unit_price: number;
  price?: number; // Keep price for backward compatibility if needed
  total: number;
  barcode?: string;
  image_url?: string;
  operation_id?: string | null;
  department_id?: string | null;
  cost_center_id?: string | null;
  description?: string;
  vat_rate?: number;
  vat_amount?: number;
}

export interface CustomerDiscount {
  id: string;
  customer_id: string;
  customer_name?: string;
  date: string;
  amount: number;
  description: string;
}

export interface SupplierDiscount {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  date: string;
  amount: number;
  description: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  username: string;
  user_email?: string;
  company_id: string;
  created_at: string;
  module: string;
  action: string;
  details: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: any;
  ip_address?: string;
  // Backward compatibility fields
  entity?: string | string[];
  document_id?: string;
  changes?: {
    field: string;
    label?: string;
    old_value: any;
    new_value: any;
  }[];
}

export interface DashboardTransaction {
  id: string;
  type: 'invoice' | 'return' | 'journal' | 'receipt' | 'payment';
  number: string;
  customer_name: string;
  date: string;
  total_amount: number;
}

export interface DashboardStats {
  netProfit: number;
  netSales: number;
  totalInvoices: number;
  totalReceipts: number;
  totalExpenses: number;
  totalCustomerBalances: number;
  totalSupplierBalances: number;
  totalCashBalance: number;
  salesByMonth: { month: string; total: number }[];
  recentTransactions: DashboardTransaction[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: string;
  read: boolean;
  category?: 'stock' | 'invoice' | 'ai' | 'general';
  path?: string;
}

export interface AccountType {
  id: string;
  code: string;
  name: string;
  statement_type: 'income_statement' | 'balance_sheet';
  classification: 'asset' | 'liability' | 'equity' | 'revenue' | 'cost' | 'expense' | 'liability_equity' | 'cash_and_equivalents' | 'receivables' | 'payables' | 'interest_expense' | 'depreciation' | 'other_revenue' | 'other_expense'; // liability_equity kept for backward compatibility/choice
  company_id: string;
  is_active?: boolean;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type_id: string;
  type_name?: string;
  parent_id?: string | null;
  company_id: string;
  opening_balance: number;
  opening_balance_date?: string;
  required_sub_account?: boolean;
  is_active?: boolean;
  account_usage?: string;
}

export interface Setting {
  id: string;
  company_id: string;
  type: string;
  key: string;
  value: string;
  updated_at?: string;
  created_at?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference_id: string;
  reference_type: string;
  reference_number?: string;
  entry_number?: string;
  total_debit: number;
  total_credit: number;
  company_id: string;
  items: JournalEntryItem[];
  created_at: string;
  created_by: string;
}

export interface JournalEntryItem {
  account_id: string;
  account_name: string;
  account_code?: string;
  product_name?: string;
  debit: number;
  credit: number;
  description?: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  sub_account_id?: string;
  sub_account_type?: 'customer' | 'supplier' | 'payment_method' | 'expense' | 'other';
  operation_id?: string | null;
  department_id?: string | null;
  cost_center_id?: string | null;
  currency?: string;
  exchange_rate?: number;
  foreign_amount?: number;
}

export interface TrialBalanceItem {
  id: string;
  code: string;
  name: string;
  type?: string;
  opening: {
    debit: number;
    credit: number;
  };
  movement: {
    debit: number;
    credit: number;
  };
  closing: {
    debit: number;
    credit: number;
  };
}

export interface LedgerLine {
  id: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  entity_name?: string;
  reference_type?: string;
  entry_number?: string;
  sub_account_id?: string;
  sub_account_type?: string;
  reference_id?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  parent_id: string | null;
  manager_user_id: string | null;
  company_id: string;
  is_active: boolean;
  created_at?: string;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  department_id?: string;
  company_id: string;
  budget?: number;
  currency?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Operation {
  id: string;
  company_id: string;
  customer_id: string;
  customer_name?: string;
  description?: string;
  date: string;
  operation_date?: string;
  operation_number?: string;
  status: string;
  category_id: string;
  department_id?: string;
  cost_center_id?: string;
  created_at?: string;
}

export interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  warehouse_id?: string;
  date: string;
  delivery_date?: string;
  description?: string;
  notes?: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  total_amount: number;
  status: 'pending' | 'converted';
  invoice_id?: string;
  invoice_number?: string;
  items?: SalesOrderItem[];
  company_id: string;
  created_by?: string;
  created_at?: string;
  currency_id?: string | null;
  exchange_rate?: number;
  exchange_rate_type?: 'auto' | 'manual';
  operation_id?: string | null;
  cost_center_id?: string | null;
  department_id?: string | null;
}

export interface SalesOrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  product_image_url?: string;
  quantity: number;
  unit_price: number;
  total: number;
  barcode?: string;
  image_url?: string;
  operation_id?: string | null;
  cost_center_id?: string | null;
  department_id?: string | null;
  description?: string | null;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_id: string;
  supplier_name?: string;
  warehouse_id?: string;
  date: string;
  delivery_date?: string;
  description?: string;
  notes?: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  total_amount: number;
  status: 'pending' | 'converted';
  invoice_id?: string;
  invoice_number?: string;
  items?: PurchaseOrderItem[];
  company_id: string;
  created_by?: string;
  created_at?: string;
  currency_id?: string | null;
  exchange_rate?: number;
  exchange_rate_type?: 'auto' | 'manual';
  operation_id?: string | null;
  cost_center_id?: string | null;
  department_id?: string | null;
}

export interface PurchaseOrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  product_image_url?: string;
  quantity: number;
  unit_price: number;
  total: number;
  barcode?: string;
  image_url?: string;
  operation_id?: string | null;
  cost_center_id?: string | null;
  department_id?: string | null;
  description?: string | null;
}

export interface EmployeeDocument {
  name: string;
  type: string;
  data: string;
}

export interface Employee {
  id: string;
  company_id: string;
  employee_code: string;
  name: string;
  nationality?: string;
  national_id?: string;
  gender?: 'male' | 'female';
  marital_status?: 'married' | 'single';
  birth_date?: string;
  hire_date?: string;
  contract_type?: 'permanent' | 'temporary';
  contract_expiry_date?: string;
  photo_url?: string;
  documents?: string | EmployeeDocument[];
  created_by?: string;
  created_at?: string;
  job_title?: string;
  manager_id?: string;
  department_id?: string;
}

export interface WarehouseTransferItem {
  id?: string;
  transfer_id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
}

export interface WarehouseTransfer {
  id: string;
  company_id: string;
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  from_warehouse_name?: string;
  to_warehouse_name?: string;
  date: string;
  description?: string;
  created_by?: string;
  created_at?: string;
  items?: WarehouseTransferItem[];
  entry_number?: string;
}

export interface OpeningStockItem {
  id?: string;
  opening_stock_id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  warehouse_id: string;
  warehouse_name?: string;
  quantity: number;
  unit_cost: number;
  total_cost?: number;
  company_id?: string;
  created_at?: string;
}

export interface OpeningStockBalance {
  id: string;
  company_id: string;
  document_number: string;
  date: string;
  debit_account_id: string;
  debit_account_name?: string;
  credit_account_id: string;
  credit_account_name?: string;
  description?: string;
  created_by?: string;
  created_at?: string;
  items?: OpeningStockItem[];
  entry_number?: string;
}

export interface StockAdjustmentItem {
  id?: string;
  adjustment_id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  warehouse_id: string;
  warehouse_name?: string;
  quantity: number;
  unit_cost: number;
  total_cost?: number;
  company_id?: string;
  created_at?: string;
}

export interface StockAdjustment {
  id: string;
  company_id: string;
  adjustment_number: string;
  date: string;
  account_id: string;
  account_name?: string;
  description?: string;
  created_by?: string;
  created_at?: string;
  items?: StockAdjustmentItem[];
  entry_number?: string;
}

// ─── ExchangeRateService Types ────────────────────────────────────────────────

/**
 * A single currency rate entry as returned by the ExchangeRateService.
 * Intentionally decoupled from the DB model so accounting logic is unaffected.
 */
export interface FetchedCurrencyRate {
  /** ISO 4217 currency code, e.g. "USD", "EUR" */
  currencyCode: string;
  /** Exchange rate relative to the configured base currency */
  rate: number;
  /** ISO 8601 date string of when this rate was valid, e.g. "2026-06-16" */
  rateDate: string;
}

/**
 * Options accepted by ExchangeRateService.fetchLatestRates().
 */
export interface ExchangeRateFetchOptions {
  /** ISO 4217 base currency code. Defaults to "EGP" if omitted. */
  baseCurrency?: string;
  /**
   * Request timeout in milliseconds.
   * Defaults to 10 000 ms (10 s) if omitted.
   */
  timeoutMs?: number;
}

/** Discriminated-union result – either success or a typed failure. */
export type ExchangeRateFetchResult =
  | {
      success: true;
      /** The base currency used for this fetch */
      baseCurrency: string;
      /** ISO 8601 date string reported by the API */
      rateDate: string;
      /** All rates returned by the API, parsed into application models */
      rates: FetchedCurrencyRate[];
      /** Unix timestamp (ms) when the response was received */
      fetchedAt: number;
    }
  | {
      success: false;
      /** Machine-readable reason code */
      error:
        | 'NETWORK_TIMEOUT'
        | 'API_UNAVAILABLE'
        | 'INVALID_JSON'
        | 'PARSE_ERROR'
        | 'UNKNOWN';
      /** Human-readable message suitable for logging */
      message: string;
    };

// ─── ExchangeRatePersistenceService Types ────────────────────────────────────

/**
 * Summary returned by ExchangeRatePersistenceService.persistLatestRates()
 * after a fetch-and-save cycle completes.
 */
export interface PersistRatesResult {
  /** Whether the entire operation (fetch + DB transaction) succeeded */
  success: boolean;
  /** Number of new rows inserted into currency_rates */
  inserted: number;
  /** Number of existing rows (same currency_id + rate_date) updated */
  updated: number;
  /** Number of currencies in the API response that had no matching row in the currencies table */
  skipped: number;
  /** Human-readable summary message */
  message: string;
}

export interface PaperSize {
  id: string;
  company_id?: string;
  name: string;
  width: number;
  height: number;
  unit: string;
  is_system?: boolean;
}

export interface PrintProfile {
  id: string;
  company_id: string;
  name: string;
  paper_size_id: string;
  custom_width?: number;
  custom_height?: number;
  orientation: 'portrait' | 'landscape';
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  dpi: number;
  print_settings?: any;
  created_at?: string;
  updated_at?: string;
}

export interface Template {
  id: string;
  company_id: string;
  name: string;
  description: string;
  paper_size_id: string;
  orientation: 'portrait' | 'landscape';
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  is_active: boolean;
  layout?: any;
  document_type?: string;
  is_default?: boolean;
  is_system?: boolean;
  print_profile_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Dashboard {
  id: string;
  company_id: string;
  owner_user_id: string | null;
  name: string;
  description?: string;
  is_default: boolean;
  is_system: boolean;
  icon?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Widget {
  id: string;
  dashboard_id: string;
  widget_type: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  settings: any;
  filters: any;
  order: number;
  visible: boolean;
  locked: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WidgetTypeDefinition {
  type: string;
  nameEn: string;
  nameAr: string;
  defaultW: number;
  defaultH: number;
  description?: string;
}

export interface InventoryMovementType {
  id: string;
  name_en: string;
  name_ar: string;
  default_direction: 'IN' | 'OUT' | 'NONE';
  description?: string;
  created_at?: string;
}

export interface InventoryMovementV2 {
  id: string;
  company_id: string;
  branch_id?: string | null;
  warehouse_id?: string | null;
  movement_number: string;
  movement_type: string;
  source_document_type?: string | null;
  source_document_id?: string | null;
  movement_date: string;
  status: 'draft' | 'posted' | 'cancelled' | 'reversed';
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  lines?: InventoryMovementLine[];
}

export interface InventoryMovementLine {
  id: string;
  movement_id: string;
  product_id: string;
  unit_id: string;
  quantity: number;
  direction: 'IN' | 'OUT';
  unit_cost?: number;
  total_cost?: number;
  batch_id?: string | null;
  serial_number?: string | null;
  notes?: string | null;
  before_quantity?: number;
  after_quantity?: number;
  before_cost?: number;
  after_cost?: number;
  created_at?: string;
}

export interface StockCardRecord {
  id: string;
  company_id: string;
  warehouse_id?: string | null;
  product_id: string;
  movement_id: string;
  movement_line_id: string;
  movement_date: string;
  quantity: number;
  direction: 'IN' | 'OUT';
  before_qty: number;
  after_qty: number;
  before_cost: number;
  after_cost: number;
  unit_cost: number;
  total_cost: number;
  created_at?: string;
}

export interface InventoryTransactionJournal {
  id: string;
  company_id: string;
  warehouse_id?: string | null;
  movement_id?: string | null;
  movement_type: string;
  source_document_type?: string | null;
  source_document_id?: string | null;
  reference_number: string;
  status: 'Draft' | 'Posted' | 'Cancelled' | 'Reversed';
  created_by?: string | null;
  created_at?: string;
  posted_at?: string | null;
  cancelled_at?: string | null;
  notes?: string | null;
}






