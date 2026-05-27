import fs from 'fs';

let content = fs.readFileSync('src/lib/erp-api.ts', 'utf8');

// 1. Redeclaration of invoiceId in PUT /invoices/:id
// and PUT /purchase_invoices/:id
content = content.replace(/(const invData = invoiceData;)\s*const invoiceId = req\.params\.id;/g, '$1\n    const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];');

// 2. Redeclaration of returnId in PUT /returns/:id
// and PUT /purchase_returns/:id
content = content.replace(/(const returnDataFinal = returnData;)\s*const returnId = req\.params\.id;/g, '$1\n    const rData = returnDataFinal;\n    const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];');

fs.writeFileSync('src/lib/erp-api.ts', content);
console.log('Fixed redeclarations and cogsLines');
