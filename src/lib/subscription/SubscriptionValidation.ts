import { z } from 'zod';

export const PlanTypeEnum = z.enum(['Basic', 'Pro', 'Enterprise']);
export const SubscriptionStatusEnum = z.enum(['Trial', 'Active', 'Suspended', 'Expired']);

export const SubscriptionCreateSchema = z.object({
  company_id: z.string().min(1, 'Company ID is required'),
  plan_type: PlanTypeEnum,
  subscription_status: SubscriptionStatusEnum.default('Trial'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  trial_until: z.string().optional(),
  max_users: z.number().int().min(0).default(0),
  max_branches: z.number().int().min(0).default(0),
  max_warehouses: z.number().int().min(0).default(0),
  max_devices: z.number().int().min(0).default(0),
  max_monthly_transactions: z.number().int().min(0).default(0),
});

export const SubscriptionUpdateSchema = z.object({
  plan_type: PlanTypeEnum.optional(),
  subscription_status: SubscriptionStatusEnum.optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  trial_until: z.string().optional(),
  max_users: z.number().int().min(0).optional(),
  max_branches: z.number().int().min(0).optional(),
  max_warehouses: z.number().int().min(0).optional(),
  max_devices: z.number().int().min(0).optional(),
  max_monthly_transactions: z.number().int().min(0).optional(),
});

export const SubscriptionUsageUpdateSchema = z.object({
  current_users: z.number().int().min(0).optional(),
  current_branches: z.number().int().min(0).optional(),
  current_warehouses: z.number().int().min(0).optional(),
  current_devices: z.number().int().min(0).optional(),
  current_monthly_transactions: z.number().int().min(0).optional(),
});

export type SubscriptionCreateInput = z.infer<typeof SubscriptionCreateSchema>;
export type SubscriptionUpdateInput = z.infer<typeof SubscriptionUpdateSchema>;
export type SubscriptionUsageUpdateInput = z.infer<typeof SubscriptionUsageUpdateSchema>;
