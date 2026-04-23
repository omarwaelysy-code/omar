// Schema Registry for System Check
// Defines the expected tables and columns for the ERP system

export interface TableSchema {
  [tableName: string]: string[]; // Array of expected column names
}

export const EXPECTED_SCHEMA: TableSchema = {
  companies: [
    'id', 'name', 'code', 'tax_number', 'commercial_register', 'address', 'phone', 'email',
    'logo_url', 'website', 'subscription_status', 'subscription_plan', 'subscription_start',
    'subscription_end', 'subscription_expiry', 'subscription_days', 'users_limit', 
    'transactions_limit', 'company_status', 'features', 'settings', 'created_at', 'updated_at'
  ],
  users: [
    'id', 'username', 'name', 'email', 'password_hash', 'mobile', 'role', 'company_id',
    'status', 'temp_password', 'permissions', 'must_change_password', 'created_at'
  ],
  customers: [
    'id', 'company_id', 'account_id', 'code', 'name', 'email', 'mobile', 'address', 
    'tax_number', 'opening_balance', 'opening_balance_date', 'counter_account_id'
  ],
  suppliers: [
    'id', 'company_id', 'account_id', 'name', 'code', 'email', 'mobile', 'address', 
    'tax_number', 'opening_balance', 'opening_balance_date', 'counter_account_id'
  ],
  products: [
    'id', 'company_id', 'revenue_account_id', 'cost_account_id', 'name', 'code', 'barcode',
    'type', 'description', 'image_url', 'cost_price', 'sale_price', 'min_stock', 
    'current_stock', 'is_service', 'counter_account_id'
  ],
  accounts: [
    'id', 'company_id', 'type_id', 'parent_id', 'code', 'name', 'opening_balance', 'is_active'
  ],
  invoices: [
    'id', 'company_id', 'customer_id', 'invoice_number', 'date', 'due_date', 'subtotal',
    'tax_amount', 'discount_amount', 'total_amount', 'status', 'payment_type', 
    'payment_method_id', 'notes', 'created_by'
  ],
  invoice_items: [
    'id', 'invoice_id', 'product_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url'
  ],
  journal_entries: [
    'id', 'company_id', 'date', 'description', 'reference_id', 'reference_type', 
    'reference_number', 'total_debit', 'total_credit', 'status'
  ],
  journal_entry_lines: [
    'id', 'journal_entry_id', 'account_id', 'description', 'debit', 'credit'
  ],
  payment_methods: [
    'id', 'company_id', 'account_id', 'code', 'name', 'type', 'opening_balance', 
    'opening_balance_date', 'counter_account_id'
  ],
  activity_logs: [
    'id', 'company_id', 'user_id', 'username', 'action', 'details', 'ip_address', 
    'timestamp', 'category', 'document_id', 'changes'
  ],
  receipt_vouchers: [
    'id', 'company_id', 'customer_id', 'date', 'amount', 'description', 'payment_method_id'
  ],
  payment_vouchers: [
    'id', 'company_id', 'supplier_id', 'expense_category_id', 'date', 'amount', 
    'description', 'payment_method_id'
  ],
  returns: [
    'id', 'company_id', 'customer_id', 'return_number', 'date', 'total_amount', 
    'payment_type', 'payment_method_id', 'notes'
  ],
  return_items: [
    'id', 'return_id', 'product_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url'
  ]
};
