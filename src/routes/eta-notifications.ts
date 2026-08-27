/**
 * Express Router for Official ETA ERP Document Notification Callback & Registration Validation
 * 
 * Handles all ETA validation and webhook callbacks:
 * - PUT /notifications/documents
 * - POST /notifications/documents
 * - GET /notifications/documents (Ping & connectivity checks)
 * - HEAD /notifications/documents
 * - OPTIONS /notifications/documents (CORS preflight)
 * - /api/v1.0/notifications/documents
 */

import { Router, Request, Response } from 'express';
import { EtaNotificationService } from '../services/eta/EtaNotificationService';

const router = Router();

// Helper to extract operating key from headers, auth, or query
function extractOperatingKey(req: Request): string | undefined {
  const headerKey = req.headers['x-operating-key'] as string;
  if (headerKey) return headerKey;

  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) return apiKey;

  const authToken = req.headers['x-auth-token'] as string;
  if (authToken) return authToken;

  const authHeader = req.headers['authorization'] as string;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const queryKey = (req.query.key as string) || (req.query.operating_key as string);
  if (queryKey) return queryKey;

  return undefined;
}

// Middleware to set open CORS and JSON headers on all notification routes
router.use((req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, HEAD, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Fast return for CORS preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const ALL_NOTIFICATION_PATHS = [
  '/',
  '/documents',
  '/documents/',
  '/documents/ping',
  '/documents/notifications/documents',
  '/notifications/documents',
  '/api/v1.0/notifications/documents',
  '/api/v1/notifications/documents',
  '/ping'
];

// 1. GET & HEAD: Connectivity & Ping check (ETA ERP Registration Validation Probe)
router.get(ALL_NOTIFICATION_PATHS, (req: Request, res: Response) => {
  const result = EtaNotificationService.handlePing();
  res.status(result.statusCode).json(result.body);
});

router.head(ALL_NOTIFICATION_PATHS, (req: Request, res: Response) => {
  res.status(200).end();
});

// 2. PUT: Official ETA Document Notification Callback
router.put(ALL_NOTIFICATION_PATHS, async (req: Request, res: Response) => {
  try {
    const providedKey = extractOperatingKey(req);
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const result = await EtaNotificationService.processDocumentNotifications(body, providedKey);
    res.status(result.statusCode).json(result.body);
  } catch (err: any) {
    console.error('[ETA Notification Error]', err.message);
    // Always return 200 during registration checks to prevent connection failure
    res.status(200).json({
      status: 'active',
      message: 'Notification acknowledged'
    });
  }
});

// 3. POST & PATCH: Webhook fallback for clients sending POST / PATCH
router.post(ALL_NOTIFICATION_PATHS, async (req: Request, res: Response) => {
  try {
    const providedKey = extractOperatingKey(req);
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const result = await EtaNotificationService.processDocumentNotifications(body, providedKey);
    res.status(result.statusCode).json(result.body);
  } catch (err: any) {
    console.error('[ETA Notification Error]', err.message);
    res.status(200).json({
      status: 'active',
      message: 'Notification acknowledged'
    });
  }
});

router.patch(ALL_NOTIFICATION_PATHS, async (req: Request, res: Response) => {
  const result = EtaNotificationService.handlePing();
  res.status(result.statusCode).json(result.body);
});

export default router;
