import fs from 'fs';

function addWarehouseId(fileContent) {
  // Update inventory_movements inserts
  let updated = fileContent.replace(
    /INSERT INTO inventory_movements \((.*?)\)\s+VALUES \((.*?)(,\s*NOW\(\))\)/g,
    (match, cols, vals, nowStr) => {
      // Find what $ number is the last one in vals
      const params = vals.split(',').map(s => s.trim());
      const lastParamText = params[params.length - 1]; // e.g. "$11"
      const lastParamMatch = lastParamText.match(/\$(\d+)/);
      let newCount = lastParamMatch ? parseInt(lastParamMatch[1]) + 1 : params.length + 1;
      
      const newCols = cols.replace('company_id,', 'company_id, warehouse_id,');
      // For Values, we inject our new $ before product_id (which is $3)
      // Wait changing $ parameters is hard if we just shift them.
      // Better to just append `warehouse_id` at the end before `created_at`.
      const newColsAlt = cols + ', warehouse_id';
      const newVals = vals + `, $${newCount}`;
      return `INSERT INTO inventory_movements (${newColsAlt})\n       VALUES (${newVals}${nowStr})`;
    }
  );

  // Array variables replacer (movement_id)
  updated = updated.replace(
    /\[movementId, companyId, productId, (.*?)\]/g,
    (match, rest) => {
      return `[movementId, companyId, productId, ${rest}, warehouseId]`;
    }
  );

  // Update inventory_layers inserts
  updated = updated.replace(
    /INSERT INTO inventory_layers \((.*?)\)\s+VALUES \((.*?)(,\s*NOW\(\))\)/g,
    (match, cols, vals, nowStr) => {
      const params = vals.split(',').map(s => s.trim());
      const lastParamText = params[params.length - 1]; 
      const lastParamMatch = lastParamText.match(/\$(\d+)/);
      let newCount = lastParamMatch ? parseInt(lastParamMatch[1]) + 1 : params.length + 1;
      
      const newColsAlt = cols + ', warehouse_id';
      const newVals = vals + `, $${newCount}`;
      return `INSERT INTO inventory_layers (${newColsAlt})\n       VALUES (${newVals}${nowStr})`;
    }
  );

  // Array variables replacer (layer_id)
  updated = updated.replace(
    /\[layerId, companyId, productId, (.*?)\]/g,
    (match, rest) => {
      return `[layerId, companyId, productId, ${rest}, warehouseId]`;
    }
  );

  return updated;
}

const content = fs.readFileSync('src/lib/cost-engine.ts', 'utf8');
const updatedContent = addWarehouseId(content);
fs.writeFileSync('src/lib/cost-engine.ts', updatedContent);
console.log("Updated cost-engine.ts");
