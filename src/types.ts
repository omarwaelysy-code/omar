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
  role: 'super_admin' | 'admin' | 'user' | 'manager';
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
  settings: {
    currency: string;
    timezone: string;
    language: 'ar' | 'en';
    fiscal_year_start: string;
  };
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
  type: 'service' | 'product' | 'commodity';
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
  counter_account_id?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  date: string;
  due_date?: string;
  subtotal?: number;
  discount?: number;
  total_amount: number;
  payment_type: 'credit' | 'cash';
  payment_method_id?: string;
  payment_method_name?: string;
  status: 'paid' | 'unpaid' | 'partial';
  items?: InvoiceItem[];
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name?: string;
  date: string;
  subtotal?: number;
  discount?: number;
  total_amount: number;
  payment_type: 'credit' | 'cash';
  payment_method_id?: string;
  payment_method_name?: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  product_image_url?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptVoucher {
  id: string;
  customer_id: string;
  customer_name?: string;
  date: string;
  amount: number;
  description: string;
  payment_method_id?: string;
  payment_method_name?: string;
}

export interface PaymentVoucher {
  id: string;
  supplier_id?: string;
  supplier_name?: string;
  expense_category_id?: string;
  expense_category_name?: string;
  date: string;
  amount: number;
  description: string;
  payment_method_id: string;
  payment_method_name?: string;
}

export interface Return {
  id: string;
  return_number: string;
  customer_id: string;
  customer_name?: string;
  date: string;
  total_amount: number;
  payment_type: 'credit' | 'cash';
  payment_method_id?: string;
  payment_method_name?: string;
  items?: ReturnItem[];
}

export interface PurchaseReturn {
  id: string;
  return_number: string;
  supplier_id: string;
  supplier_name?: string;
  date: string;
  total_amount: number;
  payment_type: 'credit' | 'cash';
  payment_method_id?: string;
  payment_method_name?: string;
  items?: ReturnItem[];
}

export interface ReturnItem {
  id?: string;
  return_id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  product_image_url?: string;
  quantity: number;
  price: number;
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
  company_id: string;
  timestamp: string;
  action: string;
  details: string;
  category?: string | string[];
  document_id?: string;
  changes?: {
    field: string;
    old_value: any;
    new_value: any;
  }[];
}

export interface DashboardTransaction {
  id: string;
  type: 'invoice' | 'return';
  number: string;
  customer_name: string;
  date: string;
  total_amount: number;
}

export interface DashboardStats {
  netSales: number;
  totalInvoices: number;
  totalReceipts: number;
  totalExpenses: number;
  totalCustomerBalances: number;
  totalSupplierBalances: number;
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
  classification: 'asset' | 'liability_equity' | 'revenue' | 'cost' | 'expense';
  company_id: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type_id: string;
  type_name?: string;
  company_id: string;
  opening_balance: number;
  opening_balance_date?: string;
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
}
