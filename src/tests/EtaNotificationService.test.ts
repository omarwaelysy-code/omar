import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EtaNotificationService } from '../services/eta/EtaNotificationService';
import pool from '../lib/postgres';

describe('ETA ERP Notification Callback & Connectivity (Registration Infrastructure)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should handle ping / connectivity check correctly', () => {
    const pingResult = EtaNotificationService.handlePing();
    expect(pingResult.statusCode).toBe(200);
    expect(pingResult.body.status).toBe('active');
    expect(pingResult.body.message).toContain('Obrain ERP ETA Notification Service is active');
    expect(pingResult.body.timestamp).toBeDefined();
  });

  it('2. should process PUT /notifications/documents with valid batch payload', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (text: any, params: any) => {
      if (typeof text === 'string' && text.includes('SELECT company_id, operating_key')) {
        return { rows: [] } as any;
      }
      return { rows: [{ id: '1' }] } as any;
    });

    const payload = {
      notifications: [
        {
          notificationId: 'notif-101',
          type: 'DOCUMENT_STATUS_CHANGED',
          documentUuid: 'DOC-UUID-12345-ABCDE',
          documentType: 'i',
          status: 'Valid',
          issuedDate: '2026-08-27T18:00:00Z',
          dateTimeReceived: '2026-08-27T18:05:00Z',
          channel: 'API'
        }
      ]
    };

    const result = await EtaNotificationService.processDocumentNotifications(payload);

    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('success');
    expect(result.body.receivedCount).toBe(1);
    expect(result.safeMetadata?.types).toContain('DOCUMENT_STATUS_CHANGED');
    expect(result.safeMetadata?.documentUuids).toContain('DOC-UUID-12345-ABCDE');
  });

  it('3. should reject invalid operating key when company has an operating key configured', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (text: any, params: any) => {
      if (typeof text === 'string' && text.includes('SELECT company_id FROM eta_settings WHERE operating_key = $1')) {
        return { rows: [] } as any; // No match
      }
      return { rows: [{ company_id: 'comp-1', operating_key: 'correct-secret-key' }] } as any;
    });

    const payload = {
      notifications: [
        { notificationId: 'n1', type: 'NEW_DOCUMENT_ISSUED' }
      ]
    };

    const result = await EtaNotificationService.processDocumentNotifications(payload, 'wrong-operating-key');

    expect(result.statusCode).toBe(401);
    expect(result.body.status).toBe('error');
    expect(result.body.message).toContain('Invalid or unauthorized ETA Operating Key');
  });

  it('4. should accept valid operating key matching stored company key', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (text: any, params: any) => {
      if (typeof text === 'string' && text.includes('SELECT company_id FROM eta_settings WHERE operating_key = $1')) {
        if (params[0] === 'valid-secret-key') {
          return { rows: [{ company_id: 'comp-1' }] } as any;
        }
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const payload = {
      notifications: [
        { notificationId: 'n2', type: 'DOCUMENT_CANCELLED', documentUuid: 'UUID-999' }
      ]
    };

    const result = await EtaNotificationService.processDocumentNotifications(payload, 'valid-secret-key');

    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('success');
    expect(result.body.receivedCount).toBe(1);
  });

  it('5. should never leak operating keys, secrets, or passwords in responses', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({ rows: [] } as any);

    const payload = {
      notifications: [
        { notificationId: 'n3', type: 'DOCUMENT_REJECTED' }
      ]
    };

    const result = await EtaNotificationService.processDocumentNotifications(payload, 'top-secret-operating-key-12345');

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('top-secret-operating-key-12345');
    expect((result.body as any).operating_key).toBeUndefined();
    expect((result.body as any).client_secret).toBeUndefined();
    expect((result.body as any).access_token).toBeUndefined();
  });

  it('6. should handle empty or ping payload gracefully', async () => {
    const result1 = await EtaNotificationService.processDocumentNotifications({ ping: true });
    expect(result1.statusCode).toBe(200);
    expect(result1.body.status).toBe('active');

    const result2 = await EtaNotificationService.processDocumentNotifications({});
    expect(result2.statusCode).toBe(200);
    expect(result2.body.status).toBe('active');
  });
});
