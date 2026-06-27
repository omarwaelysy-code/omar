import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { InventoryMovementV2, InventoryMovementLine } from '../types.js';

export class InventoryPostingService {
  /**
   * Posts a movement and its lines to the inventory balances and stock card.
   * Runs in the same transaction using the provided database client.
   */
  static async postMovement(
    movement: InventoryMovementV2,
    lines: InventoryMovementLine[],
    client: PoolClient | Pool
  ): Promise<void> {
    for (const line of lines) {
      const productId = line.product_id;
      const quantity = parseFloat(String(line.quantity));
      const direction = line.direction; // 'IN' or 'OUT'
      const unitCost = parseFloat(String(line.unit_cost || 0));
      const totalCost = parseFloat(String(line.total_cost || (quantity * unitCost)));

      // 1. Calculate the product stock and WAC immediately before this transaction
      const { beforeQty, beforeCost } = await this.getPreviousStockAndCost(
        client,
        productId,
        movement.source_document_id || ''
      );

      // 2. Compute the new stock and average cost (Moving Average)
      let afterQty = beforeQty;
      let afterCost = beforeCost;

      if (direction === 'IN') {
        afterQty = beforeQty + quantity;
        if (afterQty > 0) {
          afterCost = ((beforeQty * beforeCost) + (quantity * unitCost)) / afterQty;
        } else {
          afterCost = unitCost;
        }
      } else if (direction === 'OUT') {
        afterQty = beforeQty - quantity;
        // Constraint check: Negative stock is not allowed
        if (afterQty < 0) {
          throw new Error(`الكمية المطلوبة غير متوفرة في المخزن لهذا المنتج. الرصيد الحالي: ${beforeQty}، الكمية المطلوبة: ${quantity} (Negative stock is not allowed. Product ID: ${productId})`);
        }
        afterCost = beforeCost; // Cost remains unchanged on outflow under Moving Average
      }

      // 3. Save snapshot metrics back to the movement line
      await client.query(
        `UPDATE "inventory_movement_lines" 
         SET "before_quantity" = $1, "after_quantity" = $2, "before_cost" = $3, "after_cost" = $4
         WHERE id = $5`,
        [beforeQty, afterQty, beforeCost, afterCost, line.id]
      );

      // 4. Create a record in the stock_card log table
      const stockCardId = uuidv4();
      await client.query(
        `INSERT INTO "stock_card" (
          id, company_id, warehouse_id, product_id, movement_id, movement_line_id,
          movement_date, quantity, direction, before_qty, after_qty, before_cost, after_cost,
          unit_cost, total_cost
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          stockCardId,
          movement.company_id,
          movement.warehouse_id || null,
          productId,
          movement.id,
          line.id,
          movement.movement_date,
          quantity,
          direction,
          beforeQty,
          afterQty,
          beforeCost,
          afterCost,
          unitCost,
          totalCost
        ]
      );

      // 5. Update the main products table with the new balance and cost
      const { rowCount } = await client.query(
        `UPDATE products 
         SET stock = $1, current_stock = $1, cost_price = $2, weighted_average_cost = $2, updated_at = NOW()
         WHERE id = $3`,
        [afterQty, afterCost, productId]
      );

      if (rowCount === 0) {
        throw new Error(`Product not found or failed to update balance. Product ID: ${productId}`);
      }
    }

    // 6. Automatically create the central Inventory Transaction Journal record (Phase 4)
    const journalId = uuidv4();
    const isPosted = movement.status === 'posted';
    const journalStatus = isPosted ? 'Posted' : 'Draft';
    const postedAt = isPosted ? new Date() : null;

    const journalQuery = `
      INSERT INTO "inventory_transaction_journal" (
        id, company_id, warehouse_id, movement_id, movement_type,
        source_document_type, source_document_id, reference_number,
        status, created_by, created_at, posted_at, cancelled_at, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, NULL, $12)
    `;

    await client.query(journalQuery, [
      journalId,
      movement.company_id,
      movement.warehouse_id || null,
      movement.id,
      movement.movement_type,
      movement.source_document_type || null,
      movement.source_document_id || null,
      movement.movement_number,
      journalStatus,
      movement.created_by || null,
      postedAt,
      movement.notes || null
    ]);
  }

  /**
   * Helper to compute the stock quantity and average cost of a product
   * immediately prior to the current document being saved/updated.
   */
  private static async getPreviousStockAndCost(
    client: PoolClient | Pool,
    productId: string,
    sourceDocumentId: string
  ): Promise<{ beforeQty: number; beforeCost: number }> {
    // Query all previous movements of this product from the old table (excluding this document)
    const movesRes = await client.query(
      `SELECT quantity, unit_cost FROM inventory_movements 
       WHERE product_id = $1 AND reference_id != $2 
       ORDER BY date ASC, created_at ASC, id ASC`,
      [productId, sourceDocumentId]
    );

    let stock = 0;
    let wac = 0;

    for (const move of movesRes.rows) {
      const qty = parseFloat(String(move.quantity));
      const unitCost = parseFloat(String(move.unit_cost || 0));

      if (qty > 0) {
        wac = (stock * wac + qty * unitCost) / (stock + qty);
        stock += qty;
      } else {
        stock += qty; // qty is negative for outflows in old movements table
      }
    }

    // Fallback: If no movements exist in the old table, read from products
    // (but adjust for possible updates already done by the old engine in the same transaction)
    if (movesRes.rows.length === 0) {
      const prodRes = await client.query(
        'SELECT stock, cost_price FROM products WHERE id = $1',
        [productId]
      );
      if (prodRes.rows.length > 0) {
        const prodStock = parseFloat(String(prodRes.rows[0].stock || 0));
        const prodCost = parseFloat(String(prodRes.rows[0].cost_price || 0));
        return { beforeQty: prodStock, beforeCost: prodCost };
      }
    }

    return { beforeQty: stock, beforeCost: wac };
  }
}
