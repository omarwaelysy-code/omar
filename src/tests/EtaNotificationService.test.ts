import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EtaNotificationService } from '../services/eta/EtaNotificationService';
import pool from '../lib/postgres';

describe('ETA ERP Notification Callback & Connectivity (Registration Infrastructure)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should handle ping / connectivity check correctly', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({ rows: [{ tax_number: '772681716', name: 'Test Company' }] } as any);
    const pingResult = await EtaNotificationService.handlePing();
    expect(pingResult.statusCode).toBe(200);
    expect(pingResult.body.status).toBe('active');
    expect(pingResult.body.message).toContain('Obrain ERP ETA Notification Service is active');
    expect(pingResult.body.timestamp).toBeDefined();
  });

  it('2. should process PUT /notifications/documents with valid batch payload', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async () => ({ rows: [] } as any));

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

  it('3. should handle registration validation probes with undefined or empty payload gracefully', async () => {
    const resNull = await EtaNotificationService.processDocumentNotifications(null);
    expect(resNull.statusCode).toBe(200);
    expect(resNull.body.status).toBe('active');

    const resEmpty = await EtaNotificationService.processDocumentNotifications({});
    expect(resEmpty.statusCode).toBe(200);
    expect(resEmpty.body.status).toBe('active');

    const resPing = await EtaNotificationService.processDocumentNotifications({ ping: true });
    expect(resPing.statusCode).toBe(200);
    expect(resPing.body.status).toBe('active');
  });

  it('4. should acknowledge notifications even during initial registration without prior keys', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({ rows: [] } as any);

    const payload = {
      notifications: [
        { notificationId: 'n2', type: 'DOCUMENT_CANCELLED', documentUuid: 'UUID-999' }
      ]
    };

    const result = await EtaNotificationService.processDocumentNotifications(payload, 'probe-key-123');

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
});
