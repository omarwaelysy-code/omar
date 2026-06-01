import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export async function reverseAndRecalculate(client: PoolClient, companyId: string, referenceId: string) {
  // Find all affected products
  const movesRes = await client.query('SELECT DISTINCT product_id FROM inventory_movements WHERE reference_id = $1', [referenceId]);
  const productIds = movesRes.rows.map(r => r.product_id).filter(Boolean);

  // Delete all old impacts
  await client.query('DELETE FROM inventory_movements WHERE reference_id = $1', [referenceId]);
  await client.query('DELETE FROM inventory_layers WHERE reference_id = $1', [referenceId]);
  await client.query('DELETE FROM journal_entries WHERE reference_id = $1', [referenceId]);

  // Recalculate all affected products
  for (const pid of productIds) {
    if (pid) await recalculateProductStock(client, companyId, pid);
  }
}

export async function recalculateTransactionsCosting(client: PoolClient, companyId: string, productIds: string[]) {
  // Utility for putting things in order after new items are added
  for (const pid of productIds) {
    if (pid) await recalculateProductStock(client, companyId, pid);
  }
}

export async function recalculateProductStock(client: PoolClient, companyId: string, productId: string) {
  // Delete all existing layers for this product/company
  await client.query(
    'DELETE FROM inventory_layers WHERE product_id = $1 AND company_id = $2',
    [productId, companyId]
  );

  let stock = 0;
  let wac = 0;
  let totalValue = 0;
  let lastInflowCost = 0;

  // Retrieve fallback costs and current costing method
  const productRes = await client.query('SELECT cost_price, weighted_average_cost, inventory_cost_method FROM products WHERE id = $1', [productId]);
  let fallbackCost = 0;
  let productCostMethod = 'wac';
  if (productRes.rows.length > 0) {
    fallbackCost = parseFloat(productRes.rows[0].weighted_average_cost || '0') || parseFloat(productRes.rows[0].cost_price || '0');
    productCostMethod = productRes.rows[0].inventory_cost_method || 'wac';
  }
  lastInflowCost = fallbackCost;
  wac = fallbackCost;

  // Update all movements of this product to use the current product's costing method
  await client.query(
    'UPDATE inventory_movements SET cost_policy = $1 WHERE product_id = $2 AND company_id = $3',
    [productCostMethod, productId, companyId]
  );

  // Query all movements sorted chronologically
  const movesRes = await client.query(`
    SELECT * FROM inventory_movements 
    WHERE product_id = $1 AND company_id = $2 
    ORDER BY 
      date ASC, 
      CASE WHEN quantity > 0 THEN 0 ELSE 1 END ASC,
      COALESCE(reference_number, '') ASC,
      created_at ASC,
      id ASC
  `, [productId, companyId]);

  for (const move of movesRes.rows) {
    const origQty = parseFloat(move.quantity || '0');
    const qty = Math.abs(origQty);
    const isOutflow = ['sale', 'purchase_return'].includes(move.movement_type) || (move.movement_type === 'adjustment' && origQty < 0);
    const movePolicy = move.cost_policy || 'wac';

    if (!isOutflow) {
      // Inflow: create layer
      const layerId = uuidv4();
      const moveUnitCost = parseFloat(move.unit_cost || '0');
      const moveTotal = moveUnitCost * qty;

      await client.query(`
        INSERT INTO inventory_layers (
          id, company_id, product_id, purchase_date, original_qty, qty_remaining, 
          unit_cost, reference_type, reference_id, created_at, warehouse_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        layerId,
        companyId,
        productId,
        move.date,
        qty,
        qty,
        moveUnitCost,
        move.reference_type || 'adjustment',
        move.reference_id,
        move.created_at || new Date(),
        move.warehouse_id || null
      ]);

      const newStock = stock + qty;
      if (newStock > 0) {
        wac = (totalValue + moveTotal) / newStock;
      } else {
        wac = moveUnitCost;
      }
      stock = newStock;
      totalValue = stock * wac;
      if (moveUnitCost > 0) {
        lastInflowCost = moveUnitCost;
      }
    } else {
      // Outflow: consume layers
      const orderDirection = movePolicy === 'lifo' ? 'DESC' : 'ASC';
      const layersRes = await client.query(`
        SELECT * FROM inventory_layers 
        WHERE product_id = $1 AND qty_remaining > 0 
        ORDER BY purchase_date ${orderDirection}, created_at ${orderDirection}
      `, [productId]);

      let rem = qty;
      let layersCostSum = 0;
      for (const layer of layersRes.rows) {
        if (rem <= 0) break;
        const layerQty = parseFloat(layer.qty_remaining || '0');
        const layerCost = parseFloat(layer.unit_cost || '0');
        const take = Math.min(rem, layerQty);

        await client.query(
          `UPDATE inventory_layers SET qty_remaining = qty_remaining - $1 WHERE id = $2`,
          [take, layer.id]
        );

        layersCostSum += take * layerCost;
        rem -= take;
      }

      if (rem > 0) {
        // Out of stock fallback
        layersCostSum += rem * lastInflowCost;
      }

      let finalUnitCost = 0;
      let finalTotalCost = 0;

      if (movePolicy === 'wac') {
        finalUnitCost = wac;
        finalTotalCost = qty * wac;
      } else {
        finalUnitCost = qty > 0 ? layersCostSum / qty : lastInflowCost;
        finalTotalCost = layersCostSum;
      }

      const sign = origQty < 0 ? -1 : 1;

      // Update the movement's cost/unit cost
      await client.query(`
        UPDATE inventory_movements 
        SET unit_cost = $1, total_cost = $2 
        WHERE id = $3
      `, [finalUnitCost, finalTotalCost * sign, move.id]);

      // Update invoice items if needed
      if (move.reference_type === 'invoice' || move.reference_type === 'sale') {
        await client.query(`
          UPDATE invoice_items 
          SET unit_cost = $1, total_cost = $2 
          WHERE invoice_id = $3 AND product_id = $4
        `, [finalUnitCost, finalTotalCost, move.reference_id, productId]);
      }

      stock = stock - qty;
      totalValue = totalValue - finalTotalCost;
      if (stock <= 0) {
        totalValue = 0;
      }
      if (stock > 0) {
        wac = totalValue / stock;
      }
    }
  }

  // Update products table with final results
  await client.query(`
    UPDATE products 
    SET stock = $1, current_stock = $1, weighted_average_cost = $2, cost_price = $2
    WHERE id = $3
  `, [stock, wac, productId]);
}

/**
 * Inventory Costing Engine
 * Supports FIFO, LIFO, and Moving Average (WAC) costing methods.
 */

export interface CostingResult {
  unitCost: number;
  totalCost: number;
  methodUsed: 'wac' | 'fifo' | 'lifo';
}

/**
 * Gets the configured company inventory cost method or product specific method.
 */
async function getCompanyCostMethod(client: PoolClient, companyId: string, productId?: string): Promise<'wac' | 'fifo' | 'lifo'> {
  const companyRes = await client.query('SELECT settings FROM companies WHERE id = $1', [companyId]);
  if (companyRes.rows[0]) {
    const settings = companyRes.rows[0].settings || {};
    
    // Check if item level is configured and product ID is provided
    if (settings.inventory_cost_method_level === 'item' && productId) {
      const productRes = await client.query('SELECT inventory_cost_method FROM products WHERE id = $1', [productId]);
      if (productRes.rows.length > 0 && productRes.rows[0].inventory_cost_method) {
        const productMethod = String(productRes.rows[0].inventory_cost_method).toLowerCase();
        if (productMethod === 'fifo' || productMethod === 'lifo' || productMethod === 'wac') {
          return productMethod as 'fifo' | 'lifo' | 'wac';
        }
      }
    }

    const method = (settings.inventory_cost_method || '').toLowerCase();
    if (method === 'fifo' || method === 'lifo' || method === 'wac') {
      return method;
    }
  }
  return 'wac';
}

/**
 * Updates product current stock and cost price inside products table
 */
async function updateProductDetails(
  client: PoolClient,
  productId: string,
  stockDelta: number,
  newCostPrice?: number
): Promise<void> {
  if (newCostPrice !== undefined && newCostPrice > 0) {
    await client.query(
      `UPDATE products 
       SET current_stock = current_stock + $1, stock = stock + $1, weighted_average_cost = $2 
       WHERE id = $3`,
      [stockDelta, newCostPrice, productId]
    );
  } else {
    await client.query(
      `UPDATE products 
       SET current_stock = current_stock + $1, stock = stock + $1 
       WHERE id = $2`,
      [stockDelta, productId]
    );
  }
}

/**
 * Records a Purchase movement (Inflow) and updates product average cost or layers
 */
export async function recordPurchase(
  client: PoolClient,
  companyId: string,
  warehouseId: string | null,
  productId: string,
  quantity: number,
  unitCost: number,
  referenceId: string,
  referenceNumber: string,
  date: string
): Promise<CostingResult> {
  const method = await getCompanyCostMethod(client, companyId, productId);
  const totalCost = quantity * unitCost;

  // Retrieve product details
  const productRes = await client.query('SELECT cost_price, stock, weighted_average_cost FROM products WHERE id = $1', [productId]);
  if (productRes.rows.length === 0) {
    throw new Error(`Product not found: ${productId}`);
  }
  const product = productRes.rows[0];
  const oldStock = parseFloat(product.stock || '0');
  const oldCost = parseFloat(product.weighted_average_cost || '0') || parseFloat(product.cost_price || '0');

  let newCost = oldCost;

  // Create an inventory layer for all methods
  const layerId = uuidv4();
  await client.query(
    `INSERT INTO inventory_layers (id, company_id, product_id, purchase_date, original_qty, qty_remaining, unit_cost, reference_type, reference_id, created_at, warehouse_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
    [layerId, companyId, productId, date, quantity, quantity, unitCost, 'purchase_invoice', referenceId, warehouseId]
  );

  if (method === 'wac') {
    // Moving Average calculation
    const totalOldValue = oldStock * oldCost;
    const totalNewValue = totalCost;
    const newStock = oldStock + quantity;
    if (newStock !== 0) {
      newCost = (totalOldValue + totalNewValue) / newStock;
    } else {
      newCost = unitCost;
    }
  } else {
    // Cost price is updated to latest purchase unit cost
    newCost = unitCost;
  }

  // Insert into inventory_movements
  const movementId = uuidv4();
  await client.query(
    `INSERT INTO inventory_movements (id, company_id, product_id, movement_type, reference_id, reference_type, reference_number, date, quantity, unit_cost, total_cost, created_at, warehouse_id, cost_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)`,
    [movementId, companyId, productId, 'purchase', referenceId, 'purchase_invoice', referenceNumber, date, quantity, unitCost, totalCost, warehouseId, method]
  );

  // Update product stock and cost price
  await updateProductDetails(client, productId, quantity, newCost);

  return {
    unitCost,
    totalCost,
    methodUsed: method
  };
}

/**
 * Records a Sale movement (Outflow), deducts from stock and applies costing
 */
export async function recordSale(
  client: PoolClient,
  companyId: string,
  warehouseId: string | null,
  productId: string,
  quantity: number,
  referenceId: string,
  referenceNumber: string,
  date: string
): Promise<CostingResult> {
  const method = await getCompanyCostMethod(client, companyId, productId);

  // Retrieve product details
  const productRes = await client.query('SELECT cost_price, stock, weighted_average_cost FROM products WHERE id = $1', [productId]);
  if (productRes.rows.length === 0) {
    throw new Error(`Product not found: ${productId}`);
  }
  const product = productRes.rows[0];
  const costPrice = parseFloat(product.weighted_average_cost || '0') || parseFloat(product.cost_price || '0');

  let totalCost = 0;
  let unitCost = costPrice;

  // Always consume layers regardless of method
  const orderDirection = method === 'lifo' ? 'DESC' : 'ASC';
  const layersRes = await client.query(
    `SELECT * FROM inventory_layers 
     WHERE product_id = $1 AND qty_remaining > 0 
     ORDER BY purchase_date ${orderDirection}, created_at ${orderDirection}`,
    [productId]
  );

  let rem = quantity;
  let layersCost = 0;
  for (const layer of layersRes.rows) {
    if (rem <= 0) break;
    const layerQty = parseFloat(layer.qty_remaining || '0');
    const layerCostVal = parseFloat(layer.unit_cost || '0');
    const take = Math.min(rem, layerQty);

    await client.query(
      `UPDATE inventory_layers SET qty_remaining = qty_remaining - $1 WHERE id = $2`,
      [take, layer.id]
    );

    layersCost += take * layerCostVal;
    rem -= take;
  }

  if (rem > 0) {
    // Out of stock gracefully: cover using latest product cost_price
    layersCost += rem * costPrice;
  }

  if (method === 'wac') {
    // For WAC, the sale cost is the current average cost of the product
    unitCost = costPrice;
    totalCost = quantity * costPrice;
  } else {
    // For FIFO/LIFO, pull from layers
    totalCost = layersCost;
    unitCost = quantity > 0 ? totalCost / quantity : costPrice;
  }

  // Insert into inventory_movements
  const movementId = uuidv4();
  await client.query(
    `INSERT INTO inventory_movements (id, company_id, product_id, movement_type, reference_id, reference_type, reference_number, date, quantity, unit_cost, total_cost, created_at, warehouse_id, cost_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)`,
    [movementId, companyId, productId, 'sale', referenceId, 'invoice', referenceNumber, date, -quantity, unitCost, -totalCost, warehouseId, method]
  );

  // Update stock (cost price remains unchanged on sale)
  await updateProductDetails(client, productId, -quantity);

  return {
    unitCost,
    totalCost,
    methodUsed: method
  };
}

/**
 * Records a Sales Return (Inflow of goods returned by customer)
 */
export async function recordSalesReturn(
  client: PoolClient,
  companyId: string,
  warehouseId: string | null,
  productId: string,
  quantity: number,
  returnUnitCost: number, // Use the unit_cost registered in invoice_items originally
  referenceId: string,
  referenceNumber: string,
  date: string
): Promise<CostingResult> {
  const method = await getCompanyCostMethod(client, companyId, productId);
  const totalCost = quantity * returnUnitCost;

  // Retrieve product details
  const productRes = await client.query('SELECT cost_price, stock, weighted_average_cost FROM products WHERE id = $1', [productId]);
  if (productRes.rows.length === 0) {
    throw new Error(`Product not found: ${productId}`);
  }
  const product = productRes.rows[0];
  const oldStock = parseFloat(product.stock || '0');
  const oldCost = parseFloat(product.weighted_average_cost || '0') || parseFloat(product.cost_price || '0');

  let newCost = oldCost;

  // Return back to inventory layers: create a special layer for returned goods
  const layerId = uuidv4();
  await client.query(
    `INSERT INTO inventory_layers (id, company_id, product_id, purchase_date, original_qty, qty_remaining, unit_cost, reference_type, reference_id, created_at, warehouse_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
    [layerId, companyId, productId, date, quantity, quantity, returnUnitCost, 'returns', referenceId, warehouseId]
  );

  if (method === 'wac') {
    // Add back returned inventory at its original cost price
    const totalOldValue = oldStock * oldCost;
    const totalNewValue = quantity * returnUnitCost;
    const newStock = oldStock + quantity;
    if (newStock !== 0) {
      newCost = (totalOldValue + totalNewValue) / newStock;
    } else {
      newCost = returnUnitCost;
    }
  }

  // Insert into inventory_movements
  const movementId = uuidv4();
  await client.query(
    `INSERT INTO inventory_movements (id, company_id, product_id, movement_type, reference_id, reference_type, reference_number, date, quantity, unit_cost, total_cost, created_at, warehouse_id, cost_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)`,
    [movementId, companyId, productId, 'sales_return', referenceId, 'returns', referenceNumber, date, quantity, returnUnitCost, totalCost, warehouseId, method]
  );

  // Update stock and cost price
  await updateProductDetails(client, productId, quantity, newCost);

  return {
    unitCost: returnUnitCost,
    totalCost,
    methodUsed: method
  };
}

/**
 * Records a Purchase Return (Outflow of goods returned to supplier)
 */
export async function recordPurchaseReturn(
  client: PoolClient,
  companyId: string,
  warehouseId: string | null,
  productId: string,
  quantity: number,
  returnUnitCost: number, // Unit cost from original purchase
  referenceId: string,
  referenceNumber: string,
  date: string
): Promise<CostingResult> {
  const method = await getCompanyCostMethod(client, companyId, productId);
  const totalCost = quantity * returnUnitCost;

  // Retrieve product details
  const productRes = await client.query('SELECT cost_price, stock, weighted_average_cost FROM products WHERE id = $1', [productId]);
  if (productRes.rows.length === 0) {
    throw new Error(`Product not found: ${productId}`);
  }
  const product = productRes.rows[0];
  const oldStock = parseFloat(product.stock || '0');
  const oldCost = parseFloat(product.weighted_average_cost || '0') || parseFloat(product.cost_price || '0');

  let newCost = oldCost;

  // Always consume layers regardless of the method
  const orderDirection = method === 'lifo' ? 'DESC' : 'ASC';
  const layersRes = await client.query(
    `SELECT * FROM inventory_layers 
     WHERE product_id = $1 AND qty_remaining > 0 
     ORDER BY purchase_date ${orderDirection}, created_at ${orderDirection}`,
    [productId]
  );

  let rem = quantity;
  for (const layer of layersRes.rows) {
    if (rem <= 0) break;
    const layerQty = parseFloat(layer.qty_remaining || '0');
    const take = Math.min(rem, layerQty);

    await client.query(
      `UPDATE inventory_layers SET qty_remaining = qty_remaining - $1 WHERE id = $2`,
      [take, layer.id]
    );
    rem -= take;
  }

  if (method === 'wac') {
    const newStock = oldStock - quantity;
    if (newStock !== 0) {
      const totalOldValue = oldStock * oldCost;
      const totalNewValue = quantity * returnUnitCost;
      newCost = (totalOldValue - totalNewValue) / newStock;
      if (newCost < 0) newCost = oldCost; // Prevent negative cost bounds anomalies
    }
  }

  // Insert into inventory_movements
  const movementId = uuidv4();
  await client.query(
    `INSERT INTO inventory_movements (id, company_id, product_id, movement_type, reference_id, reference_type, reference_number, date, quantity, unit_cost, total_cost, created_at, warehouse_id, cost_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)`,
    [movementId, companyId, productId, 'purchase_return', referenceId, 'purchase_returns', referenceNumber, date, -quantity, returnUnitCost, -totalCost, warehouseId, method]
  );

  // Update stock
  await updateProductDetails(client, productId, -quantity);

  return {
    unitCost: returnUnitCost,
    totalCost,
    methodUsed: method
  };
}

/**
 * Records an inventory Adjustment (plus/minus correction)
 */
export async function recordAdjustment(
  client: PoolClient,
  companyId: string,
  warehouseId: string | null,
  productId: string,
  quantity: number, // positive for addition, negative for deduction
  unitCost: number, // cost of adding or standard cost
  referenceId: string,
  referenceNumber: string,
  date: string
): Promise<CostingResult> {
  const method = await getCompanyCostMethod(client, companyId, productId);
  const totalCost = quantity * unitCost;

  if (quantity > 0) {
    // Inflow
    const productRes = await client.query('SELECT cost_price, stock, weighted_average_cost FROM products WHERE id = $1', [productId]);
    if (productRes.rows.length === 0) {
      throw new Error(`Product not found: ${productId}`);
    }
    const product = productRes.rows[0];
    const oldStock = parseFloat(product.stock || '0');
    const oldCost = parseFloat(product.weighted_average_cost || '0') || parseFloat(product.cost_price || '0');

    let newCost = oldCost;

    // Create layer
    const layerId = uuidv4();
    await client.query(
      `INSERT INTO inventory_layers (id, company_id, product_id, purchase_date, original_qty, qty_remaining, unit_cost, reference_type, reference_id, created_at, warehouse_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
      [layerId, companyId, productId, date, quantity, quantity, unitCost, 'adjustment', referenceId, warehouseId]
    );

    if (method === 'wac') {
      const totalOldValue = oldStock * oldCost;
      const totalNewValue = totalCost;
      const newStock = oldStock + quantity;
      if (newStock !== 0) {
        newCost = (totalOldValue + totalNewValue) / newStock;
      } else {
        newCost = unitCost;
      }
    }

    // Insert into inventory_movements
    const movementId = uuidv4();
    await client.query(
      `INSERT INTO inventory_movements (id, company_id, product_id, movement_type, reference_id, reference_type, reference_number, date, quantity, unit_cost, total_cost, created_at, warehouse_id, cost_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)`,
      [movementId, companyId, productId, 'adjustment', referenceId, 'adjustment', referenceNumber, date, quantity, unitCost, totalCost, warehouseId, method]
    );

    // Update stock and cost
    await updateProductDetails(client, productId, quantity, newCost);
  } else {
    // Outflow
    const remQty = Math.abs(quantity);
    let calculatedCost = 0;
    let actualUnitCost = unitCost;

    // Always consume layers
    const orderDirection = method === 'lifo' ? 'DESC' : 'ASC';
    const layersRes = await client.query(
      `SELECT * FROM inventory_layers 
       WHERE product_id = $1 AND qty_remaining > 0 
       ORDER BY purchase_date ${orderDirection}, created_at ${orderDirection}`,
      [productId]
    );

    let rem = remQty;
    for (const layer of layersRes.rows) {
      if (rem <= 0) break;
      const layerQty = parseFloat(layer.qty_remaining || '0');
      const layerCost = parseFloat(layer.unit_cost || '0');
      const take = Math.min(rem, layerQty);

      await client.query(
        `UPDATE inventory_layers SET qty_remaining = qty_remaining - $1 WHERE id = $2`,
        [take, layer.id]
      );

      calculatedCost += take * layerCost;
      rem -= take;
    }

    if (rem > 0) {
      calculatedCost += rem * unitCost;
    }

    if (method === 'wac') {
      calculatedCost = remQty * unitCost;
      actualUnitCost = unitCost;
    } else {
      actualUnitCost = remQty > 0 ? calculatedCost / remQty : unitCost;
    }

    // Insert into inventory_movements
    const movementId = uuidv4();
    await client.query(
      `INSERT INTO inventory_movements (id, company_id, product_id, movement_type, reference_id, reference_type, reference_number, date, quantity, unit_cost, total_cost, created_at, warehouse_id, cost_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)`,
      [movementId, companyId, productId, 'adjustment', referenceId, 'adjustment', referenceNumber, date, -remQty, actualUnitCost, -calculatedCost, warehouseId, method]
    );

    // Update stock only
    await updateProductDetails(client, productId, -remQty);
  }

  return {
    unitCost,
    totalCost,
    methodUsed: method
  };
}
