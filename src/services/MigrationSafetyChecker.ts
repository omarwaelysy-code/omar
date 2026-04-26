import { dbService } from './dbService';
import { AccountSchema, JournalEntrySchema, InvoiceSchema, VoucherSchema } from '../lib/schemas';
import { z } from 'zod';

export interface MigrationReport {
  collection: string;
  total: number;
  valid: number;
  invalid: number;
  errors: { id: string; error: any }[];
}

export class MigrationSafetyChecker {
  static async validateCollection(collectionName: string, schema: z.ZodSchema, companyId: string): Promise<MigrationReport> {
    const data = await dbService.list(collectionName, companyId);
    let validCount = 0;
    let invalidCount = 0;
    const errors: { id: string; error: any }[] = [];

    data.forEach((item: any) => {
      const result = schema.safeParse(item);
      if (result.success) {
        validCount++;
      } else {
        invalidCount++;
        errors.push({ id: item.id, error: result.error.format() });
      }
    });

    return {
      collection: collectionName,
      total: data.length,
      valid: validCount,
      invalid: invalidCount,
      errors
    };
  }

  static async runFullHealthCheck(companyId: string) {
    const collections = [
      { name: 'accounts', schema: AccountSchema },
      { name: 'journal_entries', schema: JournalEntrySchema },
      { name: 'invoices', schema: InvoiceSchema },
      { name: 'receipt_vouchers', schema: VoucherSchema },
      { name: 'payment_vouchers', schema: VoucherSchema },
    ];

    const reports = await Promise.all(
      collections.map(c => this.validateCollection(c.name, c.schema, companyId))
    );

    return reports;
  }
}
