import fs from 'fs';

function addWarehouseId(fileContent) {
  let updated = fileContent;

  updated = updated.replace(
    /const costInfo = await recordSale\(\s*client,\s*companyId,\s*item\.product_id,\s*quantity,\s*invoiceId,/g,
    `const costInfo = await recordSale(\n              client,\n              companyId,\n              invData.warehouse_id || null,\n              item.product_id,\n              quantity,\n              invoiceId,`
  );

  updated = updated.replace(
    /await recordSalesReturn\(\s*client,\s*companyId,\s*item\.product_id,\s*quantity,\s*returnUnitCost,\s*returnId,/g,
    `await recordSalesReturn(\n              client,\n              companyId,\n              retData.warehouse_id || null,\n              item.product_id,\n              quantity,\n              returnUnitCost,\n              returnId,`
  );

  updated = updated.replace(
    /await recordPurchase\(\s*client,\s*companyId,\s*item\.product_id,\s*qty,\s*unitPrice,\s*invoiceId,/g,
    `await recordPurchase(\n              client,\n              companyId,\n              invData.warehouse_id || null,\n              item.product_id,\n              qty,\n              unitPrice,\n              invoiceId,`
  );
  
  updated = updated.replace(
    /await recordPurchaseReturn\(\s*client,\s*companyId,\s*item\.product_id,\s*qty,\s*returnUnitCost,\s*returnId,/g,
    `await recordPurchaseReturn(\n              client,\n              companyId,\n              retData.warehouse_id || null,\n              item.product_id,\n              qty,\n              returnUnitCost,\n              returnId,`
  );

  return updated;
}

const content = fs.readFileSync('src/lib/erp-api.ts', 'utf8');
const updatedContent = addWarehouseId(content);
fs.writeFileSync('src/lib/erp-api.ts', updatedContent);
console.log("Updated erp-api.ts");
