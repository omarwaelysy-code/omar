/**
 * Express Router for Official ETA ERP Document Notification Callback
 * 
 * Mount Paths:
 * - PUT /notifications/documents
 * - GET /notifications/documents (Ping / Health Check)
 * - GET /notifications/ping
 * - POST /notifications/documents
 */

import { Router, Request, Response } from 'express';
import { EtaNotificationService } from '../services/eta/EtaNotificationService';

const router = Router();

// Helper to extract operating key from headers, auth, or query
function extractOperatingKey(req: Request): string | undefined {
  const headerKey = req.headers['x-operating-key'] as string;
  if (headerKey) return headerKey;

  const authToken = req.headers['x-auth-token'] as string;
  if (authToken) return authToken;

  const authHeader = req.headers['authorization'] as string;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const queryKey = req.query.key as string || req.query.operating_key as string;
  if (queryKey) return queryKey;

  return undefined;
}

// 1. GET /notifications/documents & /notifications/ping (Connectivity / Ping check from ETA)
router.get(['/documents', '/documents/ping', '/ping'], (req: Request, res: Response) => {
  const result = EtaNotificationService.handlePing();
  res.status(result.statusCode).json(result.body);
});

// 2. PUT /notifications/documents (Official ETA Document Notification Callback)
router.put(['/documents', '/documents/'], async (req: Request, res: Response) => {
  try {
    const providedKey = extractOperatingKey(req);
    const result = await EtaNotificationService.processDocumentNotifications(req.body, providedKey);
    res.status(result.statusCode).json(result.body);
  } catch (err: any) {
    console.error('[ETA Notification Error]', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process notification'
    });
  }
});

// 3. POST /notifications/documents (Fallback for webhook clients sending POST)
router.post(['/documents', '/documents/'], async (req: Request, res: Response) => {
  try {
    const providedKey = extractOperatingKey(req);
    const result = await EtaNotificationService.processDocumentNotifications(req.body, providedKey);
    res.status(result.statusCode).json(result.body);
  } catch (err: any) {
    console.error('[ETA Notification Error]', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process notification'
    });
  }
});

// 4. Reject unsupported methods with 405 Method Not Allowed
router.all(['/documents', '/documents/*'], (req: Request, res: Response) => {
  res.status(405).json({
    status: 'error',
    message: `Method ${req.method} not allowed on ETA notification endpoint. Supported methods: PUT, GET, POST.`
  });
});

export default router;
