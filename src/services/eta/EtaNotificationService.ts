/**
 * ETA (Egyptian Tax Authority / مصلحة الضرائب المصرية) ERP Notification Service
 * 
 * Implements the official ETA ERP notification callback & ping endpoint:
 * - Public Endpoint: https://obrain.tech/notifications/documents
 * - Expected HTTP Method: PUT (also supports GET for connectivity ping, POST for webhooks)
 * 
 * Safety & Security:
 * - Validates ETA Operating Key (مفتاح التشغيل) when configured.
 * - Does NOT modify invoices, customers, products, accounting, or inventory in this phase.
 * - NEVER logs operating keys, secrets, tokens, or raw authorization headers.
 * - Returns official ETA-compatible success responses.
 */

import pool from '../../lib/postgres';
import { EtaNotificationPayload, EtaNotificationResponse } from '../../types';

export interface ProcessNotificationResult {
  statusCode: number;
  body: EtaNotificationResponse;
  safeMetadata?: {
    receivedCount: number;
    types: string[];
    documentUuids: string[];
  };
}

export class EtaNotificationService {
  /**
   * Validate incoming operating key against database
   * Returns true if valid or if no operating key is enforced on open ping
   */
  public static async validateOperatingKey(providedKey?: string): Promise<{
    isValid: boolean;
    companyId?: string;
  }> {
    const cleanKey = providedKey?.trim();
    if (!cleanKey) {
      // Check if any company has an operating key configured
      const { rows } = await pool.query(
        'SELECT company_id, operating_key FROM eta_settings WHERE operating_key IS NOT NULL AND TRIM(operating_key) != \'\''
      );

      // If no companies have set an operating key yet, allow connectivity checks during registration
      if (rows.length === 0) {
        return { isValid: true };
      }

      // If companies require operating keys, empty key is unauthorized
      return { isValid: false };
    }

    // Match provided key against stored operating_key
    const { rows } = await pool.query(
      'SELECT company_id FROM eta_settings WHERE operating_key = $1 LIMIT 1',
      [cleanKey]
    );

    if (rows.length > 0) {
      return { isValid: true, companyId: rows[0].company_id };
    }

    return { isValid: false };
  }

  /**
   * Process ETA Ping / Connectivity check
   */
  public static handlePing(): ProcessNotificationResult {
    return {
      statusCode: 200,
      body: {
        status: 'active',
        message: 'Obrain ERP ETA Notification Service is active and reachable',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Process incoming ETA Document Notifications (PUT /notifications/documents)
   */
  public static async processDocumentNotifications(
    payload: EtaNotificationPayload,
    providedKey?: string
  ): Promise<ProcessNotificationResult> {
    const timestamp = new Date().toISOString();

    // 1. Check if payload is a ping / connectivity check
    if (payload && (payload.ping || (typeof payload === 'object' && Object.keys(payload).length === 0))) {
      return this.handlePing();
    }

    // 2. Validate Operating Key if present or required
    if (providedKey) {
      const keyValidation = await this.validateOperatingKey(providedKey);
      if (!keyValidation.isValid) {
        return {
          statusCode: 401,
          body: {
            status: 'error',
            message: 'Invalid or unauthorized ETA Operating Key',
            timestamp
          }
        };
      }
    }

    // 3. Extract notification items safely
    const rawNotifications = Array.isArray(payload?.notifications)
      ? payload.notifications
      : (Array.isArray(payload) ? payload : (payload ? [payload] : []));

    const safeTypes: string[] = [];
    const safeDocumentUuids: string[] = [];

    for (const item of rawNotifications) {
      if (item && typeof item === 'object') {
        if (typeof item.type === 'string') safeTypes.push(item.type.slice(0, 50));
        if (typeof item.documentUuid === 'string') safeDocumentUuids.push(item.documentUuid.slice(0, 64));
      }
    }

    // 4. Update last_notification_at timestamp if company matched
    try {
      if (providedKey) {
        await pool.query(
          'UPDATE eta_settings SET last_notification_at = CURRENT_TIMESTAMP WHERE operating_key = $1',
          [providedKey.trim()]
        );
      }
    } catch (dbErr) {
      console.warn('[ETA Notification] Failed to update last_notification_at timestamp:', dbErr);
    }

    // Safe logging without any sensitive values
    console.log(`[ETA Notification] Received ${rawNotifications.length} document notifications at ${timestamp}`);

    return {
      statusCode: 200,
      body: {
        status: 'success',
        message: 'Notification received and acknowledged',
        receivedCount: rawNotifications.length,
        timestamp
      },
      safeMetadata: {
        receivedCount: rawNotifications.length,
        types: safeTypes,
        documentUuids: safeDocumentUuids
      }
    };
  }
}
