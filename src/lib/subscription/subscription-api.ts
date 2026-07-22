import { Router, Response } from 'express';
import { subscriptionService } from './SubscriptionService';
import { featureService } from './FeatureService';
import { SubscriptionCreateSchema, SubscriptionUpdateSchema, SubscriptionUsageUpdateSchema } from './SubscriptionValidation';
import { authenticateToken, authorizeRoles, AuthRequest } from '../auth-middleware';

const router = Router();

// GET /api/subscriptions/my-features
router.get('/my-features', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: 'Company ID required' });
    const features = await featureService.getFeatures(companyId);
    res.json(features);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Secure all other routes in this router to super_admin only
router.use(authenticateToken, authorizeRoles('super_admin'));

// GET /api/subscriptions
router.get('/', async (req, res) => {
  try {
    const subscriptions = await subscriptionService.getAllSubscriptions();
    res.json(subscriptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/subscriptions/:companyId
router.get('/:companyId', async (req, res) => {
  try {
    const subscription = await subscriptionService.getByCompany(req.params.companyId);
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    res.json(subscription);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subscriptions
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = SubscriptionCreateSchema.parse(req.body);
    const existing = await subscriptionService.getByCompany(data.company_id);
    if (existing) {
      return res.status(400).json({ error: 'Company already has a subscription' });
    }
    const newSubscription = await subscriptionService.create(data, req.user?.email || 'system');
    res.status(201).json(newSubscription);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Validation Error' });
  }
});

// PUT /api/subscriptions/:companyId
router.put('/:companyId', async (req: AuthRequest, res) => {
  try {
    const data = SubscriptionUpdateSchema.parse(req.body);
    const updated = await subscriptionService.update(req.params.companyId, data, req.user?.email || 'system');
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Validation Error' });
  }
});

// DELETE /api/subscriptions/:companyId
router.delete('/:companyId', async (req: AuthRequest, res) => {
  try {
    const deleted = await subscriptionService.delete(req.params.companyId, req.user?.email || 'system');
    if (!deleted) return res.status(404).json({ error: 'Subscription not found' });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/subscriptions/:companyId/activate
router.patch('/:companyId/activate', async (req: AuthRequest, res) => {
  try {
    const updated = await subscriptionService.activate(req.params.companyId, req.user?.email || 'system');
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/subscriptions/:companyId/suspend
router.patch('/:companyId/suspend', async (req: AuthRequest, res) => {
  try {
    const updated = await subscriptionService.suspend(req.params.companyId, req.user?.email || 'system');
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/subscriptions/:companyId/expire
router.patch('/:companyId/expire', async (req: AuthRequest, res) => {
  try {
    const updated = await subscriptionService.expire(req.params.companyId, req.user?.email || 'system');
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/subscriptions/:companyId/trial
router.patch('/:companyId/trial', async (req: AuthRequest, res) => {
  try {
    const updated = await subscriptionService.trial(req.params.companyId, req.user?.email || 'system');
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/subscriptions/:companyId/usage
router.patch('/:companyId/usage', async (req, res) => {
  try {
    const usageData = SubscriptionUsageUpdateSchema.parse(req.body);
    const updated = await subscriptionService.updateUsage(req.params.companyId, usageData);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- Feature Flags (Super Admin Only) ---

// Get all features for a company
router.get('/:companyId/features', authenticateToken, authorizeRoles('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    const features = await featureService.getFeatures(companyId);
    res.json(features);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle a feature for a company
router.put('/:companyId/features/:featureName', authenticateToken, authorizeRoles('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, featureName } = req.params;
    const { isEnabled } = req.body;
    
    if (typeof isEnabled !== 'boolean') {
      return res.status(400).json({ error: 'isEnabled must be a boolean' });
    }

    await featureService.toggleFeature(companyId, featureName, isEnabled);
    res.json({ success: true, message: 'Feature updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
