import { InventoryMovementV2, InventoryMovementLine } from '../types.js';

export interface StockCardLine {
  date: string;
  movement_number: string;
  movement_type: string;
  source_document_type?: string | null;
  source_document_id?: string | null;
  warehouse_id?: string | null;
  notes?: string | null;
  qty_in: number;
  qty_out: number;
  unit_cost: number;
  total_cost: number;
  running_qty: number;
  running_value: number;
  running_average_cost: number;
}

export class StockCardPreparer {
  /**
   * Constructs the chronological stock card report lines for a single product.
   * Calculates running quantity, running values, and running average costs.
   * 
   * This structure prepared in Phase 1 allows the UI to easily present
   * product history based on the new Inventory Movements engine.
   */
  static generateStockCard(
    productId: string,
    initialQty: number,
    initialAverageCost: number,
    movements: { header: InventoryMovementV2; line: InventoryMovementLine }[]
  ): { lines: StockCardLine[]; summary: { finalQty: number; finalValue: number; finalAverageCost: number } } {
    const lines: StockCardLine[] = [];
    
    let runningQty = initialQty;
    let runningValue = initialQty * initialAverageCost;
    let runningAverageCost = initialAverageCost;

    // Sort movements chronologically by movement_date
    const sortedMoves = [...movements].sort(
      (a, b) => new Date(a.header.movement_date).getTime() - new Date(b.header.movement_date).getTime()
    );

    for (const item of sortedMoves) {
      const { header, line } = item;
      const isIn = line.direction === 'IN';
      const qtyIn = isIn ? line.quantity : 0;
      const qtyOut = isIn ? 0 : line.quantity;
      const lineUnitCost = line.unit_cost || 0;
      const lineTotalCost = line.total_cost || (line.quantity * lineUnitCost);

      if (isIn) {
        runningQty += qtyIn;
        runningValue += lineTotalCost;
        if (runningQty > 0) {
          runningAverageCost = runningValue / runningQty;
        }
      } else {
        runningQty -= qtyOut;
        runningValue -= qtyOut * runningAverageCost;
        // WAC doesn't change on outflow, unless stock becomes 0
        if (runningQty <= 0) {
          runningQty = 0;
          runningValue = 0;
        }
      }

      lines.push({
        date: header.movement_date,
        movement_number: header.movement_number,
        movement_type: header.movement_type,
        source_document_type: header.source_document_type,
        source_document_id: header.source_document_id,
        warehouse_id: header.warehouse_id,
        notes: line.notes || header.notes || null,
        qty_in: qtyIn,
        qty_out: qtyOut,
        unit_cost: lineUnitCost,
        total_cost: lineTotalCost,
        running_qty: runningQty,
        running_value: runningValue,
        running_average_cost: runningAverageCost
      });
    }

    return {
      lines,
      summary: {
        finalQty: runningQty,
        finalValue: runningValue,
        finalAverageCost: runningQty > 0 ? runningValue / runningQty : runningAverageCost
      }
    };
  }
}
