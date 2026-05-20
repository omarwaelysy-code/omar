export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface UserPermissions {
  [moduleId: string]: ModulePermissions;
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
  settings: {
    currency: string;
    timezone: string;
    language: 'ar' | 'en';
    fiscal_year_start: string;
    enable_multi_currency?: boolean;
    inventory_cost_method?: 'wac' | 'fifo' | 'lifo';
    vat_enabled?: boolean;
    wht_enabled?: boolean;
  };
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
  address?: string;
  opening_balance: number;
  opening_balance_date?: string;
  account_id?: string;
  account_name?: string;
  counter_account_id?: string;
  company_id: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  opening_balance: number;
  opening_balance_date?: string;
  account_id?: string;
  account_name?: string;
  counter_account_id?: string;
  company_id: string;
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
}

export interface Product {
  id: string;
  code: string;
  name: string;
  type: 'service' | 'finished_good' | 'raw_material' | 'commodity';
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
  counter_account_id?: string;
  company_id: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  date: string;
  due_date?: string;
  description?: string;
  subtotal?: number;
  discount?: number;
  discount_amount?: number;
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
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name?: string;
  date: string;
  description?: string;
  subtotal?: number;
  discount?: number;
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
}

export interface ReceiptVoucher {
  id: string;
  customer_id: string;
  customer_name?: string;
  voucher_number?: string;
  date: string;
  amount: number;
  description: string;
  payment_method_id?: string;
  payment_method_name?: string;
  account_id?: string;
  company_id: string;
}

export interface PaymentVoucherItem {
  type: 'supplier' | 'customer' | 'expense' | 'account';
  entity_id: string;
  entity_name?: string;
  amount: number;
  description?: string;
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
}

export interface Return {
  id: string;
  return_number: string;
  customer_id: string;
  customer_name?: string;
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
}

export interface PurchaseReturn {
  id: string;
  return_number: string;
  supplier_id: string;
  supplier_name?: string;
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
  classification: 'asset' | 'liability' | 'equity' | 'revenue' | 'cost' | 'expense' | 'liability_equity'; // liability_equity kept for backward compatibility/choice
  company_id: string;
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
  debit: number;
  credit: number;
  description?: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  sub_account_id?: string;
  sub_account_type?: 'customer' | 'supplier' | 'payment_method' | 'expense' | 'other';
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
