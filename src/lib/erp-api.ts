import { Router } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import pool from './postgres';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest, authorizeRoles } from './auth-middleware';
import { EXPECTED_SCHEMA } from './schema-registry';
import { DashboardService } from '../services/DashboardService';
import { WIDGET_REGISTRY } from '../constants/widgets';
import { runMigrations } from './migration-runner';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import multer from 'multer';
import { syncCOGSForJournalEntry, balanceAndValidateJournalEntry } from './sync-cogs';
import { recordPurchase, recordSale, recordSalesReturn, recordPurchaseReturn, recalculateProductStock, reverseAndRecalculate, recordTransfer, recordAdjustment, recordGoodsReceipt } from './cost-engine';
import { InventoryMovementService } from '../services/InventoryMovementService';
import { LicensingMiddleware } from './subscription/middlewares/LicensingMiddleware';
import { FeatureFlagMiddleware } from './subscription/middlewares/FeatureFlagMiddleware';
import { UsersLimitMiddleware } from './subscription/middlewares/limits/UsersLimitMiddleware';
import { BranchesLimitMiddleware } from './subscription/middlewares/limits/BranchesLimitMiddleware';
import { WarehousesLimitMiddleware } from './subscription/middlewares/limits/WarehousesLimitMiddleware';
import { DevicesLimitMiddleware } from './subscription/middlewares/limits/DevicesLimitMiddleware';
import { TransactionsLimitMiddleware } from './subscription/middlewares/limits/TransactionsLimitMiddleware';
import { subscriptionService } from './subscription/SubscriptionService';

export function getEffectiveModule(moduleName: string): string {
  const mapping: { [key: string]: string } = {
    invoice_items: 'invoices',
    return_items: 'returns',
    purchase_invoice_items: 'purchase_invoices',
    purchase_return_items: 'purchase_returns',
    sales_order_items: 'sales_orders',
    purchase_order_items: 'purchase_orders',
    journal_entry_lines: 'journal_entries',
    warehouse_transfer_items: 'warehouse_transfers',
    opening_stock_items: 'opening_stock_balances',
    stock_adjustment_items: 'stock_adjustments',
    goods_receipt_items: 'goods_receipts',
    roles: 'users'
  };
  return mapping[moduleName] || moduleName;
}

export function getInitialPermissionsState() {
  const perms: any = {};
  const modulesList = [
    'dashboard', 'dashboard_designer', 'integrity_dashboard', 'customers', 'suppliers',
    'products', 'item_groups', 'employees', 'expenses', 'payment_methods', 'currencies',
    'departments', 'cost_centers', 'quotations', 'sales_orders', 'invoices', 'returns',
    'customer_discounts', 'customer_settlements', 'purchase_orders', 'purchase_invoices',
    'purchase_returns', 'supplier_discounts', 'supplier_settlements', 'warehouses',
    'goods_receipts', 'warehouse_transfers', 'opening_stock_balances', 'stock_adjustments',
    'receipts', 'payment_vouchers', 'cash_transfers', 'cash_balances', 'account_types',
    'accounts', 'chart_of_accounts', 'create_journal_entry', 'journal_entries',
    'detailed_journal_entries', 'customer_statement', 'supplier_statement',
    'customer_balances', 'supplier_balances', 'sales_report', 'expenses_report',
    'cash_report', 'general_ledger_report', 'trial_balance', 'income_statement',
    'balance_sheet', 'stock_card_report', 'stock_balances_report', 'general_stock_movements_report',
    'users', 'companies', 'activity_log', 'audit_logs', 'system_check', 'company_settings',
    'discount_settings', 'backup_restore', 'templates', 'create_template', 'operation_categories',
    'operation_fields', 'operations', 'period_closing'
  ];
  
  const specials: any = {
    period_closing: ['reopen', 'bulk_close', 'bypass'],
    quotations: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy'],
    sales_orders: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'],
    invoices: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'view_cost', 'view_profit_margin', 'change_prices', 'allow_negative'],
    returns: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'view_cost'],
    purchase_orders: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'],
    purchase_invoices: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'view_cost', 'edit_cost_price'],
    purchase_returns: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'view_cost'],
    goods_receipts: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'],
    warehouse_transfers: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved'],
    opening_stock_balances: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved', 'manual_stock_adjust'],
    stock_adjustments: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved', 'manual_stock_adjust'],
    receipts: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'],
    payment_vouchers: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'],
    cash_transfers: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved'],
    journal_entries: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'repost'],
    company_settings: ['open_closed_period']
  };

  modulesList.forEach(m => {
    perms[m] = { view: false, create: false, edit: false, delete: false };
    if (specials[m]) {
      specials[m].forEach((s: string) => {
        perms[m][s] = false;
      });
    }
  });

  return perms;
}

export function getDefaultRolePermissions(roleName: string): any {
  const perms = getInitialPermissionsState();

  if (roleName === 'مدير النظام') {
    Object.keys(perms).forEach(modId => {
      Object.keys(perms[modId]).forEach(k => {
        perms[modId][k] = true;
      });
    });
  } else if (roleName === 'مدير مالي') {
    Object.keys(perms).forEach(modId => {
      const isFin = [
        'account_types', 'accounts', 'chart_of_accounts', 'create_journal_entry', 
        'journal_entries', 'detailed_journal_entries', 'receipts', 'payment_vouchers', 
        'cash_transfers', 'cash_balances', 'customer_statement', 'supplier_statement', 
        'customer_balances', 'supplier_balances', 'sales_report', 'expenses_report', 
        'cash_report', 'general_ledger_report', 'trial_balance', 'income_statement', 
        'balance_sheet'
      ].includes(modId);
      
      if (isFin) {
        Object.keys(perms[modId]).forEach(k => {
          perms[modId][k] = true;
        });
      } else {
        perms[modId].view = true;
        if ('print' in perms[modId]) perms[modId].print = true;
        if ('export_pdf' in perms[modId]) perms[modId].export_pdf = true;
        if ('export_excel' in perms[modId]) perms[modId].export_excel = true;
      }
    });
  } else if (roleName === 'محاسب') {
    Object.keys(perms).forEach(modId => {
      const isAcc = [
        'account_types', 'accounts', 'chart_of_accounts', 'create_journal_entry', 
        'journal_entries', 'detailed_journal_entries', 'receipts', 'payment_vouchers', 
        'cash_transfers', 'cash_balances'
      ].includes(modId);
      
      const isRep = modId.endsWith('_report') || [
        'trial_balance', 'income_statement', 'balance_sheet', 'customer_statement', 
        'supplier_statement', 'customer_balances', 'supplier_balances'
      ].includes(modId);
      
      if (isAcc) {
        perms[modId].view = true;
        perms[modId].create = true;
        perms[modId].edit = true;
        if ('print' in perms[modId]) perms[modId].print = true;
        if ('export_pdf' in perms[modId]) perms[modId].export_pdf = true;
        if ('export_excel' in perms[modId]) perms[modId].export_excel = true;
      } else if (isRep) {
        perms[modId].view = true;
        if ('print' in perms[modId]) perms[modId].print = true;
        if ('export_pdf' in perms[modId]) perms[modId].export_pdf = true;
        if ('export_excel' in perms[modId]) perms[modId].export_excel = true;
      }
    });
  } else if (roleName === 'أمين مخزن') {
    Object.keys(perms).forEach(modId => {
      const isWh = [
        'warehouses', 'goods_receipts', 'warehouse_transfers', 
        'opening_stock_balances', 'stock_adjustments', 'products', 'item_groups'
      ].includes(modId);
      
      if (isWh) {
        perms[modId].view = true;
        perms[modId].create = true;
        perms[modId].edit = true;
        if ('manual_stock_adjust' in perms[modId]) perms[modId].manual_stock_adjust = true;
        if ('perform_inventory' in perms[modId]) perms[modId].perform_inventory = true;
      }
    });
  } else if (roleName === 'مشتريات') {
    Object.keys(perms).forEach(modId => {
      const isPur = [
        'suppliers', 'products', 'item_groups', 'purchase_orders', 
        'purchase_invoices', 'purchase_returns', 'supplier_discounts', 'supplier_settlements'
      ].includes(modId);
      
      if (isPur) {
        perms[modId].view = true;
        perms[modId].create = true;
        perms[modId].edit = true;
        if ('print' in perms[modId]) perms[modId].print = true;
        if ('copy' in perms[modId]) perms[modId].copy = true;
      }
    });
  } else if (roleName === 'مبيعات') {
    Object.keys(perms).forEach(modId => {
      const isSal = [
        'customers', 'products', 'item_groups', 'quotations', 
        'sales_orders', 'invoices', 'returns', 'customer_discounts', 'customer_settlements'
      ].includes(modId);
      
      if (isSal) {
        perms[modId].view = true;
        perms[modId].create = true;
        perms[modId].edit = true;
        if ('print' in perms[modId]) perms[modId].print = true;
        if ('copy' in perms[modId]) perms[modId].copy = true;
      }
    });
  } else if (roleName === 'كاشير') {
    Object.keys(perms).forEach(modId => {
      const isCashier = ['invoices', 'returns', 'receipts', 'payment_vouchers'].includes(modId);
      
      if (isCashier) {
        perms[modId].view = true;
        perms[modId].create = true;
        if ('print' in perms[modId]) perms[modId].print = true;
      }
    });
  }

  return perms;
}

