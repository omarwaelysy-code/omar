// Schema Registry for System Check
// Defines the expected tables and columns for the ERP system

export interface TableSchema {
  [tableName: string]: string[]; // Array of expected column names
}

export const EXPECTED_SCHEMA: TableSchema = {
  companies: [
    'id', 'name', 'code', 'tax_number', 'commercial_register', 'address', 'phone', 'email',
    'logo_url', 'website', 'country', 'currency', 'fiscal_year_end',
    'subscription_status', 'subscription_plan', 'subscription_start',
    'subscription_end', 'subscription_expiry', 'subscription_days', 'users_limit', 
    'transactions_limit', 'company_status', 'features', 'settings', 'vat_enabled', 'wht_enabled', 'created_at', 'updated_at'
  ],
  users: [
    'id', 'username', 'name', 'email', 'password_hash', 'mobile', 'role', 'company_id',
    'status', 'temp_password', 'permissions', 'must_change_password', 'created_at'
  ],
  customers: [
    'id', 'company_id', 'account_id', 'account_name', 'code', 'name', 'email', 'mobile', 'address', 
    'tax_number', 'opening_balance', 'opening_balance_date', 'counter_account_id', 'created_at'
  ],
  suppliers: [
    'id', 'company_id', 'account_id', 'account_name', 'name', 'code', 'email', 'mobile', 'address', 
    'tax_number', 'opening_balance', 'opening_balance_date', 'counter_account_id', 'created_at'
  ],
  products: [
    'id', 'company_id', 'revenue_account_id', 'cost_account_id', 'revenue_account_name', 'cost_account_name', 'name', 'code', 'barcode',
    'type', 'description', 'image_url', 'category', 'unit', 'cost_price', 'sale_price', 'stock', 'min_stock', 
    'current_stock', 'is_service', 'counter_account_id', 'inventory_account_id', 'inventory_account_name', 'vat_account_id', 'vat_account_name', 'vat_rate', 'created_at'
  ],
  item_groups: [
    'id', 'company_id', 'name', 'code', 'type', 'sequence_number', 'description', 'created_at'
  ],
  accounts: [
    'id', 'company_id', 'type_id', 'parent_id', 'code', 'name', 'opening_balance', 'opening_balance_date', 'required_sub_account', 'is_active', 'created_at'
  ],
  invoices: [
    'id', 'company_id', 'customer_id', 'customer_name', 'invoice_number', 'date', 'due_date', 'subtotal',
    'tax_amount', 'discount_amount', 'total_amount', 'status', 'payment_type', 
    'payment_method_id', 'payment_method_name', 'description', 'notes', 'created_by', 'created_at'
  ],
  invoice_items: [
    'id', 'invoice_id', 'product_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url', 'image_url', 'barcode',
    'unit_cost', 'total_cost', 'costing_method_used', 'company_id'
  ],
  returns: [
    'id', 'company_id', 'customer_id', 'customer_name', 'return_number', 'date', 'total_amount', 
    'payment_type', 'payment_method_id', 'payment_method_name', 'description', 'notes', 'created_at'
  ],
  return_items: [
    'id', 'return_id', 'product_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url'
  ],
  purchase_invoices: [
    'id', 'company_id', 'supplier_id', 'supplier_name', 'invoice_number', 'date', 'due_date', 'subtotal',
    'tax_amount', 'discount_amount', 'total_amount', 'status', 'payment_type', 
    'payment_method_id', 'payment_method_name', 'description', 'notes', 'created_at'
  ],
  purchase_invoice_items: [
    'id', 'invoice_id', 'product_id', 'expense_category_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'category_name', 'product_code', 'product_image_url'
  ],
  purchase_returns: [
    'id', 'company_id', 'supplier_id', 'supplier_name', 'return_number', 'date', 'total_amount', 
    'payment_type', 'payment_method_id', 'payment_method_name', 'description', 'notes', 'created_at'
  ],
  purchase_return_items: [
    'id', 'return_id', 'product_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url'
  ],
  receipt_vouchers: [
    'id', 'company_id', 'customer_id', 'customer_name', 'voucher_number', 'date', 'amount', 'description', 
    'payment_method_id', 'payment_method_name', 'account_id', 'created_at',
    'items', 'internal_reference', 'manual_reference', 'voucher_type', 'supplier_id', 'supplier_name'
  ],
  payment_vouchers: [
    'id', 'company_id', 'supplier_id', 'supplier_name', 'expense_category_id', 'category_name', 'date', 'amount', 
    'description', 'payment_method_id', 'payment_method_name', 'account_id', 'created_at',
    'items', 'internal_reference', 'manual_reference', 'voucher_type', 'customer_id', 'customer_name', 'voucher_number'
  ],
  customer_discounts: [
    'id', 'company_id', 'customer_id', 'customer_name', 'date', 'amount', 'description'
  ],
  supplier_discounts: [
    'id', 'company_id', 'supplier_id', 'supplier_name', 'date', 'amount', 'description'
  ],
  cash_transfers: [
    'id', 'company_id', 'date', 'amount', 'from_payment_method_id', 'to_payment_method_id', 
    'from_payment_method_name', 'to_payment_method_name', 'description', 'created_by', 'created_at'
  ],
  expense_categories: [
    'id', 'company_id', 'code', 'name', 'description', 'account_id', 'account_name'
  ],
  journal_entries: [
    'id', 'company_id', 'date', 'description', 'reference_id', 'reference_type', 
    'reference_number', 'total_debit', 'total_credit', 'status', 'created_at'
  ],
  journal_entry_lines: [
    'id', 'journal_entry_id', 'account_id', 'account_name', 'description', 'debit', 'credit',
    'customer_id', 'supplier_id', 'customer_name', 'supplier_name', 'sub_account_id', 'sub_account_type'
  ],
  operation_categories: [
    'id', 'name', 'code', 'parent_id', 'is_final', 'level', 'full_path', 'description', 'company_id', 'created_at', 'updated_at'
  ],
  field_operation_categories: [
    'id', 'field_id', 'category_id', 'company_id', 'created_at'
  ],
  departments: [
    'id', 'code', 'name', 'description', 'parent_id', 'manager_user_id', 'company_id', 'is_active', 'created_at'
  ],
  cost_centers: [
    'id', 'code', 'name', 'description', 'department_id', 'company_id', 'budget', 'currency', 'is_active', 'created_at'
  ],
  operations: [
    'id', 'company_id', 'customer_id', 'customer_name', 'description', 'date', 'status', 'category_id', 'operation_category_id', 'operation_number', 'department_id', 'cost_center_id', 'operation_date', 'created_at'
  ],
  operation_fields: [
    'id', 'company_id', 'name', 'label', 'type', 'category_id', 'operation_category_id', 'department_id', 'sort_order', 'is_required', 'options', 'code', 'description', 'unit', 'default_value', 'created_at'
  ],
  operation_field_values: [
    'id', 'operation_id', 'field_id', 'value', 'company_id', 'created_at'
  ],
  payment_methods: [
    'id', 'company_id', 'account_id', 'account_name', 'code', 'name', 'type', 'opening_balance', 
    'opening_balance_date', 'counter_account_id'
  ],
  activity_logs: [
    'id', 'company_id', 'user_id', 'username', 'action', 'details', 'ip_address', 
    'created_at', 'entity', 'document_id', 'changes'
  ],
  settings: [
    'id', 'company_id', 'type', 'key', 'value', 'customer_discount_account_id', 'supplier_discount_account_id', 'updated_at', 'created_at'
  ],
  system_config: [
    'id', 'maintenance_mode', 'maintenance_message', 'allowed_users', 'min_client_version', 'updated_at', 'updated_by'
  ],
  audit_logs: [
    'id', 'company_id', 'user_id', 'username', 'user_email', 'action', 'module', 'details', 'entity_type', 'entity_id', 'ip_address', 'metadata', 'created_at'
  ],
  currencies: [
    'id', 'company_id', 'code', 'name_ar', 'name_en', 'symbol', 'flag', 'is_active', 'created_at'
  ],
  exchange_rates: [
    'id', 'company_id', 'currency_id', 'exchange_rate', 'rate_date', 'notes', 'created_by', 'created_at'
  ],
  inventory_movements: [
    'id', 'company_id', 'product_id', 'movement_type', 'reference_id', 'reference_type',
    'reference_number', 'date', 'quantity', 'unit_cost', 'total_cost', 'created_at'
  ],
  inventory_layers: [
    'id', 'company_id', 'product_id', 'purchase_date', 'original_qty', 'qty_remaining',
    'unit_cost', 'reference_type', 'reference_id', 'created_at'
  ]
};
