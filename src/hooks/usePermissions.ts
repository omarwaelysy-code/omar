import { useAuth } from '../contexts/AuthContext';

export const usePermissions = (moduleId: string) => {
  const { user } = useAuth();

  const getInitialState = (isAdmin: boolean) => ({
    canView: isAdmin,
    canCreate: isAdmin,
    canEdit: isAdmin,
    canDelete: isAdmin,
    canApprove: isAdmin,
    canCancelApproval: isAdmin,
    canPrint: isAdmin,
    canExportPdf: isAdmin,
    canExportExcel: isAdmin,
    canCopy: isAdmin,
    canEditApproved: isAdmin,
    canDeleteApproved: isAdmin,
    canViewCost: isAdmin,
    canViewProfitMargin: isAdmin,
    canChangePrices: isAdmin,
    canAllowNegative: isAdmin,
    canManualStockAdjust: isAdmin,
    canOpenClosedPeriod: isAdmin,
    canRepost: isAdmin,
    canRecalculateCost: isAdmin,
    canPerformInventory: isAdmin,
    canEditCostPrice: isAdmin,
    isAdmin,
    
    // Dynamic/Extensible helpers for custom business permissions
    hasBusinessPermission: (permissionId: string): boolean => {
      if (isAdmin) return true;
      if (!user?.permissions?.[moduleId]) return false;
      return !!user.permissions[moduleId][permissionId];
    },
    
    allowedWarehouseIds: (user?.permissions?.['warehouses']?.allowed_warehouse_ids || []) as string[],
    isWarehouseRestricted: !!user?.permissions?.['warehouses']?.restrict_warehouses,
    
    allowedSafeIds: (user?.permissions?.['cash_balances']?.allowed_safe_ids || []) as string[],
    isSafeRestricted: !!user?.permissions?.['cash_balances']?.restrict_safes,
    
    allowedBankIds: (user?.permissions?.['accounts']?.allowed_bank_ids || []) as string[],
    isBankRestricted: !!user?.permissions?.['accounts']?.restrict_banks,

    allowedDepartmentIds: (user?.permissions?.['departments']?.allowed_department_ids || []) as string[],
    isDepartmentRestricted: !!user?.permissions?.['departments']?.restrict_departments,

    allowedCostCenterIds: (user?.permissions?.['cost_centers']?.allowed_cost_center_ids || []) as string[],
    isCostCenterRestricted: !!user?.permissions?.['cost_centers']?.restrict_cost_centers,

    allowedPaymentMethodIds: (user?.permissions?.['payment_methods']?.allowed_payment_method_ids || []) as string[],
    isPaymentMethodRestricted: !!user?.permissions?.['payment_methods']?.restrict_payment_methods,
  });

  if (!user) return getInitialState(false);
  if (user.role === 'admin' || user.role === 'super_admin') return getInitialState(true);

  const permissions = (user.permissions?.[moduleId] || {}) as any;

  return {
    ...getInitialState(false),
    canView: !!permissions.view,
    canCreate: !!permissions.create,
    canEdit: !!permissions.edit,
    canDelete: !!permissions.delete,
    canApprove: !!permissions.approve,
    canCancelApproval: !!permissions.cancel_approval,
    canPrint: !!permissions.print,
    canExportPdf: !!permissions.export_pdf,
    canExportExcel: !!permissions.export_excel,
    canCopy: !!permissions.copy,
    canEditApproved: !!permissions.edit_approved,
    canDeleteApproved: !!permissions.delete_approved,
    canViewCost: !!permissions.view_cost,
    canViewProfitMargin: !!permissions.view_profit_margin,
    canChangePrices: !!permissions.change_prices,
    canAllowNegative: !!permissions.allow_negative,
    canManualStockAdjust: !!permissions.manual_stock_adjust,
    canOpenClosedPeriod: !!permissions.open_closed_period,
    canRepost: !!permissions.repost,
    canRecalculateCost: !!permissions.recalculate_cost,
    canPerformInventory: !!permissions.perform_inventory,
    canEditCostPrice: !!permissions.edit_cost_price,
  };
};
