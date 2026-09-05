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
    'transactions_limit', 'company_status', 'features', 'settings', 'vat_enabled', 'wht_enabled', 'pos_enabled', 'purchase_workflow_mode', 'goods_receipt_matching_mode', 'created_at', 'updated_at'
  ],
  users: [
    'id', 'username', 'name', 'email', 'password_hash', 'mobile', 'role', 'company_id',
    'status', 'temp_password', 'permissions', 'must_change_password', 'created_at', 'role_ids'
  ],
  roles: [
    'id', 'name', 'description', 'permissions', 'company_id'
  ],
  customers: [
    'id', 'company_id', 'account_id', 'account_name', 'code', 'name', 'email', 'mobile', 'address', 
    'tax_number', 'opening_balance', 'opening_balance_date', 'counter_account_id', 'created_at',
    'payment_method', 'credit_limit', 'payment_terms', 'payment_terms_days', 'advance_percentage'
  ],
  suppliers: [
    'id', 'company_id', 'account_id', 'account_name', 'name', 'code', 'email', 'mobile', 'address', 
    'tax_number', 'opening_balance', 'opening_balance_date', 'counter_account_id', 'created_at',
    'payment_method', 'credit_limit', 'payment_terms', 'payment_terms_days', 'advance_percentage'
  ],
  products: [
    'id', 'company_id', 'revenue_account_id', 'cost_account_id', 'revenue_account_name', 'cost_account_name', 'name', 'code', 'barcode',
    'type', 'description', 'image_url', 'category', 'unit', 'cost_price', 'sale_price', 'stock', 'min_stock', 
    'current_stock', 'is_service', 'counter_account_id', 'inventory_account_id', 'inventory_account_name', 'vat_account_id', 'vat_account_name', 'vat_rate', 'inventory_cost_method', 'item_group_id', 'item_group_name', 'barcode_settings', 'allow_issue_fraction', 'allow_receipt_fraction', 'allow_issue_fraction_pct', 'allow_receipt_fraction_pct', 'tax_item_code', 'tax_code_type', 'eta_item_code', 'eta_code_type', 'created_at'
  ],
  item_groups: [
    'id', 'company_id', 'name', 'code', 'type', 'sequence_number', 'description', 'created_at'
  ],
  warehouses: [
    'id', 'company_id', 'code', 'name', 'description', 'address', 'phone', 'storekeeper', 'storekeeper_phone', 'created_at'
  ],
  accounts: [
    'id', 'company_id', 'type_id', 'parent_id', 'code', 'name', 'opening_balance', 'opening_balance_date', 'required_sub_account', 'is_active', 'account_usage', 'created_at'
  ],
  invoices: [
    'id', 'company_id', 'customer_id', 'customer_name', 'warehouse_id', 'invoice_number', 'date', 'due_date', 'subtotal',
    'tax_amount', 'discount_amount', 'total_amount', 'status', 'payment_type', 
    'payment_method_id', 'payment_method_name', 'description', 'notes', 'source_orders', 'created_by', 'created_at',
    'payment_terms', 'payment_terms_days', 'advance_percentage',
    'settlements', 'settlement_number', 'settlement_date',
    'operation_id', 'department_id', 'cost_center_id', 'currency_id', 'exchange_rate', 'updated_at'
  ],
  invoice_items: [
    'id', 'invoice_id', 'product_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url', 'image_url', 'barcode',
    'unit_cost', 'total_cost', 'costing_method_used', 'company_id',
    'operation_id', 'department_id', 'cost_center_id', 'vat_rate', 'vat_amount'
  ],
  sales_orders: [
    'id', 'company_id', 'customer_id', 'customer_name', 'warehouse_id', 'order_number', 'date', 'delivery_date', 'subtotal',
    'tax_amount', 'discount_amount', 'total_amount', 'status', 'invoice_id', 'invoice_number', 'description', 'notes', 'created_by', 'created_at',
    'currency_id', 'exchange_rate'
  ],
  sales_order_items: [
    'id', 'order_id', 'product_id', 'company_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url', 'barcode', 'created_at',
    'operation_id', 'department_id', 'cost_center_id'
  ],
  purchase_orders: [
    'id', 'company_id', 'supplier_id', 'supplier_name', 'warehouse_id', 'order_number', 'date', 'delivery_date', 'subtotal',
    'tax_amount', 'discount_amount', 'total_amount', 'status', 'invoice_id', 'invoice_number', 'description', 'notes', 'created_by', 'created_at',
    'currency_id', 'exchange_rate'
  ],
  purchase_order_items: [
    'id', 'order_id', 'product_id', 'company_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url', 'barcode', 'created_at',
    'operation_id', 'department_id', 'cost_center_id'
  ],
  returns: [
    'id', 'company_id', 'customer_id', 'customer_name', 'warehouse_id', 'return_number', 'date', 'total_amount', 
    'payment_type', 'payment_method_id', 'payment_method_name', 'description', 'notes', 'created_at',
    'currency_id', 'exchange_rate'
  ],
  return_items: [
    'id', 'return_id', 'product_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url', 'unit_cost',
    'operation_id', 'department_id', 'cost_center_id'
  ],
  purchase_invoices: [
    'id', 'company_id', 'supplier_id', 'supplier_name', 'warehouse_id', 'invoice_number', 'date', 'due_date', 'subtotal',
    'tax_amount', 'discount_amount', 'total_amount', 'status', 'payment_type', 
    'payment_method_id', 'payment_method_name', 'description', 'notes', 'source_orders', 'created_at',
    'payment_terms', 'payment_terms_days', 'advance_percentage',
    'settlements', 'settlement_number', 'settlement_date',
    'operation_id', 'department_id', 'cost_center_id', 'currency_id', 'exchange_rate'
  ],
  purchase_invoice_items: [
    'id', 'invoice_id', 'product_id', 'expense_category_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'category_name', 'product_code', 'product_image_url',
    'operation_id', 'department_id', 'cost_center_id', 'vat_rate', 'vat_amount'
  ],
  purchase_returns: [
    'id', 'company_id', 'supplier_id', 'supplier_name', 'warehouse_id', 'return_number', 'date', 'total_amount', 
    'payment_type', 'payment_method_id', 'payment_method_name', 'description', 'notes', 'created_at',
    'currency_id', 'exchange_rate'
  ],
  purchase_return_items: [
    'id', 'return_id', 'product_id', 'description', 'quantity', 'unit_price', 'total',
    'product_name', 'product_code', 'product_image_url', 'unit_cost',
    'operation_id', 'department_id', 'cost_center_id'
  ],
  receipt_vouchers: [
    'id', 'company_id', 'customer_id', 'customer_name', 'voucher_number', 'date', 'amount', 'description', 
    'payment_method_id', 'payment_method_name', 'account_id', 'created_at',
    'items', 'internal_reference', 'manual_reference', 'voucher_type', 'supplier_id', 'supplier_name',
    'currency_id', 'exchange_rate'
  ],
  payment_vouchers: [
    'id', 'company_id', 'supplier_id', 'supplier_name', 'expense_category_id', 'category_name', 'date', 'amount', 
    'description', 'payment_method_id', 'payment_method_name', 'account_id', 'created_at',
    'items', 'internal_reference', 'manual_reference', 'voucher_type', 'customer_id', 'customer_name', 'voucher_number',
    'paid_to_type', 'paid_to_employee_id', 'paid_to_external_name', 'currency_id', 'exchange_rate'
  ],
  issued_cheques: [
    'id', 'company_id', 'cheque_number', 'supplier_id', 'bank_account_id', 'bank_name', 'account_number',
    'amount', 'currency', 'exchange_rate', 'issue_date', 'due_date', 'status', 'description', 'notes',
    'payee_name', 'payment_date', 'return_date', 'return_reason', 'old_due_date', 'new_due_date',
    'postponement_reason', 'cancelled_at', 'cancelled_by', 'cancel_reason', 'issue_journal_entry_id',
    'payment_journal_entry_id', 'cancel_journal_entry_id', 'attachments', 'created_by', 'updated_by',
    'created_at', 'updated_at'
  ],
  customer_discounts: [
    'id', 'company_id', 'customer_id', 'customer_name', 'date', 'amount', 'description'
  ],
  supplier_discounts: [
    'id', 'company_id', 'supplier_id', 'supplier_name', 'date', 'amount', 'description'
  ],
  cash_transfers: [
    'id', 'company_id', 'date', 'amount', 'from_payment_method_id', 'to_payment_method_id', 
    'from_payment_method_name', 'to_payment_method_name', 'description', 'created_by', 'created_at', 'transfer_number'
  ],
  expense_categories: [
    'id', 'company_id', 'code', 'name', 'description', 'account_id', 'account_name'
  ],
  journal_entries: [
    'id', 'company_id', 'date', 'description', 'reference_id', 'reference_type', 
    'reference_number', 'total_debit', 'total_credit', 'status', 'entry_number', 'created_at'
  ],
  journal_entry_lines: [
    'id', 'journal_entry_id', 'account_id', 'account_name', 'description', 'debit', 'credit',
    'customer_id', 'supplier_id', 'customer_name', 'supplier_name', 'sub_account_id', 'sub_account_type', 'product_name',
    'operation_id', 'department_id', 'cost_center_id', 'currency', 'exchange_rate', 'foreign_amount'
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
    'opening_balance_date', 'counter_account_id', 'bank_name', 'branch_name', 'account_number', 'swift_code', 'iban', 'contact_person', 'contact_phone'
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
    'id', 'company_id', 'user_id', 'username', 'user_email', 'action', 'module', 'details', 'entity_type', 'entity_id', 'ip_address', 'metadata', 'created_at',
    'browser', 'operating_system', 'device', 'branch', 'record_name', 'record_id', 'old_values', 'new_values', 'success', 'execution_time'
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
  ],
  employees: [
    'id', 'company_id', 'employee_code', 'name', 'nationality', 'national_id', 'gender',
    'marital_status', 'birth_date', 'hire_date', 'contract_type', 'contract_expiry_date',
    'photo_url', 'documents', 'created_by', 'created_at', 'job_title', 'manager_id', 'department_id'
  ],
  warehouse_transfers: [
    'id', 'company_id', 'transfer_number', 'from_warehouse_id', 'to_warehouse_id',
    'from_warehouse_name', 'to_warehouse_name', 'date', 'description', 'created_by', 'created_at'
  ],
  warehouse_transfer_items: [
    'id', 'transfer_id', 'product_id', 'product_name', 'product_code', 'quantity', 'unit_cost', 'total_cost', 'company_id', 'created_at'
  ],
  opening_stock_balances: [
    'id', 'company_id', 'document_number', 'date', 'debit_account_id', 'debit_account_name', 
    'credit_account_id', 'credit_account_name', 'description', 'created_by', 'created_at'
  ],
  opening_stock_items: [
    'id', 'opening_stock_id', 'product_id', 'product_name', 'product_code', 'warehouse_id', 
    'warehouse_name', 'quantity', 'unit_cost', 'total_cost', 'company_id', 'created_at'
  ],
  stock_adjustments: [
    'id', 'company_id', 'adjustment_number', 'date', 'account_id', 'account_name', 'description', 'created_by', 'created_at'
  ],
  stock_adjustment_items: [
    'id', 'adjustment_id', 'product_id', 'product_name', 'product_code', 'warehouse_id', 
    'warehouse_name', 'quantity', 'unit_cost', 'total_cost', 'company_id', 'created_at'
  ],
  templates: [
    'id', 'company_id', 'name', 'description', 'paper_size_id', 'orientation', 
    'margin_top', 'margin_bottom', 'margin_left', 'margin_right', 'is_active', 
    'created_at', 'updated_at', 'layout', 'document_type', 'is_default', 'print_profile_id'
  ],
  paper_sizes: [
    'id', 'name', 'width', 'height', 'unit', 'is_system', 'company_id'
  ],
  template_versions: [
    'id', 'template_id', 'company_id', 'version_number', 'layout', 'change_notes', 'created_by', 'created_at'
  ],
  print_profiles: [
    'id', 'company_id', 'name', 'paper_size_id', 'custom_width', 'custom_height',
    'orientation', 'margin_top', 'margin_bottom', 'margin_left', 'margin_right',
    'dpi', 'print_settings', 'created_at', 'updated_at'
  ],
  dashboards: [
    'id', 'company_id', 'owner_user_id', 'name', 'description', 'is_default', 'is_system', 'icon', 'created_at', 'updated_at'
  ],
  widgets: [
    'id', 'dashboard_id', 'widget_type', 'title', 'x', 'y', 'w', 'h', 'settings', 'filters', 'order', 'visible', 'locked', 'created_at', 'updated_at'
  ],
  attendance: [
    'id', 'company_id', 'employee_id', 'employee_name', 'date', 'check_in', 'check_out', 'status', 'created_at'
  ],
  payroll: [
    'id', 'company_id', 'employee_id', 'employee_name', 'month', 'year', 'date', 'basic_salary', 'allowances', 'deductions', 'net_salary', 'status', 'created_at'
  ],
  assets: [
    'id', 'company_id', 'code', 'name', 'category', 'purchase_date', 'purchase_cost', 'current_value', 'depreciation_rate', 'status', 'created_at'
  ],
  goods_receipts: [
    'id', 'company_id', 'receipt_number', 'supplier_id', 'supplier_name', 'warehouse_id', 'warehouse_name', 'date', 'notes', 'status', 'document_origin', 'created_automatically', 'source_document_type', 'source_document_id', 'source_document_number', 'created_by', 'billing_status', 'created_at', 'updated_at'
  ],
  goods_receipt_items: [
    'id', 'goods_receipt_id', 'company_id', 'product_id', 'product_name', 'product_code', 'unit', 'quantity', 'unit_cost', 'total_cost', 'batch_id', 'serial_number', 'notes', 'billed_quantity', 'remaining_quantity', 'created_at'
  ],
  purchase_invoice_goods_receipts: [
    'id', 'purchase_invoice_id', 'goods_receipt_id', 'created_at'
  ],
  pos_branch_linking_codes: [
    'id', 'company_id', 'department_id', 'warehouse_id', 'code', 'status', 'expires_at', 'created_by', 'created_at', 'used_at', 'used_by_device'
  ],
  eta_settings: [
    'id', 'company_id', 'environment', 'activity_code', 'branch_id',
    'country_code', 'governorate', 'city', 'street', 'building_number',
    'postal_code', 'client_id', 'client_secret', 'operating_key', 'last_notification_at',
    'is_configured', 'created_at', 'updated_at'
  ],
  eta_unit_types: [
    'code', 'name_ar', 'name_en', 'symbol', 'description', 'is_active', 'created_at'
  ],
  eta_tax_types: [
    'code', 'name_ar', 'name_en', 'description', 'is_active', 'created_at'
  ],
  eta_tax_subtypes: [
    'code', 'tax_type_code', 'name_ar', 'name_en', 'description', 'default_rate', 'is_active', 'created_at'
  ],
  eta_governorates: [
    'code', 'name_ar', 'name_en', 'country_code', 'is_active', 'created_at'
  ],
  eta_documents: [
    'id', 'company_id', 'uuid', 'submission_uuid', 'long_id', 'internal_id', 'type_name',
    'document_type_name', 'document_type_version', 'direction', 'status', 'date_time_issued',
    'date_time_received', 'issuer_id', 'issuer_name', 'issuer_type', 'issuer_address',
    'receiver_id', 'receiver_name', 'receiver_type', 'receiver_address', 'total_sales_amount',
    'total_discount_amount', 'net_amount', 'tax_amount', 'total_amount', 'extra_discount_amount',
    'total_items_discount_amount', 'currency', 'raw_data', 'created_at', 'updated_at', 'last_synced_at'
  ],
  eta_supplier_mappings: [
    'id', 'company_id', 'eta_tax_number', 'eta_supplier_name', 'supplier_id', 'notes', 'created_at', 'updated_at'
  ],
  eta_item_mappings: [
    'id', 'company_id', 'eta_item_code', 'eta_item_name', 'eta_item_type', 'product_id', 'notes', 'created_at', 'updated_at'
  ]
};