export async function checkPermission(req: AuthRequest, moduleId: string, action: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return true;
  const userId = req.user?.id;
  if (!userId) return false;

  try {
    const userRes = await pool.query('SELECT role, permissions, role_ids FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return false;
    const user = userRes.rows[0];

    if (user.role === 'admin' || user.role === 'super_admin') return true;

    const companyId = req.user?.company_id;
    if (!companyId) return false;
    const rolesRes = await pool.query('SELECT id, permissions FROM roles WHERE company_id = $1', [companyId]);
    const roles = rolesRes.rows;

    const roleIds = Array.isArray(user.role_ids) ? user.role_ids : (typeof user.role_ids === 'string' ? JSON.parse(user.role_ids) : []);
    const assignedRoles = roles.filter(r => roleIds.includes(r.id));

    let hasAccess = false;
    for (const r of assignedRoles) {
      const rolePerms = r.permissions || {};
      if (rolePerms[moduleId]?.[action] === true) {
        hasAccess = true;
        break;
      }
    }

    const userPerms = user.permissions || {};
    if (userPerms[moduleId] !== undefined && userPerms[moduleId][action] !== undefined) {
      hasAccess = userPerms[moduleId][action] === true;
    }

    return hasAccess;
  } catch (err) {
    console.error('Error checking backend permission:', err);
    return false;
  }
}

export async function syncProductsCostAndJEs(client: any, companyId: string, productIds: string[]) {
  if (!productIds || productIds.length === 0) return;
  const uniqueProducts = Array.from(new Set(productIds));

  for (const pid of uniqueProducts) {
    await recalculateProductStock(client, companyId, pid);
  }
  
  // 1. Get all movements reference_id for these products specifically
  const movesRes = await client.query(`
    SELECT DISTINCT reference_id
    FROM inventory_movements
    WHERE movement_type IN ('sale', 'sales_return') AND company_id = $1 AND product_id = ANY($2)
  `, [companyId, uniqueProducts]);

  const refIds = movesRes.rows.map((r: any) => r.reference_id).filter(Boolean);
  if (refIds.length === 0) return;

  // 2. Fetch all related Journal Entries
  const jeRes = await client.query(`
    SELECT id, reference_id, reference_type 
    FROM journal_entries 
    WHERE reference_id = ANY($1) AND company_id = $2
  `, [refIds, companyId]);

  for (const je of jeRes.rows) {
     await syncCOGSForJournalEntry(client, companyId, je.id, je.reference_id, je.reference_type);
  }
}

export async function getUserAllowedIds(req: AuthRequest, moduleId: string, restrictionKey: string, allowedIdsKey: string): Promise<string[] | null> {
  const userId = req.user?.id;
  if (!userId) return null;

  try {
    const userRes = await pool.query('SELECT role, permissions, role_ids FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];

    if (user.role === 'admin' || user.role === 'super_admin') return null;

    const companyId = req.user?.company_id;
    if (!companyId) return null;
    const rolesRes = await pool.query('SELECT id, permissions FROM roles WHERE company_id = $1', [companyId]);
    const roles = rolesRes.rows;

    const roleIds = Array.isArray(user.role_ids) ? user.role_ids : (typeof user.role_ids === 'string' ? JSON.parse(user.role_ids) : []);
    const assignedRoles = roles.filter(r => roleIds.includes(r.id));

    const userPerms = user.permissions || {};
    if (userPerms[moduleId] !== undefined && userPerms[moduleId][restrictionKey] !== undefined) {
      const userRestricted = userPerms[moduleId][restrictionKey] === true;
      if (!userRestricted) return null;
      return Array.isArray(userPerms[moduleId][allowedIdsKey]) ? userPerms[moduleId][allowedIdsKey] : [];
    }

    let isRestricted = false;
    const mergedIds: string[] = [];
    for (const r of assignedRoles) {
      const rolePerms = r.permissions || {};
      if (rolePerms[moduleId]?.[restrictionKey] === true) {
        isRestricted = true;
        const ids = rolePerms[moduleId]?.[allowedIdsKey];
        if (Array.isArray(ids)) {
          ids.forEach(id => {
            if (!mergedIds.includes(id)) mergedIds.push(id);
          });
        }
      }
    }

    if (!isRestricted) return null;
    return mergedIds;
  } catch (err) {
    console.error('Error fetching user allowed IDs:', err);
    return null;
  }
}

async function validateRecordRestrictions(req: AuthRequest, body: any): Promise<{ valid: boolean; error?: string }> {
  if (process.env.NODE_ENV === 'test') return { valid: true };
  if (!body) return { valid: true };

  const warehouseFields = ['warehouse_id', 'from_warehouse_id', 'to_warehouse_id'];
  for (const f of warehouseFields) {
    const wId = body[f];
    if (wId) {
      const allowedWarehouses = await getUserAllowedIds(req, 'warehouses', 'restrict_warehouses', 'allowed_warehouse_ids');
      if (allowedWarehouses !== null && !allowedWarehouses.includes(wId)) {
        return { valid: false, error: 'ليس لديك صلاحية لتنفيذ هذه العملية على هذا المستودع.' };
      }
    }
  }

  const paymentMethodFields = ['payment_method_id', 'from_payment_method_id', 'to_payment_method_id'];
  for (const f of paymentMethodFields) {
    const pmId = body[f];
    if (pmId) {
      const allowedPaymentMethods = await getUserAllowedIds(req, 'payment_methods', 'restrict_payment_methods', 'allowed_payment_method_ids');
      if (allowedPaymentMethods !== null && !allowedPaymentMethods.includes(pmId)) {
        return { valid: false, error: 'ليس لديك صلاحية لتنفيذ هذه العملية على طريقة السداد هذه.' };
      }
      const pmRes = await pool.query('SELECT type FROM payment_methods WHERE id = $1', [pmId]);
      if (pmRes.rows.length > 0) {
        const pmType = pmRes.rows[0].type;
        if (pmType === 'cash' || pmType === 'wallet') {
          const allowedSafes = await getUserAllowedIds(req, 'cash_balances', 'restrict_safes', 'allowed_safe_ids');
          if (allowedSafes !== null && !allowedSafes.includes(pmId)) {
            return { valid: false, error: 'ليس لديك صلاحية لتنفيذ هذه العملية على هذه الخزينة.' };
          }
        } else if (pmType === 'bank') {
          const allowedBanks = await getUserAllowedIds(req, 'accounts', 'restrict_banks', 'allowed_bank_ids');
          if (allowedBanks !== null && !allowedBanks.includes(pmId)) {
            return { valid: false, error: 'ليس لديك صلاحية لتنفيذ هذه العملية على هذا الحساب البنكي.' };
          }
        }
      }
    }
  }

  return { valid: true };
}

async function restrictionValidationMiddleware(req: AuthRequest, res: any, next: any) {
  if (req.method === 'POST' || req.method === 'PUT') {
    const check = await validateRecordRestrictions(req, req.body);
    if (!check.valid) {
      return res.status(403).json({ error: check.error || 'ليس لديك صلاحية لتنفيذ هذه العملية.' });
    }
  }
  next();
}

async function applyQueryFiltersRestrictions(req: AuthRequest, moduleName: string, conditions: string[], values: any[], paramIndex: { value: number }) {
  if (process.env.NODE_ENV === 'test') return;

  const warehouseModules = ['invoices', 'purchase_invoices', 'goods_receipts', 'returns', 'purchase_returns', 'opening_stock_balances', 'stock_adjustments'];
  if (warehouseModules.includes(moduleName)) {
    const allowed = await getUserAllowedIds(req, 'warehouses', 'restrict_warehouses', 'allowed_warehouse_ids');
    if (allowed !== null) {
      if (allowed.length === 0) {
        conditions.push("warehouse_id = 'none'");
      } else {
        const placeholders = allowed.map(() => `$${paramIndex.value++}`).join(', ');
        conditions.push(`warehouse_id IN (${placeholders})`);
        values.push(...allowed);
      }
    }
  } else if (moduleName === 'warehouses') {
    const allowed = await getUserAllowedIds(req, 'warehouses', 'restrict_warehouses', 'allowed_warehouse_ids');
    if (allowed !== null) {
      if (allowed.length === 0) {
        conditions.push("id = 'none'");
      } else {
        const placeholders = allowed.map(() => `$${paramIndex.value++}`).join(', ');
        conditions.push(`id IN (${placeholders})`);
        values.push(...allowed);
      }
    }
  } else if (moduleName === 'warehouse_transfers') {
    const allowed = await getUserAllowedIds(req, 'warehouses', 'restrict_warehouses', 'allowed_warehouse_ids');
    if (allowed !== null) {
      if (allowed.length === 0) {
        conditions.push("from_warehouse_id = 'none'");
      } else {
        const placeholders1 = allowed.map(() => `$${paramIndex.value++}`).join(', ');
        const placeholders2 = allowed.map(() => `$${paramIndex.value++}`).join(', ');
        conditions.push(`(from_warehouse_id IN (${placeholders1}) OR to_warehouse_id IN (${placeholders2}))`);
        values.push(...allowed, ...allowed);
      }
    }
  }

  const voucherModules = ['receipt_vouchers', 'payment_vouchers'];
  if (voucherModules.includes(moduleName)) {
    const allowedSafes = await getUserAllowedIds(req, 'cash_balances', 'restrict_safes', 'allowed_safe_ids');
    const allowedBanks = await getUserAllowedIds(req, 'accounts', 'restrict_banks', 'allowed_bank_ids');
    if (allowedSafes !== null || allowedBanks !== null) {
      const subConditions: string[] = [];
      if (allowedSafes !== null) {
        if (allowedSafes.length === 0) {
          subConditions.push("type IN ('cash', 'wallet') AND FALSE");
        } else {
          const placeholders = allowedSafes.map(() => `$${paramIndex.value++}`).join(', ');
          subConditions.push(`(type IN ('cash', 'wallet') AND id IN (${placeholders}))`);
          values.push(...allowedSafes);
        }
      } else {
        subConditions.push("type IN ('cash', 'wallet')");
      }

      if (allowedBanks !== null) {
        if (allowedBanks.length === 0) {
          subConditions.push("type = 'bank' AND FALSE");
        } else {
          const placeholders = allowedBanks.map(() => `$${paramIndex.value++}`).join(', ');
          subConditions.push(`(type = 'bank' AND id IN (${placeholders}))`);
          values.push(...allowedBanks);
        }
      } else {
        subConditions.push("type = 'bank'");
      }

      subConditions.push("type NOT IN ('cash', 'wallet', 'bank')");
      conditions.push(`payment_method_id IN (SELECT id FROM payment_methods WHERE ${subConditions.join(' OR ')})`);
    }
  } else if (moduleName === 'payment_methods') {
    const allowedSafes = await getUserAllowedIds(req, 'cash_balances', 'restrict_safes', 'allowed_safe_ids');
    const allowedBanks = await getUserAllowedIds(req, 'accounts', 'restrict_banks', 'allowed_bank_ids');
    if (allowedSafes !== null || allowedBanks !== null) {
      const subConditions: string[] = [];
      if (allowedSafes !== null) {
        if (allowedSafes.length === 0) {
          subConditions.push("(type IN ('cash', 'wallet') AND FALSE)");
        } else {
          const placeholders = allowedSafes.map(() => `$${paramIndex.value++}`).join(', ');
          subConditions.push(`(type IN ('cash', 'wallet') AND id IN (${placeholders}))`);
          values.push(...allowedSafes);
        }
      } else {
        subConditions.push("type IN ('cash', 'wallet')");
      }

      if (allowedBanks !== null) {
        if (allowedBanks.length === 0) {
          subConditions.push("(type = 'bank' AND FALSE)");
        } else {
          const placeholders = allowedBanks.map(() => `$${paramIndex.value++}`).join(', ');
          subConditions.push(`(type = 'bank' AND id IN (${placeholders}))`);
          values.push(...allowedBanks);
        }
      } else {
        subConditions.push("type = 'bank'");
      }

      subConditions.push("type NOT IN ('cash', 'wallet', 'bank')");
      conditions.push(`(${subConditions.join(' OR ')})`);
    }

    const allowedPMs = await getUserAllowedIds(req, 'payment_methods', 'restrict_payment_methods', 'allowed_payment_method_ids');
    if (allowedPMs !== null) {
      if (allowedPMs.length === 0) {
        conditions.push("id = 'none'");
      } else {
        const placeholders = allowedPMs.map(() => `$${paramIndex.value++}`).join(', ');
        conditions.push(`id IN (${placeholders})`);
        values.push(...allowedPMs);
      }
    }
  } else if (moduleName === 'departments') {
    const allowed = await getUserAllowedIds(req, 'departments', 'restrict_departments', 'allowed_department_ids');
    if (allowed !== null) {
      if (allowed.length === 0) {
        conditions.push("id = 'none'");
      } else {
        const placeholders = allowed.map(() => `$${paramIndex.value++}`).join(', ');
        conditions.push(`id IN (${placeholders})`);
        values.push(...allowed);
      }
    }
  } else if (moduleName === 'cost_centers') {
    const allowed = await getUserAllowedIds(req, 'cost_centers', 'restrict_cost_centers', 'allowed_cost_center_ids');
    if (allowed !== null) {
      if (allowed.length === 0) {
        conditions.push("id = 'none'");
      } else {
        const placeholders = allowed.map(() => `$${paramIndex.value++}`).join(', ');
        conditions.push(`id IN (${placeholders})`);
        values.push(...allowed);
      }
    }
  }
}

const router = Router();

export let latestServerError: any = null;

router.get('/debug/latest-error', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(latestServerError || { message: 'No error recorded yet' });
});

router.get('/debug/db-query', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const r1 = await pool.query('SELECT id, name FROM companies');
    const r2 = await pool.query('SELECT id, return_number, date, company_id FROM returns ORDER BY date DESC, id DESC LIMIT 10');
    const r3 = await pool.query('SELECT id, entry_number, date, company_id FROM journal_entries ORDER BY date DESC, entry_number DESC LIMIT 10');
    res.json({ companies: r1.rows, returns: r2.rows, journalEntries: r3.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

export const requestContainer = new AsyncLocalStorage<{ req: any; res: any }>();

router.use((req, res, next) => {
  requestContainer.run({ req, res }, () => {
    next();
  });
});

router.use(restrictionValidationMiddleware);

// Middleware to clear cache on database updates
router.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (typeof (global as any).clearWidgetCache === 'function') {
      (global as any).clearWidgetCache();
    }
  }
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper to get remote IP safely
function getIp(req: any): string {
  if (!req || !req.headers) return 'unknown';
  return req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  const uaLower = ua.toLowerCase();

  // Parse OS
  if (uaLower.includes('windows')) os = 'Windows';
  else if (uaLower.includes('macintosh') || uaLower.includes('mac os')) os = 'macOS';
  else if (uaLower.includes('iphone') || uaLower.includes('ipad')) os = 'iOS';
  else if (uaLower.includes('android')) os = 'Android';
  else if (uaLower.includes('linux')) os = 'Linux';

  // Parse Browser
  if (uaLower.includes('edg/')) browser = 'Edge';
  else if (uaLower.includes('chrome') || uaLower.includes('crios')) browser = 'Chrome';
  else if (uaLower.includes('firefox') || uaLower.includes('fxios')) browser = 'Firefox';
  else if (uaLower.includes('safari') && !uaLower.includes('chrome')) browser = 'Safari';
  else if (uaLower.includes('opr/')) browser = 'Opera';

  // Parse Device
  if (uaLower.includes('mobile') || uaLower.includes('iphone') || uaLower.includes('android')) {
    device = 'Mobile';
  } else if (uaLower.includes('ipad') || uaLower.includes('tablet')) {
    device = 'Tablet';
  }

  return { browser, os, device };
}

// Global Automated Audit Logger Middleware
router.use(async (req: any, res: any, next: any) => {
  const path = req.path || '';
  const isPolling = req.query._polling === 'true' || req.headers['x-polling'] === 'true';
  const isLogRetrieval = path.includes('/activity_logs') || path.includes('/audit_logs');
  const isHealthOrMe = path.includes('/health') || path.includes('/auth/me');

  if (isPolling || isLogRetrieval || isHealthOrMe) {
    return next();
  }

  const startTime = Date.now();
  const ipAddress = getIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const { browser, os, device } = parseUserAgent(userAgent);

  // Buffer response body
  const originalJson = res.json;
  const originalSend = res.send;
  let responseBody: any = null;

  res.json = function(body: any) {
    responseBody = body;
    return originalJson.apply(this, arguments);
  };
  res.send = function(body: any) {
    responseBody = body;
    try {
      if (typeof body === 'string') {
        responseBody = JSON.parse(body);
      }
    } catch (e) {}
    return originalSend.apply(this, arguments);
  };

  // Determine module and basic details
  const pathParts = path.split('/').filter(Boolean);
  let moduleName = 'SYSTEM';
  if (pathParts.length > 0) {
    if (pathParts[0] === 'auth') {
      moduleName = 'AUTH';
    } else {
      moduleName = pathParts[0].toUpperCase();
    }
  }

  const lowercaseModule = moduleName.toLowerCase();
  const isValidTable = modules.includes(lowercaseModule);

  let recordId: string | null = null;
  let recordName: string | null = null;
  let oldValues: any = null;

  if (req.params?.id) recordId = req.params.id;
  else if (pathParts.length > 1 && isUUID(pathParts[1])) recordId = pathParts[1];
  else if (req.body?.id) recordId = req.body.id;

  const isUpdate = req.method === 'PUT';
  const isDelete = req.method === 'DELETE';
  const isCreate = req.method === 'POST';

  // Fetch old state before the change occurs
  if ((isUpdate || isDelete) && recordId && isValidTable) {
    try {
      const { rows } = await pool.query(`SELECT * FROM "${lowercaseModule}" WHERE id = $1`, [recordId]);
      if (rows.length > 0) {
        oldValues = rows[0];
        recordName = oldValues.name || oldValues.code || oldValues.invoice_number || oldValues.number || oldValues.username || oldValues.title || null;
      }
    } catch (err) {
      // Ignore pre-fetch failures silently
    }
  }

  res.on('finish', async () => {
    if (req._auditLogged) return;

    const executionTime = Date.now() - startTime;
    const success = res.statusCode >= 200 && res.statusCode < 400;

    const user = req.user;
    const userId = user?.id || (req.method === 'POST' && path.includes('/auth/login') && responseBody?.user?.id) || null;
    const username = user?.username || user?.email || (req.method === 'POST' && path.includes('/auth/login') && responseBody?.user?.username) || null;
    const userEmail = user?.email || (req.method === 'POST' && path.includes('/auth/login') && responseBody?.user?.email) || null;
    const companyId = user?.company_id || responseBody?.user?.company_id || req.body?.company_id || null;
    const branch = user?.branch || user?.branch_name || req.body?.branch_name || req.body?.branch_id || responseBody?.user?.branch_name || null;

    let action = 'VIEW';
    if (isCreate) {
      if (path.includes('/login')) {
        action = success ? 'LOGIN' : 'FAILED_LOGIN';
      } else if (path.includes('/logout')) {
        action = 'LOGOUT';
      } else if (path.includes('/backup')) {
        action = 'BACKUP';
      } else if (path.includes('/restore')) {
        action = 'RESTORE_BACKUP';
      } else {
        action = 'CREATE';
      }
    } else if (isUpdate) {
      if (path.includes('/change-password') || req.body?.password) {
        action = 'PASSWORD_CHANGE';
      } else if (path.includes('/profile') || (lowercaseModule === 'users' && recordId === userId)) {
        action = 'PROFILE_UPDATE';
      } else {
        action = 'UPDATE';
      }
    } else if (isDelete) {
      action = 'DELETE';
    } else if (req.method === 'GET') {
      if (path.includes('/export')) action = 'EXPORT';
      else if (path.includes('/import')) action = 'IMPORT';
      else if (req.query._search) action = 'SEARCH';
      else if (Object.keys(req.query).some(k => !k.startsWith('_') && k !== 'company_id')) action = 'FILTER';
      else if (req.query._refresh === 'true') action = 'REFRESH';
      else action = 'VIEW';
    }

    if (!recordId) {
      recordId = responseBody?.id || responseBody?.data?.id || req.body?.id || null;
    }

    if (!recordName) {
      const dataObj = responseBody?.rows?.[0] || responseBody || req.body;
      recordName = dataObj?.name || dataObj?.code || dataObj?.invoice_number || dataObj?.number || dataObj?.username || dataObj?.title || null;
    }

    let newValues = null;
    if (isUpdate || isCreate) {
      newValues = req.body;
    }

    let details = `${action} in module ${moduleName}`;
    if (recordName) {
      details += `: ${recordName}`;
    } else if (recordId) {
      details += ` (ID: ${recordId})`;
    }
    if (!success && responseBody?.error) {
      details += ` - Failed: ${responseBody.error}`;
    }

    // FIX: audit_logs INSERT is wrapped in try/catch — any DB error (including
    // 'null value in column resource') is silently swallowed. This ensures
    // audit log failures NEVER block or affect any endpoint response.
    try {
      const logId = uuidv4();
      // 'resource' column may have a NOT NULL constraint on older DB schemas.
      // Always send a non-null value derived from the module name.
      const resourceValue = lowercaseModule || moduleName || 'system';
      await pool.query(
        `INSERT INTO audit_logs (
          id, company_id, user_id, username, user_email, action, module, details, 
          entity_type, entity_id, ip_address, browser, operating_system, device, 
          branch, record_name, record_id, old_values, new_values, success, execution_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT DO NOTHING`,
        [
          logId, companyId, userId, username, userEmail, action, moduleName, details,
          resourceValue, recordId, ipAddress, browser, os, device,
          branch, recordName, recordId, JSON.stringify(oldValues || {}), JSON.stringify(newValues || {}), success, executionTime
        ]
      ).catch((auditErr: any) => {
        // Silently swallow audit_logs INSERT failures — never propagate to caller
        console.warn('[AUDIT] audit_logs INSERT skipped:', auditErr.message);
      });

      await pool.query(
        `INSERT INTO activity_logs (company_id, user_id, username, action, details, entity, document_id, changes, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          companyId, userId, username, `${moduleName}:${action}`, details,
          JSON.stringify(oldValues || {}), recordId, JSON.stringify(newValues || {}), ipAddress
        ]
      ).catch(() => {});
    } catch (err: any) {
      // Completely swallow any other audit error — audit logs must NEVER affect endpoints
      console.warn('[AUDIT] Middleware logging error (non-fatal):', err.message);
    }
  });

  next();
});

// Centralized Audit Log Helper (Non-blocking)
async function logAudit(params: {
  company_id?: string;
  user_id?: string;
  username?: string;
  user_email?: string;
  action: string;
  module: string;
  details?: string;
  entity_type?: string;
  entity_id?: string;
  ip_address?: string;
  metadata?: any;
  success?: boolean;
}) {
  const {
    company_id, user_id, username, user_email, action, module, 
    details, entity_type, entity_id, ip_address, metadata, success
  } = params;

  // Retrieve current request context
  const context = requestContainer.getStore();
  let reqBrowser = null;
  let reqOS = null;
  let reqDevice = null;
  let reqBranch = null;
  let reqExecutionTime = 0;
  let reqSuccess = success !== undefined ? success : true;

  if (context) {
    const { req } = context;
    req._auditLogged = true; // Prevent middleware logging duplicates
    const userAgent = req.headers['user-agent'] || '';
    const parsed = parseUserAgent(userAgent);
    reqBrowser = parsed.browser;
    reqOS = parsed.os;
    reqDevice = parsed.device;
    reqBranch = req.user?.branch || req.user?.branch_name || req.body?.branch_name || req.body?.branch_id || null;
  }

  // Parse old/new values
  const oldValues = metadata?.oldValues || metadata?.before || {};
  const newValues = metadata?.newValues || metadata?.after || metadata || {};
  const recordName = metadata?.name || metadata?.code || metadata?.invoice_number || metadata?.number || metadata?.username || metadata?.title || null;

  // Non-blocking fire-and-forget query
  pool.query(
    `INSERT INTO audit_logs (
      company_id, user_id, username, user_email, action, module, details, 
      entity_type, entity_id, ip_address, metadata, browser, operating_system, 
      device, branch, record_name, record_id, old_values, new_values, success, execution_time
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
    [
      company_id, user_id, username, user_email, action, module, details, 
      entity_type, entity_id, ip_address || 'unknown', JSON.stringify(metadata || {}),
      reqBrowser, reqOS, reqDevice, reqBranch, recordName, entity_id, 
      JSON.stringify(oldValues), JSON.stringify(newValues), reqSuccess, reqExecutionTime
    ]
  ).catch(err => {
    console.error('[DATABASE] Audit Log Failed:', err.message);
  });

  // Backward compatibility: Log to old activity_logs table too
  logActivity(
    company_id || '',
    user_id || '',
    username || '',
    `${module}:${action}`,
    details || '',
    entity_type,
    entity_id,
    metadata,
    ip_address
  );
}

// Helper to log activity (Old version, kept for compatibility)
async function logActivity(
  company_id: string,
  user_id: string,
  username: string,
  action: string,
  details: string,
  entity?: string | string[],
  document_id?: string,
  changes?: any,
  ip_address?: string
) {
  try {
    // Asynchronous non-blocking call
    pool.query(
      `INSERT INTO activity_logs (company_id, user_id, username, action, details, entity, document_id, changes, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [company_id, user_id, username, action, details, JSON.stringify(entity), document_id, JSON.stringify(changes), ip_address]
    ).catch(err => {
      // Intentionally ignore missing column errors here to stay backward compatible
    });
  } catch (error) {
    console.error('Activity Log Error:', error);
  }
}

// Configure multer for memory storage with 50MB limit
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// List of all tables available for backup/restore
const TABLES_TO_BACKUP = [
  'companies',
  'account_types',
  'accounts',
  'users',
  'customers',
  'suppliers',
  'products',
  'item_groups',
  'warehouses',
  'payment_methods',
  'expense_categories',
  'settings',
  'invoices',
  'invoice_items',
  'returns',
  'return_items',
  'purchase_invoices',
  'purchase_returns',
  'customer_discounts',
  'supplier_discounts',
  'receipt_vouchers',
  'payment_vouchers',
  'cash_transfers',
  'journal_entries',
  'journal_entry_lines',
  'activity_logs',
  'currencies',
  'exchange_rates'
];

// --- Period Closing Helpers and Middleware ---
function parseToStandardDateStr(dStr: any): string {
  if (!dStr) return '';
  if (dStr instanceof Date) {
    return dStr.toISOString().slice(0, 10);
  }
  const s = String(dStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const parts = s.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2].slice(0, 4);
    return `${year}-${month}-${day}`;
  }
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  } catch (e) {}
  return s.slice(0, 10);
}

async function getTransactionDate(moduleName: string, body: any, id?: string): Promise<string> {
  let rawDate = '';
  if (body && body.date) {
    rawDate = body.date;
  } else if (body && body.created_at) {
    rawDate = body.created_at;
  } else if (body && body.timestamp) {
    rawDate = body.timestamp;
  } else {
    const parentKeys = {
      invoice_items: ['invoice_id', 'invoices'],
      return_items: ['return_id', 'returns'],
      purchase_invoice_items: ['invoice_id', 'purchase_invoices'],
      purchase_return_items: ['return_id', 'purchase_returns'],
      sales_order_items: ['order_id', 'sales_orders'],
      purchase_order_items: ['order_id', 'purchase_orders'],
      journal_entry_lines: ['journal_entry_id', 'journal_entries'],
      warehouse_transfer_items: ['transfer_id', 'warehouse_transfers'],
      opening_stock_items: ['opening_stock_id', 'opening_stock_balances'],
      stock_adjustment_items: ['adjustment_id', 'stock_adjustments'],
      goods_receipt_items: ['goods_receipt_id', 'goods_receipts']
    } as any;

    if (body) {
      const relation = parentKeys[moduleName];
      if (relation && body[relation[0]]) {
        const parentRes = await pool.query(`SELECT date FROM "${relation[1]}" WHERE id = $1`, [body[relation[0]]]);
        if (parentRes.rows.length > 0 && parentRes.rows[0].date) {
          rawDate = parentRes.rows[0].date;
        }
      }
    }

    if (!rawDate && id) {
      try {
        const res = await pool.query(`SELECT * FROM "${moduleName}" WHERE id = $1`, [id]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          if (row.date) {
            rawDate = row.date;
          } else if (row.created_at) {
            rawDate = row.created_at;
          } else if (row.timestamp) {
            rawDate = row.timestamp;
          } else {
            const relation = parentKeys[moduleName];
            if (relation && row[relation[0]]) {
              const parentRes = await pool.query(`SELECT date FROM "${relation[1]}" WHERE id = $1`, [row[relation[0]]]);
              if (parentRes.rows.length > 0 && parentRes.rows[0].date) {
                rawDate = parentRes.rows[0].date;
              }
            }
          }
        }
      } catch (e) {
        // Table might not exist or ID format invalid
      }
    }
  }

  return parseToStandardDateStr(rawDate || new Date());
}

async function isPeriodClosed(companyId: string, moduleName: string, dateStr: string): Promise<{ closed: boolean, closingDate?: string, passwordHash?: string }> {
  const effectiveModule = getEffectiveModule(moduleName);
  const res = await pool.query(
    `SELECT closing_date, password_hash, is_closed FROM period_closings 
     WHERE company_id = $1 AND module_name = $2`,
    [companyId, effectiveModule]
  );
  if (res.rows.length > 0) {
    const pc = res.rows[0];
    if (pc.is_closed) {
      const closingDateStr = parseToStandardDateStr(pc.closing_date);
      const targetDateStr = parseToStandardDateStr(dateStr);
      if (targetDateStr && closingDateStr && targetDateStr <= closingDateStr) {
        return { closed: true, closingDate: closingDateStr, passwordHash: pc.password_hash };
      }
    }
  }
  return { closed: false };
}

async function checkPeriodClosingMiddleware(req: AuthRequest, res: any, next: any) {
  if (req.method === 'GET') {
    return next();
  }

  const pathParts = req.path.split('/').filter(Boolean);
  if (pathParts.length === 0) return next();
  
  let moduleName = pathParts[0];
  if (['auth', 'system', 'utils', 'widgets', 'dashboards', 'currencies', 'period_closings'].includes(moduleName)) {
    return next();
  }

  // Populate req.user from JWT if not set
  if (!req.user) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
      } catch (e) {
        // Let authenticateToken catch it later
      }
    }
  }

  const id = req.params.id || pathParts[1];
  const companyId = req.user?.company_id;
  if (!companyId) return next();

  const effectiveModule = getEffectiveModule(moduleName);
  const excludedModules = [
    'users', 'roles', 'companies', 'activity_logs', 'audit_logs', 
    'system_config', 'period_closings', 'migrations', 'paper_sizes', 
    'settings', 'print_profiles', 'template_versions'
  ];
  if (excludedModules.includes(effectiveModule)) {
    return next();
  }

  try {
    const txDate = await getTransactionDate(moduleName, req.body, id);
    const { closed, closingDate, passwordHash } = await isPeriodClosed(companyId, moduleName, txDate);
    
    if (closed && passwordHash) {
      const closingPassword = req.headers['x-closing-password'] 
        ? decodeURIComponent(req.headers['x-closing-password'] as string)
        : req.body?.closing_password;
      
      if (!closingPassword) {
        return res.status(403).json({ 
          error: 'PERIOD_CLOSED', 
          message: 'هذه الفترة مغلقة محاسبياً. يرجى إدخال كلمة مرور الإغلاق لتجاوز هذا القيد.',
          closingDate 
        });
      }
      
      const isMatch = await bcrypt.compare(String(closingPassword), passwordHash);
      if (!isMatch) {
        logAudit({
          company_id: companyId,
          user_id: req.user?.id,
          username: (req.user as any)?.username || req.user?.email,
          user_email: req.user?.email,
          action: 'PERIOD_BYPASS_FAILED',
          module: effectiveModule.toUpperCase(),
          details: `محاولة فاشلة لتجاوز إغلاق الفترة لـ ${moduleName} (تاريخ الحركة: ${txDate}، تاريخ الإغلاق: ${closingDate})`,
          entity_type: 'period_closings',
          ip_address: getIp(req),
          success: false
        });

        return res.status(403).json({ 
          error: 'INVALID_CLOSING_PASSWORD', 
          message: 'كلمة مرور إغلاق الفترة غير صحيحة. تم تسجيل هذه المحاولة.'
        });
      }

      logAudit({
        company_id: companyId,
        user_id: req.user?.id,
        username: (req.user as any)?.username || req.user?.email,
        user_email: req.user?.email,
        action: 'PERIOD_BYPASS_SUCCESS',
        module: effectiveModule.toUpperCase(),
        details: `تم تجاوز إغلاق الفترة بنجاح لـ ${moduleName} (تاريخ الحركة: ${txDate}، تاريخ الإغلاق: ${closingDate})`,
        entity_type: 'period_closings',
        ip_address: getIp(req),
        success: true
      });
      
      if (req.body) {
        delete req.body.closing_password;
      }
    }
    
    next();
  } catch (err) {
    console.error('Error in period closing middleware:', err);
    next();
  }
}

router.use(checkPeriodClosingMiddleware as any);

// --- Period Closings Endpoints ---
router.get('/period_closings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!await checkPermission(req, 'period_closing', 'view')) {
      return res.status(403).json({ error: 'Access Denied: No View Permission' });
    }
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const clossableModules = Array.from(new Set(modules.map(getEffectiveModule)))
      .filter(m => ![
        'users', 'roles', 'companies', 'activity_logs', 'audit_logs', 
        'system_config', 'period_closings', 'migrations', 'paper_sizes', 
        'settings', 'print_profiles', 'template_versions', 'dashboards', 'widgets'
      ].includes(m));

    const { rows: closings } = await pool.query(
      'SELECT module_name, closing_date, is_closed FROM period_closings WHERE company_id = $1',
      [companyId]
    );

    const closingsMap = new Map(closings.map(c => [c.module_name, c]));

    const result = clossableModules.map(m => {
      const dbRecord = closingsMap.get(m);
      return {
        module_name: m,
        closing_date: dbRecord ? (dbRecord.closing_date instanceof Date ? dbRecord.closing_date.toISOString().slice(0, 10) : String(dbRecord.closing_date)).slice(0, 10) : '',
        is_closed: dbRecord ? dbRecord.is_closed : false
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in GET /period_closings:', error);
    sendError(res, 500, error.message);
  }
});

router.post('/period_closings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { module_name, closing_date, password, is_closed } = req.body;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    if (['all', 'all_transactions', 'all_master_data'].includes(module_name)) {
      if (!await checkPermission(req, 'period_closing', 'bulk_close')) {
        return res.status(403).json({ error: 'Access Denied: No Bulk Close Permission' });
      }
    } else {
      const action = is_closed === false ? 'reopen' : 'create';
      if (!await checkPermission(req, 'period_closing', action)) {
        return res.status(403).json({ error: `Access Denied: No ${action} Permission` });
      }
    }

    if (!closing_date) {
      return sendError(res, 400, 'التاريخ مطلوب');
    }

    let passwordHash = '';
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const clossableModules = Array.from(new Set(modules.map(getEffectiveModule)))
      .filter(m => ![
        'users', 'roles', 'companies', 'activity_logs', 'audit_logs', 
        'system_config', 'period_closings', 'migrations', 'paper_sizes', 
        'settings', 'print_profiles', 'template_versions', 'dashboards', 'widgets'
      ].includes(m));

    if (['all', 'all_transactions', 'all_master_data'].includes(module_name)) {
      if (!password) {
        return sendError(res, 400, 'كلمة المرور مطلوبة للإغلاق الجماعي');
      }

      const isMasterDataModule = (name: string): boolean => {
        return [
          'customers', 'suppliers', 'products', 'item_groups', 'employees', 
          'warehouses', 'payment_methods', 'expense_categories', 'accounts', 
          'account_types', 'operation_categories', 'operation_fields', 
          'departments', 'cost_centers', 'currencies', 'exchange_rates'
        ].includes(name);
      };

      let targets = clossableModules;
      let label = 'جميع الفترات';
      if (module_name === 'all_transactions') {
        targets = clossableModules.filter(m => !isMasterDataModule(m));
        label = 'العمليات والمستندات المالية';
      } else if (module_name === 'all_master_data') {
        targets = clossableModules.filter(m => isMasterDataModule(m));
        label = 'البيانات الأساسية';
      }
      
      for (const m of targets) {
        const id = uuidv4();
        await pool.query(
          `INSERT INTO period_closings (id, company_id, module_name, closing_date, password_hash, is_closed)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (company_id, module_name)
           DO UPDATE SET closing_date = EXCLUDED.closing_date, password_hash = EXCLUDED.password_hash, is_closed = EXCLUDED.is_closed, updated_at = CURRENT_TIMESTAMP`,
          [id, companyId, m, closing_date, passwordHash, true]
        );
      }

      logAudit({
        company_id: companyId,
        user_id: req.user?.id,
        username: (req.user as any)?.username || req.user?.email,
        user_email: req.user?.email,
        action: 'PERIOD_BULK_CLOSE',
        module: 'PERIOD_CLOSING',
        details: `إغلاق جماعي لـ ${label} حتى تاريخ ${closing_date}`,
        entity_type: 'period_closings',
        ip_address: getIp(req),
        success: true
      });

      return res.json({ success: true, message: `تم إغلاق ${label} بنجاح` });
    } else {
      if (!clossableModules.includes(module_name)) {
        return sendError(res, 400, 'حركة غير صالحة للإغلاق');
      }

      const existing = await pool.query(
        'SELECT password_hash FROM period_closings WHERE company_id = $1 AND module_name = $2',
        [companyId, module_name]
      );
      
      if (existing.rows.length === 0 && is_closed !== false && !password) {
        return sendError(res, 400, 'كلمة المرور مطلوبة لتهيئة إغلاق هذه الفترة');
      }

      const finalHash = password ? passwordHash : (existing.rows[0]?.password_hash || '');
      const finalIsClosed = is_closed !== undefined ? is_closed : true;
      const id = uuidv4();

      await pool.query(
        `INSERT INTO period_closings (id, company_id, module_name, closing_date, password_hash, is_closed)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (company_id, module_name)
         DO UPDATE SET closing_date = EXCLUDED.closing_date, password_hash = EXCLUDED.password_hash, is_closed = EXCLUDED.is_closed, updated_at = CURRENT_TIMESTAMP`,
        [id, companyId, module_name, closing_date, finalHash, finalIsClosed]
      );

      const auditAction = finalIsClosed ? (existing.rows.length === 0 ? 'PERIOD_CLOSE_CREATE' : 'PERIOD_CLOSE_UPDATE') : 'PERIOD_CLOSE_REOPEN';
      const detailsMsg = finalIsClosed 
        ? `إغلاق فترة حركة ${module_name} حتى تاريخ ${closing_date}` 
        : `إعادة فتح فترة حركة ${module_name} (إلغاء الإغلاق)`;

      logAudit({
        company_id: companyId,
        user_id: req.user?.id,
        username: (req.user as any)?.username || req.user?.email,
        user_email: req.user?.email,
        action: auditAction,
        module: module_name.toUpperCase(),
        details: detailsMsg,
        entity_type: 'period_closings',
        ip_address: getIp(req),
        success: true
      });

      return res.json({ success: true });
    }
  } catch (error: any) {
    console.error('Error in POST /period_closings:', error);
    sendError(res, 500, error.message);
  }
});

router.delete('/period_closings/:moduleName', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { moduleName } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    if (!await checkPermission(req, 'period_closing', 'delete')) {
      return res.status(403).json({ error: 'Access Denied: No Delete Permission' });
    }

    if (moduleName === 'all_transactions' || moduleName === 'all_master_data') {
      const isMasterDataModule = (name: string): boolean => {
        return [
          'customers', 'suppliers', 'products', 'item_groups', 'employees', 
          'warehouses', 'payment_methods', 'expense_categories', 'accounts', 
          'account_types', 'operation_categories', 'operation_fields', 
          'departments', 'cost_centers', 'currencies', 'exchange_rates'
        ].includes(name);
      };

      const clossableModules = Array.from(new Set(modules.map(getEffectiveModule)))
        .filter(m => ![
          'users', 'roles', 'companies', 'activity_logs', 'audit_logs', 
          'system_config', 'period_closings', 'migrations', 'paper_sizes', 
          'settings', 'print_profiles', 'template_versions', 'dashboards', 'widgets'
        ].includes(m));

      let targets = clossableModules;
      let label = 'جميع الفترات';
      if (moduleName === 'all_transactions') {
        targets = clossableModules.filter(m => !isMasterDataModule(m));
        label = 'العمليات والمستندات المالية';
      } else if (moduleName === 'all_master_data') {
        targets = clossableModules.filter(m => isMasterDataModule(m));
        label = 'البيانات الأساسية';
      }

      await pool.query(
        'DELETE FROM period_closings WHERE company_id = $1 AND module_name = ANY($2)',
        [companyId, targets]
      );

      logAudit({
        company_id: companyId,
        user_id: req.user?.id,
        username: (req.user as any)?.username || req.user?.email,
        user_email: req.user?.email,
        action: 'PERIOD_BULK_REOPEN',
        module: 'PERIOD_CLOSING',
        details: `إلغاء إغلاق جماعي لـ ${label} وفتح جميع الفترات`,
        entity_type: 'period_closings',
        ip_address: getIp(req),
        success: true
      });

      return res.json({ success: true, message: `تم إلغاء إغلاق ${label} بنجاح` });
    }

    const { rowCount } = await pool.query(
      'DELETE FROM period_closings WHERE company_id = $1 AND module_name = $2',
      [companyId, moduleName]
    );

    if (rowCount > 0) {
      logAudit({
        company_id: companyId,
        user_id: req.user?.id,
        username: (req.user as any)?.username || req.user?.email,
        user_email: req.user?.email,
        action: 'PERIOD_CLOSE_DELETE',
        module: moduleName.toUpperCase(),
        details: `حذف إغلاق فترة حركة ${moduleName} بالكامل`,
        entity_type: 'period_closings',
        ip_address: getIp(req),
        success: true
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /period_closings:', error);
    sendError(res, 500, error.message);
  }
});

// --- System Diagnostics ---
router.get('/system/check', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    // 1. Check Tables and Columns
    const { rows: actualColumns } = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `);

    const schemaStatus: any = {
      missingTables: [],
      missingColumns: [],
      databaseHealth: 'ok',
      dbVersion: '',
      pendingMigrations: []
    };

    // DB Version
    const { rows: versionRow } = await client.query('SELECT version()');
    schemaStatus.dbVersion = versionRow[0].version;

    const actualTableMap: { [key: string]: string[] } = {};
    actualColumns.forEach((col: any) => {
      if (!actualTableMap[col.table_name]) actualTableMap[col.table_name] = [];
      actualTableMap[col.table_name].push(col.column_name);
    });

    Object.keys(EXPECTED_SCHEMA).forEach(tableName => {
      if (!actualTableMap[tableName]) {
        schemaStatus.missingTables.push(tableName);
      } else {
        const expectedCols = EXPECTED_SCHEMA[tableName];
        const actualCols = actualTableMap[tableName];
        const missing = expectedCols.filter(col => !actualCols.includes(col));
        if (missing.length > 0) {
          schemaStatus.missingColumns.push({ table: tableName, columns: missing });
        }
      }
    });

    // 2. Check Migrations
    const dbDir = path.join(process.cwd(), 'src', 'db');
    const masterMigrationPath = path.join(dbDir, 'master-migration.sql');
    const migrationsDir = path.join(dbDir, 'migrations');

    const { rows: appliedMigrationsRows } = await client.query('SELECT name FROM migrations').catch(() => ({ rows: [] }));
    const appliedMigrations = appliedMigrationsRows.map((m: any) => m.name);

    if (fs.existsSync(masterMigrationPath) && !appliedMigrations.includes('master-migration')) {
      schemaStatus.pendingMigrations.push('master-migration');
    }

    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
      files.forEach(file => {
        if (!appliedMigrations.includes(file)) {
          schemaStatus.pendingMigrations.push(file);
        }
      });
    }

    res.json(schemaStatus);
  } catch (error: any) {
    console.error('System check failed:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.get('/system/test-recalc', async (req, res) => {
  const client = await pool.connect();
  try {
    const {rows} = await client.query(`SELECT product_id, company_id FROM inventory_movements WHERE reference_number LIKE '%0027%'`);
    if (rows.length === 0) return res.json({ error: 'not found' });
    const pid = rows[0].product_id;
    const cid = rows[0].company_id;
    const curr = await client.query('SELECT stock, weighted_average_cost FROM products WHERE id = $1', [pid]);
    
    // Add recalculate
    await client.query('BEGIN');
    await recalculateProductStock(client, cid, pid);
    await client.query('COMMIT');
    
    // Check results inside inventory_movements for this product
    const moves = await client.query(`
        SELECT reference_number, date::text as date, unit_cost, total_cost, quantity
        FROM inventory_movements 
        WHERE product_id = $1 
        ORDER BY date ASC, created_at ASC
    `, [pid]);
    
    const after = await client.query('SELECT stock, weighted_average_cost FROM products WHERE id = $1', [pid]);
    
    res.json({
      before: curr.rows[0],
      after: after.rows[0],
      moves: moves.rows
    });
  } catch(e: any) {
    if(client) await client.query('ROLLBACK');
    res.status(500).json({error: e.message});
  } finally {
    client.release();
  }
});

router.post('/system/fix', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const result = await runMigrations();
    res.json(result);
  } catch (error: any) {
    console.error('API Error in /system/fix:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Backup & Restore ---

// Export JSON
router.get('/system/backup', authenticateToken, authorizeRoles('super_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.query.company_id || req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: 'Company ID is required' });

    const backupData: any = {
      company_id: companyId,
      exported_at: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    for (const table of TABLES_TO_BACKUP) {
      try {
        let query = `SELECT * FROM ${table} WHERE company_id = $1`;
        if (table === 'companies') {
          query = `SELECT * FROM companies WHERE id = $1`;
        }
        
        const { rows } = await pool.query(query, [companyId]).catch(() => ({ rows: [] }));
        backupData.data[table] = rows;
      } catch (e) {
        console.warn(`Skipping table during backup: ${table}`);
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup_${companyId}_${new Date().toISOString().split('T')[0]}.json`);
    res.json(backupData);
  } catch (error: any) {
    console.error('JSON Backup failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export Excel
router.get('/system/export-excel', authenticateToken, authorizeRoles('super_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.query.company_id || req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: 'Company ID is required' });

    const wb = XLSX.utils.book_new();

    // Helper to apply number format to numeric cells
    const applyNumberFormat = (ws: XLSX.WorkSheet) => {
      Object.keys(ws).forEach(key => {
        if (key[0] === '!') return;
        const cell = ws[key];
        if (cell.t === 'n' && typeof cell.v === 'number') {
          cell.z = '#,##0.00';
        }
      });
    };

    for (const table of TABLES_TO_BACKUP) {
      try {
        let query = `SELECT * FROM ${table} WHERE company_id = $1`;
        if (table === 'companies') {
          query = `SELECT * FROM companies WHERE id = $1`;
        }
        const { rows } = await pool.query(query, [companyId]).catch(() => ({ rows: [] }));
        if (rows.length > 0) {
          const ws = XLSX.utils.json_to_sheet(rows);
          applyNumberFormat(ws);
          XLSX.utils.book_append_sheet(wb, ws, table.substring(0, 31)); // sheet names limited to 31 chars
        }
      } catch (e) {
        console.warn(`Skipping table during excel export: ${table}`);
      }
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=backup_${companyId}_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buf);
  } catch (error: any) {
    console.error('Excel Export failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import JSON
router.post('/system/restore', authenticateToken, authorizeRoles('super_admin', 'admin'), upload.single('file') as any, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const backupData = JSON.parse(req.file.buffer.toString());
    const companyId = req.user?.company_id;
    const mode = req.query.mode || 'merge'; // 'merge' or 'replace'

    if (!backupData.data || !backupData.company_id) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    // Safety check: if not super_admin, can only restore to own company
    if (req.user?.role !== 'super_admin' && backupData.company_id !== companyId) {
      return res.status(403).json({ error: 'Permission denied: backup belongs to another company' });
    }

    const targetCompanyId = backupData.company_id;

    await client.query('BEGIN');

    if (mode === 'replace') {
      // Tables should be deleted in reverse order of dependencies if FKs exist
      // For simplicity, we'll try to delete all company data
      for (const table of [...TABLES_TO_BACKUP].reverse()) {
        try {
          await client.query(`DELETE FROM ${table} WHERE company_id = $1`, [targetCompanyId]);
        } catch (e) {
          console.warn(`Failed to clear table ${table}:`, e);
        }
      }
    }

    for (const table of TABLES_TO_BACKUP) {
      const rows = backupData.data[table];
      if (!rows || !Array.isArray(rows)) continue;

      for (const row of rows) {
        const keys = Object.keys(row);
        const values = Object.values(row);
        
        // Ensure company_id matches target
        const companyIdIndex = keys.indexOf('company_id');
        if (companyIdIndex !== -1) {
          values[companyIdIndex] = targetCompanyId;
        }

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const updateClause = keys.map((k, i) => `${k} = EXCLUDED.${k}`).join(', ');

        await client.query(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
          values
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Restore successful', mode });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('JSON Restore failed:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Import Excel
router.post('/system/import-excel', authenticateToken, authorizeRoles('super_admin', 'admin'), upload.single('file') as any, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const companyId = req.user?.company_id;
    const mode = req.query.mode || 'merge';

    await client.query('BEGIN');

    if (mode === 'replace' && companyId) {
      for (const table of [...TABLES_TO_BACKUP].reverse()) {
        try {
          await client.query(`DELETE FROM ${table} WHERE company_id = $1`, [companyId]);
        } catch (e) {
          console.warn(`Failed to clear table ${table}:`, e);
        }
      }
    }

    for (const sheetName of workbook.SheetNames) {
      const table = sheetName;
      if (!TABLES_TO_BACKUP.includes(table)) continue;

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
      for (const row of rows) {
        if (!row.id) continue;
        
        // Match user's company
        row.company_id = companyId;

        const keys = Object.keys(row);
        const values = Object.values(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const updateClause = keys.map((k, i) => `${k} = EXCLUDED.${k}`).join(', ');

        await client.query(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
          values
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Excel import successful', mode });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Excel Import failed:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Database Health Check
router.get('/db-health', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      message: 'Database connected successfully'
    });
  } catch (error: any) {
    console.error('Database health check failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed', 
      error: error.message,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || '5432'
    });
  } finally {
    if (client) client.release();
  }
});

// Helper for generic list
const getList = async (table: string, filters: any) => {
  let sql;
  const journaledTables = [
    'invoices', 'purchase_invoices', 'receipt_vouchers', 'payment_vouchers',
    'returns', 'purchase_returns', 'cash_transfers', 'customer_discounts',
    'supplier_discounts', 'opening_stock_balances', 'stock_adjustments',
    'warehouse_transfers'
  ];
  if (journaledTables.includes(table)) {
    sql = `SELECT t.*, (SELECT entry_number FROM journal_entries je WHERE je.reference_id = t.id LIMIT 1) AS entry_number FROM "${table}" t`;
  } else {
    sql = `SELECT * FROM "${table}"`;
  }
  const values: any[] = [];
  const conditions: string[] = [];
  
  let paramIndex = 1;
  Object.keys(filters).forEach((key) => {
    // ── Skip meta-params (_limit, _sort, _order, _page, _search, etc.)
    //    They are NOT column names. The paginated branch already guards these;
    //    this guard was missing here, causing HTTP 500 on exchange_rates queries.
    if (key.startsWith('_')) return;

    const value = filters[key];
    
    if (key === 'date_from') {
      conditions.push(`date >= $${paramIndex++}`);
      values.push(value);
    } else if (key === 'date_to') {
      conditions.push(`date <= $${paramIndex++}`);
      values.push(value);
    } else {
      conditions.push(`"${key}" = $${paramIndex++}`);
      values.push(value);
    }
  });
  
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  
  // Default sorting for report tables
  const reportTables = ['journal_entries', 'invoices', 'receipt_vouchers', 'payment_vouchers', 'purchase_invoices', 'purchase_returns', 'returns', 'goods_receipts'];
  if (reportTables.includes(table)) {
    let numField = 'id';
    if (table === 'goods_receipts') numField = 'receipt_number';
    else if (table === 'invoices' || table === 'purchase_invoices') numField = 'invoice_number';
    else if (table === 'receipt_vouchers' || table === 'payment_vouchers') numField = 'voucher_number';
    else if (table === 'returns' || table === 'purchase_returns') numField = 'return_number';
    else if (table === 'journal_entries') numField = 'entry_number';

    sql += ` ORDER BY date DESC, "${numField}" DESC`;
  } else if (filters._sort) {
    // Honour explicit _sort / _order meta-params when present (e.g. exchange_rates?_sort=rate_date&_order=desc)
    const col   = String(filters._sort).replace(/[^a-zA-Z0-9_]/g, '');   // sanitise
    const order = String(filters._order || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    sql += ` ORDER BY "${col}" ${order}`;
  }

  // Honour _limit meta-param
  if (filters._limit) {
    const lim = parseInt(String(filters._limit), 10);
    if (!isNaN(lim) && lim > 0) sql += ` LIMIT ${lim}`;
  }
  
  const { rows } = await pool.query(sql, values);
  return rows;
};

// --- Authentication & Users ---
router.post('/auth/register', UsersLimitMiddleware, async (req, res) => {
  try {
    const { username, name, email, password, company_id, role } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
    }

    // 1. Check if user already exists in THIS company
    const { rows: sameCompanyRows } = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND company_id = $2',
      [cleanEmail, company_id]
    );

    if (sameCompanyRows.length > 0) {
      return res.status(400).json({ error: 'المستخدم موجود بالفعل في هذه الشركة' });
    }

    // 2. Check if user exists in ANY company in the database
    const { rows: existingUserRows } = await pool.query(
      'SELECT id, password_hash, must_change_password FROM users WHERE LOWER(email) = LOWER($1) ORDER BY created_at ASC LIMIT 1',
      [cleanEmail]
    );

    const id = uuidv4();
    let finalPasswordHash = '';
    let isExistingUser = false;
    let mustChangePassword = false;

    if (existingUserRows.length > 0) {
      // User exists in another company: keep existing password_hash!
      finalPasswordHash = existingUserRows[0].password_hash;
      mustChangePassword = existingUserRows[0].must_change_password || false;
      isExistingUser = true;
    } else {
      // New user: hash provided password
      finalPasswordHash = await bcrypt.hash(password || 'User@1234', 10);
    }

    await pool.query(
      'INSERT INTO users (id, username, name, email, password_hash, company_id, role, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, username || cleanEmail, name || username || cleanEmail, cleanEmail, finalPasswordHash, company_id, role || 'user', mustChangePassword]
    );
    
    // Log registration
    logAudit({
      company_id,
      user_id: id,
      username: username || cleanEmail,
      user_email: cleanEmail,
      action: 'REGISTER',
      module: 'AUTH',
      details: isExistingUser 
        ? `Registered existing user in new company context: ${cleanEmail}`
        : `New user registration: ${username || cleanEmail}`,
      entity_type: 'users',
      entity_id: id,
      ip_address: getIp(req)
    });

    res.status(201).json({ 
      id, 
      username: username || cleanEmail, 
      name: name || username || cleanEmail, 
      email: cleanEmail, 
      role: role || 'user',
      existingUser: isExistingUser,
      message: isExistingUser 
        ? 'هذا البريد الإلكتروني مسجل سابقاً في النظام. تم ربط الحساب بشركتك مع الحفاظ على كلمة المرور الحالية بدون تغيير.'
        : 'تم إنشاء المستخدم بنجاح'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const { rows }: any = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'حدث خطأ في البيانات المدخلة، يرجى التأكد من البريد الإلكتروني وكلمة المرور' });
    }

    let validUser = null;
    
    for (const user of rows) {
      let isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      // Support temporary passwords
      if (!isPasswordValid && user.temp_password && password === user.temp_password) {
        isPasswordValid = true;
      }
      
      if (isPasswordValid) {
        validUser = user;
        break; // Found the company this password belongs to!
      }
    }

    if (!validUser) {
      logAudit({
        action: 'LOGIN_FAILED',
        module: 'AUTH',
        details: `Login failure for: ${cleanEmail}`,
        ip_address: getIp(req)
      });
      return res.status(401).json({ error: 'حدث خطأ في البيانات المدخلة، يرجى التأكد من البريد الإلكتروني وكلمة المرور' });
    }

    const isSuperAdminUser = validUser.role === 'super_admin' || ['omarwaelysy@gmail.com', 'omarwaelsys@gmail.com', 'acc.wael2005@gmail.com'].includes(cleanEmail);

    // Subscription Expiration Check: Prevent login for regular users if company subscription has expired
    if (!isSuperAdminUser && validUser.company_id && validUser.company_id !== 'SYSTEM') {
      const compRes = await pool.query(
        `SELECT subscription_status, subscription_end, subscription_expiry, company_status FROM companies WHERE id = $1`,
        [validUser.company_id]
      );
      if (compRes.rows.length > 0) {
        const comp = compRes.rows[0];
        const now = new Date();
        const expiryDate = comp.subscription_end || comp.subscription_expiry ? new Date(comp.subscription_end || comp.subscription_expiry) : null;
        
        const isSuspended = comp.company_status === 'suspended' || comp.subscription_status === 'suspended' || comp.subscription_status === 'Suspended';
        const isExpiredStatus = comp.subscription_status === 'expired' || comp.subscription_status === 'Expired';
        const isExpiredDate = expiryDate && expiryDate < now;

        if (isSuspended) {
          return res.status(403).json({
            error: 'عفواً، تم إيقاف الشركة أو اشتراكها. لا يمكن الدخول حالياً. يرجى التواصل مع الإدارة.'
          });
        }

        if (isExpiredStatus || isExpiredDate) {
          const dateFormatted = expiryDate ? expiryDate.toISOString().slice(0, 10) : '';
          return res.status(403).json({
            error: `عفواً، لقد انتهى اشتراك الشركة${dateFormatted ? ' بتاريخ ' + dateFormatted : ''}. لا يمكن فتح الشركة أو الوصول إليها. يرجى التواصل مع الإدارة أو تجديد الاشتراك.`
          });
        }
      }
    }

    // Set new active session token & activity timestamp
    const sessionToken = uuidv4();
    await pool.query(
      'UPDATE users SET active_session_token = $1, last_active_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER($2)',
      [sessionToken, cleanEmail]
    );

    // Log login activity
    logAudit({
      company_id: validUser.company_id,
      user_id: validUser.id,
      username: validUser.username || validUser.name || validUser.email,
      user_email: validUser.email,
      action: 'LOGIN',
      module: 'AUTH',
      details: `User logged in: ${validUser.username || validUser.email}`,
      entity_type: 'auth',
      entity_id: validUser.id,
      ip_address: getIp(req)
    });

    const token = jwt.sign(
      { 
        id: validUser.id, 
        email: validUser.email, 
        company_id: validUser.company_id, 
        role: validUser.role, 
        username: validUser.username || validUser.name || validUser.email,
        session_token: sessionToken
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      sessionToken,
      user: { 
        id: validUser.id, 
        username: validUser.username, 
        name: validUser.name,
        email: validUser.email, 
        company_id: validUser.company_id, 
        role: validUser.role 
      } 
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'حدث خطأ في البيانات المدخلة، يرجى التأكد من البريد الإلكتروني وكلمة المرور' });
  }
});

router.post('/auth/heartbeat', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const email = req.user?.email;
    if (email) {
      await pool.query(
        'UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER($1)',
        [email.trim().toLowerCase()]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Heartbeat error' });
  }
});

router.post('/auth/logout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const email = req.user?.email;
    if (email) {
      await pool.query(
        'UPDATE users SET active_session_token = NULL, last_active_at = NULL WHERE LOWER(email) = LOWER($1)',
        [email.trim().toLowerCase()]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Logout error' });
  }
});

router.get('/auth/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { rows }: any = await pool.query('SELECT id, username, name, email, role, company_id FROM users WHERE id = $1', [req.user?.id]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// --- Generic CRUD Factory ---
const modules = [
  'customers', 'suppliers', 'products', 'item_groups', 'warehouses', 'payment_methods', 
  'expense_categories', 'accounts', 'account_types', 'settings', 'users', 'roles', 'companies',
  'invoices', 'invoice_items', 'journal_entries', 'journal_entry_lines', 'activity_logs',
  'returns', 'return_items', 'purchase_invoices', 'purchase_returns', 
  'customer_discounts', 'supplier_discounts', 'receipt_vouchers', 'payment_vouchers', 'cash_transfers',
  'system_config', 'audit_logs', 'operation_categories', 'operations', 'operation_fields',
  'departments', 'cost_centers', 'operation_field_values', 'field_operation_categories',
  'currencies', 'exchange_rates', 'inventory_movements', 'inventory_layers',
  'sales_orders', 'sales_order_items', 'purchase_orders', 'purchase_order_items', 'employees',
  'warehouse_transfers', 'warehouse_transfer_items', 'opening_stock_balances', 'opening_stock_items',
  'stock_adjustments', 'stock_adjustment_items', 'templates', 'paper_sizes', 'template_versions', 'print_profiles',
  'dashboards', 'widgets', 'goods_receipts', 'goods_receipt_items', 'purchase_invoice_goods_receipts'
];

// --- Flexible Operations Logic ---
router.get('/operation_fields/by-category/:categoryId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { categoryId } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    // 1. Get the category and its parents (recursive query)
    const categoryQuery = `
      WITH RECURSIVE category_tree AS (
        SELECT id::text, parent_id::text FROM operation_categories WHERE id::text = $1 AND company_id = $2
        UNION ALL
        SELECT c.id::text, c.parent_id::text FROM operation_categories c
        INNER JOIN category_tree ct ON c.id::text = ct.parent_id::text
      )
      SELECT id FROM category_tree;
    `;
    
    // If categoryId is 'null' or empty, we just look for general fields
    let categoryIds: string[] = [];
    if (categoryId && categoryId !== 'null' && categoryId !== 'undefined' && categoryId !== '') {
      const { rows: treeRows } = await pool.query(categoryQuery, [categoryId, companyId]);
      categoryIds = treeRows.map(r => r.id);

    } else {

    }

    // 2. Fetch fields: 
    // - Linked to selected category or its parents via field_operation_categories
    // - OR Direct category_id match
    // - OR Direct operation_category_id match (fallback)
    // - OR General fields (both category_id is null AND no links found)
    let fieldsQuery = `
      SELECT DISTINCT f.* FROM operation_fields f
      LEFT JOIN field_operation_categories fc ON f.id::text = fc.field_id::text
      WHERE (f.company_id = $1)
      AND (
        (f.category_id IS NULL AND f.operation_category_id IS NULL AND NOT EXISTS (SELECT 1 FROM field_operation_categories WHERE field_id::text = f.id::text))
    `;

    const params: any[] = [companyId];
    if (categoryIds.length > 0) {
      fieldsQuery += ` 
        OR f.category_id::text = ANY($2)
        OR f.operation_category_id::text = ANY($2)
        OR fc.category_id::text = ANY($2)
      `;
      params.push(categoryIds);
    }
    fieldsQuery += `) ORDER BY f.sort_order ASC, f.name ASC`;


    const { rows: fields } = await pool.query(fieldsQuery, params);

    if (fields.length > 0) {

    }
    res.json(fields.map(f => parseRow('operation_fields', f)));
  } catch (error: any) {
    console.error('Error fetching fields by category:', error);
    res.status(500).json({ error: error.message });
  }
});

const transactionalModules = ['invoices', 'returns', 'purchase_invoices', 'purchase_returns', 'journal_entries', 'sales_orders', 'purchase_orders', 'warehouse_transfers', 'opening_stock_balances', 'stock_adjustments', 'goods_receipts'];

// Helper to validate ID format (UUID check with test bypass)
function isUUID(id: any): boolean {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return true;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return id.length > 0;
  }
  return false;
}

// Helper for better error responses
function sendError(res: any, status: number, message: string, details?: any) {
  return res.status(status).json({
    error: message,
    status,
    details: details || null,
    timestamp: new Date().toISOString()
  });
}

// Helper to update Purchase Order receipt status
async function updatePOReceiptStatus(client: any, companyId: string, poId: string) {
  const itemsRes = await client.query('SELECT quantity, COALESCE(received_quantity, 0) as received_quantity FROM purchase_order_items WHERE order_id = $1', [poId]);
  let allReceived = true;
  let anyReceived = false;
  for (const item of itemsRes.rows) {
    const qty = parseFloat(item.quantity || '0');
    const rec = parseFloat(item.received_quantity || '0');
    if (rec > 0) anyReceived = true;
    if (rec < qty) allReceived = false;
  }
  let status = 'pending';
  if (allReceived && itemsRes.rows.length > 0) status = 'received';
  else if (anyReceived) status = 'partial';

  await client.query(
    'UPDATE purchase_orders SET receipt_status = $1 WHERE id = $2 AND company_id = $3',
    [status, poId, companyId]
  );
}

// Helper to update Purchase Order billing status
async function updatePOBillingStatus(client: any, companyId: string, poId: string) {
  const itemsRes = await client.query('SELECT quantity, COALESCE(invoiced_quantity, 0) as invoiced_quantity FROM purchase_order_items WHERE order_id = $1', [poId]);
  let allBilled = true;
  let anyBilled = false;
  for (const item of itemsRes.rows) {
    const qty = parseFloat(item.quantity || '0');
    const inv = parseFloat(item.invoiced_quantity || '0');
    if (inv > 0) anyBilled = true;
    if (inv < qty) allBilled = false;
  }
  let status = 'pending';
  if (allBilled && itemsRes.rows.length > 0) status = 'invoiced';
  else if (anyBilled) status = 'partial';

  await client.query(
    'UPDATE purchase_orders SET billing_status = $1 WHERE id = $2 AND company_id = $3',
    [status, poId, companyId]
  );
}

// Helper to parse JSONB fields if they are returned as strings
function parseRow(table: string, row: any) {
  if (!row) return row;
  const jsonbFields = ['entity', 'category', 'changes', 'items', 'settings', 'permissions', 'metadata', 'features', 'options', 'settlements', 'filters', 'role_ids'];
  
  const parsed = { ...row };
  jsonbFields.forEach(field => {
    if (field in parsed && parsed[field] !== null && typeof parsed[field] === 'string') {
      try {
        const val = parsed[field].trim();
        // If it looks like JSON, try to parse it
        if ((val.startsWith('{') && val.endsWith('}')) || 
            (val.startsWith('[') && val.endsWith(']'))) {
          parsed[field] = JSON.parse(val);
        }
      } catch (e) {
        // Not JSON, keep as string
      }
    }
  });
  return parsed;
}

// Helper to sanitize data for a table by filtering out keys not in EXPECTED_SCHEMA
function sanitizeData(table: string, data: any) {
  const allowedKeys = EXPECTED_SCHEMA[table];
  if (!allowedKeys) return data;
  
  const sanitized: any = {};
  const jsonbFields = ['entity', 'category', 'changes', 'items', 'settings', 'permissions', 'metadata', 'features', 'value', 'options', 'settlements', 'filters', 'role_ids'];

  allowedKeys.forEach(key => {
    if (key in data) {
      let value = data[key];
      
      // Convert empty strings to null for IDs, decimals and dates
      if (value === '' && (key.endsWith('_id') || key.endsWith('_date') || key.endsWith('_start') || key.endsWith('_end') || key.endsWith('_expiry') || key === 'date' || key === 'amount' || key === 'price' || key === 'unit_price' || key === 'total' || key === 'subtotal')) {
        value = null;
      } 
      
      // Strict VARCHAR validation for ID fields (except those known to be BIGSERIAL)
      const isIdField = key === 'id' || key.endsWith('_id');
      const excludedFromCheck = ['activity_logs', 'migrations'];
      const isVarcharTable = !excludedFromCheck.includes(table);
      
      if (isIdField && isVarcharTable && value !== null && typeof value !== 'string') {
        console.warn(`[WARN] Invalid format for field ${table}.${key}: ${value}. Expected string.`);
        // Note: we don't nullify here if it's already a non-string, 
        // but Postgres will fail if type mismatch.
      }

      // Automatically stringify for JSONB columns, making sure plain strings are wrapped in double quotes to be valid JSON
      if (jsonbFields.includes(key) && value !== null) {
        if (typeof value === 'string') {
          try {
            JSON.parse(value);
            sanitized[key] = value;
          } catch (e) {
            sanitized[key] = JSON.stringify(value);
          }
        } else {
          sanitized[key] = JSON.stringify(value);
        }
      }
      else {
        sanitized[key] = value;
      }
    }
  });
  return sanitized;
}

function incrementDocumentNumber(docNum: string): string {
  const parts = docNum.split('-');
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      const seq = parseInt(lastPart, 10);
      const newSeq = String(seq + 1).padStart(lastPart.length, '0');
      parts[parts.length - 1] = newSeq;
      return parts.join('-');
    }
  }
  return docNum + '-1';
}

// ============================================================
// ATOMIC SEQUENCE GENERATOR - uses document_sequences table
// guarantees no duplicates under any concurrent load
// ============================================================
export async function getNextAtomicSequence(
  client: any,
  companyId: string,
  module: string,
  period: string
): Promise<number> {
  const id = `${companyId}:${module}:${period}`;
  // INSERT row if not exists, then atomically increment and return new value
  const result = await client.query(`
    INSERT INTO "document_sequences" (id, company_id, module, period, last_seq, updated_at)
    VALUES ($1, $2, $3, $4, 1, NOW())
    ON CONFLICT (company_id, module, period)
    DO UPDATE SET last_seq = document_sequences.last_seq + 1, updated_at = NOW()
    RETURNING last_seq
  `, [id, companyId, module, period]);
  return result.rows[0].last_seq;
}

export async function ensureUniqueSequenceNumber(
  client: any,
  companyId: string,
  moduleName: string,
  dateStr: string,
  proposedNumber?: string
): Promise<string> {
  // Determine prefix and period based on module
  let prefix = 'DOC';
  let period = '';
  let padLength = 6;
  
  switch (moduleName) {
    case 'invoices': prefix = 'INV'; break;
    case 'purchase_invoices': prefix = 'PINV'; break;
    case 'returns': prefix = 'RET'; break;
    case 'purchase_returns': prefix = 'PRET'; break;
    case 'payment_vouchers': prefix = 'PV'; break;
    case 'receipt_vouchers': prefix = 'RV'; break;
    case 'journal_entries': prefix = 'JE'; padLength = 5; break;
    case 'sales_orders': prefix = 'SO'; break;
    case 'purchase_orders': prefix = 'PO'; break;
    case 'employees': prefix = 'EMP'; break;
    case 'warehouse_transfers': prefix = 'TR'; break;
    case 'opening_stock_balances': prefix = 'OPB'; break;
    case 'stock_adjustments': prefix = 'ADJ'; break;
    case 'cash_transfers': prefix = 'CT'; break;
    case 'goods_receipts': prefix = 'GR'; break;
    default: return proposedNumber || '';
  }

  const safeDateStr = (dateStr || new Date().toISOString()).slice(0, 10);
  const parts = safeDateStr.split('-');
  const year = parts[0] || new Date().getFullYear().toString();
  const month = (parts[1] || '01').padStart(2, '0');
  const day = (parts[2] || '01').padStart(2, '0');

  if (moduleName === 'journal_entries') {
    period = `${year}-${month}-${day}`;
  } else {
    period = `${year}-${month}`;
  }

  // Get atomic next sequence number from DB - guaranteed unique
  let seq = await getNextAtomicSequence(client, companyId, moduleName, period);
  let seqStr = String(seq).padStart(padLength, '0');
  
  const generateString = () => {
    if (moduleName === 'journal_entries') {
      return `JE-${year}-${month}-${day}-${seqStr}`;
    } else if (moduleName === 'employees') {
      return `EMP-${seqStr}`;
    } else {
      return `${prefix}-${year}-${month}-${seqStr}`;
    }
  };
  let generatedNumber = generateString();

  const tableNames: any = {
    'invoices': { table: 'invoices', field: 'invoice_number' },
    'purchase_invoices': { table: 'purchase_invoices', field: 'invoice_number' },
    'returns': { table: 'returns', field: 'return_number' },
    'purchase_returns': { table: 'purchase_returns', field: 'return_number' },
    'payment_vouchers': { table: 'payment_vouchers', field: 'voucher_number' },
    'receipt_vouchers': { table: 'receipt_vouchers', field: 'voucher_number' },
    'journal_entries': { table: 'journal_entries', field: 'entry_number' },
    'sales_orders': { table: 'sales_orders', field: 'order_number' },
    'purchase_orders': { table: 'purchase_orders', field: 'order_number' },
    'goods_receipts': { table: 'goods_receipts', field: 'receipt_number' }
  };

  const target = tableNames[moduleName];
  if (target) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 100) {
      attempts++;
      try {
        const res = await client.query(`SELECT 1 FROM "${target.table}" WHERE company_id = $1 AND "${target.field}" = $2 LIMIT 1`, [companyId, generatedNumber]);
        if (res.rows.length === 0) {
          isUnique = true;
        } else {
          seq = await getNextAtomicSequence(client, companyId, moduleName, period);
          seqStr = String(seq).padStart(padLength, '0');
          generatedNumber = generateString();
        }
      } catch (e) {
        break; // If table/column doesn't exist, ignore and return
      }
    }
  }

  return generatedNumber;
}

export async function generateNextSequence(client: any, companyId: string, moduleName: string, dateStr: string): Promise<string> {
  // For preview purposes (GET /utils/next-sequence), use the atomic method too
  // but without actually incrementing - we just show what the next would be
  let prefix = 'INV';
  let padLength = 6;
  
  switch (moduleName) {
    case 'invoices': prefix = 'INV'; break;
    case 'purchase_invoices': prefix = 'PINV'; break;
    case 'returns': prefix = 'RET'; break;
    case 'purchase_returns': prefix = 'PRET'; break;
    case 'payment_vouchers': prefix = 'PV'; break;
    case 'receipt_vouchers': prefix = 'RV'; break;
    case 'journal_entries': prefix = 'JE'; padLength = 5; break;
    case 'sales_orders': prefix = 'SO'; break;
    case 'purchase_orders': prefix = 'PO'; break;
    case 'employees': prefix = 'EMP'; break;
    case 'warehouse_transfers': prefix = 'TR'; break;
    case 'opening_stock_balances': prefix = 'OPB'; break;
    case 'stock_adjustments': prefix = 'ADJ'; break;
    case 'cash_transfers': prefix = 'CT'; break;
    case 'goods_receipts': prefix = 'GR'; break;
    default: prefix = 'DOC';
  }

  const safeDateStr = (dateStr || new Date().toISOString()).slice(0, 10);
  const parts = safeDateStr.split('-');
  const year = parts[0] || new Date().getFullYear().toString();
  const month = (parts[1] || '01').padStart(2, '0');
  const day = (parts[2] || '01').padStart(2, '0');

  // Read current sequence value without incrementing (for preview only)
  let period = '';
  if (moduleName === 'journal_entries') {
    period = `${year}-${month}-${day}`;
  } else {
    period = `${year}-${month}`;
  }

  try {
    const result = await client.query(
      `SELECT last_seq FROM "document_sequences" WHERE company_id = $1 AND module = $2 AND period = $3`,
      [companyId, moduleName, period]
    );
    const currentSeq = result.rows.length > 0 ? result.rows[0].last_seq : 0;
    const nextSeq = String(currentSeq + 1).padStart(padLength, '0');
    
    if (moduleName === 'journal_entries') {
      return `JE-${year}-${month}-${day}-${nextSeq}`;
    } else if (moduleName === 'employees') {
      return `EMP-${nextSeq}`;
    } else {
      return `${prefix}-${year}-${month}-${nextSeq}`;
    }
  } catch (e) {
    // Fallback if document_sequences table doesn't exist yet
    const nextSeq = String(1).padStart(padLength, '0');
    if (moduleName === 'journal_entries') {
      return `JE-${year}-${month}-${day}-${nextSeq}`;
    } else if (moduleName === 'employees') {
      return `EMP-${nextSeq}`;
    } else {
      return `${prefix}-${year}-${month}-${nextSeq}`;
    }
  }
}

router.get('/utils/next-sequence/:moduleName', authenticateToken, async (req: any, res) => {
  try {
    const { moduleName } = req.params;
    const dateStr = req.query.date as string || new Date().toISOString().slice(0, 10);
    const companyId = req.user?.company_id;
    
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const nextNumber = await generateNextSequence(pool, companyId, moduleName, dateStr);
    
    res.json({ nextNumber });
  } catch (error: any) {
    console.error(`Error generating sequence:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/utils/fix-duplicate-pinv', authenticateToken, async (req: any, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const duplicates = await client.query(`
      SELECT invoice_number, COUNT(*) as count
      FROM purchase_invoices
      WHERE company_id = $1
      GROUP BY invoice_number
      HAVING COUNT(*) > 1
    `, [companyId]);

    let fixedCount = 0;

    for (const dup of duplicates.rows) {
      const invoiceNumber = dup.invoice_number;
      const invoices = await client.query(`
        SELECT id, date, created_at
        FROM purchase_invoices
        WHERE company_id = $1 AND invoice_number = $2
        ORDER BY created_at ASC
      `, [companyId, invoiceNumber]);

      // Keep the first one, modify the rest
      for (let i = 1; i < invoices.rows.length; i++) {
        const inv = invoices.rows[i];
        const period = inv.date.slice(0, 7);
        
        let currentMax = 0;
        const maxRes = await client.query(`
          SELECT MAX(CAST(SUBSTRING(invoice_number FROM 14) AS INTEGER)) as max_seq
          FROM purchase_invoices
          WHERE company_id = $1 AND invoice_number LIKE $2
        `, [companyId, `PINV-${period}-%`]);
        
        if (maxRes.rows[0].max_seq) currentMax = maxRes.rows[0].max_seq;

        const nextSeq = currentMax + 1;
        const newInvoiceNumber = `PINV-${period}-${String(nextSeq).padStart(6, '0')}`;

        await client.query('BEGIN');
        await client.query(`UPDATE purchase_invoices SET invoice_number = $1 WHERE id = $2`, [newInvoiceNumber, inv.id]);
        await client.query(`UPDATE journal_entries SET reference_number = $1 WHERE reference_type = 'purchase_invoice' AND reference_id = $2`, [newInvoiceNumber, inv.id]);
        await client.query(`UPDATE purchase_orders SET invoice_number = $1 WHERE invoice_id = $2`, [newInvoiceNumber, inv.id]);
        await client.query('COMMIT');

        await client.query(`
          INSERT INTO document_sequences (id, company_id, module, period, last_seq, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, 'purchase_invoices', $2, $3, NOW(), NOW())
          ON CONFLICT (company_id, module, period)
          DO UPDATE SET last_seq = GREATEST(document_sequences.last_seq, $3), updated_at = NOW()
        `, [companyId, period, nextSeq]);
        
        fixedCount++;
      }
    }

    res.json({ success: true, message: `Fixed ${fixedCount} duplicate invoices.` });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.get('/detailed-journal-entries', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const companyId = isSuperAdmin ? req.query.company_id : (req.query.company_id || req.user?.company_id);
    
    if (!companyId) return res.status(400).json({ error: 'company_id is required' });

    const page = parseInt(req.query._page as string, 10) || 1;
    const limit = parseInt(req.query._limit as string, 10) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query._search as string) || '';
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;

    let sql = `
      SELECT 
        jel.id as line_id,
        jel.debit,
        jel.credit,
        jel.description as line_description,
        jel.account_id,
        jel.account_name,
        acc.code as account_code,
        
        -- Get customer/supplier from current line or any line in the same entry (opposite party)
        COALESCE(jel.customer_name, (
          SELECT customer_name 
          FROM journal_entry_lines 
          WHERE journal_entry_id = je.id AND customer_name IS NOT NULL AND customer_name != '' 
          LIMIT 1
        )) as customer_name,
        COALESCE(jel.supplier_name, (
          SELECT supplier_name 
          FROM journal_entry_lines 
          WHERE journal_entry_id = je.id AND supplier_name IS NOT NULL AND supplier_name != '' 
          LIMIT 1
        )) as supplier_name,
        COALESCE(jel.customer_id, (
          SELECT customer_id 
          FROM journal_entry_lines 
          WHERE journal_entry_id = je.id AND customer_id IS NOT NULL 
          LIMIT 1
        )) as customer_id,
        COALESCE(jel.supplier_id, (
          SELECT supplier_id 
          FROM journal_entry_lines 
          WHERE journal_entry_id = je.id AND supplier_id IS NOT NULL 
          LIMIT 1
        )) as supplier_id,
        
        jel.sub_account_id,
        jel.sub_account_type,
        je.id as journal_entry_id,
        je.entry_number,
        je.date,
        je.description as entry_description,
        je.reference_type,
        je.reference_number,
        je.reference_id,
        
        -- Account Type & Parent Account details
        act.name as account_type_name,
        parent_acc.name as parent_account_name,
        
        -- Currency & Foreign Currency details if available
        COALESCE(inv.currency_id, pinv.currency_id) as currency_id,
        cur.code as currency_code,
        cur.symbol as currency_symbol,
        COALESCE(inv.exchange_rate, pinv.exchange_rate) as exchange_rate,
        CASE 
          WHEN COALESCE(inv.exchange_rate, pinv.exchange_rate, 1) > 0 THEN 
            (jel.debit + jel.credit) / COALESCE(inv.exchange_rate, pinv.exchange_rate, 1)
          ELSE NULL
        END as foreign_amount,
        
        -- Operation, Department, Cost Center
        COALESCE(inv.operation_id, pinv.operation_id) as operation_id,
        op.operation_number as operation_number,
        COALESCE(inv.department_id, pinv.department_id) as department_id,
        dept.name as department_name,
        COALESCE(inv.cost_center_id, pinv.cost_center_id) as cost_center_id,
        cc.name as cost_center_name,
        cc.code as cost_center_code,
        
        -- Product/Item names list
        COALESCE(NULLIF(jel.product_name, ''), (
          CASE 
            WHEN je.reference_type = 'invoice' THEN 
              (SELECT string_agg(product_name, ', ') FROM invoice_items WHERE invoice_id = je.reference_id)
            WHEN je.reference_type = 'purchase_invoice' THEN 
              (SELECT string_agg(COALESCE(product_name, category_name), ', ') FROM purchase_invoice_items WHERE invoice_id = je.reference_id)
            WHEN je.reference_type = 'return' THEN 
              (SELECT string_agg(product_name, ', ') FROM return_items WHERE return_id = je.reference_id)
            WHEN je.reference_type = 'purchase_return' THEN 
              (SELECT string_agg(product_name, ', ') FROM purchase_return_items WHERE return_id = je.reference_id)
            ELSE NULL
          END
        )) as product_names
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.journal_entry_id = je.id
      LEFT JOIN accounts acc ON jel.account_id = acc.id
      LEFT JOIN accounts parent_acc ON acc.parent_id = parent_acc.id
      LEFT JOIN account_types act ON acc.type_id = act.id
      LEFT JOIN invoices inv ON je.reference_type = 'invoice' AND je.reference_id = inv.id
      LEFT JOIN purchase_invoices pinv ON je.reference_type = 'purchase_invoice' AND je.reference_id = pinv.id
      LEFT JOIN currencies cur ON cur.id = COALESCE(inv.currency_id, pinv.currency_id)
      LEFT JOIN operations op ON op.id = COALESCE(inv.operation_id, pinv.operation_id)
      LEFT JOIN departments dept ON dept.id = COALESCE(inv.department_id, pinv.department_id)
      LEFT JOIN cost_centers cc ON cc.id = COALESCE(inv.cost_center_id, pinv.cost_center_id)
    `;

    const values: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    // Filter by company
    conditions.push(`je.company_id = $${paramIndex++}`);
    values.push(companyId);

    // Filter by date
    if (dateFrom) {
      conditions.push(`je.date >= $${paramIndex++}`);
      values.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`je.date <= $${paramIndex++}`);
      values.push(dateTo);
    }

    // Filter by search term
    if (search) {
      conditions.push(`(
        je.entry_number ILIKE $${paramIndex} OR
        jel.account_name ILIKE $${paramIndex} OR
        jel.description ILIKE $${paramIndex} OR
        je.description ILIKE $${paramIndex} OR
        jel.customer_name ILIKE $${paramIndex} OR
        jel.supplier_name ILIKE $${paramIndex} OR
        je.reference_number ILIKE $${paramIndex} OR
        je.reference_type ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Get count
    const countSql = `SELECT count(*) as total FROM (${sql}) t`;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].total, 10);

    // Get summary (Total Debit / Credit)
    const sumSql = `SELECT sum(debit) as total_debit, sum(credit) as total_credit FROM (${sql}) t`;
    const sumRes = await pool.query(sumSql, values);
    const summary = {
      total_debit: Number(sumRes.rows[0].total_debit || 0),
      total_credit: Number(sumRes.rows[0].total_credit || 0)
    };

    // Sort: Date DESC, Entry Number DESC, Line ID ASC (to keep lines within an entry grouped and ordered)
    sql += ` ORDER BY je.date DESC, je.entry_number DESC, jel.id ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const queryResult = await pool.query(sql, values);
    
    res.json({
      data: queryResult.rows,
      total,
      summary,
      page,
      limit
    });
  } catch (error: any) {
    console.error('Error fetching detailed journal entries:', error);
    res.status(500).json({ error: error.message });
  }
});

// Custom endpoint for paper sizes to get both system-default and company-specific sizes
router.get('/paper_sizes', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.company_id;
    const { rows } = await pool.query(
      `SELECT * FROM paper_sizes WHERE company_id = $1 OR is_system = TRUE OR company_id IS NULL ORDER BY is_system DESC, name ASC`,
      [companyId]
    );
    res.json(rows);
  } catch (error: any) {
    console.error('Error fetching paper sizes:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/paper-sizes', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.company_id;
    const { rows } = await pool.query(
      `SELECT * FROM paper_sizes WHERE company_id = $1 OR is_system = TRUE OR company_id IS NULL ORDER BY is_system DESC, name ASC`,
      [companyId]
    );
    res.json(rows);
  } catch (error: any) {
    console.error('Error fetching paper sizes:', error);
    res.status(500).json({ error: error.message });
  }
});

modules.forEach(moduleName => {
  const hyphenName = moduleName.replace(/_/g, '-');
  const routeNames = [moduleName];
  if (hyphenName !== moduleName) routeNames.push(hyphenName);

  routeNames.forEach(rn => {
    // List with filters
    router.get(`/${rn}`, authenticateToken, async (req: AuthRequest, res) => {
      try {
        const targetModule = getEffectiveModule(moduleName);
        if (!await checkPermission(req, targetModule, 'view')) {
          return res.status(403).json({ error: 'Access Denied: No View Permission' });
        }

        if (moduleName === 'roles') {
          const companyId = req.user?.company_id;
          if (companyId) {
            const { rows: existingRoles } = await pool.query('SELECT * FROM roles WHERE company_id = $1', [companyId]);
            if (existingRoles.length === 0) {
              const defaultRolesList = [
                { name: 'مدير النظام', description: 'له كامل الصلاحيات لإدارة النظام والإعدادات والمستخدمين' },
                { name: 'مدير مالي', description: 'إدارة الحسابات العامة، التقارير المالية، والقيود اليومية والاعتمادات' },
                { name: 'محاسب', description: 'تسجيل القيود اليومية، مراجعة الحسابات، وإعداد كشوفات الحساب' },
                { name: 'أمين مخزن', description: 'إدارة المخازن، استلام البضائع، التحويلات المخزنية، والجرد' },
                { name: 'مشتريات', description: 'إدارة الموردين، أوامر الشراء، وفواتير المشتريات' },
                { name: 'مبيعات', description: 'إدارة العملاء، عروض الأسعار، أوامر البيع، وفواتير المبيعات' },
                { name: 'كاشير', description: 'إصدار فواتير مبيعات نقدية وسندات قبض وصرف يومية' }
              ];
              for (const dr of defaultRolesList) {
                const perms = getDefaultRolePermissions(dr.name);
                const roleId = uuidv4();
                await pool.query(
                  'INSERT INTO roles (id, name, description, permissions, company_id) VALUES ($1, $2, $3, $4, $5)',
                  [roleId, dr.name, dr.description, JSON.stringify(perms), companyId]
                );
              }
            }
          }
        }

        let rows;
        if (moduleName === 'activity_logs') {
        const isSuperAdmin = req.user?.role === 'super_admin';
        const companyId = isSuperAdmin ? req.query.company_id : (req.query.company_id || req.user?.company_id);
        
        // Basic validation for company_id if provided (though it's VARCHAR(36) in activity_logs, usually matches user's company_id)
        if (companyId && typeof companyId !== 'string') return sendError(res, 400, 'Invalid company_id format');

        let query = 'SELECT * FROM activity_logs';
        let params: any[] = [];
        
        if (companyId) {
          query += ' WHERE company_id = $1';
          params.push(companyId);
        }
        
        const orderBy = 'id DESC';
        query += ` ORDER BY ${orderBy}`;
        
        const queryResult = await pool.query(query, params);
        rows = queryResult.rows;
      } else if (moduleName === 'audit_logs') {
        const companyId = req.query.company_id || req.user?.company_id;
        const isSuperAdmin = req.user?.role === 'super_admin';

        if (!companyId && !isSuperAdmin) {
          return sendError(res, 400, 'company_id is required');
        }

        let query = 'SELECT * FROM audit_logs';
        let params: any[] = [];

        if (companyId) {
          query += ' WHERE company_id = $1';
          params.push(companyId);
        }

        const orderBy = 'created_at DESC';
        query += ` ORDER BY ${orderBy}`;
        const queryResult = await pool.query(query, params);
        rows = queryResult.rows;
      } else {
        // For other tables, we apply company_id filter by default if present in schema
        const queryFilters = { ...req.query } as any;
        const isSuperAdmin = req.user?.role === 'super_admin';
        const isOwnEmailQuery = moduleName === 'users' && (
          queryFilters.email === req.user?.email || 
          (typeof queryFilters.email === 'string' && typeof req.user?.email === 'string' && queryFilters.email.toLowerCase() === req.user.email.toLowerCase())
        );

        if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && !queryFilters.company_id && req.user?.company_id && !isSuperAdmin && !isOwnEmailQuery) {
          queryFilters.company_id = req.user.company_id;
        }

        const isPaginated = queryFilters._page && queryFilters._limit;
        
        if (isPaginated) {
          const limit = parseInt(queryFilters._limit, 10) || 50;
          const page = parseInt(queryFilters._page, 10) || 1;
          const offset = (page - 1) * limit;
          const sortBy = queryFilters._sortBy || 'date';
          const sortOrder = queryFilters._sortOrder || 'DESC';
          const search = queryFilters._search || '';
          
          let sql;
          const journaledTables = [
            'invoices', 'purchase_invoices', 'receipt_vouchers', 'payment_vouchers',
            'returns', 'purchase_returns', 'cash_transfers', 'customer_discounts',
            'supplier_discounts', 'opening_stock_balances', 'stock_adjustments',
            'warehouse_transfers'
          ];
          if (journaledTables.includes(moduleName)) {
            sql = `SELECT t.*, (SELECT entry_number FROM journal_entries je WHERE je.reference_id = t.id LIMIT 1) AS entry_number FROM "${moduleName}" t`;
          } else {
            sql = `SELECT * FROM "${moduleName}"`;
          }
          const values: any[] = [];
          const conditions: string[] = [];
          let paramIndex = 1;

          Object.keys(queryFilters).forEach((key) => {
            if (['company_id', 'date_from', 'date_to'].includes(key) || (!key.startsWith('_') && key !== 'company_id')) {
              const value = queryFilters[key];
              if (key === 'date_from') {
                conditions.push(`date >= $${paramIndex++}`);
                values.push(value);
              } else if (key === 'date_to') {
                conditions.push(`date <= $${paramIndex++}`);
                values.push(value);
              } else if (!key.startsWith('_')) {
                conditions.push(`"${key}" = $${paramIndex++}`);
                values.push(value);
              }
            }
          });

          const pIdxObj = { value: paramIndex };
          await applyQueryFiltersRestrictions(req, moduleName, conditions, values, pIdxObj);
          paramIndex = pIdxObj.value;

          if (search) {
             const searchCols = EXPECTED_SCHEMA[moduleName] || [];
             const textCols = searchCols.filter(c => ['description', 'notes', 'reference_number', 'invoice_number', 'voucher_number', 'customer_name', 'supplier_name', 'account_name', 'code', 'name'].includes(c));
             if (textCols.length > 0) {
               const searchConditions = textCols.map(c => `"${c}"::text ILIKE $${paramIndex}`).join(' OR ');
               conditions.push(`(${searchConditions})`);
               values.push(`%${search}%`);
               paramIndex++;
             }
          }

          if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
          }

          const countSql = `SELECT count(*) as total FROM (${sql}) t`;
          const countRes = await pool.query(countSql, values);
          const total = parseInt(countRes.rows[0].total);

          let summary = {};
          if (moduleName === 'invoices' || moduleName === 'purchase_invoices') {
             const sumRes = await pool.query(`SELECT sum("total_amount" * COALESCE("exchange_rate", 1)) as sum1, sum("discount_amount" * COALESCE("exchange_rate", 1)) as sum2 FROM (${sql}) t`, values);
             summary = { total_amount: Number(sumRes.rows[0].sum1 || 0), total_discount: Number(sumRes.rows[0].sum2 || 0) };
          } else if (moduleName === 'returns' || moduleName === 'purchase_returns') {
             const sumRes = await pool.query(`SELECT sum(total_amount) as sum1 FROM (${sql}) t`, values);
             summary = { total_amount: Number(sumRes.rows[0].sum1 || 0) };
          } else if (moduleName === 'receipt_vouchers' || moduleName === 'payment_vouchers' || moduleName === 'customer_discounts' || moduleName === 'supplier_discounts') {
             const sumRes = await pool.query(`SELECT sum(amount) as sum1 FROM (${sql}) t`, values);
             summary = { total_amount: Number(sumRes.rows[0].sum1 || 0) };
          } else if (moduleName === 'journal_entries') {
             const sumRes = await pool.query(`SELECT sum(total_debit) as sum1, sum(total_credit) as sum2 FROM (${sql}) t`, values);
             summary = { total_debit: Number(sumRes.rows[0].sum1 || 0), total_credit: Number(sumRes.rows[0].sum2 || 0) };
          }

          let sortField = `"${sortBy}"`;
          if (moduleName === 'invoices' || moduleName === 'purchase_invoices') {
            if (sortBy === 'currency') {
              sortField = `"currency_id"`;
            } else if (sortBy === 'foreign_amount') {
              sortField = `"total_amount"`;
            } else if (sortBy === 'base_amount') {
              sortField = `("total_amount" * COALESCE("exchange_rate", 1))`;
            } else if (sortBy === 'subtotal') {
              sortField = `("subtotal" * COALESCE("exchange_rate", 1))`;
            } else if (sortBy === 'tax_amount') {
              sortField = `("tax_amount" * COALESCE("exchange_rate", 1))`;
            } else if (sortBy === 'remaining' || sortBy === 'remaining_foreign') {
              sortField = `"total_amount"`;
            }
          }

          let finalSort = `${sortField} ${sortOrder.toUpperCase()}`;
          if (moduleName === 'invoices' || moduleName === 'purchase_invoices') {
            if (sortBy === 'date' || sortBy === 'operation_date') {
              finalSort += `, "invoice_number" ${sortOrder.toUpperCase()}`;
            } else if (sortBy === 'invoice_number') {
              finalSort += `, "date" DESC`;
            } else {
              finalSort += `, "date" DESC, "invoice_number" DESC`;
            }
          } else if (moduleName === 'goods_receipts') {
            if (sortBy === 'date' || sortBy === 'operation_date') {
              finalSort += `, "receipt_number" ${sortOrder.toUpperCase()}`;
            } else if (sortBy === 'receipt_number') {
              finalSort += `, "date" DESC`;
            } else {
              finalSort += `, "date" DESC, "receipt_number" DESC`;
            }
          } else {
            if (sortBy === 'date' || sortBy === 'operation_date') {
              finalSort += `, id DESC`;
            }
          }
          
          sql += ` ORDER BY ${finalSort} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
          values.push(limit, offset);

          const paginatedRes = await pool.query(sql, values);
          rows = paginatedRes.rows;

          if (transactionalModules.includes(moduleName)) {
            const rowIds = rows.map((r: any) => r.id);
            const itemsMap = await fetchItemsForMultiple(moduleName, rowIds);
            for (let row of rows) {
              row.items = itemsMap[row.id] || [];
            }
          }
          
          return res.json({
            data: rows.map((row: any) => parseRow(moduleName, row)),
            total,
            summary,
            page,
            limit
          });
        }

        rows = await getList(moduleName, queryFilters);

        const allowedWarehouses = await getUserAllowedIds(req, 'warehouses', 'restrict_warehouses', 'allowed_warehouse_ids');
        if (allowedWarehouses !== null) {
          const warehouseModules = ['invoices', 'purchase_invoices', 'goods_receipts', 'returns', 'purchase_returns', 'opening_stock_balances', 'stock_adjustments'];
          if (moduleName === 'warehouses') {
            rows = rows.filter((r: any) => allowedWarehouses.includes(r.id));
          } else if (warehouseModules.includes(moduleName)) {
            rows = rows.filter((r: any) => allowedWarehouses.includes(r.warehouse_id));
          } else if (moduleName === 'warehouse_transfers') {
            rows = rows.filter((r: any) => allowedWarehouses.includes(r.from_warehouse_id) || allowedWarehouses.includes(r.to_warehouse_id));
          }
        }

        const allowedSafes = await getUserAllowedIds(req, 'cash_balances', 'restrict_safes', 'allowed_safe_ids');
        const allowedBanks = await getUserAllowedIds(req, 'accounts', 'restrict_banks', 'allowed_bank_ids');
        if (allowedSafes !== null || allowedBanks !== null) {
          const voucherModules = ['receipt_vouchers', 'payment_vouchers'];
          if (moduleName === 'payment_methods') {
            rows = rows.filter((r: any) => {
              if (r.type === 'cash' || r.type === 'wallet') {
                return allowedSafes === null ? true : allowedSafes.includes(r.id);
              }
              if (r.type === 'bank') {
                return allowedBanks === null ? true : allowedBanks.includes(r.id);
              }
              return true;
            });
          } else if (voucherModules.includes(moduleName)) {
            const pmIds = Array.from(new Set(rows.map((r: any) => r.payment_method_id).filter(Boolean)));
            if (pmIds.length > 0) {
              const pmRes = await pool.query('SELECT id, type FROM payment_methods WHERE id = ANY($1)', [pmIds]);
              const pmTypeMap = pmRes.rows.reduce((acc: any, curr: any) => {
                acc[curr.id] = curr.type;
                return acc;
              }, {});
              rows = rows.filter((r: any) => {
                const type = pmTypeMap[r.payment_method_id];
                if (type === 'cash' || type === 'wallet') {
                  return allowedSafes === null ? true : allowedSafes.includes(r.payment_method_id);
                }
                if (type === 'bank') {
                  return allowedBanks === null ? true : allowedBanks.includes(r.payment_method_id);
                }
                return true;
              });
            }
          }
        }

        if (moduleName === 'companies') {
          try {
            const sizeRes = await pool.query(`
              WITH company_sizes AS (
                SELECT company_id, pg_column_size(t.*) AS sz FROM accounts t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM users t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM invoices t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM invoice_items t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM purchase_invoices t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM purchase_invoice_items t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM journal_entries t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM journal_entry_items t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM products t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM customers t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM suppliers t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM inventory_movements t WHERE company_id IS NOT NULL
                UNION ALL
                SELECT company_id, pg_column_size(t.*) AS sz FROM activity_logs t WHERE company_id IS NOT NULL
              )
              SELECT company_id, COALESCE(SUM(sz), 0) AS total_bytes
              FROM company_sizes
              GROUP BY company_id;
            `);

            const sizeMap: Record<string, number> = {};
            for (const r of sizeRes.rows) {
              sizeMap[r.company_id] = parseInt(r.total_bytes, 10);
            }

            const usersRes = await pool.query(
              `SELECT company_id, COUNT(*) as count FROM users WHERE company_id IS NOT NULL GROUP BY company_id`
            );
            const usersMap: Record<string, number> = {};
            for (const r of usersRes.rows) {
              usersMap[r.company_id] = parseInt(r.count, 10);
            }

            for (const row of rows) {
              const bytes = sizeMap[row.id] || 0;
              row.storage_bytes = bytes;
              
              if (bytes <= 0) {
                row.storage_size = '24.5 KB';
              } else if (bytes < 1024) {
                row.storage_size = `${bytes} B`;
              } else if (bytes < 1024 * 1024) {
                row.storage_size = `${(bytes / 1024).toFixed(1)} KB`;
              } else {
                row.storage_size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
              }

              row.active_users_count = usersMap[row.id] || 0;
            }
          } catch (e) {
            console.error('Error computing company storage sizes:', e);
          }
        }

        if (transactionalModules.includes(moduleName)) {
          const rowIds = rows.map((r: any) => r.id);
          if (rowIds.length > 0) {
            const itemsMap = await fetchItemsForMultiple(moduleName, rowIds);
            for (let row of rows) {
              row.items = itemsMap[row.id] || [];
            }
          }
        }

        res.json(rows.map((row: any) => parseRow(moduleName, row)));
      }
    } catch (error: any) {
      console.error(`[CRASH PREVENTED] Error in GET /${moduleName}:`, error);
      sendError(res, 500, `Failed to list ${moduleName}`, error.message);
    }
  });
});

// Get Single
  routeNames.forEach(rn => {
    router.get(`/${rn}/:id`, authenticateToken, async (req: AuthRequest, res) => {
      try {
        const targetModule = getEffectiveModule(moduleName);
        if (!await checkPermission(req, targetModule, 'view')) {
          return res.status(403).json({ error: 'Access Denied: No View Permission' });
        }
        const { id } = req.params;
        
        // ID validation for single item GET
        if (!id || typeof id !== 'string') {
          return sendError(res, 400, `Invalid ID format for ${moduleName}`);
        }

        let queryStr;
        const journaledTables = [
          'invoices', 'purchase_invoices', 'receipt_vouchers', 'payment_vouchers',
          'returns', 'purchase_returns', 'cash_transfers', 'customer_discounts',
          'supplier_discounts', 'opening_stock_balances', 'stock_adjustments',
          'warehouse_transfers'
        ];
        if (journaledTables.includes(moduleName)) {
          queryStr = `SELECT t.*, (SELECT entry_number FROM journal_entries je WHERE je.reference_id = t.id LIMIT 1) AS entry_number FROM "${moduleName}" t WHERE t.id = $1`;
        } else {
          queryStr = `SELECT * FROM "${moduleName}" WHERE id = $1`;
        }
        const { rows }: any = await pool.query(queryStr, [id]);
        const row = rows[0] || null;
        
        if (!row) {
          return sendError(res, 404, `${moduleName} not found`);
        }

        if (transactionalModules.includes(moduleName)) {
          row.items = await fetchItems(moduleName, row.id);
        }
        res.json(parseRow(moduleName, row));
      } catch (error: any) {
        if (error.code === '22P02' || error.message?.includes('invalid input syntax for type uuid')) {
          return sendError(res, 400, `Invalid ID format for ${moduleName}`);
        }
        console.error(`[CRASH PREVENTED] Error in GET /${moduleName}/:id:`, error);
        sendError(res, 500, `Failed to get ${moduleName}`, error.message);
      }
    });
  });

  // Helper to fetch items for multiple parent IDs in a single query
  async function fetchItemsForMultiple(module: string, ids: string[]) {
    if (!ids || ids.length === 0) return {};
    let itemsTable = '';
    let foreignKey = '';
    
    if (module === 'journal_entries') {
      itemsTable = 'journal_entry_lines';
      foreignKey = 'journal_entry_id';
    } else if (module === 'invoices') {
      itemsTable = 'invoice_items';
      foreignKey = 'invoice_id';
    } else if (module === 'returns') {
      itemsTable = 'return_items';
      foreignKey = 'return_id';
    } else if (module === 'purchase_invoices') {
      itemsTable = 'purchase_invoice_items';
      foreignKey = 'invoice_id';
    } else if (module === 'purchase_returns') {
      itemsTable = 'purchase_return_items';
      foreignKey = 'return_id';
    } else if (module === 'sales_orders') {
      itemsTable = 'sales_order_items';
      foreignKey = 'order_id';
    } else if (module === 'purchase_orders') {
      itemsTable = 'purchase_order_items';
      foreignKey = 'order_id';
    } else if (module === 'warehouse_transfers') {
      itemsTable = 'warehouse_transfer_items';
      foreignKey = 'transfer_id';
    } else if (module === 'opening_stock_balances') {
      itemsTable = 'opening_stock_items';
      foreignKey = 'opening_stock_id';
    } else if (module === 'stock_adjustments') {
      itemsTable = 'stock_adjustment_items';
      foreignKey = 'adjustment_id';
    } else if (module === 'goods_receipts') {
      itemsTable = 'goods_receipt_items';
      foreignKey = 'goods_receipt_id';
    }

    if (itemsTable) {
      if (module === 'journal_entries') {
        const { rows } = await pool.query(`
          SELECT jel.*, COALESCE(jel.account_name, acc.name) AS account_name, acc.code AS account_code
          FROM "journal_entry_lines" jel
          LEFT JOIN "accounts" acc ON acc.id = jel.account_id
          WHERE jel."journal_entry_id" = ANY($1)
        `, [ids]);
        
        const mapping: Record<string, any[]> = {};
        for (const id of ids) mapping[id] = [];
        for (const r of rows) {
          const parentId = r.journal_entry_id;
          if (mapping[parentId]) {
            mapping[parentId].push(r);
          }
        }
        return mapping;
      }
      
      const { rows } = await pool.query(`SELECT * FROM "${itemsTable}" WHERE "${foreignKey}" = ANY($1)`, [ids]);
      const mapping: Record<string, any[]> = {};
      for (const id of ids) mapping[id] = [];
      for (const r of rows) {
        const parentId = r[foreignKey];
        if (mapping[parentId]) {
          mapping[parentId].push(r);
        }
      }
      return mapping;
    }
    return {};
  }

  // Helper to fetch items
  async function fetchItems(module: string, id: string) {
    let itemsTable = '';
    let foreignKey = '';
    
    if (module === 'journal_entries') {
      itemsTable = 'journal_entry_lines';
      foreignKey = 'journal_entry_id';
    } else if (module === 'invoices') {
      itemsTable = 'invoice_items';
      foreignKey = 'invoice_id';
    } else if (module === 'returns') {
      itemsTable = 'return_items';
      foreignKey = 'return_id';
    } else if (module === 'purchase_invoices') {
      itemsTable = 'purchase_invoice_items';
      foreignKey = 'invoice_id';
    } else if (module === 'purchase_returns') {
      itemsTable = 'purchase_return_items';
      foreignKey = 'return_id';
    } else if (module === 'sales_orders') {
      itemsTable = 'sales_order_items';
      foreignKey = 'order_id';
    } else if (module === 'purchase_orders') {
      itemsTable = 'purchase_order_items';
      foreignKey = 'order_id';
    } else if (module === 'warehouse_transfers') {
      itemsTable = 'warehouse_transfer_items';
      foreignKey = 'transfer_id';
    } else if (module === 'opening_stock_balances') {
      itemsTable = 'opening_stock_items';
      foreignKey = 'opening_stock_id';
    } else if (module === 'stock_adjustments') {
      itemsTable = 'stock_adjustment_items';
      foreignKey = 'adjustment_id';
    } else if (module === 'goods_receipts') {
      itemsTable = 'goods_receipt_items';
      foreignKey = 'goods_receipt_id';
    }

    if (itemsTable) {
      if (module === 'journal_entries') {
        const { rows } = await pool.query(`
          SELECT jel.*, COALESCE(jel.account_name, acc.name) AS account_name, acc.code AS account_code
          FROM "journal_entry_lines" jel
          LEFT JOIN "accounts" acc ON acc.id = jel.account_id
          WHERE jel."journal_entry_id" = $1
        `, [id]);
        return rows;
      }
      const { rows } = await pool.query(`SELECT * FROM "${itemsTable}" WHERE "${foreignKey}" = $1`, [id]);
      return rows;
    }
    return [];
  }

  // Create
  if (!transactionalModules.includes(moduleName)) {
    routeNames.forEach(rn => {
      router.post(`/${rn}`, authenticateToken, async (req: AuthRequest, res, next) => {
        if (rn === 'users' || rn === 'roles') {
          return UsersLimitMiddleware(req, res, () => next());
        }
        if (rn === 'departments' || rn === 'cost_centers') {
          return BranchesLimitMiddleware(req, res, () => next());
        }
        if (rn === 'warehouses') {
          return WarehousesLimitMiddleware(req, res, () => next());
        }
        if (rn === 'pos_sessions') {
          return DevicesLimitMiddleware(req, res, () => next());
        }
        const txRoutes = ['receipt_vouchers', 'payment_vouchers', 'cash_transfers', 'sales_orders', 'purchase_orders', 'returns', 'purchase_returns'];
        if (txRoutes.includes(rn)) {
          return TransactionsLimitMiddleware(req, res, () => next());
        }
        next();
      }, async (req: AuthRequest, res) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const targetModule = getEffectiveModule(moduleName);
          if (!await checkPermission(req, targetModule, 'create')) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Access Denied: No Create Permission' });
          }
          const companyId = req.user?.company_id;
          if (!companyId && moduleName !== 'companies') {
            await client.query('ROLLBACK');
            return sendError(res, 401, 'Unauthorized');
          }

          // Special case for users: handle password/temp_password hashing
          if (moduleName === 'users') {
            if (req.body.password) {
              req.body.password_hash = await bcrypt.hash(req.body.password, 10);
              delete req.body.password;
            }
            if (req.body.temp_password) {
              req.body.password_hash = await bcrypt.hash(req.body.temp_password, 10);
            }
          }

          const dateStr = req.body.date || new Date().toISOString().slice(0, 10);
          if (moduleName === 'employees') {
            req.body.employee_code = await ensureUniqueSequenceNumber(client, companyId, 'employees', '', req.body.employee_code);
          } else if (moduleName === 'cash_transfers') {
            req.body.transfer_number = await ensureUniqueSequenceNumber(client, companyId, 'cash_transfers', dateStr, req.body.transfer_number);
          } else if (moduleName === 'payment_vouchers') {
            req.body.voucher_number = await ensureUniqueSequenceNumber(client, companyId, 'payment_vouchers', dateStr, req.body.voucher_number);
          } else if (moduleName === 'receipt_vouchers') {
            req.body.voucher_number = await ensureUniqueSequenceNumber(client, companyId, 'receipt_vouchers', dateStr, req.body.voucher_number);
          }

          const sanitizedData = sanitizeData(moduleName, req.body);
          const data = { ...sanitizedData };
          if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && !data.company_id) {
            data.company_id = companyId;
          }

          if (!data.id && moduleName !== 'activity_logs' && moduleName !== 'audit_logs') {
            data.id = uuidv4();
          }
          
          const keys = Object.keys(data);
          const values = Object.values(data);
          const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
          
          const result = await client.query(
            `INSERT INTO "${moduleName}" ("${keys.join('", "')}") VALUES (${placeholders}) RETURNING *`,
            values
          );

          if (moduleName === 'companies') {
            const newCompanyId = result.rows[0].id;
            const planMap: Record<string, string> = { basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' };
            const plan = planMap[req.body.subscription_plan?.toLowerCase()] || 'Basic';
            
            const days = parseInt(req.body.subscription_days || '30', 10);
            const startDate = req.body.subscription_start || new Date().toISOString().slice(0, 10);
            let endDate = req.body.subscription_end || req.body.subscription_expiry;

            if (!endDate) {
              const d = new Date(startDate);
              d.setDate(d.getDate() + days);
              endDate = d.toISOString().split('T')[0];
            }

            await subscriptionService.create({
              company_id: newCompanyId,
              plan_type: plan,
              subscription_status: req.body.subscription_status === 'suspended' ? 'Suspended' : (req.body.subscription_status === 'expired' ? 'Expired' : 'Active'),
              start_date: startDate,
              end_date: endDate,
              max_users: parseInt(req.body.users_limit || '5', 10),
              max_branches: plan === 'Enterprise' ? 100 : plan === 'Pro' ? 10 : 3,
              max_warehouses: plan === 'Enterprise' ? 100 : plan === 'Pro' ? 10 : 3,
              max_devices: plan === 'Enterprise' ? 100 : plan === 'Pro' ? 10 : 3,
              max_monthly_transactions: parseInt(req.body.transactions_limit || '1000', 10)
            }, req.user?.email || 'system', client);
          }

          await client.query('COMMIT');

          // Audit Log
          logAudit({
            company_id: req.user?.company_id,
            user_id: req.user?.id,
            username: (req.user as any)?.username || req.user?.email,
            user_email: req.user?.email,
            action: 'CREATE',
            module: moduleName.toUpperCase(),
            details: `Created ${moduleName}: ${data.name || data.id}`,
            entity_type: moduleName,
            entity_id: data.id,
            ip_address: getIp(req),
            metadata: data
          });

          res.status(201).json(parseRow(moduleName, result.rows[0] || data));
        } catch (error: any) {
          await client.query('ROLLBACK');
          console.error(`[CRITICAL] Error in POST /${moduleName}:`, {
            message: error.message,
            stack: error.stack,
            body: req.body,
            user: req.user?.email
          });
          sendError(res, 500, `Failed to create ${moduleName}. ${error.message}`, error.message);
        } finally {
          client.release();
        }
      });
    });

    // Update
    routeNames.forEach(rn => {
      router.put(`/${rn}/:id`, authenticateToken, async (req: AuthRequest, res) => {
        try {
          const targetModule = getEffectiveModule(moduleName);
          if (!await checkPermission(req, targetModule, 'edit')) {
            return res.status(403).json({ error: 'Access Denied: No Edit Permission' });
          }
          const { id } = req.params;
          const companyId = req.user?.company_id;

          if (moduleName === 'companies') {
            const currentRes = await pool.query('SELECT settings FROM companies WHERE id = $1', [id]);
            const currentSettings = currentRes.rows[0]?.settings || {};
            const newSettings = req.body.settings || {};
            
            const currentMethod = currentSettings.inventory_cost_method || 'wac';
            const newMethod = newSettings.inventory_cost_method || 'wac';
            
            if (currentMethod !== newMethod) {
              const movementsCheck = await pool.query('SELECT COUNT(*) FROM inventory_movements WHERE company_id = $1', [companyId || id]);
              const movementsCount = parseInt(movementsCheck.rows[0]?.count || '0', 10);
              if (movementsCount > 0) {
                return sendError(res, 400, 'لا يمكن تغيير طريقة تقييم المخزون بعد تسجيل حركات مخزنية بالفعل.');
              }
            }

            // Sync subscription details to company_subscriptions table
            try {
              const start_date = req.body.subscription_start || req.body.start_date;
              const end_date = req.body.subscription_end || req.body.subscription_expiry || req.body.end_date;
              const max_users = req.body.users_limit !== undefined ? parseInt(req.body.users_limit, 10) : undefined;
              const status = req.body.subscription_status === 'suspended' ? 'Suspended' : (req.body.subscription_status === 'expired' ? 'Expired' : req.body.subscription_status);

              await pool.query(
                `UPDATE company_subscriptions 
                 SET start_date = COALESCE($1, start_date),
                     end_date = COALESCE($2, end_date),
                     max_users = COALESCE($3, max_users),
                     subscription_status = COALESCE($4, subscription_status)
                 WHERE company_id = $5`,
                [start_date, end_date, max_users, status, id]
              );
            } catch (syncErr) {
              console.error('Error syncing company_subscriptions on company update:', syncErr);
            }
          }

          const sanitizedData = sanitizeData(moduleName, req.body);
          delete (sanitizedData as any).id;
          if (moduleName !== 'companies') delete (sanitizedData as any).company_id;

          const keys = Object.keys(sanitizedData);
          const values = Object.values(sanitizedData);
          if (keys.length === 0) return sendError(res, 400, 'No valid fields for update');

          // REAL RUNTIME CHECK: See if updated_at column exists in the database for this table
          const colCheck = await pool.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'updated_at'
          `, [moduleName]);
          const hasUpdatedAt = colCheck.rows.length > 0;

          const setClause = keys.map((key, index) => {
            return `"${key}" = $${index + 1}`;
          }).join(', ');
          
          let query = `UPDATE "${moduleName}" SET ${setClause}${hasUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : ''} WHERE id = $${keys.length + 1}`;
          let params = [...values, id];

          const isSuperAdmin = req.user?.role === 'super_admin';
          if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && companyId && moduleName !== 'companies' && !isSuperAdmin) {
            query += ` AND company_id = $${keys.length + 2}`;
            params.push(companyId);
          }

          const result = await pool.query(query, params);
          if (result.rowCount === 0) return sendError(res, 404, 'Not found or permission denied');

          // Audit Log
          logAudit({
            company_id: req.user?.company_id,
            user_id: req.user?.id,
            username: (req.user as any)?.username || req.user?.email,
            user_email: req.user?.email,
            action: 'UPDATE',
            module: moduleName.toUpperCase(),
            details: `Updated ${moduleName}: ${id}`,
            entity_type: moduleName,
            entity_id: id,
            ip_address: getIp(req),
            metadata: sanitizedData
          });

          res.json({ success: true });
        } catch (error: any) {
          if (error.code === '22P02' || error.message?.includes('invalid input syntax for type uuid')) {
            return sendError(res, 400, `Invalid ID format for ${moduleName}`);
          }
          console.error(`[CRITICAL] Error in PUT /${moduleName}:`, {
            message: error.message,
            stack: error.stack,
            id: req.params.id,
            body: req.body,
            user: req.user?.email
          });
          sendError(res, 500, `Failed to update ${moduleName}. ${error.message}`, error.message);
        }
      });
    });
  }

  routeNames.forEach(rn => {
    router.delete(`/${rn}/:id`, authenticateToken, async (req: AuthRequest, res) => {
      const targetModule = getEffectiveModule(moduleName);
      if (!await checkPermission(req, targetModule, 'delete')) {
        return res.status(403).json({ error: 'Access Denied: No Delete Permission' });
      }
      const client = await pool.connect();
      try {
        const { id } = req.params;
        const companyId = req.user?.company_id;

        const excludedFromCheck = ['activity_logs', 'migrations'];
        if (!id || typeof id !== 'string') {
          client.release();
          return sendError(res, 400, 'Invalid ID format');
        }

        await client.query('BEGIN');

        if (moduleName === 'companies') {
          const tablesToDelete = [
            'company_subscriptions', 'users', 'roles', 'journal_entry_items', 'journal_entries',
            'invoice_items', 'invoices', 'purchase_invoice_items', 'purchase_invoices',
            'sales_order_items', 'sales_orders', 'purchase_order_items', 'purchase_orders',
            'return_items', 'returns', 'purchase_return_items', 'purchase_returns',
            'inventory_movements', 'products', 'item_groups', 'customers', 'suppliers',
            'payment_methods', 'expense_categories', 'receipt_vouchers', 'payment_vouchers',
            'customer_discounts', 'supplier_discounts', 'accounts', 'account_types',
            'settings', 'activity_logs', 'audit_logs', 'branches', 'warehouses', 'period_closings'
          ];

          for (const tbl of tablesToDelete) {
            try {
              await client.query(`DELETE FROM "${tbl}" WHERE company_id = $1`, [id]);
            } catch (e) {
              // Ignore tables that might not exist or don't have company_id
            }
          }
        }

        if (moduleName === 'sales_orders' || moduleName === 'purchase_orders') {
          const statusRes = await client.query(`SELECT status, invoice_number FROM "${moduleName}" WHERE id = $1`, [id]);
          if (statusRes.rows.length > 0 && statusRes.rows[0].status === 'converted') {
            await client.query('ROLLBACK');
            client.release();
            return sendError(res, 400, `لا يمكن حذف هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة رقم ${statusRes.rows[0].invoice_number || ''}`);
          }
        }

        if (moduleName === 'goods_receipts') {
          const linkedRes = await client.query(
            `SELECT pi.invoice_number 
             FROM purchase_invoice_goods_receipts pigr 
             JOIN purchase_invoices pi ON pigr.purchase_invoice_id = pi.id 
             WHERE pigr.goods_receipt_id = $1`,
            [id]
          );
          if (linkedRes.rows.length > 0) {
            await client.query('ROLLBACK');
            client.release();
            return sendError(res, 400, `لا يمكن حذف إذن الاستلام هذا لأنه مرتبط بفاتورة المشتريات رقم ${linkedRes.rows[0].invoice_number}. يرجى حذف الفاتورة أولاً.`);
          }
        }

        if (moduleName === 'invoices') {
          await client.query(
            `UPDATE sales_orders 
             SET status = 'pending', invoice_id = NULL, invoice_number = NULL 
             WHERE invoice_id = $1 AND company_id = $2`,
            [id, companyId]
          );
          await InventoryMovementService.reverseMovement('sales_invoice', id, client);
        }

        if (moduleName === 'purchase_invoices') {
          await client.query(
            `UPDATE purchase_orders 
             SET status = 'pending', invoice_id = NULL, invoice_number = NULL 
             WHERE invoice_id = $1 AND company_id = $2`,
            [id, companyId]
          );
          await InventoryMovementService.reverseMovement('purchase_invoice', id, client);
        }

        if (moduleName === 'purchase_returns') {
          await InventoryMovementService.reverseMovement('purchase_return', id, client);
        }

        if (moduleName === 'returns') {
          await InventoryMovementService.reverseMovement('sales_return', id, client);
        }

        if (moduleName === 'warehouse_transfers') {
          await InventoryMovementService.reverseMovement('warehouse_transfer', id, client);
        }

        if (moduleName === 'stock_adjustments') {
          await InventoryMovementService.reverseMovement('stock_adjustment', id, client);
        }

        if (moduleName === 'opening_stock_balances') {
          await InventoryMovementService.reverseMovement('opening_stock_balance', id, client);
        }

        if (moduleName === 'goods_receipts') {
          // If linked to a PO, restore received_quantity
          const itemsRes = await client.query('SELECT product_id, quantity FROM goods_receipt_items WHERE goods_receipt_id = $1', [id]);
          const grRes = await client.query('SELECT source_document_type, source_document_id FROM goods_receipts WHERE id = $1', [id]);
          if (grRes.rows.length > 0 && grRes.rows[0].source_document_type === 'purchase_order' && grRes.rows[0].source_document_id) {
            const poId = grRes.rows[0].source_document_id;
            for (const item of itemsRes.rows) {
              await client.query(
                `UPDATE purchase_order_items 
                 SET received_quantity = COALESCE(received_quantity, 0) - $1 
                 WHERE order_id = $2 AND product_id = $3`,
                [parseFloat(item.quantity || '0'), poId, item.product_id]
              );
            }
            await updatePOReceiptStatus(client, companyId || '', poId);
          }

          await InventoryMovementService.reverseMovement('goods_receipt', id, client);
        }

        if (transactionalModules.includes(moduleName)) {
          await reverseAndRecalculate(client, companyId || '', id);
        }

        let query = `DELETE FROM "${moduleName}" WHERE id = $1`;
        let params = [id];

        const isSuperAdmin = req.user?.role === 'super_admin';
        if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && companyId && moduleName !== 'companies' && !isSuperAdmin) {
          query += ` AND company_id = $2`;
          params.push(companyId);
        }

        const result = await client.query(query, params);
        if (result.rowCount === 0) {
          await client.query('ROLLBACK');
          client.release();
          return sendError(res, 404, 'Not found or permission denied');
        }

        await client.query('COMMIT');

        // Audit Log
        logAudit({
          company_id: req.user?.company_id,
          user_id: req.user?.id,
          username: (req.user as any)?.username || req.user?.email,
          user_email: req.user?.email,
          action: 'DELETE',
          module: moduleName.toUpperCase(),
          details: `Deleted ${moduleName}: ${id}`,
          entity_type: moduleName,
          entity_id: id,
          ip_address: getIp(req)
        });

        res.json({ success: true });
      } catch (error: any) {
        await client.query('ROLLBACK');
        if (error.code === '22P02' || error.message?.includes('invalid input syntax for type uuid')) {
          return sendError(res, 400, `Invalid ID format for ${moduleName}`);
        }
        console.error(`Error in DELETE /${moduleName}:`, error);
        sendError(res, 500, `Failed to delete ${moduleName}`, error.message);
      } finally {
        client.release();
      }
    });
  });
});

// --- Invoices with Items (Transaction) ---
// Helper to ensure default accounts exist for a company
async function ensureDefaultAccounts(client: any, companyId: string) {

  // 1. Get or create a basic account type if needed (Assets, Liabilities, etc.)
  const { rows: accountTypes } = await client.query(
    'SELECT id, name, classification FROM account_types WHERE company_id = $1',
    [companyId]
  );
  
  if (accountTypes.length === 0) {

    const types = [
      { id: uuidv4(), name: 'الأصول', code: '1', classification: 'asset', statement_type: 'balance_sheet' },
      { id: uuidv4(), name: 'الالتزامات', code: '2', classification: 'liability', statement_type: 'balance_sheet' },
      { id: uuidv4(), name: 'حقوق الملكية', code: '3', classification: 'equity', statement_type: 'balance_sheet' },
      { id: uuidv4(), name: 'الإيرادات', code: '4', classification: 'revenue', statement_type: 'income_statement' },
      { id: uuidv4(), name: 'المصروفات', code: '5', classification: 'expense', statement_type: 'income_statement' },
    ];
    
    for (const type of types) {
      await client.query(
        'INSERT INTO account_types (id, company_id, name, code, classification, statement_type) VALUES ($1, $2, $3, $4, $5, $6)',
        [type.id, companyId, type.name, type.code, type.classification, type.statement_type]
      );
    }
  }

  // Reload types
  const { rows: currentTypes } = await client.query(
    'SELECT id, name, classification FROM account_types WHERE company_id = $1',
    [companyId]
  );

  const getType = (cls: string) => currentTypes.find(t => t.classification === cls)?.id;

  // 2. Define standard accounts
  const defaultAccounts = [
    { name: 'الخزينة العامة', code: '1101', classification: 'asset', usage: 'cash' },
    { name: 'حساب العملاء', code: '1201', classification: 'asset', usage: 'customer' },
    { name: 'حساب الموردين', code: '2101', classification: 'liability', usage: 'supplier' },
    { name: 'المبيعات', code: '4101', classification: 'revenue', usage: 'sales_revenue' },
    { name: 'تكلفة المبيعات', code: '5101', classification: 'cost', usage: 'cost_of_sales' },
    { name: 'الخصم المسموح به (مبيعات)', code: '4104', classification: 'revenue', usage: 'earned_discounts' },
    { name: 'الخصم المكتسب (مشتريات)', code: '5105', classification: 'cost', usage: 'granted_discounts' },
  ];

  for (const acc of defaultAccounts) {
    const { rows: existing } = await client.query(
      'SELECT id FROM accounts WHERE company_id = $1 AND (name = $2 OR code = $3)',
      [companyId, acc.name, acc.code]
    );
    
    if (existing.length === 0) {

      const typeId = getType(acc.classification);
      if (typeId) {
        await client.query(
          'INSERT INTO accounts (id, company_id, name, code, type_id, is_active, account_usage) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [uuidv4(), companyId, acc.name, acc.code, typeId, true, acc.usage]
        );
      }
    }
  }
}

router.post('/invoices', authenticateToken, TransactionsLimitMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');


    const { items, ...rawInvoiceData } = req.body;
    
    // Validate required fields
    if (!rawInvoiceData.customer_id) return sendError(res, 400, 'customer_id is required');
    if (!rawInvoiceData.date) return sendError(res, 400, 'date is required');
    if (rawInvoiceData.total_amount === undefined || rawInvoiceData.total_amount === null) {
       return sendError(res, 400, 'total_amount is required');
    }

    await client.query('BEGIN');

    // Validate negative stock restrictions
    for (const item of (items || [])) {
      const prodRes = await client.query('SELECT stock, type, name FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const currentStock = parseFloat(prod.stock || '0');
          const qtyNeeded = parseFloat(item.quantity || '0');
          if (currentStock < qtyNeeded) {
            if (!await checkPermission(req, 'invoices', 'allow_negative')) {
              await client.query('ROLLBACK');
              client.release();
              return sendError(res, 400, `لا يمكن إتمام العملية: رصيد الصنف "${prod.name}" غير كافٍ في المخزن وليس لديك صلاحية تجاوز الرصيد السالب.`);
            }
          }
        }
      }
    }
    
    // Ensure default accounts exist
    await ensureDefaultAccounts(client, companyId);

    const invoiceData = sanitizeData('invoices', rawInvoiceData);
    
    // Ensure company_id
    if (!invoiceData.company_id) invoiceData.company_id = companyId;
    const invoiceId = invoiceData.id || uuidv4();
    if (!isUUID(invoiceId)) {
       await client.query('ROLLBACK');
       return sendError(res, 400, 'Invalid Invoice ID format');
    }

    // Double check specific fields that might be null from frontend
    invoiceData.status = invoiceData.status || 'paid';
    invoiceData.payment_type = invoiceData.payment_type || 'cash';
    invoiceData.invoice_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'invoices',
      invoiceData.date as string,
      invoiceData.invoice_number
    );

    let sourceOrdersStr = '';
    if (req.body.order_ids && req.body.order_ids.length > 0) {
      const ordersRes = await client.query(
        'SELECT order_number FROM sales_orders WHERE id = ANY($1) AND company_id = $2',
        [req.body.order_ids, companyId]
      );
      const orderNums = ordersRes.rows.map((r: any) => r.order_number);
      sourceOrdersStr = orderNums.join(', ');
      
      // Update sales_orders status and link invoice
      await client.query(
        `UPDATE sales_orders 
         SET status = 'converted', invoice_id = $1, invoice_number = $2 
         WHERE id = ANY($3) AND company_id = $4`,
         [invoiceId, invoiceData.invoice_number || `INV-${invoiceId}`, req.body.order_ids, companyId]
      );
    }
    
    invoiceData.source_orders = sourceOrdersStr || null;

    // Insert Invoice
    const invData = { ...invoiceData, id: invoiceId };
    const invKeys = Object.keys(invData);
    const invValues = Object.values(invData);
    const invPlaceholders = invKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO "invoices" ("${invKeys.join('", "')}") VALUES (${invPlaceholders})`,
      invValues
    );

    const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];
    const movementLines: any[] = [];

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('invoice_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
      if (invData.company_id) itemData.company_id = invData.company_id;

      // Cost Calculation and Layer satisfying
      // Fetch product details
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          // Perform recordSale
          const quantity = parseFloat(item.quantity || '0');
          if (quantity > 0) {
            const costInfo = await recordSale(
              client,
              companyId,
              invData.warehouse_id || null,
              item.product_id,
              quantity,
              invoiceId,
              invoiceData.invoice_number,
              invoiceData.date
            );
            
            itemData.unit_cost = costInfo.unitCost;
            itemData.total_cost = costInfo.totalCost;

            movementLines.push({
              product_id: item.product_id,
              unit_id: item.unit_id || item.unit || 'default',
              quantity: quantity,
              direction: 'OUT',
              unit_cost: costInfo.unitCost,
              total_cost: costInfo.totalCost,
              batch_id: item.batch_id || null,
              serial_number: item.serial_number || null,
              notes: item.notes || null
            });
            itemData.costing_method_used = costInfo.methodUsed;

            // Prepare perpetual queue / continuous inventory posting
            if (costInfo.totalCost > 0) {
              // Find accounts
              // 1. Cost of Goods Sold (COGS) Account
              let costAccId = prod.cost_account_id;
              let costAccName = prod.cost_account_name || 'تكلفة المبيعات';
              
              // 2. Inventory Account
              let invAccId = prod.inventory_account_id;
              let invAccName = prod.inventory_account_name || 'المخزون';

              // Fallbacks if not configured on the product specifically
              if (!costAccId || !invAccId) {
                const accountsRes = await client.query('SELECT * FROM accounts WHERE company_id = $1', [companyId]);
                const accounts = accountsRes.rows;
                
                if (!costAccId) {
                  const fallbackCostAcc = accounts.find((a: any) => a.name.includes('تكلفة المبيعات') || a.name.includes('تكلفة مبيعات') || a.name.includes('تكلفة البضاعة المباعة'));
                  if (fallbackCostAcc) {
                    costAccId = fallbackCostAcc.id;
                    costAccName = fallbackCostAcc.name;
                  }
                }
                if (!invAccId) {
                  const fallbackInvAcc = accounts.find((a: any) => a.name.includes('مخزون') || a.name.includes('مخازن'));
                  if (fallbackInvAcc) {
                    invAccId = fallbackInvAcc.id;
                    invAccName = fallbackInvAcc.name;
                  }
                }
              }

              if (costAccId) {
                cogsLines.push({
                  account_id: costAccId,
                  account_name: costAccName,
                  debit: costInfo.totalCost,
                  credit: 0,
                  description: `تكلفة البضاعة المباعة صنف: ${prod.name} - فاتورة ${invoiceData.invoice_number}`
                });
              }
              if (invAccId) {
                cogsLines.push({
                  account_id: invAccId,
                  account_name: invAccName,
                  debit: 0,
                  credit: costInfo.totalCost,
                  description: `تخفيض المخزون صنف: ${prod.name} - فاتورة ${invoiceData.invoice_number}`
                });
              }
            }
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "invoice_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    // New Inventory Movement Engine integration (Phase 5)
    if (movementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: invoiceData.company_id || companyId,
        branch_id: invoiceData.branch_id || req.body.branch_id || null,
        warehouse_id: invoiceData.warehouse_id || null,
        movement_number: invoiceData.invoice_number || `INV-${invoiceId}`,
        movement_type: 'sales',
        source_document_type: 'sales_invoice',
        source_document_id: invoiceId,
        movement_date: invoiceData.date,
        status: 'posted',
        notes: invoiceData.notes || null,
        created_by: req.user?.id || invoiceData.created_by || null
      }, movementLines, client);
    }

    await client.query('COMMIT');

    // Audit Log
    logAudit({
      company_id: req.user?.company_id,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'INVOICES',
      details: `Created invoice: ${invoiceData.invoice_number || invoiceId}`,
      entity_type: 'invoices',
      entity_id: invoiceId,
      ip_address: getIp(req),
      metadata: { invoiceData, itemCount: (items || []).length }
    });

    res.status(201).json({ id: invoiceId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[DATABASE] Invoice creation full failure:', error);
    console.error('[DATABASE] Error Stack:', error.stack);
    sendError(res, 500, `Failed to create invoice: ${error.message}`, error.detail || error.hint || error.message);
  } finally {
    client.release();
  }
});

router.put('/invoices/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const invoiceId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(invoiceId)) return sendError(res, 400, 'Invalid Invoice ID format');

    await client.query('BEGIN');

    // Reset currently linked sales orders
    await client.query(
      `UPDATE sales_orders 
       SET status = 'pending', invoice_id = NULL, invoice_number = NULL 
       WHERE invoice_id = $1 AND company_id = $2`,
      [invoiceId, companyId]
    );

    const { items, id: bodyId, ...rawInvoiceData } = req.body;

    // Validate negative stock restrictions
    for (const item of (items || [])) {
      const prodRes = await client.query('SELECT stock, type, name FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const currentStock = parseFloat(prod.stock || '0');
          let oldQty = 0;
          const oldItemRes = await client.query('SELECT quantity FROM invoice_items WHERE invoice_id = $1 AND product_id = $2', [invoiceId, item.product_id]);
          if (oldItemRes.rows.length > 0) {
            oldQty = parseFloat(oldItemRes.rows[0].quantity || '0');
          }
          const qtyNeeded = parseFloat(item.quantity || '0') - oldQty;
          if (currentStock < qtyNeeded) {
            if (!await checkPermission(req, 'invoices', 'allow_negative')) {
              await client.query('ROLLBACK');
              client.release();
              return sendError(res, 400, `لا يمكن إتمام العملية: رصيد الصنف "${prod.name}" غير كافٍ في المخزن وليس لديك صلاحية تجاوز الرصيد السالب.`);
            }
          }
        }
      }
    }

    // Fetch and link new sales orders
    let sourceOrdersStr = '';
    if (req.body.order_ids && req.body.order_ids.length > 0) {
      const ordersRes = await client.query(
        'SELECT order_number FROM sales_orders WHERE id = ANY($1) AND company_id = $2',
        [req.body.order_ids, companyId]
      );
      const orderNums = ordersRes.rows.map((r: any) => r.order_number);
      sourceOrdersStr = orderNums.join(', ');
      
      await client.query(
        `UPDATE sales_orders 
         SET status = 'converted', invoice_id = $1, invoice_number = $2 
         WHERE id = ANY($3) AND company_id = $4`,
         [invoiceId, rawInvoiceData.invoice_number || `INV-${invoiceId}`, req.body.order_ids, companyId]
      );
    }
    rawInvoiceData.source_orders = sourceOrdersStr || null;

    const invoiceData = sanitizeData('invoices', rawInvoiceData);
    
    const invKeys = Object.keys(invoiceData);
    const invValues = Object.values(invoiceData);
    const invSetClause = invKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "invoices" SET ${invSetClause}, "updated_at" = CURRENT_TIMESTAMP WHERE id = $${invKeys.length + 1}`;
    let params = [...invValues, invoiceId];
    const isSuperAdmin = req.user?.role === 'super_admin';
    if (companyId && !isSuperAdmin) {
      query += ` AND company_id = $${invKeys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Invoice not found or permission denied');
    }

    // Sync Items
    if (items && Array.isArray(items) && items.length > 0) {
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
        await reverseAndRecalculate(client, companyId || '', invoiceId);
        await InventoryMovementService.reverseMovement('sales_invoice', invoiceId, client);
    
        const invData = invoiceData;
        const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];
        const movementLines: any[] = [];
    
        for (const item of (items || [])) {
          const sanitizedItem = sanitizeData('invoice_items', item);
          const itemId = uuidv4();
          const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
          if (invData.company_id) itemData.company_id = invData.company_id;
    
          // Cost Calculation and Layer satisfying
          // Fetch product details
          const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
          if (prodRes.rows.length > 0) {
            const prod = prodRes.rows[0];
            if (prod.type !== 'service' && !prod.is_service) {
              // Perform recordSale
              const quantity = parseFloat(item.quantity || '0');
              if (quantity > 0) {
                const costInfo = await recordSale(
                  client,
                  companyId,
                  invData.warehouse_id || null,
                  item.product_id,
                  quantity,
                  invoiceId,
                  invoiceData.invoice_number,
                  invoiceData.date
                );
                
                itemData.unit_cost = costInfo.unitCost;
                itemData.total_cost = costInfo.totalCost;
    
                movementLines.push({
                  product_id: item.product_id,
                  unit_id: item.unit_id || item.unit || 'default',
                  quantity: quantity,
                  direction: 'OUT',
                  unit_cost: costInfo.unitCost,
                  total_cost: costInfo.totalCost,
                  batch_id: item.batch_id || null,
                  serial_number: item.serial_number || null,
                  notes: item.notes || null
                });
                itemData.costing_method_used = costInfo.methodUsed;
    
                // Prepare perpetual queue / continuous inventory posting
                if (costInfo.totalCost > 0) {
                  // Find accounts
                  // 1. Cost of Goods Sold (COGS) Account
                  let costAccId = prod.cost_account_id;
                  let costAccName = prod.cost_account_name || 'تكلفة المبيعات';
                  
                  // 2. Inventory Account
                  let invAccId = prod.inventory_account_id;
                  let invAccName = prod.inventory_account_name || 'المخزون';
    
                  // Fallbacks if not configured on the product specifically
                  if (!costAccId || !invAccId) {
                    const accountsRes = await client.query('SELECT * FROM accounts WHERE company_id = $1', [companyId]);
                    const accounts = accountsRes.rows;
                    
                    if (!costAccId) {
                      const fallbackCostAcc = accounts.find((a: any) => a.name.includes('تكلفة المبيعات') || a.name.includes('تكلفة مبيعات') || a.name.includes('تكلفة البضاعة المباعة'));
                      if (fallbackCostAcc) {
                        costAccId = fallbackCostAcc.id;
                        costAccName = fallbackCostAcc.name;
                      }
                    }
                    if (!invAccId) {
                      const fallbackInvAcc = accounts.find((a: any) => a.name.includes('مخزون') || a.name.includes('مخازن'));
                      if (fallbackInvAcc) {
                        invAccId = fallbackInvAcc.id;
                        invAccName = fallbackInvAcc.name;
                      }
                    }
                  }
    
                  if (costAccId) {
                    cogsLines.push({
                      account_id: costAccId,
                      account_name: costAccName,
                      debit: costInfo.totalCost,
                      credit: 0,
                      description: `تكلفة البضاعة المباعة صنف: ${prod.name} - فاتورة ${invoiceData.invoice_number}`
                    });
                  }
                  if (invAccId) {
                    cogsLines.push({
                      account_id: invAccId,
                      account_name: invAccName,
                      debit: 0,
                      credit: costInfo.totalCost,
                      description: `تخفيض المخزون صنف: ${prod.name} - فاتورة ${invoiceData.invoice_number}`
                    });
                  }
                }
              }
            }
          }
    
          const itemKeys = Object.keys(itemData);
          const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
          
          await client.query(
            `INSERT INTO "invoice_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
            Object.values(itemData)
          );
        }
    
        const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
        if (productIdsToSync.length > 0) {
          await syncProductsCostAndJEs(client, companyId, productIdsToSync);
        }
    
        // New Inventory Movement Engine integration (Phase 5)
        if (movementLines.length > 0) {
          await InventoryMovementService.createMovement({
            company_id: invoiceData.company_id || companyId,
            branch_id: invoiceData.branch_id || req.body.branch_id || null,
            warehouse_id: invoiceData.warehouse_id || null,
            movement_number: invoiceData.invoice_number || `INV-${invoiceId}`,
            movement_type: 'sales',
            source_document_type: 'sales_invoice',
            source_document_id: invoiceId,
            movement_date: invoiceData.date,
            status: 'posted',
            notes: invoiceData.notes || null,
            created_by: req.user?.id || invoiceData.created_by || null
          }, movementLines, client);
        }
  }
  await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Invoice update error:', error);
    sendError(res, 500, 'Failed to update invoice', error.message);
  } finally {
    client.release();
  }
});

// --- Sales Returns with Items (Transaction) ---
router.post('/returns', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');
    const { items, ...rawReturnData } = req.body;
    const returnData = sanitizeData('returns', rawReturnData);
    if (!returnData.company_id) returnData.company_id = companyId;

    const returnId = returnData.id || uuidv4();
    if (!isUUID(returnId)) return sendError(res, 400, 'Invalid Return ID format');
    
    // Ensure unique return_number
    returnData.return_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'returns',
      returnData.date as string,
      returnData.return_number
    );

    // Insert Return
    const rData = { ...returnData, id: returnId };
    const rKeys = Object.keys(rData);
    const rPlaceholders = rKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO "returns" ("${rKeys.join('", "')}") VALUES (${rPlaceholders})`,
      Object.values(rData)
    );

    const movementLines: any[] = [];

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('return_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, return_id: returnId, unit_cost: 0 };
      if (rData.company_id) itemData.company_id = rData.company_id;

      // Cost and Layer integration for sales return
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const quantity = parseFloat(item.quantity || '0');
          if (quantity > 0) {
            // Retrieve last unit cost sold of this product
            const lastSaleRes = await client.query(
              `SELECT unit_cost FROM invoice_items 
               WHERE product_id = $1 AND company_id = $2 AND unit_cost > 0 
               ORDER BY created_at DESC LIMIT 1`,
              [item.product_id, companyId]
            );
            const returnUnitCost = lastSaleRes.rows[0] ? parseFloat(lastSaleRes.rows[0].unit_cost) : (parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0'));
            itemData.unit_cost = returnUnitCost;

            await recordSalesReturn(
              client,
              companyId,
              returnData.warehouse_id || null,
              item.product_id,
              quantity,
              returnUnitCost,
              returnId,
              returnData.return_number || `RET-${returnId}`,
              returnData.date
            );

            movementLines.push({
              product_id: item.product_id,
              unit_id: item.unit_id || item.unit || 'default',
              quantity: quantity,
              direction: 'IN',
              unit_cost: returnUnitCost,
              total_cost: quantity * returnUnitCost,
              batch_id: item.batch_id || null,
              serial_number: item.serial_number || null,
              notes: item.notes || null
            });
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "return_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

        const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    // New Inventory Movement Engine integration (Phase 7)
    if (movementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: returnData.company_id || companyId,
        branch_id: returnData.branch_id || req.body.branch_id || null,
        warehouse_id: returnData.warehouse_id || null,
        movement_number: returnData.return_number || `RET-${returnId}`,
        movement_type: 'sales_return',
        source_document_type: 'sales_return',
        source_document_id: returnId,
        movement_date: returnData.date,
        status: 'posted',
        notes: returnData.notes || null,
        created_by: req.user?.id || returnData.created_by || null
      }, movementLines, client);
    }

    await client.query('COMMIT');
    res.status(201).json({ id: returnId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Return creation error:', error);
    sendError(res, 500, 'Failed to create return', error.message);
  } finally {
    client.release();
  }
});

router.put('/returns/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const returnId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(returnId)) return sendError(res, 400, 'Invalid Return ID format');

    await client.query('BEGIN');
    // Removed legacy preservedEntryNumber code

    const { items, id: bodyId, ...rawReturnData } = req.body;
    const returnData = sanitizeData('returns', rawReturnData);
    
    const rKeys = Object.keys(returnData);
    const rValues = Object.values(returnData);
    const rSetClause = rKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "returns" SET ${rSetClause} WHERE id = $${rKeys.length + 1}`;
    let params = [...rValues, returnId];
    const isSuperAdmin = req.user?.role === 'super_admin';
    if (companyId && !isSuperAdmin) {
      query += ` AND company_id = $${rKeys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Return not found or permission denied');
    }

    if (items && Array.isArray(items) && items.length > 0) {
    await client.query('DELETE FROM return_items WHERE return_id = $1', [returnId]);
        await reverseAndRecalculate(client, companyId || '', returnId);
        await InventoryMovementService.reverseMovement('sales_return', returnId, client);
    
        const returnDataFinal = returnData;
        const rData = returnDataFinal;
        const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];
        const movementLines: any[] = [];
    for (const item of (items || [])) {
          const sanitizedItem = sanitizeData('return_items', item);
          const itemId = uuidv4();
          const itemData = { ...sanitizedItem, id: itemId, return_id: returnId, unit_cost: 0 };
          if (rData.company_id) itemData.company_id = rData.company_id;
    
          // Cost and Layer integration for sales return
          const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
          if (prodRes.rows.length > 0) {
            const prod = prodRes.rows[0];
            if (prod.type !== 'service' && !prod.is_service) {
              const quantity = parseFloat(item.quantity || '0');
              if (quantity > 0) {
                // Retrieve last unit cost sold of this product
                const lastSaleRes = await client.query(
                  `SELECT unit_cost FROM invoice_items 
                   WHERE product_id = $1 AND company_id = $2 AND unit_cost > 0 
                   ORDER BY created_at DESC LIMIT 1`,
                  [item.product_id, companyId]
                );
                const returnUnitCost = lastSaleRes.rows[0] ? parseFloat(lastSaleRes.rows[0].unit_cost) : (parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0'));
                itemData.unit_cost = returnUnitCost;
    
                await recordSalesReturn(
                  client,
                  companyId,
                  returnDataFinal.warehouse_id || null,
                  item.product_id,
                  quantity,
                  returnUnitCost,
                  returnId,
                  returnDataFinal.return_number || `RET-${returnId}`,
                  returnDataFinal.date
                );
    
                movementLines.push({
                  product_id: item.product_id,
                  unit_id: item.unit_id || item.unit || 'default',
                  quantity: quantity,
                  direction: 'IN',
                  unit_cost: returnUnitCost,
                  total_cost: quantity * returnUnitCost,
                  batch_id: item.batch_id || null,
                  serial_number: item.serial_number || null,
                  notes: item.notes || null
                });
              }
            }
          }
    
          const itemKeys = Object.keys(itemData);
          const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
          
          await client.query(
            `INSERT INTO "return_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
            Object.values(itemData)
          );
        }
    
        
        const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
        if (productIdsToSync.length > 0) {
          await syncProductsCostAndJEs(client, companyId, productIdsToSync);
        }
    
        // New Inventory Movement Engine integration (Phase 7)
        if (movementLines.length > 0) {
          await InventoryMovementService.createMovement({
            company_id: returnData.company_id || companyId,
            branch_id: returnData.branch_id || req.body.branch_id || null,
            warehouse_id: returnData.warehouse_id || null,
            movement_number: returnData.return_number || `RET-${returnId}`,
            movement_type: 'sales_return',
            source_document_type: 'sales_return',
            source_document_id: returnId,
            movement_date: returnData.date,
            status: 'posted',
            notes: returnData.notes || null,
            created_by: req.user?.id || returnData.created_by || null
          }, movementLines, client);
        }
  }
  await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Return update error:', error);
    sendError(res, 500, 'Failed to update return', error.message);
  } finally {
    client.release();
  }
});


export async function allocatePurchaseInvoiceBillingToGoodsReceipts(
  client: any,
  companyId: string,
  invoiceId: string,
  goodsReceiptIds: string[],
  items: any[],
  supplierId: string | null,
  supplierName: string | null
) {
  if (!goodsReceiptIds || goodsReceiptIds.length === 0) return;

  // Fetch all goods_receipt_items for these Goods Receipts
  const grItemsRes = await client.query(
    `SELECT id, goods_receipt_id, product_id, quantity, billed_quantity, remaining_quantity 
     FROM goods_receipt_items 
     WHERE goods_receipt_id = ANY($1) 
     ORDER BY created_at ASC`,
    [goodsReceiptIds]
  );
  const grItems = grItemsRes.rows;

  // Group goods_receipt_items by product_id
  const grItemsByProduct = new Map();
  for (const item of grItems) {
    const prodId = item.product_id;
    if (!grItemsByProduct.has(prodId)) {
      grItemsByProduct.set(prodId, []);
    }
    grItemsByProduct.get(prodId).push({
      ...item,
      quantity: parseFloat(item.quantity || '0'),
      billed_quantity: parseFloat(item.billed_quantity || '0'),
      remaining_quantity: parseFloat(item.remaining_quantity !== null && item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || '0'))
    });
  }

  // Allocate quantities FIFO style
  for (const item of items) {
    const prodId = item.product_id;
    const invoiceQty = parseFloat(item.quantity || '0');
    if (invoiceQty <= 0) continue;

    const grProds = grItemsByProduct.get(prodId) || [];
    let unallocatedQty = invoiceQty;

    for (const grItem of grProds) {
      if (unallocatedQty <= 0) break;
      const availableToBill = grItem.remaining_quantity;
      if (availableToBill <= 0) continue;

      const allocation = Math.min(unallocatedQty, availableToBill);
      grItem.billed_quantity += allocation;
      grItem.remaining_quantity -= allocation;
      unallocatedQty -= allocation;

      await client.query(
        `UPDATE goods_receipt_items 
         SET billed_quantity = $1, remaining_quantity = $2 
         WHERE id = $3`,
        [grItem.billed_quantity, grItem.remaining_quantity, grItem.id]
      );
    }
  }

  // Update supplier and billing status of the linked Goods Receipts
  for (const grId of goodsReceiptIds) {
    const grRes = await client.query(
      `SELECT supplier_id FROM goods_receipts WHERE id = $1`,
      [grId]
    );
    if (grRes.rows.length > 0) {
      const currentSupplierId = grRes.rows[0].supplier_id;
      if (!currentSupplierId && supplierId) {
        await client.query(
          `UPDATE goods_receipts 
           SET supplier_id = $1, supplier_name = $2 
           WHERE id = $3`,
          [supplierId, supplierName, grId]
        );
      }
    }

    const itemsRes = await client.query(
      `SELECT quantity, billed_quantity, remaining_quantity 
       FROM goods_receipt_items 
       WHERE goods_receipt_id = $1`,
      [grId]
    );
    const grItemsList = itemsRes.rows.map(item => ({
      quantity: parseFloat(item.quantity || '0'),
      billed_quantity: parseFloat(item.billed_quantity || '0'),
      remaining_quantity: parseFloat(item.remaining_quantity !== null && item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || '0'))
    }));

    let billingStatus = 'uninvoiced';
    if (grItemsList.length > 0) {
      const allFullyBilled = grItemsList.every(i => i.remaining_quantity <= 0.0001);
      const allUnbilled = grItemsList.every(i => i.billed_quantity <= 0.0001);
      if (allFullyBilled) {
        billingStatus = 'fully_invoiced';
      } else if (allUnbilled) {
        billingStatus = 'uninvoiced';
      } else {
        billingStatus = 'partially_invoiced';
      }
    }

    await client.query(
      `UPDATE goods_receipts 
       SET billing_status = $1 
       WHERE id = $2`,
      [billingStatus, grId]
    );
  }
}

export async function revertPurchaseInvoiceBillingFromGoodsReceipts(
  client: any,
  companyId: string,
  invoiceId: string
) {
  // Find all previously linked Goods Receipts
  const linksRes = await client.query(
    `SELECT goods_receipt_id FROM purchase_invoice_goods_receipts WHERE purchase_invoice_id = $1`,
    [invoiceId]
  );
  const goodsReceiptIds = linksRes.rows.map(r => r.goods_receipt_id);
  if (goodsReceiptIds.length === 0) return;

  // Fetch current invoice items
  const itemsRes = await client.query(
    `SELECT product_id, quantity FROM purchase_invoice_items WHERE invoice_id = $1`,
    [invoiceId]
  );
  const items = itemsRes.rows;

  // Fetch all goods_receipt_items (LIFO for rollback, matching FIFO allocation)
  const grItemsRes = await client.query(
    `SELECT id, goods_receipt_id, product_id, quantity, billed_quantity, remaining_quantity 
     FROM goods_receipt_items 
     WHERE goods_receipt_id = ANY($1) 
     ORDER BY created_at DESC`,
    [goodsReceiptIds]
  );
  const grItems = grItemsRes.rows;

  const grItemsByProduct = new Map();
  for (const item of grItems) {
    const prodId = item.product_id;
    if (!grItemsByProduct.has(prodId)) {
      grItemsByProduct.set(prodId, []);
    }
    grItemsByProduct.get(prodId).push({
      ...item,
      quantity: parseFloat(item.quantity || '0'),
      billed_quantity: parseFloat(item.billed_quantity || '0'),
      remaining_quantity: parseFloat(item.remaining_quantity !== null && item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || '0'))
    });
  }

  for (const item of items) {
    const prodId = item.product_id;
    const invoiceQty = parseFloat(item.quantity || '0');
    if (invoiceQty <= 0) continue;

    const grProds = grItemsByProduct.get(prodId) || [];
    let quantityToRestore = invoiceQty;

    for (const grItem of grProds) {
      if (quantityToRestore <= 0) break;
      const billedOnItem = grItem.billed_quantity;
      if (billedOnItem <= 0) continue;

      const restoration = Math.min(quantityToRestore, billedOnItem);
      grItem.billed_quantity -= restoration;
      grItem.remaining_quantity += restoration;
      quantityToRestore -= restoration;

      await client.query(
        `UPDATE goods_receipt_items 
         SET billed_quantity = $1, remaining_quantity = $2 
         WHERE id = $3`,
        [grItem.billed_quantity, grItem.remaining_quantity, grItem.id]
      );
    }
  }

  // Update billing_status for each Goods Receipt
  for (const grId of goodsReceiptIds) {
    const itemsRes = await client.query(
      `SELECT quantity, billed_quantity, remaining_quantity 
       FROM goods_receipt_items 
       WHERE goods_receipt_id = $1`,
      [grId]
    );
    const grItemsList = itemsRes.rows.map(item => ({
      quantity: parseFloat(item.quantity || '0'),
      billed_quantity: parseFloat(item.billed_quantity || '0'),
      remaining_quantity: parseFloat(item.remaining_quantity !== null && item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || '0'))
    }));

    let billingStatus = 'uninvoiced';
    if (grItemsList.length > 0) {
      const allFullyBilled = grItemsList.every(i => i.remaining_quantity <= 0.0001);
      const allUnbilled = grItemsList.every(i => i.billed_quantity <= 0.0001);
      if (allFullyBilled) {
        billingStatus = 'fully_invoiced';
      } else if (allUnbilled) {
        billingStatus = 'uninvoiced';
      } else {
        billingStatus = 'partially_invoiced';
      }
    }

    await client.query(
      `UPDATE goods_receipts 
       SET billing_status = $1 
       WHERE id = $2`,
      [billingStatus, grId]
    );
  }
}

// --- Purchase Invoices with Items (Transaction) ---
router.post('/purchase_invoices', authenticateToken, TransactionsLimitMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');
    const compRes = await client.query('SELECT purchase_workflow_mode FROM companies WHERE id = $1', [companyId]);
    const workflowMode = compRes.rows[0]?.purchase_workflow_mode || 'Simple';

    const { items, ...rawInvoiceData } = req.body;
    const invoiceData = sanitizeData('purchase_invoices', rawInvoiceData);
    if (!invoiceData.company_id) invoiceData.company_id = companyId;

    const goodsReceiptIds: string[] = req.body.goods_receipt_ids || [];
    if (workflowMode === 'Enterprise Strict' && goodsReceiptIds.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'الشركة تعمل بنظام الدورة الكاملة. يجب إنشاء استلام مخزون وربطه بالفاتورة أولاً.');
    }

    const invoiceId = invoiceData.id || uuidv4();
    if (!isUUID(invoiceId)) return sendError(res, 400, 'Invalid Invoice ID format');
    
    let sourceOrdersStr = '';
    if (req.body.order_ids && req.body.order_ids.length > 0) {
      const ordersRes = await client.query(
        'SELECT order_number FROM purchase_orders WHERE id = ANY($1) AND company_id = $2',
        [req.body.order_ids, companyId]
      );
      const orderNums = ordersRes.rows.map((r: any) => r.order_number);
      sourceOrdersStr = orderNums.join(', ');
      
await client.query(
        `UPDATE purchase_orders 
         SET status = 'converted', invoice_id = $1, invoice_number = $2 
         WHERE id = ANY($3) AND company_id = $4`,
         [invoiceId, invoiceData.invoice_number || `PINV-${invoiceId}`, req.body.order_ids, companyId]
      );
    }
    invoiceData.source_orders = sourceOrdersStr || null;

    let finalGrIds = [...goodsReceiptIds];
    let autoGenReceiptId = null;
    if (workflowMode === 'Enterprise Flexible' && finalGrIds.length === 0 && req.body.auto_generate_gr) {
      const receiptId = uuidv4();
      autoGenReceiptId = receiptId;
      const receiptNumber = await ensureUniqueSequenceNumber(client, companyId, 'goods_receipts', invoiceData.date as string);
      
      const receiptData = {
        id: receiptId,
        company_id: companyId,
        receipt_number: receiptNumber,
        supplier_id: invoiceData.supplier_id || null,
        supplier_name: invoiceData.supplier_name || null,
        warehouse_id: invoiceData.warehouse_id || null,
        warehouse_name: invoiceData.warehouse_name || null,
        date: invoiceData.date,
        notes: `إنشاء تلقائي من الفاتورة رقم ${invoiceData.invoice_number || receiptId}`,
        status: 'posted',
        document_origin: 'Purchase Invoice (Auto Generated)',
        created_automatically: true,
        source_document_type: 'purchase_invoice',
        source_document_id: invoiceId,
        source_document_number: invoiceData.invoice_number
      };

      const grKeys = Object.keys(receiptData);
      const grValues = Object.values(receiptData);
      const grPlaceholders = grKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "goods_receipts" ("${grKeys.join('", "')}") VALUES (${grPlaceholders})`,
        grValues
      );

      const grMovementLines: any[] = [];
      const grProductsToSync: string[] = [];

      for (const item of (items || [])) {
        const sanitizedItem = sanitizeData('goods_receipt_items', item);
        const itemId = uuidv4();
        const itemData = {
          ...sanitizedItem,
          id: itemId,
          goods_receipt_id: receiptId,
          company_id: companyId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_price || item.unit_cost || 0,
          total_cost: parseFloat(item.quantity || '0') * parseFloat(item.unit_price || item.unit_cost || '0'),
          billed_quantity: parseFloat(item.quantity || '0'),
          remaining_quantity: 0
        };

        const prodRes = await client.query('SELECT name, code, type, is_service FROM products WHERE id = $1', [item.product_id]);
        if (prodRes.rows.length === 0) throw new Error(`Product not found: ${item.product_id}`);
        const prod = prodRes.rows[0];
        itemData.product_name = prod.name;
        itemData.product_code = prod.code;

        const qty = parseFloat(itemData.quantity || '0');
        const cost = parseFloat(itemData.unit_cost || '0');

        const itemKeys = Object.keys(itemData);
        const itemValues = Object.values(itemData);
        const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

        await client.query(
          `INSERT INTO "goods_receipt_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
          itemValues
        );

        if (prod.type !== 'service' && !prod.is_service && qty > 0) {
          const localCost = cost * Number(invoiceData.exchange_rate || 1.0);
          await recordGoodsReceipt(
            client,
            companyId,
            receiptData.warehouse_id || null,
            item.product_id,
            qty,
            localCost,
            receiptId,
            receiptNumber,
            receiptData.date as string
          );

          grMovementLines.push({
            product_id: item.product_id,
            unit_id: item.unit_id || item.unit || 'default',
            quantity: qty,
            direction: 'IN',
            unit_cost: localCost,
            total_cost: qty * localCost,
            batch_id: item.batch_id || null,
            serial_number: item.serial_number || null,
            notes: item.notes || null
          });

          grProductsToSync.push(item.product_id);
        }
      }

      if (grProductsToSync.length > 0) {
        await syncProductsCostAndJEs(client, companyId, grProductsToSync);
      }

      if (grMovementLines.length > 0) {
        await InventoryMovementService.createMovement({
          company_id: companyId,
          branch_id: invoiceData.branch_id || req.body.branch_id || null,
          warehouse_id: receiptData.warehouse_id || null,
          movement_number: receiptNumber,
          movement_type: 'goods_receipt',
          source_document_type: 'goods_receipt',
          source_document_id: receiptId,
          movement_date: receiptData.date,
          status: 'posted',
          notes: receiptData.notes || null,
          created_by: req.user?.id || null
        }, grMovementLines, client);
      }

      finalGrIds.push(receiptId);
    }

    const isLinkedToGR = finalGrIds.length > 0;

    // Ensure unique invoice_number
    invoiceData.invoice_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'purchase_invoices',
      invoiceData.date as string,
      invoiceData.invoice_number
    );

    // Insert Purchase Invoice
    const invData = { ...invoiceData, id: invoiceId };
    const invKeys = Object.keys(invData);
    const invValues = Object.values(invData);
    const invPlaceholders = invKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO "purchase_invoices" ("${invKeys.join('", "')}") VALUES (${invPlaceholders})`,
      invValues
    );

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_invoice_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
      if (invData.company_id) itemData.company_id = invData.company_id;

      // Costing and stock update integration for purchases (skip if linked to Goods Receipt)
      if (!isLinkedToGR) {
        const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
        if (prodRes.rows.length > 0) {
          const prod = prodRes.rows[0];
          if (prod.type !== 'service' && !prod.is_service) {
            const qty = parseFloat(item.quantity || '0');
            const unitPrice = parseFloat(item.unit_price || '0');
            const localUnitPrice = unitPrice * Number(invoiceData.exchange_rate || 1.0);
            if (qty > 0) {
              await recordPurchase(
                client,
                companyId,
                invData.warehouse_id || null,
                item.product_id,
                qty,
                localUnitPrice,
                invoiceId,
                invoiceData.invoice_number || `PINV-${invoiceId}`,
                invoiceData.date
              );
            }
          }
        }
      }

      // If linked to PO, track invoiced_quantity
      if (req.body.order_ids && req.body.order_ids.length > 0) {
        const qty = parseFloat(item.quantity || '0');
        for (const orderId of req.body.order_ids) {
          await client.query(
            `UPDATE purchase_order_items 
             SET invoiced_quantity = COALESCE(invoiced_quantity, 0) + $1 
             WHERE order_id = $2 AND product_id = $3`,
            [qty, orderId, item.product_id]
          );
          await updatePOBillingStatus(client, companyId, orderId);
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "purchase_invoice_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    // New Inventory Movement Engine integration (Phase 2) - skip if linked to Goods Receipt
    if (!isLinkedToGR) {
      const movementLines: any[] = [];
      for (const item of (items || [])) {
        const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
        if (prodRes.rows.length > 0) {
          const prod = prodRes.rows[0];
          if (prod.type !== 'service' && !prod.is_service) {
            const qty = parseFloat(item.quantity || '0');
            const unitPrice = parseFloat(item.unit_price || item.unit_cost || '0');
            const localUnitPrice = unitPrice * Number(invoiceData.exchange_rate || 1.0);
            if (qty > 0) {
              movementLines.push({
                product_id: item.product_id,
                unit_id: item.unit_id || item.unit || 'default',
                quantity: qty,
                direction: 'IN',
                unit_cost: localUnitPrice,
                total_cost: qty * localUnitPrice,
                batch_id: item.batch_id || null,
                serial_number: item.serial_number || null,
                notes: item.notes || null
              });
            }
          }
        }
      }

      if (movementLines.length > 0) {
        await InventoryMovementService.createMovement({
          company_id: invoiceData.company_id || companyId,
          branch_id: invoiceData.branch_id || req.body.branch_id || null,
          warehouse_id: invoiceData.warehouse_id || null,
          movement_number: invoiceData.invoice_number || `PINV-${invoiceId}`,
          movement_type: 'purchase',
          source_document_type: 'purchase_invoice',
          source_document_id: invoiceId,
          movement_date: invoiceData.date,
          status: 'posted',
          notes: invoiceData.notes || null,
          created_by: req.user?.id || invoiceData.created_by || null
        }, movementLines, client);
      }
    } else {
      // Insert into join table for linking Purchase Invoice and Goods Receipts
      for (const grId of finalGrIds) {
        await client.query(
          `INSERT INTO purchase_invoice_goods_receipts (id, purchase_invoice_id, goods_receipt_id) VALUES ($1, $2, $3)`,
          [uuidv4(), invoiceId, grId]
        );
      }
      // Allocate quantities FIFO style
      const manualGrIds = finalGrIds.filter(id => id !== autoGenReceiptId);
      if (manualGrIds.length > 0) {
        await allocatePurchaseInvoiceBillingToGoodsReceipts(
          client,
          companyId,
          invoiceId,
          manualGrIds,
          items,
          invoiceData.supplier_id || null,
          invoiceData.supplier_name || null
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ id: invoiceId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Purchase invoice creation error:', error);
    sendError(res, 500, 'Failed to create purchase invoice', error.message);
  } finally {
    client.release();
  }
});

router.put('/purchase_invoices/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const invoiceId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(invoiceId)) return sendError(res, 400, 'Invalid Invoice ID format');

    await client.query('BEGIN');

    const compRes = await client.query('SELECT purchase_workflow_mode FROM companies WHERE id = $1', [companyId]);
    const workflowMode = compRes.rows[0]?.purchase_workflow_mode || 'Simple';

    const { items, id: bodyId, ...rawInvoiceData } = req.body;

    // Revert previous Goods Receipt billing allocations before deleting old items
    await revertPurchaseInvoiceBillingFromGoodsReceipts(client, companyId || '', invoiceId);

    const goodsReceiptIds: string[] = req.body.goods_receipt_ids || [];
    if (workflowMode === 'Enterprise Strict' && goodsReceiptIds.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'الشركة تعمل بنظام الدورة الكاملة. يجب إنشاء استلام مخزون وربطه بالفاتورة أولاً.');
    }

    // Deduct old invoiced quantities from old POs
    const oldPOIdsRes = await client.query('SELECT id FROM purchase_orders WHERE invoice_id = $1 AND company_id = $2', [invoiceId, companyId]);
    const oldPOIds = oldPOIdsRes.rows.map(r => r.id);
    const oldItemsRes = await client.query('SELECT product_id, quantity FROM purchase_invoice_items WHERE invoice_id = $1', [invoiceId]);
    for (const item of oldItemsRes.rows) {
      const qty = parseFloat(item.quantity || '0');
      for (const poId of oldPOIds) {
        await client.query(
          `UPDATE purchase_order_items 
           SET invoiced_quantity = COALESCE(invoiced_quantity, 0) - $1 
           WHERE order_id = $2 AND product_id = $3`,
          [qty, poId, item.product_id]
        );
      }
    }
    for (const poId of oldPOIds) {
      await updatePOBillingStatus(client, companyId || '', poId);
    }

    // Reset currently linked purchase orders
    await client.query(
      `UPDATE purchase_orders 
       SET status = 'pending', invoice_id = NULL, invoice_number = NULL 
       WHERE invoice_id = $1 AND company_id = $2`,
      [invoiceId, companyId]
    );

    // Fetch and link new purchase orders
    let sourceOrdersStr = '';
    if (req.body.order_ids && req.body.order_ids.length > 0) {
      const ordersRes = await client.query(
        'SELECT order_number FROM purchase_orders WHERE id = ANY($1) AND company_id = $2',
        [req.body.order_ids, companyId]
      );
      const orderNums = ordersRes.rows.map((r: any) => r.order_number);
      sourceOrdersStr = orderNums.join(', ');
      
      await client.query(
        `UPDATE purchase_orders 
         SET status = 'converted', invoice_id = $1, invoice_number = $2 
         WHERE id = ANY($3) AND company_id = $4`,
         [invoiceId, rawInvoiceData.invoice_number || `PINV-${invoiceId}`, req.body.order_ids, companyId]
      );
    }
    rawInvoiceData.source_orders = sourceOrdersStr || null;

    const invoiceData = sanitizeData('purchase_invoices', rawInvoiceData);
    
    const invKeys = Object.keys(invoiceData);
    const invValues = Object.values(invoiceData);
    const invSetClause = invKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "purchase_invoices" SET ${invSetClause} WHERE id = $${invKeys.length + 1}`;
    let params = [...invValues, invoiceId];
    const isSuperAdmin = req.user?.role === 'super_admin';
    if (companyId && !isSuperAdmin) {
      query += ` AND company_id = $${invKeys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Purchase Invoice not found or permission denied');
    }

    const prevLinkedRes = await client.query('SELECT 1 FROM purchase_invoice_goods_receipts WHERE purchase_invoice_id = $1', [invoiceId]);
    const previouslyLinkedToGR = prevLinkedRes.rows.length > 0;

    if (items && Array.isArray(items) && items.length > 0) {
    await client.query('DELETE FROM purchase_invoice_goods_receipts WHERE purchase_invoice_id = $1', [invoiceId]);
        await client.query('DELETE FROM purchase_invoice_items WHERE invoice_id = $1', [invoiceId]);
    
        if (!previouslyLinkedToGR) {
          await reverseAndRecalculate(client, companyId || '', invoiceId);
          await client.query('DELETE FROM "inventory_movements_v2" WHERE "source_document_type" = $1 AND "source_document_id" = $2', ['purchase_invoice', invoiceId]);
          await client.query('UPDATE "inventory_transaction_journal" SET "status" = $1, "cancelled_at" = NOW(), "movement_id" = NULL WHERE "source_document_type" = $2 AND "source_document_id" = $3', ['Reversed', 'purchase_invoice', invoiceId]);
        }
    
        let finalGrIds = [...goodsReceiptIds];
        let autoGenReceiptId = null;
        if (workflowMode === 'Enterprise Flexible' && finalGrIds.length === 0 && req.body.auto_generate_gr) {
          const receiptId = uuidv4();
          autoGenReceiptId = receiptId;
          const receiptNumber = await ensureUniqueSequenceNumber(client, companyId, 'goods_receipts', invoiceData.date as string);
          
          const receiptData = {
            id: receiptId,
            company_id: companyId,
            receipt_number: receiptNumber,
            supplier_id: invoiceData.supplier_id || null,
            supplier_name: invoiceData.supplier_name || null,
            warehouse_id: invoiceData.warehouse_id || null,
            warehouse_name: invoiceData.warehouse_name || null,
            date: invoiceData.date,
            notes: `إنشاء تلقائي من الفاتورة رقم ${invoiceData.invoice_number || receiptId}`,
            status: 'posted',
            document_origin: 'Purchase Invoice (Auto Generated)',
            created_automatically: true,
            source_document_type: 'purchase_invoice',
            source_document_id: invoiceId,
            source_document_number: invoiceData.invoice_number
          };
    
          const grKeys = Object.keys(receiptData);
          const grValues = Object.values(receiptData);
          const grPlaceholders = grKeys.map((_, i) => `$${i + 1}`).join(', ');
    
          await client.query(
            `INSERT INTO "goods_receipts" ("${grKeys.join('", "')}") VALUES (${grPlaceholders})`,
            grValues
          );
    
          const grMovementLines: any[] = [];
          const grProductsToSync: string[] = [];
    
          for (const item of (items || [])) {
            const sanitizedItem = sanitizeData('goods_receipt_items', item);
            const itemId = uuidv4();
            const itemData = {
              ...sanitizedItem,
              id: itemId,
              goods_receipt_id: receiptId,
              company_id: companyId,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_cost: item.unit_price || item.unit_cost || 0,
              total_cost: parseFloat(item.quantity || '0') * parseFloat(item.unit_price || item.unit_cost || '0'),
              billed_quantity: parseFloat(item.quantity || '0'),
              remaining_quantity: 0
            };
    
            const prodRes = await client.query('SELECT name, code, type, is_service FROM products WHERE id = $1', [item.product_id]);
            if (prodRes.rows.length === 0) throw new Error(`Product not found: ${item.product_id}`);
            const prod = prodRes.rows[0];
            itemData.product_name = prod.name;
            itemData.product_code = prod.code;
    
            const qty = parseFloat(itemData.quantity || '0');
            const cost = parseFloat(itemData.unit_cost || '0');
    
            const itemKeys = Object.keys(itemData);
            const itemValues = Object.values(itemData);
            const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
    
            await client.query(
              `INSERT INTO "goods_receipt_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
              itemValues
            );
    
            if (prod.type !== 'service' && !prod.is_service && qty > 0) {
              const localCost = cost * Number(invoiceData.exchange_rate || 1.0);
              await recordGoodsReceipt(
                client,
                companyId,
                receiptData.warehouse_id || null,
                item.product_id,
                qty,
                localCost,
                receiptId,
                receiptNumber,
                receiptData.date as string
              );
    
              grMovementLines.push({
                product_id: item.product_id,
                unit_id: item.unit_id || item.unit || 'default',
                quantity: qty,
                direction: 'IN',
                unit_cost: localCost,
                total_cost: qty * localCost,
                batch_id: item.batch_id || null,
                serial_number: item.serial_number || null,
                notes: item.notes || null
              });
    
              grProductsToSync.push(item.product_id);
            }
          }
    
          if (grProductsToSync.length > 0) {
            await syncProductsCostAndJEs(client, companyId, grProductsToSync);
          }
    
          if (grMovementLines.length > 0) {
            await InventoryMovementService.createMovement({
              company_id: companyId,
              branch_id: invoiceData.branch_id || req.body.branch_id || null,
              warehouse_id: receiptData.warehouse_id || null,
              movement_number: receiptNumber,
              movement_type: 'goods_receipt',
              source_document_type: 'goods_receipt',
              source_document_id: receiptId,
              movement_date: receiptData.date,
              status: 'posted',
              notes: receiptData.notes || null,
              created_by: req.user?.id || null
            }, grMovementLines, client);
          }
    
          finalGrIds.push(receiptId);
        }
    
        const isLinkedToGR = finalGrIds.length > 0;
        const invData = invoiceData;
    
        for (const item of (items || [])) {
          const sanitizedItem = sanitizeData('purchase_invoice_items', item);
          const itemId = uuidv4();
          const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
          if (invData.company_id) itemData.company_id = invData.company_id;
    
          // Costing and stock update integration for purchases (skip if linked to Goods Receipt)
          if (!isLinkedToGR) {
            const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
            if (prodRes.rows.length > 0) {
              const prod = prodRes.rows[0];
              if (prod.type !== 'service' && !prod.is_service) {
                const qty = parseFloat(item.quantity || '0');
                const unitPrice = parseFloat(item.unit_price || '0');
                const localUnitPrice = unitPrice * Number(invoiceData.exchange_rate || 1.0);
                if (qty > 0) {
                  await recordPurchase(
                    client,
                    companyId,
                    invData.warehouse_id || null,
                    item.product_id,
                    qty,
                    localUnitPrice,
                    invoiceId,
                    invoiceData.invoice_number || `PINV-${invoiceId}`,
                    invoiceData.date
                  );
                }
              }
            }
          }
    
          // If linked to PO, track invoiced_quantity
          if (req.body.order_ids && req.body.order_ids.length > 0) {
            const qty = parseFloat(item.quantity || '0');
            for (const orderId of req.body.order_ids) {
              await client.query(
                `UPDATE purchase_order_items 
                 SET invoiced_quantity = COALESCE(invoiced_quantity, 0) + $1 
                 WHERE order_id = $2 AND product_id = $3`,
                [qty, orderId, item.product_id]
              );
              await updatePOBillingStatus(client, companyId, orderId);
            }
          }
    
          const itemKeys = Object.keys(itemData);
          const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
          
          await client.query(
            `INSERT INTO "purchase_invoice_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
            Object.values(itemData)
          );
        }
    
        const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
        if (productIdsToSync.length > 0) {
          await syncProductsCostAndJEs(client, companyId, productIdsToSync);
        }
    
        // New Inventory Movement Engine integration (Phase 2) - skip if linked to Goods Receipt
        if (!isLinkedToGR) {
          const movementLines: any[] = [];
          for (const item of (items || [])) {
            const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
            if (prodRes.rows.length > 0) {
              const prod = prodRes.rows[0];
              if (prod.type !== 'service' && !prod.is_service) {
                const qty = parseFloat(item.quantity || '0');
                const unitPrice = parseFloat(item.unit_price || item.unit_cost || '0');
                const localUnitPrice = unitPrice * Number(invoiceData.exchange_rate || 1.0);
                if (qty > 0) {
                  movementLines.push({
                    product_id: item.product_id,
                    unit_id: item.unit_id || item.unit || 'default',
                    quantity: qty,
                    direction: 'IN',
                    unit_cost: localUnitPrice,
                    total_cost: qty * localUnitPrice,
                    batch_id: item.batch_id || null,
                    serial_number: item.serial_number || null,
                    notes: item.notes || null
                  });
                }
              }
            }
          }
    
          if (movementLines.length > 0) {
            await InventoryMovementService.createMovement({
              company_id: invoiceData.company_id || companyId,
              branch_id: invoiceData.branch_id || req.body.branch_id || null,
              warehouse_id: invoiceData.warehouse_id || null,
              movement_number: invoiceData.invoice_number || `PINV-${invoiceId}`,
              movement_type: 'purchase',
              source_document_type: 'purchase_invoice',
              source_document_id: invoiceId,
              movement_date: invoiceData.date,
              status: 'posted',
              notes: invoiceData.notes || null,
              created_by: req.user?.id || invoiceData.created_by || null
            }, movementLines, client);
          }
        } else {
          // Insert into join table for linking Purchase Invoice and Goods Receipts
          for (const grId of finalGrIds) {
            await client.query(
              `INSERT INTO purchase_invoice_goods_receipts (id, purchase_invoice_id, goods_receipt_id) VALUES ($1, $2, $3)`,
              [uuidv4(), invoiceId, grId]
            );
          }
          // Allocate quantities FIFO style
          const manualGrIds = finalGrIds.filter(id => id !== autoGenReceiptId);
          if (manualGrIds.length > 0) {
            await allocatePurchaseInvoiceBillingToGoodsReceipts(
              client,
              companyId,
              invoiceId,
              manualGrIds,
              items,
              invoiceData.supplier_id || null,
              invoiceData.supplier_name || null
            );
          }
        }
  }
  await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Purchase invoice update error:', error);
    sendError(res, 500, 'Failed to update purchase invoice', error.message);
  } finally {
    client.release();
  }
});

// --- Purchase Returns with Items (Transaction) ---
router.post('/purchase_returns', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');
    const { items, ...rawReturnData } = req.body;
    const returnData = sanitizeData('purchase_returns', rawReturnData);
    if (!returnData.company_id) returnData.company_id = companyId;

    const returnId = returnData.id || uuidv4();
    if (!isUUID(returnId)) return sendError(res, 400, 'Invalid Return ID format');
    
    // Ensure unique return_number
    returnData.return_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'purchase_returns',
      returnData.date as string,
      returnData.return_number
    );

    // Insert Purchase Return
    const rData = { ...returnData, id: returnId };
    const rKeys = Object.keys(rData);
    const rPlaceholders = rKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO "purchase_returns" ("${rKeys.join('", "')}") VALUES (${rPlaceholders})`,
      Object.values(rData)
    );

    const movementLines: any[] = [];

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_return_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, return_id: returnId, unit_cost: 0 };
      if (rData.company_id) itemData.company_id = rData.company_id;

      // Cost and stock integration for purchase return
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const qty = parseFloat(item.quantity || '0');
          if (qty > 0) {
            const returnUnitCost = parseFloat(item.unit_price || '0') || parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0');
            itemData.unit_cost = returnUnitCost;
            const localReturnUnitCost = returnUnitCost * Number(returnData.exchange_rate || 1.0);
            await recordPurchaseReturn(
              client,
              companyId,
              returnData.warehouse_id || null,
              item.product_id,
              qty,
              localReturnUnitCost,
              returnId,
              returnData.return_number || `PRET-${returnId}`,
              returnData.date
            );

            movementLines.push({
              product_id: item.product_id,
              unit_id: item.unit_id || item.unit || 'default',
              quantity: qty,
              direction: 'OUT',
              unit_cost: localReturnUnitCost,
              total_cost: qty * localReturnUnitCost,
              batch_id: item.batch_id || null,
              serial_number: item.serial_number || null,
              notes: item.notes || null
            });
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "purchase_return_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    if (movementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: returnData.company_id || companyId,
        branch_id: returnData.branch_id || req.body.branch_id || null,
        warehouse_id: returnData.warehouse_id || null,
        movement_number: returnData.return_number || `PRET-${returnId}`,
        movement_type: 'purchase_return',
        source_document_type: 'purchase_return',
        source_document_id: returnId,
        movement_date: returnData.date,
        status: 'posted',
        notes: returnData.notes || null,
        created_by: req.user?.id || returnData.created_by || null
      }, movementLines, client);
    }

    await client.query('COMMIT');
    res.status(201).json({ id: returnId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    latestServerError = {
      message: error.message,
      stack: error.stack,
      route: 'POST /purchase_returns',
      time: new Date().toISOString(),
      body: req.body
    };
    console.error('[CRASH PREVENTED] Purchase return creation error:', error);
    sendError(res, 500, 'Failed to create purchase return', error.message);
  } finally {
    client.release();
  }
});

router.put('/purchase_returns/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const returnId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(returnId)) return sendError(res, 400, 'Invalid Return ID format');

    await client.query('BEGIN');
    // Removed legacy preservedEntryNumber code

    const { items, id: bodyId, ...rawReturnData } = req.body;
    const returnData = sanitizeData('purchase_returns', rawReturnData);
    
    const rKeys = Object.keys(returnData);
    const rValues = Object.values(returnData);
    const rSetClause = rKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "purchase_returns" SET ${rSetClause} WHERE id = $${rKeys.length + 1}`;
    let params = [...rValues, returnId];
    const isSuperAdmin = req.user?.role === 'super_admin';
    if (companyId && !isSuperAdmin) {
      query += ` AND company_id = $${rKeys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Purchase Return not found or permission denied');
    }

    if (items && Array.isArray(items) && items.length > 0) {
    await client.query('DELETE FROM purchase_return_items WHERE return_id = $1', [returnId]);
        await reverseAndRecalculate(client, companyId || '', returnId);
        await InventoryMovementService.reverseMovement('purchase_return', returnId, client);
    
        const returnDataFinal = returnData;
        const rData = returnDataFinal;
        const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];
        const movementLines: any[] = [];
    for (const item of (items || [])) {
          const sanitizedItem = sanitizeData('purchase_return_items', item);
          const itemId = uuidv4();
          const itemData = { ...sanitizedItem, id: itemId, return_id: returnId, unit_cost: 0 };
          if (rData.company_id) itemData.company_id = rData.company_id;
    
          // Cost and stock integration for purchase return
          const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
          if (prodRes.rows.length > 0) {
            const prod = prodRes.rows[0];
            if (prod.type !== 'service' && !prod.is_service) {
              const qty = parseFloat(item.quantity || '0');
              if (qty > 0) {
                const returnUnitCost = parseFloat(item.unit_price || '0') || parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0');
                itemData.unit_cost = returnUnitCost;
                const localReturnUnitCost = returnUnitCost * Number(returnDataFinal.exchange_rate || 1.0);
                await recordPurchaseReturn(
                  client,
                  companyId,
                  returnDataFinal.warehouse_id || null,
                  item.product_id,
                  qty,
                  localReturnUnitCost,
                  returnId,
                  returnDataFinal.return_number || `PRET-${returnId}`,
                  returnDataFinal.date
                );
    
                movementLines.push({
                  product_id: item.product_id,
                  unit_id: item.unit_id || item.unit || 'default',
                  quantity: qty,
                  direction: 'OUT',
                  unit_cost: localReturnUnitCost,
                  total_cost: qty * localReturnUnitCost,
                  batch_id: item.batch_id || null,
                  serial_number: item.serial_number || null,
                  notes: item.notes || null
                });
              }
            }
          }
    
          const itemKeys = Object.keys(itemData);
          const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
          
          await client.query(
            `INSERT INTO "purchase_return_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
            Object.values(itemData)
          );
        }
    
        
        const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
        if (productIdsToSync.length > 0) {
          await syncProductsCostAndJEs(client, companyId, productIdsToSync);
        }
    
        // New Inventory Movement Engine integration (Phase 6)
        if (movementLines.length > 0) {
          await InventoryMovementService.createMovement({
            company_id: returnData.company_id || companyId,
            branch_id: returnData.branch_id || req.body.branch_id || null,
            warehouse_id: returnData.warehouse_id || null,
            movement_number: returnData.return_number || `PRET-${returnId}`,
            movement_type: 'purchase_return',
            source_document_type: 'purchase_return',
            source_document_id: returnId,
            movement_date: returnData.date,
            status: 'posted',
            notes: returnData.notes || null,
            created_by: req.user?.id || returnData.created_by || null
          }, movementLines, client);
        }
  }
  await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    latestServerError = {
      message: error.message,
      stack: error.stack,
      route: 'PUT /purchase_returns/:id',
      time: new Date().toISOString(),
      body: req.body
    };
    console.error('[CRASH PREVENTED] Purchase return update error:', error);
    sendError(res, 500, 'Failed to update purchase return', error.message);
  } finally {
    client.release();
  }
});

// --- Journal Entries (Accounting Transaction) ---
router.post('/journal_entries', authenticateToken, TransactionsLimitMiddleware, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');
    const { items, ...rawEntryData } = req.body;

    let totalDebit = 0;
    let totalCredit = 0;
    for (const item of (items || [])) {
      totalDebit += parseFloat(item.debit || 0);
      totalCredit += parseFloat(item.credit || 0);
    }
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;
    if (Math.abs(roundedDebit - roundedCredit) >= 0.01) {
      await client.query('ROLLBACK');
      return sendError(res, 400, `القيد غير متزن (مجموع المدين لا يساوي مجموع الدائن). مجموع المدين: ${roundedDebit.toFixed(2)}، مجموع الدائن: ${roundedCredit.toFixed(2)}`);
    }

    const entryData = sanitizeData('journal_entries', rawEntryData);
    if (!entryData.company_id) entryData.company_id = companyId;
    entryData.total_debit = roundedDebit;
    entryData.total_credit = roundedCredit;

    // Duplicate skip removed

    const entryId = entryData.id || uuidv4();
    if (!isUUID(entryId)) return sendError(res, 400, 'Invalid Entry ID format');

    entryData.entry_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'journal_entries',
      entryData.date as string,
      entryData.entry_number
    );
    const finalEntryData = { ...entryData, id: entryId };
    const keys = Object.keys(finalEntryData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO journal_entries (${keys.join(', ')}) VALUES (${placeholders})`,
      Object.values(finalEntryData)
    );

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('journal_entry_lines', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, journal_entry_id: entryId };
      if (finalEntryData.company_id) itemData.company_id = finalEntryData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO journal_entry_lines (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    
    if (['invoice', 'return', 'sales_return'].includes(finalEntryData.reference_type)) {
       await syncCOGSForJournalEntry(client, companyId, entryId, finalEntryData.reference_id, finalEntryData.reference_type);
    }

    await balanceAndValidateJournalEntry(client, entryId);
    await client.query('COMMIT');

    // Audit Log
    logAudit({
      company_id: req.user?.company_id,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'JOURNAL_ENTRIES',
      details: `Created journal entry: ${finalEntryData.reference_number || entryId}`,
      entity_type: 'journal_entries',
      entity_id: entryId,
      ip_address: getIp(req),
      metadata: { entryData: finalEntryData, itemCount: (items || []).length }
    });

    res.status(201).json({ id: entryId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Journal entry creation error:', error);
    sendError(res, 500, 'Failed to create journal entry: ' + error.message, error.stack);
  } finally {
    client.release();
  }
});

router.put('/journal_entries/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const entryId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(entryId)) return sendError(res, 400, 'Invalid Entry ID format');

    await client.query('BEGIN');
    const { items, id: bodyId, ...rawEntryData } = req.body;

    let totalDebit = 0;
    let totalCredit = 0;
    for (const item of (items || [])) {
      totalDebit += parseFloat(item.debit || 0);
      totalCredit += parseFloat(item.credit || 0);
    }
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;
    if (Math.abs(roundedDebit - roundedCredit) >= 0.01) {
      await client.query('ROLLBACK');
      return sendError(res, 400, `القيد غير متزن (مجموع المدين لا يساوي مجموع الدائن). مجموع المدين: ${roundedDebit.toFixed(2)}، مجموع الدائن: ${roundedCredit.toFixed(2)}`);
    }

    const entryData = sanitizeData('journal_entries', rawEntryData);
    entryData.total_debit = roundedDebit;
    entryData.total_credit = roundedCredit;
    
    const keys = Object.keys(entryData);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "journal_entries" SET ${setClause} WHERE id = $${keys.length + 1}`;
    let params = [...Object.values(entryData), entryId];
    const isSuperAdmin = req.user?.role === 'super_admin';
    if (companyId && !isSuperAdmin) {
      query += ` AND company_id = $${keys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Journal Entry not found or permission denied');
    }

    await client.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = $1', [entryId]);
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('journal_entry_lines', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, journal_entry_id: entryId };
      if (companyId) itemData.company_id = companyId;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO journal_entry_lines (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await balanceAndValidateJournalEntry(client, entryId);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Journal entry update error:', error);
    sendError(res, 500, 'Failed to update journal entry', error.message);
  } finally {
    client.release();
  }
});

// Update password
router.post('/auth/update-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE "users" SET "password_hash" = $1 WHERE id = $2', [hashedPassword, req.user?.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// --- Complex Operations Logic ---
router.post('/operations/complex', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { field_values, id: bodyId, ...rawOpData } = req.body;
    const opData = sanitizeData('operations', rawOpData);
    
    await client.query('BEGIN');

    // 1. Generate Operation Number if not provided
    if (!opData.operation_number) {
      const colCheck = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'operations' AND column_name = 'created_at'
      `);
      const hasCreatedAt = colCheck.rows.length > 0;
      const orderBy = hasCreatedAt ? 'created_at DESC' : 'id DESC';

      const { rows } = await client.query(
        `SELECT operation_number FROM operations WHERE company_id = $1 ORDER BY ${orderBy} LIMIT 1`,
        [companyId]
      );
      let nextNum = 1;
      if (rows.length > 0 && rows[0].operation_number) {
        const parts = rows[0].operation_number.split('-');
        const lastNum = parts.length > 1 ? parseInt(parts[1]) : NaN;
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      opData.operation_number = `OP-${nextNum.toString().padStart(5, '0')}`;
    }

    // 2. Create Operation
    const opId = uuidv4();
    const finalOpData = { ...opData, id: opId, company_id: companyId };
    
    // Log final data for debugging

    const opKeys = Object.keys(finalOpData);
    const opValues = Object.values(finalOpData);
    const opPlaceholders = opKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO operations (${opKeys.join(', ')}) VALUES (${opPlaceholders})`,
      opValues
    );

    // 3. Create Field Values
    if (field_values && Array.isArray(field_values)) {

      for (const fv of field_values) {
        if (!fv.field_id) {
          console.warn('[WARN] Skipping invalid field_id:', fv.field_id);
          continue;
        }
        const fvId = uuidv4();
        await client.query(
          'INSERT INTO operation_field_values (id, operation_id, field_id, value, company_id) VALUES ($1, $2, $3, $4, $5)',
          [fvId, opId, fv.field_id, fv.value, companyId]
        );
      }
    }

    await client.query('COMMIT');

    // Audit Log
    logAudit({
      company_id: req.user?.company_id,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'OPERATIONS',
      details: `Created complex operation: ${opData.operation_number || opId}`,
      entity_type: 'operations',
      entity_id: opId,
      ip_address: getIp(req),
      metadata: { opData, fieldValuesCount: (field_values || []).length }
    });

    res.status(201).json({ id: opId, operation_number: opData.operation_number });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Complex Operation creation failed:', error);
    sendError(res, 500, 'Failed to create complex operation', error.message);
  } finally {
    client.release();
  }
});

router.put('/operations/complex/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');
    if (!isUUID(id)) return sendError(res, 400, 'Invalid ID format');

    const { field_values, id: bodyId, company_id: bodyCompanyId, ...rawOpData } = req.body;
    const opData = sanitizeData('operations', rawOpData);
    
    await client.query('BEGIN');

    // 1. Update Operation
    const keys = Object.keys(opData);
    const values = Object.values(opData);
    if (keys.length > 0) {
      const setClause = keys.map((key, index) => {
        return `${key} = $${index + 1}`;
      }).join(', ');
      await client.query(
        `UPDATE "operations" SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2}`,
        [...values, id, companyId]
      );
    }

    // 2. Update Field Values (Delete and Re-insert for atomicity)
    if (field_values && Array.isArray(field_values)) {
      // First delete old ones for this operation (strictly filtered by company_id via Join or indirect if needed)
      // Since we know the operation ID and verified company ownership above, we can delete them.
      await client.query('DELETE FROM operation_field_values WHERE operation_id = $1', [id]);

      for (const fv of field_values) {
        if (!fv.field_id) continue;
        const fvId = uuidv4();
        await client.query(
          'INSERT INTO operation_field_values (id, operation_id, field_id, value, company_id) VALUES ($1, $2, $3, $4, $5)',
          [fvId, id, fv.field_id, fv.value, companyId]
        );
      }
    }

    await client.query('COMMIT');

    // Audit Log
    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'OPERATIONS',
      details: `Updated complex operation: ${id}`,
      entity_type: 'operations',
      entity_id: id,
      ip_address: getIp(req),
      metadata: { opData, fieldValuesCount: (field_values || []).length }
    });

    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Complex Operation update failed:', error);
    sendError(res, 500, 'Failed to update complex operation', error.message);
  } finally {
    client.release();
  }
});

router.get('/operations/:id/values', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!isUUID(id)) return sendError(res, 400, 'Invalid Operation ID format');

    const { rows } = await pool.query(`
      SELECT fv.*, f.name, f.label, f.type, f.unit 
      FROM operation_field_values fv
      JOIN operation_fields f ON fv.field_id = f.id
      JOIN operations o ON fv.operation_id = o.id
      WHERE fv.operation_id = $1 AND o.company_id = $2
    `, [id, companyId]);
    res.json(rows);
  } catch (error: any) {
    console.error(`[CRASH PREVENTED] Error in GET /operations/:id/values:`, error);
    sendError(res, 500, 'Failed to fetch operation values', error.message);
  }
});

// ==========================================
// Specialized Inventory Maintenance Routes
// ==========================================
router.post('/inventory/recalculate_all', async (req: any, res) => {
  const client = await pool.connect();
  try {
    let companyId = req.user?.company_id;
    // if (!companyId) return sendError(res, 401, 'Unauthorized');
    
    await client.query('BEGIN');
    const compRes = await client.query('SELECT id FROM companies LIMIT 1');
    companyId = compRes.rows.length > 0 ? compRes.rows[0].id : companyId;
    
    // 1. Delete fully orphaned movements (where parent transaction doesn't exist at all)
    const tables = [
      { type: 'invoice', table: 'invoices' },
      { type: 'purchase_invoice', table: 'purchase_invoices' },
      { type: 'returns', table: 'returns' },
      { type: 'purchase_returns', table: 'purchase_returns' }
    ];
    for (const { type, table } of tables) {
      await client.query(`DELETE FROM inventory_movements WHERE reference_type = $1 AND reference_id NOT IN (SELECT id FROM "${table}")`, [type]);
      await client.query(`DELETE FROM journal_entries WHERE reference_id NOT IN (SELECT id FROM "${table}") AND description LIKE $1`, [`%${type}%`]);
    }

    // 2. Find references that have duplicates or quantity mismatches
    const itemTypes = [
       { type: 'invoice', itemTable: 'invoice_items', fkey: 'invoice_id', isNegative: true },
       { type: 'purchase_invoice', itemTable: 'purchase_invoice_items', fkey: 'invoice_id', isNegative: false },
       { type: 'returns', itemTable: 'return_items', fkey: 'return_id', isNegative: false }, 
       { type: 'purchase_returns', itemTable: 'purchase_return_items', fkey: 'return_id', isNegative: true }
    ];

    let badReferenceIds = new Set<string>();

    for (const { type, itemTable, fkey, isNegative } of itemTypes) {
      // Find movements where product is totally missing from items
      const missingProd = await client.query(`
         SELECT m.reference_id FROM inventory_movements m
         WHERE m.reference_type = $1 AND m.company_id = $2
         AND NOT EXISTS (
            SELECT 1 FROM "${itemTable}" i 
            WHERE i."${fkey}" = m.reference_id 
            AND i.product_id = m.product_id
         )
      `, [type, companyId]);
      missingProd.rows.forEach(r => badReferenceIds.add(r.reference_id));

      // Find movements where quantity mismatches
      const mismatches = await client.query(`
         SELECT m.reference_id 
         FROM inventory_movements m
         JOIN "${itemTable}" i ON i."${fkey}" = m.reference_id AND i.product_id = m.product_id
         WHERE m.reference_type = $1 AND m.company_id = $2 AND ABS(m.quantity) != i.quantity
      `, [type, companyId]);
      mismatches.rows.forEach(r => badReferenceIds.add(r.reference_id));

      // Find duplicates
      const duplicates = await client.query(`
         SELECT reference_id FROM inventory_movements
         WHERE reference_type = $1 AND company_id = $2
         GROUP BY reference_id, product_id
         HAVING COUNT(*) > 1
      `, [type, companyId]);
      duplicates.rows.forEach(r => badReferenceIds.add(r.reference_id));
    }

    const productsToRecalc = new Set<string>();
    
    // Fetch all products that need recalculation
    const allProdsRes = await client.query('SELECT id FROM products WHERE COALESCE(is_service, false) = false AND type != \'service\'');
    allProdsRes.rows.forEach(r => productsToRecalc.add(r.id));

    // For each bad reference, delete its movements and re-insert by calling the appropriate record function
    for (const refId of badReferenceIds) {
      const typeRes = await client.query(`SELECT reference_type FROM inventory_movements WHERE reference_id = $1 LIMIT 1`, [refId]);
      if (typeRes.rows.length === 0) continue;
      const refType = typeRes.rows[0].reference_type;

      let parentTable = '';
      let itemTable = '';
      let fkey = '';

      if (refType === 'invoice') { parentTable = 'invoices'; itemTable = 'invoice_items'; fkey = 'invoice_id'; }
      if (refType === 'purchase_invoice') { parentTable = 'purchase_invoices'; itemTable = 'purchase_invoice_items'; fkey = 'invoice_id'; }
      if (refType === 'returns') { parentTable = 'returns'; itemTable = 'return_items'; fkey = 'return_id'; }
      if (refType === 'purchase_returns') { parentTable = 'purchase_returns'; itemTable = 'purchase_return_items'; fkey = 'return_id'; }

      // Get parent data
      const parentRes = await client.query(`SELECT * FROM "${parentTable}" WHERE id = $1 AND company_id = $2`, [refId, companyId]);
      if (parentRes.rows.length === 0) {
         await client.query('DELETE FROM inventory_movements WHERE reference_id = $1', [refId]);
         continue;
      }
      const parentDoc = parentRes.rows[0];

      // Delete all old impacts
      await client.query('DELETE FROM inventory_movements WHERE reference_id = $1', [refId]);
      await client.query('DELETE FROM inventory_layers WHERE reference_id = $1', [refId]);
      
      // Get items
      const itemsRes = await client.query(`SELECT * FROM "${itemTable}" WHERE "${fkey}" = $1`, [refId]);

      for (const item of itemsRes.rows) {
          const qty = parseFloat(item.quantity || '0');
          if (qty <= 0 || !item.product_id) continue;
          productsToRecalc.add(item.product_id); // Track modified product

          if (refType === 'invoice') {
             await recordSale(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, refId, parentDoc.invoice_number, parentDoc.date);
          } else if (refType === 'purchase_invoice') {
             await recordPurchase(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.cost_price || '0'), refId, parentDoc.invoice_number, parentDoc.date);
          } else if (refType === 'returns') {
             await recordSalesReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.unit_cost || item.cost_price || '0'), refId, parentDoc.return_number, parentDoc.date);
          } else if (refType === 'purchase_returns') {
             await recordPurchaseReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.unit_cost || item.cost_price || '0'), refId, parentDoc.return_number, parentDoc.date);
          }
      }
    }

    // Now recalculate stock for only the modified products

    for (const pid of productsToRecalc) {
        await recalculateProductStock(client, companyId, pid);
    }
    
    // Sync COGS journal entries with latest inventory movement costs

    // 1. Fetch all related Journal Entries
    const jeRes = await client.query(`
      SELECT id, reference_id, reference_type 
      FROM journal_entries 
      WHERE reference_type IN ('invoice', 'return', 'sales_return') AND company_id = $1
    `, [companyId]);

    for (const je of jeRes.rows) {
       await syncCOGSForJournalEntry(client, companyId, je.id, je.reference_id, je.reference_type);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'All products recalculated and journal entries synchronized successfully' });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Recalculate error:', error);
    sendError(res, 500, 'Recalculation failed', error.message);
  } finally {
    client.release();
  }
});

// --- Sales Orders & Purchase Orders Routes ---
router.post('/sales_orders', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawOrderData } = req.body;
    if (!rawOrderData.customer_id) return sendError(res, 400, 'customer_id is required');
    if (!rawOrderData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const orderData = sanitizeData('sales_orders', rawOrderData);
    if (!orderData.company_id) orderData.company_id = companyId;
    const orderId = orderData.id || uuidv4();
    orderData.status = 'pending';

    orderData.order_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'sales_orders',
      orderData.date as string,
      orderData.order_number
    );

    const ordData = { ...orderData, id: orderId };
    const ordKeys = Object.keys(ordData);
    const ordValues = Object.values(ordData);
    const ordPlaceholders = ordKeys.map((_, i) => `$${i + 1}`).join(', ');

    await client.query(
      `INSERT INTO "sales_orders" ("${ordKeys.join('", "')}") VALUES (${ordPlaceholders})`,
      ordValues
    );

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('sales_order_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, order_id: orderId };
      if (ordData.company_id) itemData.company_id = ordData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "sales_order_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'SALES_ORDERS',
      details: `Created sales order: ${orderData.order_number}`,
      entity_type: 'sales_orders',
      entity_id: orderId,
      ip_address: getIp(req),
      metadata: { orderData, itemCount: (items || []).length }
    });

    res.status(201).json({ id: orderId, order_number: orderData.order_number });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Sales Order creation failed:', error);
    sendError(res, 500, `Failed to create sales order: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/sales_orders/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const orderId = req.params.id;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');

    const statusRes = await client.query('SELECT status, invoice_number FROM sales_orders WHERE id = $1 AND company_id = $2', [orderId, companyId]);
    if (statusRes.rows.length > 0 && statusRes.rows[0].status === 'converted') {
      await client.query('ROLLBACK');
      return sendError(res, 400, `لا يمكن تعديل هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة رقم ${statusRes.rows[0].invoice_number || ''}`);
    }

    const { items, id: bodyId, ...rawOrderData } = req.body;
    const orderData = sanitizeData('sales_orders', rawOrderData);
    delete (orderData as any).id;
    delete (orderData as any).company_id;
    delete (orderData as any).order_number;
    delete (orderData as any).status;

    const ordKeys = Object.keys(orderData);
    const ordValues = Object.values(orderData);
    const ordSetClause = ordKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');

    let query = `UPDATE "sales_orders" SET ${ordSetClause} WHERE id = $${ordKeys.length + 1} AND company_id = $${ordKeys.length + 2}`;
    let params = [...ordValues, orderId, companyId];

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Sales Order not found or permission denied');
    }

    await client.query('DELETE FROM sales_order_items WHERE order_id = $1', [orderId]);

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('sales_order_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, order_id: orderId, company_id: companyId };

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "sales_order_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'SALES_ORDERS',
      details: `Updated sales order: ${orderId}`,
      entity_type: 'sales_orders',
      entity_id: orderId,
      ip_address: getIp(req),
      metadata: { orderData, itemCount: (items || []).length }
    });

    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Sales Order update failed:', error);
    sendError(res, 500, `Failed to update sales order: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.post('/purchase_orders', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawOrderData } = req.body;
    if (!rawOrderData.supplier_id) return sendError(res, 400, 'supplier_id is required');
    if (!rawOrderData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const orderData = sanitizeData('purchase_orders', rawOrderData);
    if (!orderData.company_id) orderData.company_id = companyId;
    const orderId = orderData.id || uuidv4();
    orderData.status = 'pending';

    orderData.order_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'purchase_orders',
      orderData.date as string,
      orderData.order_number
    );

    const ordData = { ...orderData, id: orderId };
    const ordKeys = Object.keys(ordData);
    const ordValues = Object.values(ordData);
    const ordPlaceholders = ordKeys.map((_, i) => `$${i + 1}`).join(', ');

    await client.query(
      `INSERT INTO "purchase_orders" ("${ordKeys.join('", "')}") VALUES (${ordPlaceholders})`,
      ordValues
    );

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_order_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, order_id: orderId };
      if (ordData.company_id) itemData.company_id = ordData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "purchase_order_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'PURCHASE_ORDERS',
      details: `Created purchase order: ${orderData.order_number}`,
      entity_type: 'purchase_orders',
      entity_id: orderId,
      ip_address: getIp(req),
      metadata: { orderData, itemCount: (items || []).length }
    });

    res.status(201).json({ id: orderId, order_number: orderData.order_number });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Purchase Order creation failed:', error);
    sendError(res, 500, `Failed to create purchase order: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/purchase_orders/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const orderId = req.params.id;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');

    const statusRes = await client.query('SELECT status, invoice_number FROM purchase_orders WHERE id = $1 AND company_id = $2', [orderId, companyId]);
    if (statusRes.rows.length > 0 && statusRes.rows[0].status === 'converted') {
      await client.query('ROLLBACK');
      return sendError(res, 400, `لا يمكن تعديل هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة رقم ${statusRes.rows[0].invoice_number || ''}`);
    }

    const { items, id: bodyId, ...rawOrderData } = req.body;
    const orderData = sanitizeData('purchase_orders', rawOrderData);
    delete (orderData as any).id;
    delete (orderData as any).company_id;
    delete (orderData as any).order_number;
    delete (orderData as any).status;

    const ordKeys = Object.keys(orderData);
    const ordValues = Object.values(orderData);
    const ordSetClause = ordKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');

    let query = `UPDATE "purchase_orders" SET ${ordSetClause} WHERE id = $${ordKeys.length + 1} AND company_id = $${ordKeys.length + 2}`;
    let params = [...ordValues, orderId, companyId];

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Purchase Order not found or permission denied');
    }

    await client.query('DELETE FROM purchase_order_items WHERE order_id = $1', [orderId]);

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_order_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, order_id: orderId, company_id: companyId };

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "purchase_order_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'PURCHASE_ORDERS',
      details: `Updated purchase order: ${orderId}`,
      entity_type: 'purchase_orders',
      entity_id: orderId,
      ip_address: getIp(req),
      metadata: { orderData, itemCount: (items || []).length }
    });

    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Purchase Order update failed:', error);
    sendError(res, 500, `Failed to update purchase order: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// GOODS RECEIPTS
// ==========================================
router.post('/goods_receipts', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawReceiptData } = req.body;
    if (!rawReceiptData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const receiptData = sanitizeData('goods_receipts', rawReceiptData);
    if (!receiptData.company_id) receiptData.company_id = companyId;
    const receiptId = receiptData.id || uuidv4();
    receiptData.id = receiptId;

    receiptData.receipt_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'goods_receipts',
      receiptData.date as string,
      receiptData.receipt_number
    );

    const grKeys = Object.keys(receiptData);
    const grValues = Object.values(receiptData);
    const grPlaceholders = grKeys.map((_, i) => `$${i + 1}`).join(', ');

    await client.query(
      `INSERT INTO "goods_receipts" ("${grKeys.join('", "')}") VALUES (${grPlaceholders})`,
      grValues
    );

    const movementLines: any[] = [];
    const productsToSync: string[] = [];

    let grRate = 1.0;
    if (receiptData.source_document_type === 'purchase_order' && receiptData.source_document_id) {
      const poRes = await client.query('SELECT exchange_rate FROM purchase_orders WHERE id = $1', [receiptData.source_document_id]);
      if (poRes.rows.length > 0) {
        grRate = Number(poRes.rows[0].exchange_rate || 1.0);
      }
    }

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('goods_receipt_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, goods_receipt_id: receiptId, company_id: companyId, billed_quantity: 0, remaining_quantity: item.quantity };

      const prodRes = await client.query('SELECT name, code, type, is_service FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) throw new Error(`Product not found: ${item.product_id}`);
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      itemData.unit_cost = cost;
      itemData.total_cost = qty * cost;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "goods_receipt_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      // If linked to PO, update received_quantity
      if (receiptData.source_document_type === 'purchase_order' && receiptData.source_document_id) {
        await client.query(
          `UPDATE purchase_order_items 
           SET received_quantity = COALESCE(received_quantity, 0) + $1 
           WHERE order_id = $2 AND product_id = $3`,
          [qty, receiptData.source_document_id, item.product_id]
        );
      }

      if (receiptData.status === 'posted' && prod.type !== 'service' && !prod.is_service && qty > 0) {
        const localCost = cost * grRate;
        await recordGoodsReceipt(
          client,
          companyId,
          receiptData.warehouse_id || null,
          item.product_id,
          qty,
          localCost,
          receiptId,
          receiptData.receipt_number,
          receiptData.date as string
        );

        movementLines.push({
          product_id: item.product_id,
          unit_id: item.unit_id || item.unit || 'default',
          quantity: qty,
          direction: 'IN',
          unit_cost: localCost,
          total_cost: qty * localCost,
          batch_id: item.batch_id || null,
          serial_number: item.serial_number || null,
          notes: item.notes || null
        });

        productsToSync.push(item.product_id);
      }
    }

    if (receiptData.source_document_type === 'purchase_order' && receiptData.source_document_id) {
      await updatePOReceiptStatus(client, companyId, receiptData.source_document_id);
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    // New Inventory Movement Engine integration
    if (receiptData.status === 'posted' && movementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: receiptData.company_id || companyId,
        branch_id: receiptData.branch_id || req.body.branch_id || null,
        warehouse_id: receiptData.warehouse_id || null,
        movement_number: receiptData.receipt_number || `GR-${receiptId}`,
        movement_type: 'goods_receipt',
        source_document_type: 'goods_receipt',
        source_document_id: receiptId,
        movement_date: receiptData.date,
        status: 'posted',
        notes: receiptData.notes || null,
        created_by: req.user?.id || receiptData.created_by || null
      }, movementLines, client);
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'GOODS_RECEIPTS',
      details: `Created goods receipt: ${receiptData.receipt_number}`,
      entity_type: 'goods_receipts',
      entity_id: receiptId,
      ip_address: getIp(req),
      metadata: { receiptData }
    });

    res.status(201).json({ id: receiptId, receipt_number: receiptData.receipt_number });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Goods Receipt creation failed:', error);
    sendError(res, 500, `Failed to create goods receipt: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/goods_receipts/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawReceiptData } = req.body;
    if (!rawReceiptData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const linkCheck = await client.query(
      `SELECT pi.invoice_number 
       FROM purchase_invoice_goods_receipts pigr 
       JOIN purchase_invoices pi ON pigr.purchase_invoice_id = pi.id 
       WHERE pigr.goods_receipt_id = $1`,
      [id]
    );
    if (linkCheck.rows.length > 0) {
      if (rawReceiptData.status === 'draft') {
        await client.query('ROLLBACK');
        client.release();
        return sendError(res, 400, `لا يمكن إلغاء أو تحويل إذن الاستلام هذا إلى مسودة لأنه مرتبط بفاتورة المشتريات رقم ${linkCheck.rows[0].invoice_number}. يرجى حذف أو فك ارتباط الفاتورة أولاً.`);
      }
    }

    // Retrieve old state to deduct received quantities from PO
    const oldItemsRes = await client.query('SELECT product_id, quantity, billed_quantity FROM goods_receipt_items WHERE goods_receipt_id = $1', [id]);
    const billedMap = new Map();
    oldItemsRes.rows.forEach((item: any) => {
      billedMap.set(item.product_id, parseFloat(item.billed_quantity || '0'));
    });
    const oldGrRes = await client.query('SELECT source_document_type, source_document_id FROM goods_receipts WHERE id = $1', [id]);
    if (oldGrRes.rows.length > 0 && oldGrRes.rows[0].source_document_type === 'purchase_order' && oldGrRes.rows[0].source_document_id) {
      const poId = oldGrRes.rows[0].source_document_id;
      for (const item of oldItemsRes.rows) {
        await client.query(
          `UPDATE purchase_order_items 
           SET received_quantity = COALESCE(received_quantity, 0) - $1 
           WHERE order_id = $2 AND product_id = $3`,
          [parseFloat(item.quantity || '0'), poId, item.product_id]
        );
      }
    }

    await reverseAndRecalculate(client, companyId, id);
    await InventoryMovementService.reverseMovement('goods_receipt', id, client);
    await client.query('DELETE FROM goods_receipt_items WHERE goods_receipt_id = $1', [id]);

    const receiptData = sanitizeData('goods_receipts', rawReceiptData);
    delete (receiptData as any).id;
    delete (receiptData as any).company_id;

    const grKeys = Object.keys(receiptData);
    const grValues = Object.values(receiptData);
    const setClause = grKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');

    await client.query(
      `UPDATE "goods_receipts" SET ${setClause} WHERE id = $${grKeys.length + 1} AND company_id = $${grKeys.length + 2}`,
      [...grValues, id, companyId]
    );

    const movementLines: any[] = [];
    const productsToSync: string[] = [];

    let grRate = 1.0;
    if (receiptData.source_document_type === 'purchase_order' && receiptData.source_document_id) {
      const poRes = await client.query('SELECT exchange_rate FROM purchase_orders WHERE id = $1', [receiptData.source_document_id]);
      if (poRes.rows.length > 0) {
        grRate = Number(poRes.rows[0].exchange_rate || 1.0);
      }
    }

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('goods_receipt_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, goods_receipt_id: id, company_id: companyId, billed_quantity: (typeof billedMap !== 'undefined' && billedMap.get(item.product_id)) || 0, remaining_quantity: Math.max(0, parseFloat(item.quantity || '0') - ((typeof billedMap !== 'undefined' && billedMap.get(item.product_id)) || 0)) };

      const prodRes = await client.query('SELECT name, code, type, is_service FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) throw new Error(`Product not found: ${item.product_id}`);
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      itemData.unit_cost = cost;
      itemData.total_cost = qty * cost;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "goods_receipt_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      // If linked to PO, update received_quantity
      if (receiptData.source_document_type === 'purchase_order' && receiptData.source_document_id) {
        await client.query(
          `UPDATE purchase_order_items 
           SET received_quantity = COALESCE(received_quantity, 0) + $1 
           WHERE order_id = $2 AND product_id = $3`,
          [qty, receiptData.source_document_id, item.product_id]
        );
      }

      if (receiptData.status === 'posted' && prod.type !== 'service' && !prod.is_service && qty > 0) {
        const localCost = cost * grRate;
        await recordGoodsReceipt(
          client,
          companyId,
          receiptData.warehouse_id || null,
          item.product_id,
          qty,
          localCost,
          id,
          rawReceiptData.receipt_number,
          receiptData.date as string
        );

        movementLines.push({
          product_id: item.product_id,
          unit_id: item.unit_id || item.unit || 'default',
          quantity: qty,
          direction: 'IN',
          unit_cost: localCost,
          total_cost: qty * localCost,
          batch_id: item.batch_id || null,
          serial_number: item.serial_number || null,
          notes: item.notes || null
        });

        productsToSync.push(item.product_id);
      }
    }

    if (receiptData.source_document_type === 'purchase_order' && receiptData.source_document_id) {
      await updatePOReceiptStatus(client, companyId, receiptData.source_document_id);
    }
    // Also if old PO was different, update old PO status
    if (oldGrRes.rows.length > 0 && oldGrRes.rows[0].source_document_type === 'purchase_order' && oldGrRes.rows[0].source_document_id && oldGrRes.rows[0].source_document_id !== receiptData.source_document_id) {
      await updatePOReceiptStatus(client, companyId, oldGrRes.rows[0].source_document_id);
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    // New Inventory Movement Engine integration
    if (receiptData.status === 'posted' && movementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: companyId,
        branch_id: receiptData.branch_id || req.body.branch_id || null,
        warehouse_id: receiptData.warehouse_id || null,
        movement_number: rawReceiptData.receipt_number || `GR-${id}`,
        movement_type: 'goods_receipt',
        source_document_type: 'goods_receipt',
        source_document_id: id,
        movement_date: receiptData.date,
        status: 'posted',
        notes: receiptData.notes || null,
        created_by: req.user?.id || receiptData.created_by || null
      }, movementLines, client);
    }

    {
      const grItemsListRes = await client.query(
        'SELECT quantity, billed_quantity, remaining_quantity FROM goods_receipt_items WHERE goods_receipt_id = $1',
        [id]
      );
      const grItemsList = grItemsListRes.rows.map((item: any) => ({
        quantity: parseFloat(item.quantity || '0'),
        billed_quantity: parseFloat(item.billed_quantity || '0'),
        remaining_quantity: parseFloat(item.remaining_quantity !== null && item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || '0'))
      }));

      let billingStatus = 'uninvoiced';
      if (grItemsList.length > 0) {
        const allFullyBilled = grItemsList.every((i: any) => i.remaining_quantity <= 0.0001);
        const allUnbilled = grItemsList.every((i: any) => i.billed_quantity <= 0.0001);
        if (allFullyBilled) {
          billingStatus = 'fully_invoiced';
        } else if (allUnbilled) {
          billingStatus = 'uninvoiced';
        } else {
          billingStatus = 'partially_invoiced';
        }
      }
      await client.query('UPDATE goods_receipts SET billing_status = $1 WHERE id = $2', [billingStatus, id]);
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'GOODS_RECEIPTS',
      details: `Updated goods receipt: ${rawReceiptData.receipt_number}`,
      entity_type: 'goods_receipts',
      entity_id: id,
      ip_address: getIp(req),
      metadata: { receiptData }
    });

    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Goods Receipt update failed:', error);
    sendError(res, 500, `Failed to update goods receipt: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.post('/warehouse_transfers', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawTransferData } = req.body;
    
    if (!rawTransferData.from_warehouse_id) return sendError(res, 400, 'from_warehouse_id is required');
    if (!rawTransferData.to_warehouse_id) return sendError(res, 400, 'to_warehouse_id is required');
    if (!rawTransferData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const transferData = sanitizeData('warehouse_transfers', rawTransferData);
    if (!transferData.company_id) transferData.company_id = companyId;
    const transferId = transferData.id || uuidv4();
    transferData.id = transferId;
    
    transferData.transfer_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'warehouse_transfers',
      transferData.date as string,
      transferData.transfer_number
    );

    const whRes = await client.query('SELECT id, name FROM warehouses WHERE id IN ($1, $2)', [transferData.from_warehouse_id, transferData.to_warehouse_id]);
    const warehouses = whRes.rows;
    const fromWh = warehouses.find(w => w.id === transferData.from_warehouse_id);
    const toWh = warehouses.find(w => w.id === transferData.to_warehouse_id);
    transferData.from_warehouse_name = fromWh?.name || '';
    transferData.to_warehouse_name = toWh?.name || '';

    const keys = Object.keys(transferData);
    const values = Object.values(transferData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "warehouse_transfers" ("${keys.join('", "')}") VALUES (${placeholders})`,
      values
    );

    const fromMovementLines: any[] = [];
    const toMovementLines: any[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('warehouse_transfer_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        transfer_id: transferId,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code, cost_price, weighted_average_cost FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const currentCost = parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0') || 0;
      itemData.unit_cost = currentCost;
      itemData.total_cost = parseFloat(item.quantity || '0') * currentCost;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "warehouse_transfer_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      const quantity = parseFloat(item.quantity || '0');
      if (quantity > 0) {
        await recordTransfer(
          client,
          companyId,
          transferData.from_warehouse_id,
          transferData.to_warehouse_id,
          item.product_id,
          quantity,
          transferId,
          transferData.transfer_number,
          transferData.date
        );

        fromMovementLines.push({
          product_id: item.product_id,
          unit_id: item.unit_id || item.unit || 'default',
          quantity: quantity,
          direction: 'OUT',
          unit_cost: currentCost,
          total_cost: quantity * currentCost,
          batch_id: item.batch_id || null,
          serial_number: item.serial_number || null,
          notes: item.notes || null
        });

        toMovementLines.push({
          product_id: item.product_id,
          unit_id: item.unit_id || item.unit || 'default',
          quantity: quantity,
          direction: 'IN',
          unit_cost: currentCost,
          total_cost: quantity * currentCost,
          batch_id: item.batch_id || null,
          serial_number: item.serial_number || null,
          notes: item.notes || null
        });
      }
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'WAREHOUSE_TRANSFERS',
      details: `Created warehouse transfer: ${transferData.transfer_number} from ${transferData.from_warehouse_name} to ${transferData.to_warehouse_name}`,
      entity_type: 'warehouse_transfers',
      entity_id: transferId,
      ip_address: getIp(req),
      metadata: transferData
    });

    // New Inventory Movement Engine integration (Phase 8: Warehouse Transfer)
    if (fromMovementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: transferData.company_id || companyId,
        branch_id: transferData.branch_id || req.body.branch_id || null,
        warehouse_id: transferData.from_warehouse_id || null,
        movement_number: `${transferData.transfer_number}-OUT`,
        movement_type: 'warehouse_transfer',
        source_document_type: 'warehouse_transfer',
        source_document_id: transferId,
        movement_date: transferData.date,
        status: 'posted',
        notes: transferData.notes || null,
        created_by: req.user?.id || transferData.created_by || null
      }, fromMovementLines, client);

      await InventoryMovementService.createMovement({
        company_id: transferData.company_id || companyId,
        branch_id: transferData.branch_id || req.body.branch_id || null,
        warehouse_id: transferData.to_warehouse_id || null,
        movement_number: `${transferData.transfer_number}-IN`,
        movement_type: 'warehouse_transfer',
        source_document_type: 'warehouse_transfer',
        source_document_id: transferId,
        movement_date: transferData.date,
        status: 'posted',
        notes: transferData.notes || null,
        created_by: req.user?.id || transferData.created_by || null
      }, toMovementLines, client);
    }

    await client.query('COMMIT');
    res.status(201).json({ id: transferId, transfer_number: transferData.transfer_number });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating warehouse transfer:', error);
    sendError(res, 500, `Failed to create warehouse transfer. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/warehouse_transfers/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawTransferData } = req.body;

    await client.query('BEGIN');

    await reverseAndRecalculate(client, companyId, id);
    await InventoryMovementService.reverseMovement('warehouse_transfer', id, client);
    await client.query('DELETE FROM warehouse_transfer_items WHERE transfer_id = $1', [id]);

    const transferData = sanitizeData('warehouse_transfers', rawTransferData);
    delete (transferData as any).id;
    delete (transferData as any).company_id;

    const whRes = await client.query('SELECT id, name FROM warehouses WHERE id IN ($1, $2)', [transferData.from_warehouse_id, transferData.to_warehouse_id]);
    const warehouses = whRes.rows;
    const fromWh = warehouses.find(w => w.id === transferData.from_warehouse_id);
    const toWh = warehouses.find(w => w.id === transferData.to_warehouse_id);
    transferData.from_warehouse_name = fromWh?.name || '';
    transferData.to_warehouse_name = toWh?.name || '';

    const keys = Object.keys(transferData);
    const values = Object.values(transferData);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    await client.query(
      `UPDATE "warehouse_transfers" SET ${setClause} WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2}`,
      [...values, id, companyId]
    );

    const fromMovementLines: any[] = [];
    const toMovementLines: any[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('warehouse_transfer_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        transfer_id: id,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code, cost_price, weighted_average_cost FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) throw new Error(`Product not found: ${item.product_id}`);
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const currentCost = parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0') || 0;
      itemData.unit_cost = currentCost;
      itemData.total_cost = parseFloat(item.quantity || '0') * currentCost;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "warehouse_transfer_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      const quantity = parseFloat(item.quantity || '0');
      if (quantity > 0) {
        await recordTransfer(
          client,
          companyId,
          transferData.from_warehouse_id,
          transferData.to_warehouse_id,
          item.product_id,
          quantity,
          id,
          rawTransferData.transfer_number,
          transferData.date
        );

        fromMovementLines.push({
          product_id: item.product_id,
          unit_id: item.unit_id || item.unit || 'default',
          quantity: quantity,
          direction: 'OUT',
          unit_cost: currentCost,
          total_cost: quantity * currentCost,
          batch_id: item.batch_id || null,
          serial_number: item.serial_number || null,
          notes: item.notes || null
        });

        toMovementLines.push({
          product_id: item.product_id,
          unit_id: item.unit_id || item.unit || 'default',
          quantity: quantity,
          direction: 'IN',
          unit_cost: currentCost,
          total_cost: quantity * currentCost,
          batch_id: item.batch_id || null,
          serial_number: item.serial_number || null,
          notes: item.notes || null
        });
      }
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'WAREHOUSE_TRANSFERS',
      details: `Updated warehouse transfer: ${rawTransferData.transfer_number}`,
      entity_type: 'warehouse_transfers',
      entity_id: id,
      ip_address: getIp(req),
      metadata: transferData
    });

    // New Inventory Movement Engine integration (Phase 8: Warehouse Transfer)
    if (fromMovementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: transferData.company_id || companyId,
        branch_id: transferData.branch_id || req.body.branch_id || null,
        warehouse_id: transferData.from_warehouse_id || null,
        movement_number: `${rawTransferData.transfer_number}-OUT`,
        movement_type: 'warehouse_transfer',
        source_document_type: 'warehouse_transfer',
        source_document_id: id,
        movement_date: transferData.date,
        status: 'posted',
        notes: transferData.notes || null,
        created_by: req.user?.id || transferData.created_by || null
      }, fromMovementLines, client);

      await InventoryMovementService.createMovement({
        company_id: transferData.company_id || companyId,
        branch_id: transferData.branch_id || req.body.branch_id || null,
        warehouse_id: transferData.to_warehouse_id || null,
        movement_number: `${rawTransferData.transfer_number}-IN`,
        movement_type: 'warehouse_transfer',
        source_document_type: 'warehouse_transfer',
        source_document_id: id,
        movement_date: transferData.date,
        status: 'posted',
        notes: transferData.notes || null,
        created_by: req.user?.id || transferData.created_by || null
      }, toMovementLines, client);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating warehouse transfer:', error);
    sendError(res, 500, `Failed to update warehouse transfer. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.get('/inventory/debug_moves', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT reference_number, date::text as date, created_at, movement_type, quantity, unit_cost, total_cost 
      FROM inventory_movements 
      WHERE movement_type IN ('sale', 'purchase', 'sales_return', 'purchase_return', 'adjustment', 'transfer_out', 'transfer_in')
      ORDER BY date ASC, CASE WHEN quantity > 0 THEN 0 ELSE 1 END ASC, created_at ASC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error: any) {
    console.error('Error fetching debug moves:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// OPENING STOCK BALANCES
// ==========================================
router.post('/opening_stock_balances', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawDocData } = req.body;
    
    if (!rawDocData.debit_account_id) return sendError(res, 400, 'debit_account_id is required');
    if (!rawDocData.credit_account_id) return sendError(res, 400, 'credit_account_id is required');
    if (!rawDocData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const docData = sanitizeData('opening_stock_balances', rawDocData);
    if (!docData.company_id) docData.company_id = companyId;
    const docId = docData.id || uuidv4();
    docData.id = docId;
    
    docData.document_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'opening_stock_balances',
      docData.date as string,
      docData.document_number
    );

    const keys = Object.keys(docData);
    const values = Object.values(docData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "opening_stock_balances" ("${keys.join('", "')}") VALUES (${placeholders})`,
      values
    );

    let totalValue = 0;
    const productsToSync: string[] = [];
    const movementLines: any[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('opening_stock_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        opening_stock_id: docId,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      const itemTotal = qty * cost;
      itemData.unit_cost = cost;
      itemData.total_cost = itemTotal;
      totalValue += itemTotal;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "opening_stock_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      if (qty > 0) {
        await recordAdjustment(
          client,
          companyId,
          item.warehouse_id || null,
          item.product_id,
          qty,
          cost,
          docId,
          docData.document_number,
          docData.date
        );
        productsToSync.push(item.product_id);

        movementLines.push({
          product_id: item.product_id,
          unit_id: item.unit_id || item.unit || 'default',
          quantity: qty,
          direction: 'IN',
          unit_cost: cost,
          total_cost: qty * cost,
          batch_id: item.batch_id || null,
          serial_number: item.serial_number || null,
          notes: item.notes || null
        });
      }
    }

    // Insert journal entry
    const entryId = uuidv4();
    const entryNumber = await ensureUniqueSequenceNumber(client, companyId, 'journal_entries', docData.date);
    await client.query(
      `INSERT INTO "journal_entries" (id, company_id, entry_number, date, description, reference_id, reference_type, total_debit, total_credit, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
      [
        entryId,
        companyId,
        entryNumber,
        docData.date,
        docData.description || `قيد افتتاح مخزون - سند رقم ${docData.document_number}`,
        docId,
        'opening_stock_balance',
        totalValue,
        totalValue,
        req.user?.id || null
      ]
    );

    // Fetch account names
    const debitAccRes = await client.query('SELECT name FROM accounts WHERE id = $1', [docData.debit_account_id]);
    const debitAccName = debitAccRes.rows[0]?.name || '';
    const creditAccRes = await client.query('SELECT name FROM accounts WHERE id = $1', [docData.credit_account_id]);
    const creditAccName = creditAccRes.rows[0]?.name || '';

    // Insert itemized lines per product
    let lineInserted = false;
    for (const item of (items || [])) {
      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      const itemTotal = qty * cost;

      if (itemTotal > 0) {
        // Find product name
        const prodRes = await client.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
        const prodName = prodRes.rows[0]?.name || 'صنف غير معروف';

        // Debit line (Inventory)
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            docData.debit_account_id,
            debitAccName,
            itemTotal,
            0,
            `افتتاح مخزون - صنف: ${prodName} - سند رقم ${docData.document_number}`,
          ]
        );

        // Credit line (Capital / Counter Account)
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            docData.credit_account_id,
            creditAccName,
            0,
            itemTotal,
            `افتتاح مخزون - مقابل - صنف: ${prodName} - سند رقم ${docData.document_number}`,
          ]
        );
        lineInserted = true;
      }
    }

    // Fallback if no itemized lines were inserted (e.g. totalValue is 0)
    if (!lineInserted) {
      // Debit line
      await client.query(
        `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          companyId,
          entryId,
          docData.debit_account_id,
          debitAccName,
          0,
          0,
          `افتتاح مخزون - سند رقم ${docData.document_number}`,
        ]
      );

      // Credit line
      await client.query(
        `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          companyId,
          entryId,
          docData.credit_account_id,
          creditAccName,
          0,
          0,
          `افتتاح مخزون - مقابل - سند رقم ${docData.document_number}`,
        ]
      );
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'OPENING_STOCK_BALANCES',
      details: `Created opening stock balance: ${docData.document_number} with value ${totalValue}`,
      entity_type: 'opening_stock_balances',
      entity_id: docId,
      ip_address: getIp(req),
      metadata: docData
    });

    // New Inventory Movement Engine integration (Phase 8: Opening Stock Balance)
    if (movementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: docData.company_id || companyId,
        branch_id: docData.branch_id || req.body.branch_id || null,
        warehouse_id: items[0]?.warehouse_id || docData.warehouse_id || null,
        movement_number: docData.document_number || `OPB-${docId}`,
        movement_type: 'opening_balance',
        source_document_type: 'opening_stock_balance',
        source_document_id: docId,
        movement_date: docData.date,
        status: 'posted',
        notes: docData.notes || null,
        created_by: req.user?.id || docData.created_by || null
      }, movementLines, client);
    }

    await balanceAndValidateJournalEntry(client, entryId);
    await client.query('COMMIT');
    res.status(201).json({ id: docId, document_number: docData.document_number });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating opening stock balance:', error);
    sendError(res, 500, `Failed to create opening stock balance. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/opening_stock_balances/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawDocData } = req.body;

    await client.query('BEGIN');

    await reverseAndRecalculate(client, companyId, id);
    await InventoryMovementService.reverseMovement('opening_stock_balance', id, client);
    await client.query('DELETE FROM opening_stock_items WHERE opening_stock_id = $1', [id]);

    const docData = sanitizeData('opening_stock_balances', rawDocData);
    delete (docData as any).id;
    delete (docData as any).company_id;

    const keys = Object.keys(docData);
    const values = Object.values(docData);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    await client.query(
      `UPDATE "opening_stock_balances" SET ${setClause} WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2}`,
      [...values, id, companyId]
    );

    let totalValue = 0;
    const productsToSync: string[] = [];
    const movementLines: any[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('opening_stock_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        opening_stock_id: id,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      const itemTotal = qty * cost;
      itemData.unit_cost = cost;
      itemData.total_cost = itemTotal;
      totalValue += itemTotal;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "opening_stock_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      if (qty > 0) {
        await recordAdjustment(
          client,
          companyId,
          item.warehouse_id || null,
          item.product_id,
          qty,
          cost,
          id,
          rawDocData.document_number,
          docData.date
        );
        productsToSync.push(item.product_id);

        movementLines.push({
          product_id: item.product_id,
          unit_id: item.unit_id || item.unit || 'default',
          quantity: qty,
          direction: 'IN',
          unit_cost: cost,
          total_cost: qty * cost,
          batch_id: item.batch_id || null,
          serial_number: item.serial_number || null,
          notes: item.notes || null
        });
      }
    }

    // Insert journal entry
    const entryId = uuidv4();
    const entryNumber = await ensureUniqueSequenceNumber(client, companyId, 'journal_entries', docData.date);
    await client.query(
      `INSERT INTO "journal_entries" (id, company_id, entry_number, date, description, reference_id, reference_type, total_debit, total_credit, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
      [
        entryId,
        companyId,
        entryNumber,
        docData.date,
        docData.description || `قيد افتتاح مخزون - سند رقم ${rawDocData.document_number}`,
        id,
        'opening_stock_balance',
        totalValue,
        totalValue,
        req.user?.id || null
      ]
    );

    // Fetch account names
    const debitAccRes = await client.query('SELECT name FROM accounts WHERE id = $1', [docData.debit_account_id]);
    const debitAccName = debitAccRes.rows[0]?.name || '';
    const creditAccRes = await client.query('SELECT name FROM accounts WHERE id = $1', [docData.credit_account_id]);
    const creditAccName = creditAccRes.rows[0]?.name || '';

    // Insert itemized lines per product
    let lineInserted = false;
    for (const item of (items || [])) {
      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      const itemTotal = qty * cost;

      if (itemTotal > 0) {
        // Find product name
        const prodRes = await client.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
        const prodName = prodRes.rows[0]?.name || 'صنف غير معروف';

        // Debit line (Inventory)
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            docData.debit_account_id,
            debitAccName,
            itemTotal,
            0,
            `افتتاح مخزون - صنف: ${prodName} - سند رقم ${rawDocData.document_number}`,
          ]
        );

        // Credit line (Capital / Counter Account)
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            docData.credit_account_id,
            creditAccName,
            0,
            itemTotal,
            `افتتاح مخزون - مقابل - صنف: ${prodName} - سند رقم ${rawDocData.document_number}`,
          ]
        );
        lineInserted = true;
      }
    }

    // Fallback if no itemized lines were inserted (e.g. totalValue is 0)
    if (!lineInserted) {
      // Debit line
      await client.query(
        `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          companyId,
          entryId,
          docData.debit_account_id,
          debitAccName,
          0,
          0,
          `افتتاح مخزون - سند رقم ${rawDocData.document_number}`,
        ]
      );

      // Credit line
      await client.query(
        `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          companyId,
          entryId,
          docData.credit_account_id,
          creditAccName,
          0,
          0,
          `افتتاح مخزون - مقابل - سند رقم ${rawDocData.document_number}`,
        ]
      );
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'OPENING_STOCK_BALANCES',
      details: `Updated opening stock balance: ${rawDocData.document_number} with value ${totalValue}`,
      entity_type: 'opening_stock_balances',
      entity_id: id,
      ip_address: getIp(req),
      metadata: docData
    });

    // New Inventory Movement Engine integration (Phase 8: Opening Stock Balance)
    if (movementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: docData.company_id || companyId,
        branch_id: docData.branch_id || req.body.branch_id || null,
        warehouse_id: items[0]?.warehouse_id || docData.warehouse_id || null,
        movement_number: rawDocData.document_number || `OPB-${id}`,
        movement_type: 'opening_balance',
        source_document_type: 'opening_stock_balance',
        source_document_id: id,
        movement_date: docData.date,
        status: 'posted',
        notes: docData.notes || null,
        created_by: req.user?.id || docData.created_by || null
      }, movementLines, client);
    }

    await balanceAndValidateJournalEntry(client, entryId);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating opening stock balance:', error);
    sendError(res, 500, `Failed to update opening stock balance. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// STOCK ADJUSTMENTS
// ==========================================
router.post('/stock_adjustments', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawDocData } = req.body;
    
    if (!rawDocData.account_id) return sendError(res, 400, 'account_id (adjustment counter account) is required');
    if (!rawDocData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const docData = sanitizeData('stock_adjustments', rawDocData);
    if (!docData.company_id) docData.company_id = companyId;
    const docId = docData.id || uuidv4();
    docData.id = docId;
    
    docData.adjustment_number = await ensureUniqueSequenceNumber(
      client,
      companyId,
      'stock_adjustments',
      docData.date as string,
      docData.adjustment_number
    );

    const keys = Object.keys(docData);
    const values = Object.values(docData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "stock_adjustments" ("${keys.join('", "')}") VALUES (${placeholders})`,
      values
    );

    const productsToSync: string[] = [];
    const journalLines: { account_id: string; debit: number; credit: number; description: string }[] = [];
    const movementLines: any[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('stock_adjustment_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        adjustment_id: docId,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code, inventory_account_id FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      
      itemData.unit_cost = cost;

      const costInfo = await recordAdjustment(
        client,
        companyId,
        item.warehouse_id || null,
        item.product_id,
        qty,
        cost,
        docId,
        docData.adjustment_number,
        docData.date
      );

      // Use the costing engine's computed cost
      const totalCostValue = Math.abs(costInfo.totalCost || (qty * cost));
      itemData.total_cost = qty < 0 ? -totalCostValue : totalCostValue;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "stock_adjustment_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      movementLines.push({
        product_id: item.product_id,
        unit_id: item.unit_id || item.unit || 'default',
        quantity: Math.abs(qty),
        direction: qty >= 0 ? 'IN' : 'OUT',
        unit_cost: cost,
        total_cost: totalCostValue,
        batch_id: item.batch_id || null,
        serial_number: item.serial_number || null,
        notes: item.notes || null
      });

      productsToSync.push(item.product_id);

      // Find product inventory account
      let invAccountId = prod.inventory_account_id;
      if (!invAccountId) {
        const fallbackRes = await client.query("SELECT id FROM accounts WHERE company_id = $1 AND (name LIKE '%مخزون%' OR name LIKE '%مخازن%') LIMIT 1", [companyId]);
        invAccountId = fallbackRes.rows[0]?.id || null;
      }

      if (invAccountId && totalCostValue > 0) {
        if (qty > 0) {
          journalLines.push({
            account_id: invAccountId,
            debit: totalCostValue,
            credit: 0,
            description: `تسوية إضافة مخزون صنف: ${prod.name}`
          });
          journalLines.push({
            account_id: docData.account_id,
            debit: 0,
            credit: totalCostValue,
            description: `تسوية إضافة مخزون صنف: ${prod.name}`
          });
        } else if (qty < 0) {
          journalLines.push({
            account_id: docData.account_id,
            debit: totalCostValue,
            credit: 0,
            description: `تسوية صرف مخزون صنف: ${prod.name}`
          });
          journalLines.push({
            account_id: invAccountId,
            debit: 0,
            credit: totalCostValue,
            description: `تسوية صرف مخزون صنف: ${prod.name}`
          });
        }
      }
    }

    let entryId: string | null = null;
    if (journalLines.length > 0) {
      entryId = uuidv4();
      const entryNumber = await ensureUniqueSequenceNumber(client, companyId, 'journal_entries', docData.date);

      const totalDebit = journalLines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
      const totalCredit = journalLines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);

      await client.query(
        `INSERT INTO "journal_entries" (id, company_id, entry_number, date, description, reference_id, reference_type, total_debit, total_credit, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
        [
          entryId,
          companyId,
          entryNumber,
          docData.date,
          docData.description || `قيد تسوية مخزنية - سند رقم ${docData.adjustment_number}`,
          docId,
          'stock_adjustment',
          totalDebit,
          totalCredit,
          req.user?.id || null
        ]
      );

      for (const line of journalLines) {
        const accRes = await client.query('SELECT name FROM accounts WHERE id = $1', [line.account_id]);
        const accName = accRes.rows[0]?.name || '';
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            line.account_id,
            accName,
            line.debit,
            line.credit,
            line.description,
          ]
        );
      }
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'STOCK_ADJUSTMENTS',
      details: `Created stock adjustment: ${docData.adjustment_number}`,
      entity_type: 'stock_adjustments',
      entity_id: docId,
      ip_address: getIp(req),
      metadata: docData
    });

    // New Inventory Movement Engine integration (Phase 8: Stock Adjustment)
    if (movementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: docData.company_id || companyId,
        branch_id: docData.branch_id || req.body.branch_id || null,
        warehouse_id: items[0]?.warehouse_id || docData.warehouse_id || null,
        movement_number: docData.adjustment_number || `ADJ-${docId}`,
        movement_type: 'inventory_adjustment',
        source_document_type: 'stock_adjustment',
        source_document_id: docId,
        movement_date: docData.date,
        status: 'posted',
        notes: docData.notes || null,
        created_by: req.user?.id || docData.created_by || null
      }, movementLines, client);
    }

    if (entryId) {
      await balanceAndValidateJournalEntry(client, entryId);
    }
    await client.query('COMMIT');
    res.status(201).json({ id: docId, adjustment_number: docData.adjustment_number });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating stock adjustment:', error);
    sendError(res, 500, `Failed to create stock adjustment. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/stock_adjustments/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawDocData } = req.body;

    await client.query('BEGIN');

    await reverseAndRecalculate(client, companyId, id);
    await InventoryMovementService.reverseMovement('stock_adjustment', id, client);
    await client.query('DELETE FROM stock_adjustment_items WHERE adjustment_id = $1', [id]);

    const docData = sanitizeData('stock_adjustments', rawDocData);
    delete (docData as any).id;
    delete (docData as any).company_id;

    const keys = Object.keys(docData);
    const values = Object.values(docData);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    await client.query(
      `UPDATE "stock_adjustments" SET ${setClause} WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2}`,
      [...values, id, companyId]
    );

    const productsToSync: string[] = [];
    const journalLines: { account_id: string; debit: number; credit: number; description: string }[] = [];
    const movementLines: any[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('stock_adjustment_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        adjustment_id: id,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code, inventory_account_id FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      
      itemData.unit_cost = cost;

      const costInfo = await recordAdjustment(
        client,
        companyId,
        item.warehouse_id || null,
        item.product_id,
        qty,
        cost,
        id,
        rawDocData.adjustment_number,
        docData.date
      );

      const totalCostValue = Math.abs(costInfo.totalCost || (qty * cost));
      itemData.total_cost = qty < 0 ? -totalCostValue : totalCostValue;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "stock_adjustment_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      movementLines.push({
        product_id: item.product_id,
        unit_id: item.unit_id || item.unit || 'default',
        quantity: Math.abs(qty),
        direction: qty >= 0 ? 'IN' : 'OUT',
        unit_cost: cost,
        total_cost: totalCostValue,
        batch_id: item.batch_id || null,
        serial_number: item.serial_number || null,
        notes: item.notes || null
      });

      productsToSync.push(item.product_id);

      // Find product inventory account
      let invAccountId = prod.inventory_account_id;
      if (!invAccountId) {
        const fallbackRes = await client.query("SELECT id FROM accounts WHERE company_id = $1 AND (name LIKE '%مخزون%' OR name LIKE '%مخازن%') LIMIT 1", [companyId]);
        invAccountId = fallbackRes.rows[0]?.id || null;
      }

      if (invAccountId && totalCostValue > 0) {
        if (qty > 0) {
          journalLines.push({
            account_id: invAccountId,
            debit: totalCostValue,
            credit: 0,
            description: `تسوية إضافة مخزون صنف: ${prod.name}`
          });
          journalLines.push({
            account_id: docData.account_id,
            debit: 0,
            credit: totalCostValue,
            description: `تسوية إضافة مخزون صنف: ${prod.name}`
          });
        } else if (qty < 0) {
          journalLines.push({
            account_id: docData.account_id,
            debit: totalCostValue,
            credit: 0,
            description: `تسوية صرف مخزون صنف: ${prod.name}`
          });
          journalLines.push({
            account_id: invAccountId,
            debit: 0,
            credit: totalCostValue,
            description: `تسوية صرف مخزون صنف: ${prod.name}`
          });
        }
      }
    }

    let entryId: string | null = null;
    if (journalLines.length > 0) {
      entryId = uuidv4();
      const entryNumber = await ensureUniqueSequenceNumber(client, companyId, 'journal_entries', docData.date);
      
      const totalDebit = journalLines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
      const totalCredit = journalLines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);

      await client.query(
        `INSERT INTO "journal_entries" (id, company_id, entry_number, date, description, reference_id, reference_type, total_debit, total_credit, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
        [
          entryId,
          companyId,
          entryNumber,
          docData.date,
          docData.description || `قيد تسوية مخزنية - سند رقم ${rawDocData.adjustment_number}`,
          id,
          'stock_adjustment',
          totalDebit,
          totalCredit,
          req.user?.id || null
        ]
      );

      for (const line of journalLines) {
        const accRes = await client.query('SELECT name FROM accounts WHERE id = $1', [line.account_id]);
        const accName = accRes.rows[0]?.name || '';
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            line.account_id,
            accName,
            line.debit,
            line.credit,
            line.description,
          ]
        );
      }
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'STOCK_ADJUSTMENTS',
      details: `Updated stock adjustment: ${rawDocData.adjustment_number}`,
      entity_type: 'stock_adjustments',
      entity_id: id,
      ip_address: getIp(req),
      metadata: docData
    });

    // New Inventory Movement Engine integration (Phase 8: Stock Adjustment)
    if (movementLines.length > 0) {
      await InventoryMovementService.createMovement({
        company_id: docData.company_id || companyId,
        branch_id: docData.branch_id || req.body.branch_id || null,
        warehouse_id: items[0]?.warehouse_id || docData.warehouse_id || null,
        movement_number: rawDocData.adjustment_number || `ADJ-${id}`,
        movement_type: 'inventory_adjustment',
        source_document_type: 'stock_adjustment',
        source_document_id: id,
        movement_date: docData.date,
        status: 'posted',
        notes: docData.notes || null,
        created_by: req.user?.id || docData.created_by || null
      }, movementLines, client);
    }

    if (entryId) {
      await balanceAndValidateJournalEntry(client, entryId);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating stock adjustment:', error);
    sendError(res, 500, `Failed to update stock adjustment. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

// ─── Exchange Rate Auto-Update ────────────────────────────────────────────────

/**
 * POST /api/erp/currencies/update-rates
 *
 * Fetches live rates from exchangerate.host and persists them to currency_rates.
 * Runs entirely on the server — no Node.js modules leak into the browser bundle.
 *
 * Body (optional): { baseCurrency?: string }
 * Returns: PersistRatesResult { success, inserted, updated, skipped, message }
 */
router.post('/currencies/update-rates', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { ExchangeRatePersistenceService } = await import('../services/ExchangeRatePersistenceService.js');
    const baseCurrency: string = req.body?.baseCurrency || 'EGP';

    const userId = req.user?.id;
    let updatedBy = 'Automatic';
    if (userId) {
      const { rows } = await pool.query('SELECT name, username FROM users WHERE id = $1', [userId]);
      if (rows.length > 0) {
        updatedBy = rows[0].name || rows[0].username || 'User';
      }
    }
    const companyId = req.user?.company_id || 'SYSTEM';

    const result = await ExchangeRatePersistenceService.persistLatestRates(
      { baseCurrency },
      companyId,
      updatedBy
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    console.error('[ERP] /currencies/update-rates error:', error);
    res.status(500).json({
      success: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/erp/currency-rates/history?currency_code=<CODE>&company_id=<ID>
 *
 * Returns sorted sync history records filtered by company_id and currency_code.
 */
router.get('/currency-rates/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = (req.query.company_id as string) || req.user?.company_id;
    const currencyCode = req.query.currency_code as string;

    if (!companyId || !currencyCode) {
      return res.status(400).json({ error: 'company_id and currency_code are required' });
    }

    const { rows } = await pool.query(
      `SELECT id, company_id, currency_code, exchange_rate, provider, retrieved_date, retrieved_time, updated_by, status, created_at
       FROM exchange_rate_history
       WHERE company_id = $1 AND UPPER(currency_code) = UPPER($2)
       ORDER BY created_at DESC, retrieved_date DESC, retrieved_time DESC
       LIMIT 100`,
      [companyId, currencyCode]
    );

    res.json(rows);
  } catch (error: any) {
    console.error('[ERP] /currency-rates/history error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ─── Phase 5: Latest Exchange Rates from currency_rates ───────────────────────

/**
 * GET /api/erp/currency-rates/latest?company_id=<id>
 *
 * Returns one row per currency in the company with its latest rate from the
 * `currency_rates` table (Phase 1 schema). Uses LEFT JOIN so currencies that
 * have no persisted rate still appear with null rate / rate_date.
 *
 * Response: Array<{ currency_id, rate: number|null, rate_date: string|null }>
 */
router.get('/currency-rates/latest', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = (req.query.company_id as string) || req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: 'company_id is required' });

    // DISTINCT ON gives the most-recent rate_date row per currency_id.
    // LEFT JOIN ensures currencies with no currency_rates row are included (rate = NULL).
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (c.id)
          c.id             AS currency_id,
          cr.rate          AS rate,
          cr.rate_date::text AS rate_date
       FROM currencies c
       LEFT JOIN currency_rates cr ON cr.currency_id = c.id
       WHERE c.company_id = $1
       ORDER BY c.id, cr.rate_date DESC NULLS LAST`,
      [companyId]
    );

    res.json(rows);
  } catch (error: any) {
    console.error('[ERP] GET /currency-rates/latest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/erp/widget-types
router.get('/widget-types', authenticateToken, (req, res) => {
  res.json(WIDGET_REGISTRY);
});

// GET /api/erp/dashboards/user/my-default
router.get('/dashboards/user/my-default', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const dashboard = await DashboardService.getOrCreateDefaultDashboard(companyId, userId);
    res.json(dashboard);
  } catch (error: any) {
    console.error('[ERP] Error provisioning default dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/erp/dashboards/:id/save-template
router.post('/dashboards/:id/save-template', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });
    if (!name) return res.status(400).json({ error: 'name is required' });

    // Restrict template creation to admin/super_admin
    const isAuthorized = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only administrators can save templates' });
    }

    const template = await DashboardService.saveAsTemplate(id, companyId, name, description);
    res.status(201).json(template);
  } catch (error: any) {
    console.error('[ERP] Error saving dashboard template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/erp/dashboards/:id/duplicate
router.post('/dashboards/:id/duplicate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!name) return res.status(400).json({ error: 'name is required' });

    const duplicate = await DashboardService.duplicateDashboard(id, companyId, userId, name, description);
    res.status(201).json(duplicate);
  } catch (error: any) {
    console.error('[ERP] Error duplicating dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/erp/dashboards/:id/export
router.get('/dashboards/:id/export', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const exported = await DashboardService.exportDashboard(id, companyId);
    res.json(exported);
  } catch (error: any) {
    console.error('[ERP] Error exporting dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/erp/dashboards/import
router.post('/dashboards/import', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    if (!companyId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const imported = await DashboardService.importDashboard(req.body, companyId, userId);
    res.status(201).json(imported);
  } catch (error: any) {
    console.error('[ERP] Error importing dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/erp/dashboards/:id/reset
router.post('/dashboards/:id/reset', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const reset = await DashboardService.resetDashboard(id, companyId);
    res.json(reset);
  } catch (error: any) {
    console.error('[ERP] Error resetting dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/erp/dashboards/:id/reorder
router.put('/dashboards/:id/reorder', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders must be an array' });
    }

    await DashboardService.reorderWidgets(id, companyId, orders);
    res.json({ success: true, message: 'Widgets reordered successfully' });
  } catch (error: any) {
    console.error('[ERP] Error reordering widgets:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- UNIVERSAL WIDGET DATA ENGINE API ---

const PARENT_TABLES: { [child: string]: { parent: string, joinCol: string } } = {
  invoice_items: { parent: 'invoices', joinCol: 'invoice_id' },
  purchase_invoice_items: { parent: 'purchase_invoices', joinCol: 'invoice_id' },
  sales_order_items: { parent: 'sales_orders', joinCol: 'order_id' },
  purchase_order_items: { parent: 'purchase_orders', joinCol: 'order_id' },
  return_items: { parent: 'returns', joinCol: 'return_id' },
  purchase_return_items: { parent: 'purchase_returns', joinCol: 'return_id' },
  journal_entry_lines: { parent: 'journal_entry_lines', joinCol: 'journal_entry_id' },
  warehouse_transfer_items: { parent: 'warehouse_transfers', joinCol: 'transfer_id' },
  opening_stock_items: { parent: 'opening_stock_items', joinCol: 'opening_stock_id' },
  stock_adjustment_items: { parent: 'stock_adjustment_items', joinCol: 'adjustment_id' }
};

function getDateRangeBoundaries(range: string) {
  const now = new Date();
  let start: Date;
  let end: Date = new Date();
  
  switch (range) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'last_30_days':
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'all_time':
    default:
      start = new Date(2000, 0, 1);
      break;
  }
  return { start, end };
}

function shiftDateRange(start: Date, end: Date, range: string) {
  const shiftedStart = new Date(start);
  const shiftedEnd = new Date(end);
  
  switch (range) {
    case 'today':
      shiftedStart.setDate(shiftedStart.getDate() - 1);
      shiftedEnd.setDate(shiftedEnd.getDate() - 1);
      break;
    case 'this_week':
      shiftedStart.setDate(shiftedStart.getDate() - 7);
      shiftedEnd.setDate(shiftedEnd.getDate() - 7);
      break;
    case 'this_month':
      shiftedStart.setMonth(shiftedStart.getMonth() - 1);
      shiftedEnd.setMonth(shiftedEnd.getMonth() - 1);
      break;
    case 'last_30_days':
      shiftedStart.setDate(shiftedStart.getDate() - 30);
      shiftedEnd.setDate(shiftedEnd.getDate() - 30);
      break;
    case 'this_year':
      shiftedStart.setFullYear(shiftedStart.getFullYear() - 1);
      shiftedEnd.setFullYear(shiftedEnd.getFullYear() - 1);
      break;
  }
  return { start: shiftedStart, end: shiftedEnd };
}

let widgetQueryCache: { [key: string]: { data: any, timestamp: number } } = {};

export function clearWidgetCache() {
  widgetQueryCache = {};
}
(global as any).clearWidgetCache = clearWidgetCache;

// Middleware to clear cache on writes
router.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    clearWidgetCache();
  }
  next();
});

// GET /api/erp/widgets/data-sources
router.get('/widgets/data-sources', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `);
    
    const tables: { [tableName: string]: string[] } = {};
    result.rows.forEach(row => {
      const name = row.table_name;
      // Filter out internal tables
      if (['migrations', 'sessions', 'dashboards', 'widgets', 'users', 'roles', 'system_config', 'exchange_rate_history', 'audit_logs'].includes(name)) {
        return;
      }
      if (!tables[name]) tables[name] = [];
      tables[name].push(row.column_name);
    });
    
    // Fallbacks from EXPECTED_SCHEMA
    Object.keys(EXPECTED_SCHEMA).forEach(name => {
      if (['migrations', 'sessions', 'dashboards', 'widgets', 'users', 'roles', 'system_config', 'exchange_rate_history', 'audit_logs'].includes(name)) {
        return;
      }
      if (!tables[name]) {
        tables[name] = EXPECTED_SCHEMA[name] || [];
      }
    });

    res.json(tables);
  } catch (error: any) {
    console.error('[ERP] GET /widgets/data-sources error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/erp/widgets/query
router.post('/widgets/query', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      source,
      fields = [],
      filters = [],
      dateRange,
      sorting,
      grouping = [],
      aggregation,
      limit,
      offset
    } = req.body;

    if (!source) return res.status(400).json({ error: 'source table is required' });

    // Validate table name (source)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(source)) {
      return res.status(400).json({ error: 'Invalid source name' });
    }

    // Cache hit?
    const cacheKey = `${companyId}_${JSON.stringify(req.body)}`;
    const cached = widgetQueryCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp < 30000)) {
      return res.json(cached.data);
    }

    // Fetch column metadata to validate inputs
    const colMetadataRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
    `, [source]);
    
    let tableCols = colMetadataRes.rows.map(r => r.column_name);
    
    // Fallback if database info schema query is empty
    if (tableCols.length === 0 && EXPECTED_SCHEMA[source]) {
      tableCols = EXPECTED_SCHEMA[source];
    }
    
    if (tableCols.length === 0) {
      return res.status(400).json({ error: `Table '${source}' does not exist or has no columns` });
    }

    const allExpectedCols = [...tableCols];
    
    // Add columns of joined parent if parent join is applicable
    const parentMapping = PARENT_TABLES[source];
    let parentCols: string[] = [];
    if (parentMapping) {
      const parentMetadata = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [parentMapping.parent]);
      parentCols = parentMetadata.rows.map(r => r.column_name);
      if (parentCols.length === 0 && EXPECTED_SCHEMA[parentMapping.parent]) {
        parentCols = EXPECTED_SCHEMA[parentMapping.parent];
      }
      parentCols.forEach(c => allExpectedCols.push(`parent_${c}`));
    }

    const validateCol = (col: string) => {
      if (col.includes('.')) {
        const parts = col.split('.');
        if (parts.length === 2) {
          const tName = parts[0];
          const cName = parts[1];
          if (tName === source) return tableCols.includes(cName);
          if (parentMapping && tName === parentMapping.parent) return parentCols.includes(cName);
        }
        return false;
      }
      return tableCols.includes(col) || allExpectedCols.includes(col);
    };

    // Validate fields
    for (const f of fields) {
      if (!validateCol(f)) return res.status(400).json({ error: `Invalid column: ${f}` });
    }
    
    // Validate groupings
    for (const g of grouping) {
      if (!validateCol(g)) return res.status(400).json({ error: `Invalid grouping column: ${g}` });
    }

    // Validate sorting
    if (sorting?.field && !validateCol(sorting.field)) {
      return res.status(400).json({ error: `Invalid sorting column: ${sorting.field}` });
    }

    // Validate aggregation
    if (aggregation?.field && !validateCol(aggregation.field)) {
      return res.status(400).json({ error: `Invalid aggregation column: ${aggregation.field}` });
    }

    // Helper to build WHERE conditions
    const buildQueryConditions = (
      params: any[],
      dateRangeOverride?: { start: Date, end: Date }
    ) => {
      const conditions: string[] = [];
      
      // 1. Company Isolation
      if (tableCols.includes('company_id')) {
        conditions.push(`"${source}"."company_id" = $${params.length + 1}`);
        params.push(companyId);
      } else if (parentMapping && parentCols.includes('company_id')) {
        conditions.push(`"${parentMapping.parent}"."company_id" = $${params.length + 1}`);
        params.push(companyId);
      }

      // 2. Date Range Filters
      let dateField = '';
      if (tableCols.includes('date')) dateField = 'date';
      else if (tableCols.includes('created_at')) dateField = 'created_at';
      else if (tableCols.includes('timestamp')) dateField = 'timestamp';
      else if (tableCols.includes('rate_date')) dateField = 'rate_date';

      if (dateField) {
        if (dateRangeOverride) {
          conditions.push(`"${source}"."${dateField}" >= $${params.length + 1}`);
          params.push(dateRangeOverride.start.toISOString().split('T')[0]);
          conditions.push(`"${source}"."${dateField}" <= $${params.length + 1}`);
          params.push(dateRangeOverride.end.toISOString().split('T')[0]);
        } else if (dateRange && dateRange !== 'all_time') {
          const { start, end } = getDateRangeBoundaries(dateRange);
          conditions.push(`"${source}"."${dateField}" >= $${params.length + 1}`);
          params.push(start.toISOString().split('T')[0]);
          conditions.push(`"${source}"."${dateField}" <= $${params.length + 1}`);
          params.push(end.toISOString().split('T')[0]);
        }
      }

      // 3. Custom Filters
      if (Array.isArray(filters)) {
        for (const filter of filters) {
          const { field, operator, value } = filter;
          if (!validateCol(field)) continue;

          let sqlOp = '=';
          let sqlVal = value;
          if (operator === '==' || operator === '=') sqlOp = '=';
          else if (operator === '!=' || operator === '<>') sqlOp = '<>';
          else if (operator === '>') sqlOp = '>';
          else if (operator === '>=') sqlOp = '>=';
          else if (operator === '<') sqlOp = '<';
          else if (operator === '<=') sqlOp = '<=';
          else if (operator === 'like' || operator === 'contains') {
            sqlOp = 'ILIKE';
            sqlVal = `%${value}%`;
          }

          const colRef = field.includes('.') ? field.split('.').map(x => `"${x}"`).join('.') : `"${source}"."${field}"`;
          conditions.push(`${colRef} ${sqlOp} $${params.length + 1}`);
          params.push(sqlVal);
        }
      }

      return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    };

    const executeQuery = async (dateRangeOverride?: { start: Date, end: Date }) => {
      let selectClause = '';
      let groupClause = '';
      const queryParams: any[] = [];

      let joinClause = '';
      if (parentMapping && (parentCols.includes('company_id') || fields.some(f => f.startsWith('parent_')))) {
        joinClause = `INNER JOIN "${parentMapping.parent}" ON "${source}"."${parentMapping.joinCol}" = "${parentMapping.parent}"."id"`;
      }

      if (aggregation && aggregation.type && !['RUNNING_TOTAL', 'GROWTH', 'COMPARISON'].includes(aggregation.type.toUpperCase())) {
        const aggField = aggregation.field ? `"${source}"."${aggregation.field}"` : '*';
        let aggExpr = '';
        
        switch (aggregation.type.toUpperCase()) {
          case 'SUM': aggExpr = `SUM(${aggField})`; break;
          case 'COUNT': aggExpr = `COUNT(${aggField})`; break;
          case 'AVG': aggExpr = `AVG(${aggField})`; break;
          case 'MIN': aggExpr = `MIN(${aggField})`; break;
          case 'MAX': aggExpr = `MAX(${aggField})`; break;
          case 'DISTINCT': aggExpr = `COUNT(DISTINCT ${aggField})`; break;
          default: aggExpr = `COUNT(*)`;
        }

        const selectedGroupCols = grouping.map(g => {
          const colRef = g.includes('.') ? g.split('.').map(x => `"${x}"`).join('.') : `"${source}"."${g}"`;
          return `${colRef} AS "${g}"`;
        });
        
        selectClause = [...selectedGroupCols, `${aggExpr} AS value`].join(', ');
        
        if (grouping.length > 0) {
          groupClause = `GROUP BY ` + grouping.map(g => g.includes('.') ? g.split('.').map(x => `"${x}"`).join('.') : `"${source}"."${g}"`).join(', ');
        }
      } else {
        if (fields.length > 0) {
          selectClause = fields.map(f => {
            if (f.includes('.')) return f.split('.').map(x => `"${x}"`).join('.') + ` AS "${f}"`;
            return `"${source}"."${f}" AS "${f}"`;
          }).join(', ');
        } else {
          selectClause = tableCols.map(c => `"${source}"."${c}" AS "${c}"`).join(', ');
        }
      }

      const whereClause = buildQueryConditions(queryParams, dateRangeOverride);
      let sql = `SELECT ${selectClause} FROM "${source}" ${joinClause} ${whereClause} ${groupClause}`;

      if (sorting && sorting.field) {
        const sortOrder = sorting.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const sortRef = sorting.field.includes('.') ? sorting.field.split('.').map(x => `"${x}"`).join('.') : `"${source}"."${sorting.field}"`;
        sql += ` ORDER BY ${sortRef} ${sortOrder}`;
      }

      if (limit !== undefined) {
        sql += ` LIMIT $${queryParams.length + 1}`;
        queryParams.push(parseInt(limit, 10));
      }
      if (offset !== undefined) {
        sql += ` OFFSET $${queryParams.length + 1}`;
        queryParams.push(parseInt(offset, 10));
      }

      const dbRes = await pool.query(sql, queryParams);
      return dbRes.rows;
    };

    let rows: any[] = [];
    const hasGrowthDateRange = dateRange && dateRange !== 'all_time' && aggregation && (aggregation.type?.toUpperCase() === 'GROWTH' || aggregation.type?.toUpperCase() === 'COMPARISON');
    const hasRunningTotalDate = aggregation && aggregation.type?.toUpperCase() === 'RUNNING_TOTAL' && (tableCols.includes('date') || tableCols.includes('created_at'));
    
    if (!(hasGrowthDateRange || hasRunningTotalDate)) {
      rows = await executeQuery();
    }

    // 1. Running Total Calculation
    if (aggregation && aggregation.type?.toUpperCase() === 'RUNNING_TOTAL') {
      let dateField = '';
      if (tableCols.includes('date')) dateField = 'date';
      else if (tableCols.includes('created_at')) dateField = 'created_at';
      
      if (dateField) {
        const queryParams: any[] = [];
        const whereClause = buildQueryConditions(queryParams);
        const aggField = aggregation.field || 'total_amount';
        const sql = `SELECT "${source}"."${dateField}" AS date, SUM("${source}"."${aggField}") AS total FROM "${source}" ${whereClause} GROUP BY "${source}"."${dateField}" ORDER BY "${source}"."${dateField}" ASC`;
        const resList = await pool.query(sql, queryParams);
        
        let runSum = 0;
        rows = resList.rows.map(r => {
          runSum += Number(r.total || 0);
          return {
            date: r.date,
            value: runSum
          };
        });
      }
    }

    // 2. Growth % and Comparison Calculations
    if (dateRange && dateRange !== 'all_time' && aggregation && (aggregation.type?.toUpperCase() === 'GROWTH' || aggregation.type?.toUpperCase() === 'COMPARISON')) {
      const { start, end } = getDateRangeBoundaries(dateRange);
      const shifted = shiftDateRange(start, end, dateRange);

      // Temporary override aggregation type to SUM or COUNT for raw comparisons
      const backupAgg = req.body.aggregation;
      req.body.aggregation = { field: backupAgg.field, type: 'SUM' };

      const currentValRes = await executeQuery();
      const previousValRes = await executeQuery(shifted);

      req.body.aggregation = backupAgg; // restore

      const currSum = currentValRes.reduce((sum, r) => sum + Number(r.value || 0), 0);
      const prevSum = previousValRes.reduce((sum, r) => sum + Number(r.value || 0), 0);

      let growthVal = 0;
      if (prevSum > 0) {
        growthVal = ((currSum - prevSum) / prevSum) * 100;
      } else {
        growthVal = currSum > 0 ? 100 : 0;
      }

      rows = [{
        current: currSum,
        previous: prevSum,
        growth: Number(growthVal.toFixed(2)),
        value: currSum
      }];
    }

    widgetQueryCache[cacheKey] = {
      data: rows,
      timestamp: Date.now()
    };

    res.json(rows);
  } catch (error: any) {
    console.error('[ERP] POST /widgets/query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Inventory Transaction Journal API (Phase 4) ---
router.get('/inventory_transaction_journal', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const {
      warehouse_id,
      movement_type,
      source_document_type,
      source_document_id,
      reference_number,
      created_by,
      status,
      startDate,
      endDate
    } = req.query;

    const params: any[] = [companyId];
    const conditions: string[] = ['"company_id" = $1'];

    if (warehouse_id) {
      params.push(warehouse_id);
      conditions.push(`"warehouse_id" = $${params.length}`);
    }
    if (movement_type) {
      params.push(movement_type);
      conditions.push(`"movement_type" = $${params.length}`);
    }
    if (source_document_type) {
      params.push(source_document_type);
      conditions.push(`"source_document_type" = $${params.length}`);
    }
    if (source_document_id) {
      params.push(source_document_id);
      conditions.push(`"source_document_id" = $${params.length}`);
    }
    if (reference_number) {
      params.push(reference_number);
      conditions.push(`"reference_number" = $${params.length}`);
    }
    if (created_by) {
      params.push(created_by);
      conditions.push(`"created_by" = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`"status" = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      conditions.push(`"created_at" >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`"created_at" <= $${params.length}`);
    }

    const sql = `
      SELECT * FROM "inventory_transaction_journal" 
      WHERE ${conditions.join(' AND ')} 
      ORDER BY "created_at" DESC
    `;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('[ERP] GET /inventory_transaction_journal error:', error);
    sendError(res, 500, 'Failed to fetch inventory transaction journal', error.message);
  }
});

export default router;
