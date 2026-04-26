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
  debit: z.number().min(0),
  credit: z.number().min(0),
  description: z.string().optional(),
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  supplier_id: z.string().optional(),
  supplier_name: z.string().optional(),
});

// Journal Entry (The Double Entry Core)
export const JournalEntrySchema = BaseSchema.extend({
  date: z.string(),
  description: z.string(),
  reference_id: z.string().optional(),
  reference_type: z.string().optional(), // 'invoice', 'payment', 'receipt', 'expense', etc.
  reference_number: z.string().optional(),
  items: z.array(JournalEntryItemSchema).min(2),
  total_debit: z.number().min(0),
  total_credit: z.number().min(0),
}).refine((data) => Math.abs(data.total_debit - data.total_credit) < 0.01, {
  message: "Debit and Credit must be balanced",
  path: ["total_debit"],
});

// Invoice Payload
export const InvoiceItemSchema = z.object({
  product_id: z.string(),
  product_name: z.string(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const InvoiceSchema = BaseSchema.extend({
  invoice_number: z.string(),
  date: z.string(),
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  supplier_id: z.string().optional(),
  supplier_name: z.string().optional(),
  items: z.array(InvoiceItemSchema),
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

// Voucher (Receipt/Payment)
export const VoucherSchema = BaseSchema.extend({
  voucher_number: z.string(),
  date: z.string(),
  amount: z.number().nonnegative(),
  notes: z.string().optional(),
  description: z.string().optional(),
  customer_id: z.string().optional(),
  supplier_id: z.string().optional(),
  expense_category_id: z.string().optional(),
  payment_method_id: z.string().optional(),
  type: z.enum(['receipt', 'payment']),
});

// Chart of Accounts
export const AccountSchema = BaseSchema.extend({
  code: z.string(),
  name: z.string(),
  type_id: z.string(),
  opening_balance: z.number(),
  opening_balance_date: z.string().optional(),
});

// Return Schema
export const ReturnSchema = BaseSchema.extend({
  return_number: z.string(),
  date: z.string(),
  customer_id: z.string().optional(),
  supplier_id: z.string().optional(),
  items: z.array(InvoiceItemSchema),
  total_amount: z.number(),
  payment_type: z.enum(['cash', 'credit']),
  payment_method_id: z.string().optional(),
  notes: z.string().optional(),
});

// Cash Transfer
export const CashTransferSchema = BaseSchema.extend({
  date: z.string(),
  amount: z.number().positive(),
  from_payment_method_id: z.string(),
  to_payment_method_id: z.string(),
  from_payment_method_name: z.string().optional(),
  to_payment_method_name: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

// Discount
export const DiscountSchema = BaseSchema.extend({
  date: z.string(),
  amount: z.number().positive(),
  customer_id: z.string().optional(),
  supplier_id: z.string().optional(),
  account_id: z.string().optional(),
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
