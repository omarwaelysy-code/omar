import { useState, useEffect } from 'react';
import { Account } from '../types';
import { dbService } from '../services/dbService';
import { defaultAccountsService } from '../services/defaultAccountsService';

export interface DefaultAccountConfigItem {
  key: string;
  defaultCode: string;
  usages: string[];
  codePrefixes: string[];
}

export const DEFAULT_KEY_SPECS: Record<string, DefaultAccountConfigItem> = {
  sales_revenue: {
    key: 'sales_revenue',
    defaultCode: '4101',
    usages: ['sales_revenue', 'service_revenue', 'other_revenue', 'revenue', 'sales'],
    codePrefixes: ['41', '4']
  },
  cost_of_sales: {
    key: 'cost_of_sales',
    defaultCode: '5101',
    usages: ['cost_of_sales', 'purchases', 'cogs'],
    codePrefixes: ['51', '5']
  },
  inventory: {
    key: 'inventory',
    defaultCode: '110301',
    usages: ['inventory', 'raw_materials', 'work_in_progress', 'finished_goods'],
    codePrefixes: ['1103', '110301']
  },
  customer: {
    key: 'customer',
    defaultCode: '110201',
    usages: ['customer', 'accounts_receivable'],
    codePrefixes: ['1102', '110201']
  },
  supplier: {
    key: 'supplier',
    defaultCode: '210101',
    usages: ['supplier', 'accounts_payable'],
    codePrefixes: ['2101', '210101']
  },
  main_cash: {
    key: 'main_cash',
    defaultCode: '110101',
    usages: ['cash', 'main_cash', 'petty_cash'],
    codePrefixes: ['110101', '1101']
  },
  bank: {
    key: 'bank',
    defaultCode: '110103',
    usages: ['bank', 'credit_card', 'debit_card', 'cheque', 'post_dated_cheque'],
    codePrefixes: ['110103', '1101']
  },
  wallet: {
    key: 'wallet',
    defaultCode: '110101',
    usages: ['wallet', 'cash', 'bank'],
    codePrefixes: ['1101']
  },
  opening_balance: {
    key: 'opening_balance',
    defaultCode: '3104',
    usages: ['opening_balance', 'equity', 'capital'],
    codePrefixes: ['3104', '31']
  },
  output_vat: {
    key: 'output_vat',
    defaultCode: '210202',
    usages: ['vat', 'output_vat'],
    codePrefixes: ['210202', '2102', '222']
  },
  input_vat: {
    key: 'input_vat',
    defaultCode: '110402',
    usages: ['vat', 'input_vat'],
    codePrefixes: ['110402', '1104', '118']
  },
  withholding_tax_customers: {
    key: 'withholding_tax_customers',
    defaultCode: '110403',
    usages: ['withholding_tax_customers'],
    codePrefixes: ['110403', '1104']
  },
  withholding_tax_suppliers: {
    key: 'withholding_tax_suppliers',
    defaultCode: '210203',
    usages: ['withholding_tax_suppliers'],
    codePrefixes: ['210203', '2102']
  },
  sales_returns: {
    key: 'sales_returns',
    defaultCode: '4103',
    usages: ['sales_returns'],
    codePrefixes: ['4103', '41']
  },
  purchase_returns: {
    key: 'purchase_returns',
    defaultCode: '5104',
    usages: ['purchase_returns'],
    codePrefixes: ['5104', '51']
  },
  customer_discount: {
    key: 'customer_discount',
    defaultCode: '4104',
    usages: ['earned_discounts', 'customer_discount', 'sales_discount'],
    codePrefixes: ['4104', '41']
  },
  supplier_discount: {
    key: 'supplier_discount',
    defaultCode: '5105',
    usages: ['granted_discounts', 'supplier_discount', 'purchase_discount'],
    codePrefixes: ['5105', '51']
  },
  capital: {
    key: 'capital',
    defaultCode: '3101',
    usages: ['capital', 'equity'],
    codePrefixes: ['3101', '31']
  },
  retained_earnings: {
    key: 'retained_earnings',
    defaultCode: '3103',
    usages: ['retained_earnings', 'equity'],
    codePrefixes: ['3103', '31']
  },
  realized_forex_gain: {
    key: 'realized_forex_gain',
    defaultCode: '420201',
    usages: ['realized_forex_gain', 'forex_gain'],
    codePrefixes: ['420201', '4202', '42']
  },
  realized_forex_loss: {
    key: 'realized_forex_loss',
    defaultCode: '630201',
    usages: ['realized_forex_loss', 'forex_loss'],
    codePrefixes: ['630201', '6302', '63']
  }
};

