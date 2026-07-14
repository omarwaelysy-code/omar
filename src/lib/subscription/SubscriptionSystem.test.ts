import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscriptionService } from './SubscriptionService';
import { subscriptionRepository } from './SubscriptionRepository';
import { limitsValidationService } from './LimitsValidationService';
import { SubscriptionCreateSchema } from './SubscriptionValidation';

// Mock dependencies
vi.mock('../postgres', () => {
  return {
    default: {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn(),
        release: vi.fn(),
      }),
      query: vi.fn(),
    }
  };
});

vi.mock('./SubscriptionRepository', () => ({
  subscriptionRepository: {
    createSubscription: vi.fn(),
    getSubscriptionByCompanyId: vi.fn(),
    updateSubscription: vi.fn(),
    updateUsage: vi.fn(),
    deleteSubscription: vi.fn(),
    getAllSubscriptions: vi.fn(),
    addHistoryRecord: vi.fn(),
  }
}));

describe('Backend Subscription System - Phase 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation', () => {
    it('should validate a correct subscription creation payload', () => {
      const payload = {
        company_id: 'comp-123',
        plan_type: 'Pro',
        max_users: 10
      };
      
      const result = SubscriptionCreateSchema.parse(payload);
      expect(result.company_id).toBe('comp-123');
      expect(result.plan_type).toBe('Pro');
      expect(result.subscription_status).toBe('Trial'); // default
      expect(result.max_users).toBe(10);
    });

    it('should throw error for invalid plan_type', () => {
      const payload = {
        company_id: 'comp-123',
        plan_type: 'Unknown',
      };
      
      expect(() => SubscriptionCreateSchema.parse(payload)).toThrow();
    });
  });

  describe('Limits Validation Service', () => {
    it('should pass if current usage is below limits', () => {
      const subscription = { max_users: 10 };
      const currentUsage = { current_users: 5 };
      expect(() => limitsValidationService.validateLimits(subscription, currentUsage)).not.toThrow();
    });

    it('should throw if current usage exceeds limits', () => {
      const subscription = { max_users: 10 };
      const currentUsage = { current_users: 11 };
      expect(() => limitsValidationService.validateLimits(subscription, currentUsage)).toThrow(/Exceeded maximum users limit/);
    });
  });

  describe('Subscription Service', () => {
    it('should create a subscription and log history', async () => {
      const payload = { company_id: 'c1', plan_type: 'Basic' };
      const mockSub = { id: 'uuid-1', ...payload };
      
      vi.mocked(subscriptionRepository.createSubscription).mockResolvedValue(mockSub);
      
      const result = await subscriptionService.create(payload);
      
      expect(subscriptionRepository.createSubscription).toHaveBeenCalled();
      expect(subscriptionRepository.addHistoryRecord).toHaveBeenCalledWith(expect.objectContaining({
        new_plan: 'Basic',
        change_reason: 'Initial Subscription Creation'
      }), expect.anything());
      expect(result).toEqual(mockSub);
    });

    it('should activate a subscription', async () => {
      vi.mocked(subscriptionRepository.getSubscriptionByCompanyId).mockResolvedValue({ plan_type: 'Basic', subscription_status: 'Trial' });
      vi.mocked(subscriptionRepository.updateSubscription).mockResolvedValue({ plan_type: 'Basic', subscription_status: 'Active' });

      await subscriptionService.activate('c1');

      expect(subscriptionRepository.updateSubscription).toHaveBeenCalledWith('c1', { subscription_status: 'Active' }, expect.anything());
      expect(subscriptionRepository.addHistoryRecord).toHaveBeenCalledWith(expect.objectContaining({
        new_status: 'Active',
        old_status: 'Trial'
      }), expect.anything());
    });
  });
});
