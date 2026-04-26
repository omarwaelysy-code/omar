import { dbService } from './dbService';
import { z } from 'zod';

export interface TransactionStep {
  collection: string;
  data: any;
  schema?: z.ZodSchema;
  id?: string;
}

export class TransactionManager {
  private createdIds: { collection: string; id: string }[] = [];

  /**
   * Executes a sequence of operations atomically (Manual Rollback).
   * Useful for syncing Document -> Journal Entry.
   */
  async execute(steps: TransactionStep[]) {
    this.createdIds = [];

    try {
      for (const step of steps) {
        // 1. Validate if schema provided
        if (step.schema) {
          step.schema.parse(step.data);
        }

        // 2. Perform Save
        let id: string;
        if (step.id) {
          await dbService.addWithId(step.collection, step.id, step.data);
          id = step.id;
        } else {
          id = await dbService.add(step.collection, step.data);
        }

        // 3. Track for rollback
        this.createdIds.push({ collection: step.collection, id });
      }

      return { success: true, ids: this.createdIds };
    } catch (error) {
      console.error('Transaction failed, rolling back...', error);
      await this.rollback();
      throw error;
    }
  }

  private async rollback() {
    // Reverse order rollback
    const toReset = [...this.createdIds].reverse();
    for (const item of toReset) {
      try {
        await dbService.delete(item.collection, item.id);
        console.log(`Rolled back ${item.collection}:${item.id}`);
      } catch (err) {
        console.error(`Rollback failed for ${item.collection}:${item.id}`, err);
      }
    }
    this.createdIds = [];
  }

  /**
   * Specialized helper for Accounting Transactions (Main Doc + Journal Entry)
   */
  static async saveWithAccounting(
    mainCollection: string,
    mainData: any,
    mainSchema: z.ZodSchema,
    journalData: any,
    journalSchema: z.ZodSchema
  ) {
    const manager = new TransactionManager();
    
    try {
      // 1. Validate main data
      mainSchema.parse(mainData);

      // 2. Validate journal data (dummy ref to pass validation if required)
      const testJournalWithRef = {
        ...journalData,
        reference_id: journalData.reference_id || 'placeholder-for-validation'
      };
      journalSchema.parse(testJournalWithRef);

      // 3. Perform main save
      const mainId = await dbService.add(mainCollection, mainData);
      manager['createdIds'].push({ collection: mainCollection, id: mainId });

      // 4. Inject real reference and perform journal save
      const journalWithRef = {
        ...journalData,
        reference_id: mainId
      };
      
      const journalId = await dbService.add('journal_entries', journalWithRef);
      manager['createdIds'].push({ collection: 'journal_entries', id: journalId });

      return { mainId, journalId };
    } catch (error) {
      await manager['rollback']();
      throw error;
    }
  }
}

export const transactionManager = new TransactionManager();
