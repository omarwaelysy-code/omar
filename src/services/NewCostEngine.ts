import { InventoryMovementV2, InventoryMovementLine } from '../types.js';

export type CostingMethod = 'wac' | 'fifo' | 'lifo';

export interface InventoryLayer {
  id: string;
  company_id: string;
  warehouse_id: string | null;
  product_id: string;
  purchase_date: string;
  original_qty: number;
  qty_remaining: number;
  unit_cost: number;
  reference_type: string;
  reference_id: string;
  created_at: string;
}

export class NewCostEngine {
  /**
   * Stub method to calculate unit cost and total cost of outflow movement lines
   * based on the selected costing method (WAC, FIFO, LIFO).
   * 
   * (In Phase 1, this represents the structural API for the costing calculations
   * without being integrated into the main database writes.)
   */
  static async calculateOutflowCosts(
    method: CostingMethod,
    productId: string,
    companyId: string,
    warehouseId: string | null,
    qtyToIssue: number,
    date: string,
    layers: InventoryLayer[] = []
  ): Promise<{
    unitCost: number;
    totalCost: number;
    affectedLayers: { layerId: string; qtyDeducted: number }[];
    unfulfilledQty: number;
  }> {
    if (qtyToIssue <= 0) {
      return { unitCost: 0, totalCost: 0, affectedLayers: [], unfulfilledQty: 0 };
    }

    switch (method) {
      case 'wac':
        return this.calculateMovingAverage(layers, qtyToIssue);
      case 'fifo':
        return this.calculateFIFO(layers, qtyToIssue);
      case 'lifo':
        return this.calculateLIFO(layers, qtyToIssue);
      default:
        throw new Error(`Unsupported costing method: ${method}`);
    }
  }

  /**
   * Weighted Average Cost (WAC) calculations stub.
   */
  private static calculateMovingAverage(
    layers: InventoryLayer[],
    qtyToIssue: number
  ): {
    unitCost: number;
    totalCost: number;
    affectedLayers: { layerId: string; qtyDeducted: number }[];
    unfulfilledQty: number;
  } {
    const totalQty = layers.reduce((sum, l) => sum + l.qty_remaining, 0);
    const totalValue = layers.reduce((sum, l) => sum + (l.qty_remaining * l.unit_cost), 0);

    const averageCost = totalQty > 0 ? totalValue / totalQty : 0;
    const fulfilledQty = Math.min(qtyToIssue, totalQty);
    const unfulfilledQty = Math.max(0, qtyToIssue - totalQty);
    const totalCost = fulfilledQty * averageCost;

    // Deduct proportionally from layers or chronologically
    const affectedLayers: { layerId: string; qtyDeducted: number }[] = [];
    let remainingToDeduct = fulfilledQty;

    for (const layer of layers) {
      if (remainingToDeduct <= 0) break;
      const deduct = Math.min(layer.qty_remaining, remainingToDeduct);
      affectedLayers.push({ layerId: layer.id, qtyDeducted: deduct });
      remainingToDeduct -= deduct;
    }

    return {
      unitCost: averageCost,
      totalCost,
      affectedLayers,
      unfulfilledQty
    };
  }

  /**
   * First-In First-Out (FIFO) calculations stub.
   */
  private static calculateFIFO(
    layers: InventoryLayer[],
    qtyToIssue: number
  ): {
    unitCost: number;
    totalCost: number;
    affectedLayers: { layerId: string; qtyDeducted: number }[];
    unfulfilledQty: number;
  } {
    // Sort layers chronologically (First-in is oldest purchase date)
    const sortedLayers = [...layers].sort(
      (a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
    );

    let remainingToDeduct = qtyToIssue;
    let totalCost = 0;
    const affectedLayers: { layerId: string; qtyDeducted: number }[] = [];

    for (const layer of sortedLayers) {
      if (remainingToDeduct <= 0) break;
      if (layer.qty_remaining <= 0) continue;

      const deduct = Math.min(layer.qty_remaining, remainingToDeduct);
      totalCost += deduct * layer.unit_cost;
      affectedLayers.push({ layerId: layer.id, qtyDeducted: deduct });
      remainingToDeduct -= deduct;
    }

    const fulfilledQty = qtyToIssue - remainingToDeduct;
    const unitCost = fulfilledQty > 0 ? totalCost / fulfilledQty : 0;

    return {
      unitCost,
      totalCost,
      affectedLayers,
      unfulfilledQty: remainingToDeduct
    };
  }

  /**
   * Last-In First-Out (LIFO) calculations stub.
   */
  private static calculateLIFO(
    layers: InventoryLayer[],
    qtyToIssue: number
  ): {
    unitCost: number;
    totalCost: number;
    affectedLayers: { layerId: string; qtyDeducted: number }[];
    unfulfilledQty: number;
  } {
    // Sort layers reverse chronologically (Last-in is newest purchase date)
    const sortedLayers = [...layers].sort(
      (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
    );

    let remainingToDeduct = qtyToIssue;
    let totalCost = 0;
    const affectedLayers: { layerId: string; qtyDeducted: number }[] = [];

    for (const layer of sortedLayers) {
      if (remainingToDeduct <= 0) break;
      if (layer.qty_remaining <= 0) continue;

      const deduct = Math.min(layer.qty_remaining, remainingToDeduct);
      totalCost += deduct * layer.unit_cost;
      affectedLayers.push({ layerId: layer.id, qtyDeducted: deduct });
      remainingToDeduct -= deduct;
    }

    const fulfilledQty = qtyToIssue - remainingToDeduct;
    const unitCost = fulfilledQty > 0 ? totalCost / fulfilledQty : 0;

    return {
      unitCost,
      totalCost,
      affectedLayers,
      unfulfilledQty: remainingToDeduct
    };
  }
}