/**
 * Get the default Account from the company default accounts configuration
 * with fallbacks (mapped ID -> standard default code -> compatible usage -> code prefix).
 */
export function getDefaultAccount(
  key: string,
  defaultAccountMap: Record<string, string>,
  accounts: Account[]
): Account | undefined {
  if (!accounts || accounts.length === 0) return undefined;

  const spec = DEFAULT_KEY_SPECS[key];
  const targetCode = spec?.defaultCode;

  // 1. Explicit mapping from defaultAccountMap
  const mappedId = defaultAccountMap?.[key];
  if (mappedId) {
    const acc = accounts.find(a => a.id === mappedId);
    if (acc) return acc;
  }

  // 2. Exact match on standard defaultCode
  if (targetCode) {
    const acc = accounts.find(a => a.code === targetCode);
    if (acc) return acc;
  }

  // 3. Match on compatible account_usage
  if (spec?.usages && spec.usages.length > 0) {
    const acc = accounts.find(a => a.account_usage && spec.usages.includes(a.account_usage));
    if (acc) return acc;
  }

  // 4. Match on code prefixes
  if (spec?.codePrefixes && spec.codePrefixes.length > 0) {
    for (const pfx of spec.codePrefixes) {
      const acc = accounts.find(a => a.code && a.code.startsWith(pfx));
      if (acc) return acc;
    }
  }

  return undefined;
}

/**
 * Filter accounts to only those compatible with the specified usage (من نفس الاستخدام),
 * while always preserving any currently selected account so it is never hidden.
 */
export function getCompatibleAccounts(
  key: string,
  accounts: Account[],
  currentSelectedId?: string
): Account[] {
  if (!accounts || accounts.length === 0) return [];
  const spec = DEFAULT_KEY_SPECS[key];
  const usages = spec?.usages || [key];
  const prefixes = spec?.codePrefixes || [];

  return accounts.filter(acc => {
    // 1. Current selected account is always kept visible
    if (currentSelectedId && acc.id === currentSelectedId) return true;

    // 2. Strict usage match if account has account_usage
    if (acc.account_usage && usages.includes(acc.account_usage)) return true;

    // 3. Fallback to code prefix
    if (prefixes.length > 0 && acc.code) {
      for (const pfx of prefixes) {
        if (acc.code.startsWith(pfx)) return true;
      }
    }

    return false;
  });
}

/**
 * Custom hook to subscribe and pre-fetch default account mappings for the company.
 */
export function useDefaultAccounts(companyId?: string) {
  const [defaultAccountMap, setDefaultAccountMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    let isMounted = true;

    // 1. Direct fetch ensuring defaults exist in backend
    defaultAccountsService.getDefaultAccounts().then(({ mappings }) => {
      if (isMounted && mappings && Object.keys(mappings).length > 0) {
        setDefaultAccountMap(prev => ({ ...mappings, ...prev }));
        setLoading(false);
      }
    }).catch(err => {
      console.error('Failed to pre-fetch default accounts:', err);
    });

    // 2. Real-time subscription to default_account_mappings table
    const unsubscribe = dbService.subscribe<any>('default_account_mappings', companyId, (data) => {
      if (!isMounted) return;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        if (r.setting_key && r.account_id) map[r.setting_key] = r.account_id;
      });
      if (Object.keys(map).length > 0) {
        setDefaultAccountMap(prev => ({ ...prev, ...map }));
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [companyId]);

  return { defaultAccountMap, loading };
}
