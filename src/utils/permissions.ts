import { MODULE_PERMISSIONS_META, SPECIAL_PERMISSIONS_DESC } from '../constants/permissions';

export function getInitialPermissionsState() {
  const perms: any = {};
  
  Object.keys(MODULE_PERMISSIONS_META).forEach(modId => {
    perms[modId] = {
      view: false,
      create: false,
      edit: false,
      delete: false
    };
    
    const meta = MODULE_PERMISSIONS_META[modId];
    if (meta.special) {
      meta.special.forEach((sp: string) => {
        perms[modId][sp] = false;
      });
    }
  });

  return perms;
}

export function getDefaultRolePermissions(roleName: string): any {
  const perms = getInitialPermissionsState();

  if (roleName === 'مدير النظام' || roleName === 'System Admin') {
    // Set everything to true
    Object.keys(perms).forEach(modId => {
      Object.keys(perms[modId]).forEach(k => {
        perms[modId][k] = true;
      });
    });
  } else if (roleName === 'مدير مالي' || roleName === 'Financial Manager') {
    // Has full GL, JE, Reports, Cash & Banks, and approvals
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
        // Can view and print other modules
        perms[modId].view = true;
        if ('print' in perms[modId]) perms[modId].print = true;
        if ('export_pdf' in perms[modId]) perms[modId].export_pdf = true;
        if ('export_excel' in perms[modId]) perms[modId].export_excel = true;
      }
    });
  } else if (roleName === 'محاسب' || roleName === 'Accountant') {
    // Has GL, JE, Cash & Banks, Reports (cannot delete, cannot cancel_approval or open_closed_period)
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
  } else if (roleName === 'أمين مخزن' || roleName === 'Storekeeper') {
    // Has Warehouses, products, item_groups
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
  } else if (roleName === 'مشتريات' || roleName === 'Purchases') {
    // Has Suppliers, Purchase invoices/returns/orders
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
  } else if (roleName === 'مبيعات' || roleName === 'Sales') {
    // Has Customers, Sales invoices/returns/orders
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
  } else if (roleName === 'كاشير' || roleName === 'Cashier') {
    // Has invoices, returns, receipts
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

export function computeEffectivePermissions(user: any, companyRoles: any[]): any {
  // If user is admin/super_admin, they have ALL permissions as true
  if (user.role === 'admin' || user.role === 'super_admin') {
    const perms = getInitialPermissionsState();
    Object.keys(perms).forEach(modId => {
      Object.keys(perms[modId]).forEach(k => {
        perms[modId][k] = true;
      });
    });
    if (perms.warehouses) perms.warehouses.restrict_warehouses = false;
    if (perms.cash_balances) perms.cash_balances.restrict_safes = false;
    if (perms.accounts) perms.accounts.restrict_banks = false;
    return perms;
  }

  const result = getInitialPermissionsState();
  const roleIds = user.role_ids || [];

  // 1. Build union of roles' permissions
  const assignedRoles = companyRoles.filter(r => roleIds.includes(r.id));
  assignedRoles.forEach(role => {
    const rolePerms = role.permissions || {};
    Object.keys(rolePerms).forEach(modId => {
      if (!result[modId]) result[modId] = {};
      Object.keys(rolePerms[modId]).forEach(permKey => {
        const val = rolePerms[modId][permKey];
        if (val === true) {
          result[modId][permKey] = true;
        } else if (Array.isArray(val)) {
          if (!Array.isArray(result[modId][permKey])) {
            result[modId][permKey] = [];
          }
          val.forEach((item: any) => {
            if (!result[modId][permKey].includes(item)) {
              result[modId][permKey].push(item);
            }
          });
        }
      });
    });
  });

  // 2. Apply user-specific overrides
  const userPerms = user.permissions || {};
  Object.keys(userPerms).forEach(modId => {
    if (!result[modId]) result[modId] = {};
    Object.keys(userPerms[modId]).forEach(permKey => {
      const val = userPerms[modId][permKey];
      if (val === true || val === false || Array.isArray(val)) {
        result[modId][permKey] = val;
      }
    });
  });

  return result;
}
