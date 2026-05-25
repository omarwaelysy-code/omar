import fs from "fs";

let content = fs.readFileSync("src/lib/cost-engine.ts", "utf8");

content = content.replace(/INSERT INTO inventory_movements \(id, company_id, product_id,([^)]*)\)\s+VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11([^)]*)\)/g, 
  "INSERT INTO inventory_movements (id, company_id, warehouse_id, product_id,$1)\n     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12$2)");

content = content.replace(/\[movementId, companyId, productId/g, "[movementId, companyId, warehouseId, productId");

content = content.replace(/INSERT INTO inventory_layers \(id, company_id, product_id,([^)]*)\)\s+VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9([^)]*)\)/g, 
  "INSERT INTO inventory_layers (id, company_id, warehouse_id, product_id,$1)\n     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10$2)");

content = content.replace(/\[layerId, companyId, productId/g, "[layerId, companyId, warehouseId, productId");

fs.writeFileSync("src/lib/cost-engine.ts", content);

