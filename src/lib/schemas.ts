import { z } from 'zod';

// Basic metadata
const BaseSchema = z.object({
  id: z.string().optional(),
  company_id: z.string(),
  created_at: z.string().optional(),
  created_by: z.string().optional(),
});

// Journal Entry Items
export const JournalEntryItemSchema = z.object({
  account_id: z.string(),
  account_name: z.string(),
  debit: z.coerce.number().default(0),
  credit: z.coerce.number().default(0),
  description: z.string().optional(),
  customer_id: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  supplier_id: z.string().nullable().optional(),
  supplier_name: z.string().nullable().optional(),
  sub_account_id: z.string().nullable().optional(),
  sub_account_type: z.enum(['customer', 'supplier', 'payment_method', 'expense', 'other']).nullable().optional(),
});

// Journal Entry (The Double Entry Core)
export const JournalEntrySchema = BaseSchema.extend({
  date: z.string(),
  description: z.string(),
  reference_id: z.string().optional(),
  reference_type: z.string().optional(), // 'invoice', 'payment', 'receipt', 'expense', etc.
  reference_number: z.string().optional(),
  items: z.array(JournalEntryItemSchema).min(2),
  total_debit: z.coerce.number().default(0),
  total_credit: z.coerce.number().default(0),
}).refine((data) => Math.abs(data.total_debit - data.total_credit) < 0.01, {
  message: "Debit and Credit must be balanced",
  path: ["total_debit"],
});

// Invoice Payload
export const InvoiceItemSchema = z.object({
  product_id: z.string(),
  product_name: z.string().optional(),
  quantity: z.coerce.number().default(0),
  unit_price: z.coerce.number().default(0),
  total: z.coerce.number().default(0),
  barcode: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
});

export const InvoiceSchema = BaseSchema.extend({
  invoice_number: z.string(),
  date: z.string(),
  customer_id: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  supplier_id: z.string().nullable().optional(),
  supplier_name: z.string().nullable().optional(),
  items: z.array(InvoiceItemSchema),
  subtotal: z.coerce.number().default(0),
  discount_amount: z.coerce.number().default(0),
  tax_amount: z.coerce.number().default(0).optional(),
  total_amount: z.coerce.number().default(0),
  payment_type: z.enum(['cash', 'credit']).default('credit'),
  payment_method_id: z.string().nullable().optional(),
  payment_method_name: z.string().nullable().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  settlements: z.array(z.any()).optional().nullable(),
  settlement_number: z.string().optional().nullable(),
  settlement_date: z.string().optional().nullable(),
  operation_id: z.string().nullable().optional(),
  department_id: z.string().nullable().optional(),
  cost_center_id: z.string().nullable().optional(),
  currency_id: z.string().nullable().optional(),
  exchange_rate: z.coerce.number().default(1),
});

// Voucher (Receipt/Payment)
export const VoucherItemSchema = z.object({
  type: z.enum(['supplier', 'customer', 'expense', 'account']),
  entity_id: z.string(),
  entity_name: z.string().optional(),
  amount: z.coerce.number().default(0),
  description: z.string().optional(),
  settlements: z.array(z.any()).optional(),
  settlement_number: z.string().optional().nullable(),
  settlement_date: z.string().optional().nullable(),
});

export const VoucherSchema = BaseSchema.extend({
  voucher_number: z.string(),
  internal_reference: z.string().optional(),
  manual_reference: z.string().optional(),
  date: z.string(),
  amount: z.coerce.number().default(0),
  notes: z.string().optional(),
  description: z.string().optional(),
  customer_id: z.string().nullable().optional(),
  supplier_id: z.string().nullable().optional(),
  expense_category_id: z.string().nullable().optional(),
  payment_method_id: z.string().nullable().optional(),
  items: z.array(VoucherItemSchema).optional(),
  type: z.enum(['receipt', 'payment']),
});

// Chart of Accounts
export const AccountSchema = BaseSchema.extend({
  code: z.string(),
  name: z.string(),
  type_id: z.string(),
  opening_balance: z.coerce.number().default(0),
  opening_balance_date: z.string().optional(),
});

// Return Schema
export const ReturnSchema = BaseSchema.extend({
  return_number: z.string(),
  date: z.string(),
  customer_id: z.string().nullable().optional(),
  supplier_id: z.string().nullable().optional(),
  items: z.array(InvoiceItemSchema),
  total_amount: z.coerce.number().default(0),
  payment_type: z.enum(['cash', 'credit']).default('credit'),
  payment_method_id: z.string().nullable().optional(),
  payment_method_name: z.string().nullable().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

// Purchase Invoice Schema (if distinct, currently using InvoiceSchema)
export const PurchaseInvoiceSchema = InvoiceSchema;

// Cash Transfer
export const CashTransferSchema = BaseSchema.extend({
  date: z.string(),
  amount: z.coerce.number().positive(),
  from_payment_method_id: z.string(),
  to_payment_method_id: z.string(),
  from_payment_method_name: z.string().optional(),
  to_payment_method_name: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  transfer_number: z.string().optional(),
});

// Discount
export const DiscountSchema = BaseSchema.extend({
  date: z.string(),
  amount: z.coerce.number().positive(),
  customer_id: z.string().nullable().optional(),
  supplier_id: z.string().nullable().optional(),
  account_id: z.string().nullable().optional(),
  number: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  type: z.enum(['customer', 'supplier']),
});

// Types exported for convenience
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type JournalEntryItem = z.infer<typeof JournalEntryItemSchema>;
export type Voucher = z.infer<typeof VoucherSchema>;
export type CashTransfer = z.infer<typeof CashTransferSchema>;
export type Discount = z.infer<typeof DiscountSchema>;
export type Return = z.infer<typeof ReturnSchema>;
