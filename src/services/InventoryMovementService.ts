import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import pool from '../lib/postgres.js';
import { InventoryMovementV2, InventoryMovementLine } from '../types.js';
import { InventoryPostingService } from './InventoryPostingService.js';

export class InventoryMovementService {
  /**
   * Validates movement data. Throws an error if invalid.
   */
  static async validateMovement(
    client: PoolClient | Pool,
    movement: Partial<InventoryMovementV2>,
    lines: Partial<InventoryMovementLine>[]
  ): Promise<void> {
    if (!movement.company_id) {
      throw new Error('Company ID is required.');
    }
    if (!movement.movement_number) {
      throw new Error('Movement number is required.');
    }
    if (!movement.movement_type) {
      throw new Error('Movement type is required.');
    }
    if (!movement.movement_date) {
      throw new Error('Movement date is required.');
    }

    // Verify movement type is registered
    const { rows: typeRows } = await client.query(
      'SELECT id FROM inventory_movement_types WHERE id = $1',
      [movement.movement_type]
    );
    if (typeRows.length === 0) {
      throw new Error(`Movement type "${movement.movement_type}" is not registered.`);
    }

    if (!lines || lines.length === 0) {
      throw new Error('Movement must contain at least one line.');
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.product_id) {
        throw new Error(`Line ${i + 1}: Product ID is required.`);
      }
      if (!line.unit_id) {
        throw new Error(`Line ${i + 1}: Unit ID is required.`);
      }
      if (line.quantity === undefined || line.quantity === null) {
        throw new Error(`Line ${i + 1}: Quantity is required.`);
      }
      const qty = parseFloat(String(line.quantity));
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Line ${i + 1}: Quantity must be greater than zero.`);
      }
      if (!line.direction || !['IN', 'OUT'].includes(String(line.direction).toUpperCase())) {
        throw new Error(`Line ${i + 1}: Direction must be "IN" or "OUT".`);
      }
    }
  }

  /**
   * Performs a Dry Run validation. Checks all inputs, generates IDs and totals,
   * but does not write to the database.
   */
  static async createMovementDryRun(
    client: PoolClient | Pool,
    movement: Partial<InventoryMovementV2>,
    lines: Partial<InventoryMovementLine>[]
  ): Promise<{ movement: InventoryMovementV2; lines: InventoryMovementLine[] }> {
    // Validate first
    await this.validateMovement(client, movement, lines);

    const movementId = movement.id || uuidv4();
    const simulatedMovement: InventoryMovementV2 = {
      id: movementId,
      company_id: movement.company_id!,
      branch_id: movement.branch_id || null,
      warehouse_id: movement.warehouse_id || null,
      movement_number: movement.movement_number!,
      movement_type: movement.movement_type!,
      source_document_type: movement.source_document_type || null,
      source_document_id: movement.source_document_id || null,
      movement_date: typeof movement.movement_date === 'string' ? movement.movement_date : new Date(movement.movement_date!).toISOString().split('T')[0],
      status: movement.status || 'draft',
      notes: movement.notes || null,
      created_by: movement.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const simulatedLines: InventoryMovementLine[] = lines.map(line => {
      const qty = parseFloat(String(line.quantity));
      const unitCost = line.unit_cost !== undefined ? parseFloat(String(line.unit_cost)) : 0;
      const totalCost = line.total_cost !== undefined ? parseFloat(String(line.total_cost)) : qty * unitCost;

      return {
        id: line.id || uuidv4(),
        movement_id: movementId,
        product_id: line.product_id!,
        unit_id: line.unit_id!,
        quantity: qty,
        direction: String(line.direction).toUpperCase() as 'IN' | 'OUT',
        unit_cost: unitCost,
        total_cost: totalCost,
        batch_id: line.batch_id || null,
        serial_number: line.serial_number || null,
        notes: line.notes || null,
        created_at: new Date().toISOString()
      };
    });

    return {
      movement: simulatedMovement,
      lines: simulatedLines
    };
  }

  /**
   * Persists a movement and its lines to the database inside a transaction.
   */
  static async createMovement(
    movement: Partial<InventoryMovementV2>,
    lines: Partial<InventoryMovementLine>[],
    dbClient?: PoolClient
  ): Promise<{ movement: InventoryMovementV2; lines: InventoryMovementLine[] }> {
    const client = dbClient || (await pool.connect());
    let isLocalTransaction = false;

    try {
      if (!dbClient) {
        await client.query('BEGIN');
        isLocalTransaction = true;
      }

      // Perform validation and simulation (Dry Run logic) to construct final entities
      const { movement: finalMovement, lines: finalLines } = await this.createMovementDryRun(client, movement, lines);

      // Insert Header
      const headerQuery = `
        INSERT INTO "inventory_movements_v2" (
          id, company_id, branch_id, warehouse_id, movement_number, movement_type,
          source_document_type, source_document_id, movement_date, status, notes,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      await client.query(headerQuery, [
        finalMovement.id,
        finalMovement.company_id,
        finalMovement.branch_id,
        finalMovement.warehouse_id,
        finalMovement.movement_number,
        finalMovement.movement_type,
        finalMovement.source_document_type,
        finalMovement.source_document_id,
        finalMovement.movement_date,
        finalMovement.status,
        finalMovement.notes,
        finalMovement.created_by,
        finalMovement.created_at,
        finalMovement.updated_at
      ]);

      // Insert Detail Lines
      const lineInsertQuery = `
        INSERT INTO "inventory_movement_lines" (
          id, movement_id, product_id, unit_id, quantity, direction,
          unit_cost, total_cost, batch_id, serial_number, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      for (const line of finalLines) {
        await client.query(lineInsertQuery, [
          line.id,
          line.movement_id,
          line.product_id,
          line.unit_id,
          line.quantity,
          line.direction,
          line.unit_cost,
          line.total_cost,
          line.batch_id,
          line.serial_number,
          line.notes,
          line.created_at
        ]);
      }

      // Automatically post the movement using the InventoryPostingService (Phase 3)
      await InventoryPostingService.postMovement(finalMovement, finalLines, client);

      if (isLocalTransaction) {
        await client.query('COMMIT');
      }

      return {
        movement: finalMovement,
        lines: finalLines
      };
    } catch (error) {
      if (isLocalTransaction) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (isLocalTransaction) {
        (client as PoolClient).release();
      }
    }
  }

  /**
   * Fetches a movement header and details from the database by movement ID.
   */
  static async getMovement(
    id: string,
    client: PoolClient | Pool = pool
  ): Promise<{ movement: InventoryMovementV2; lines: InventoryMovementLine[] } | null> {
    const { rows: headerRows } = await client.query(
      'SELECT * FROM "inventory_movements_v2" WHERE id = $1',
      [id]
    );

    if (headerRows.length === 0) {
      return null;
    }

    const { rows: lineRows } = await client.query(
      'SELECT * FROM "inventory_movement_lines" WHERE movement_id = $1 ORDER BY created_at ASC, id ASC',
      [id]
    );

    const movement: InventoryMovementV2 = {
      ...headerRows[0],
      movement_date: headerRows[0].movement_date instanceof Date ? headerRows[0].movement_date.toISOString().split('T')[0] : headerRows[0].movement_date
    };

    const lines: InventoryMovementLine[] = lineRows.map(r => ({
      ...r,
      quantity: parseFloat(String(r.quantity)),
      unit_cost: parseFloat(String(r.unit_cost || 0)),
      total_cost: parseFloat(String(r.total_cost || 0))
    }));

    return { movement, lines };
  }

  /**
   * Lists inventory movements under a specific company with optional filters.
   */
  static async listMovements(
    companyId: string,
    filters: {
      warehouse_id?: string;
      movement_type?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {},
    client: PoolClient | Pool = pool
  ): Promise<InventoryMovementV2[]> {
    const params: any[] = [companyId];
    let queryStr = 'SELECT * FROM "inventory_movements_v2" WHERE company_id = $1';

    if (filters.warehouse_id) {
      params.push(filters.warehouse_id);
      queryStr += ` AND warehouse_id = $${params.length}`;
    }

    if (filters.movement_type) {
      params.push(filters.movement_type);
      queryStr += ` AND movement_type = $${params.length}`;
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      queryStr += ` AND movement_date >= $${params.length}`;
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      queryStr += ` AND movement_date <= $${params.length}`;
    }

    queryStr += ' ORDER BY movement_date DESC, created_at DESC';

    if (filters.limit) {
      params.push(filters.limit);
      queryStr += ` LIMIT $${params.length}`;
    }

    const { rows } = await client.query(queryStr, params);

    return rows.map(r => ({
      ...r,
      movement_date: r.movement_date instanceof Date ? r.movement_date.toISOString().split('T')[0] : r.movement_date
    }));
  }

  /**
   * Reverses an existing inventory movement by creating a matching movement in the opposite direction.
   */
  static async reverseMovement(
    sourceDocumentType: string,
    sourceDocumentId: string,
    client: PoolClient | Pool
  ): Promise<void> {
    // 1. Fetch the active posted movement for this document
    const { rows: moves } = await client.query(
      `SELECT * FROM "inventory_movements_v2" 
       WHERE "source_document_type" = $1 AND "source_document_id" = $2 AND "status" = 'posted'`,
      [sourceDocumentType, sourceDocumentId]
    );

    if (moves.length === 0) return;

    for (const originalMovement of moves) {
      // Update original movement status to 'reversed'
      await client.query(
        `UPDATE "inventory_movements_v2" SET "status" = 'reversed', "updated_at" = NOW() WHERE "id" = $1`,
        [originalMovement.id]
      );

      // Update original journal status to 'Reversed'
      await client.query(
        `UPDATE "inventory_transaction_journal" 
         SET "status" = 'Reversed', "cancelled_at" = NOW() 
         WHERE "movement_id" = $1`,
        [originalMovement.id]
      );

      // Fetch original movement lines
      const { rows: lines } = await client.query(
        `SELECT * FROM "inventory_movement_lines" WHERE "movement_id" = $1`,
        [originalMovement.id]
      );

      if (lines.length === 0) continue;

      // 2. Create Reversal Movement Header
      const reversalMovementId = uuidv4();
      const reversalMovement: InventoryMovementV2 = {
        id: reversalMovementId,
        company_id: originalMovement.company_id,
        branch_id: originalMovement.branch_id || null,
        warehouse_id: originalMovement.warehouse_id || null,
        movement_number: `${originalMovement.movement_number}-REV`,
        movement_type: originalMovement.movement_type,
        source_document_type: originalMovement.source_document_type || null,
        source_document_id: originalMovement.source_document_id || null,
        movement_date: new Date().toISOString().split('T')[0],
        status: 'reversed',
        notes: `Reversal of movement ${originalMovement.movement_number}`,
        created_by: originalMovement.created_by || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await client.query(
        `INSERT INTO "inventory_movements_v2" (
          id, company_id, branch_id, warehouse_id, movement_number, movement_type,
          source_document_type, source_document_id, movement_date, status, notes,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          reversalMovement.id,
          reversalMovement.company_id,
          reversalMovement.branch_id,
          reversalMovement.warehouse_id,
          reversalMovement.movement_number,
          reversalMovement.movement_type,
          reversalMovement.source_document_type,
          reversalMovement.source_document_id,
          reversalMovement.movement_date,
          reversalMovement.status,
          reversalMovement.notes,
          reversalMovement.created_by,
          reversalMovement.created_at,
          reversalMovement.updated_at
        ]
      );

      // 3. Create Reversal Movement Lines with opposite directions
      const reversalLines: InventoryMovementLine[] = [];
      for (const origLine of lines) {
        const revLineId = uuidv4();
        const oppositeDirection = origLine.direction === 'OUT' ? 'IN' : 'OUT';
        const revLine: InventoryMovementLine = {
          id: revLineId,
          movement_id: reversalMovementId,
          product_id: origLine.product_id,
          unit_id: origLine.unit_id,
          quantity: parseFloat(origLine.quantity),
          direction: oppositeDirection,
          unit_cost: parseFloat(origLine.unit_cost || '0'),
          total_cost: parseFloat(origLine.total_cost || '0'),
          batch_id: origLine.batch_id || null,
          serial_number: origLine.serial_number || null,
          notes: `Reversal line`
        };

        await client.query(
          `INSERT INTO "inventory_movement_lines" (
            id, movement_id, product_id, unit_id, quantity, direction,
            unit_cost, total_cost, batch_id, serial_number, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            revLine.id,
            revLine.movement_id,
            revLine.product_id,
            revLine.unit_id,
            revLine.quantity,
            revLine.direction,
            revLine.unit_cost,
            revLine.total_cost,
            revLine.batch_id,
            revLine.serial_number,
            revLine.notes
          ]
        );

        reversalLines.push(revLine);
      }

      // 4. Post the reversal movement using the posting service
      await InventoryPostingService.postMovement(reversalMovement, reversalLines, client);
    }
  }
}
