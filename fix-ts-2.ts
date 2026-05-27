import fs from 'fs';

let content = fs.readFileSync('src/lib/erp-api.ts', 'utf8');

const target1 = "await recordSalesReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, refId, parentDoc.return_number, parentDoc.date);";
const replacement1 = "await recordSalesReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.unit_cost || item.cost_price || '0'), refId, parentDoc.return_number, parentDoc.date);";

content = content.replace(target1, replacement1);

const target2 = "await recordPurchaseReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, refId, parentDoc.return_number, parentDoc.date);";
const replacement2 = "await recordPurchaseReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.unit_cost || item.cost_price || '0'), refId, parentDoc.return_number, parentDoc.date);";

content = content.replace(target2, replacement2);

fs.writeFileSync('src/lib/erp-api.ts', content);
console.log('Fixed recalculate_all');
