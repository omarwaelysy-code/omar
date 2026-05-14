const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  { path: 'src/pages/Invoices.tsx' },
  { path: 'src/pages/PurchaseInvoices.tsx' },
  { path: 'src/pages/Returns.tsx' },
  { path: 'src/pages/PurchaseReturns.tsx' },
  { path: 'src/pages/PaymentVouchers.tsx' },
  { path: 'src/pages/Receipts.tsx' },
  { path: 'src/pages/JournalEntries.tsx' }
];

for (const fileDef of filesToUpdate) {
  const filePath = path.join(__dirname, fileDef.path);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf-8');

  // Add import if not exists
  if (!content.includes('PaginationControls')) {
    const importMatch = content.match(/import.*?from 'lucide-react';/);
    if (importMatch) {
      content = content.replace(importMatch[0], importMatch[0] + "\nimport { PaginationControls } from '../components/PaginationControls';");
    }
  }

  // Find the end of view condition or empty state
  const tableEndRegex = /\{\s*filtered[A-Za-z]+\.length === 0 && !loading && \([\s\S]*?(?:<\/div>|<\/tbody>)\s*\)\s*\}\s*<\/(div|table)>(?:\s*<\/(div|div)>)/g;
  
  // We can just rely on looking for the closing tag of the main card view. 
  // Let's find: `)}` that ends the `view === 'table' ? ( ... ) : ( ... )`
  // Actually, we can inject it right above the `</main>` or whatever wrapper it has.
  // Let's just find `<TransactionSidePanel` and put it above that, or maybe looking for `        )}` before the `{isModalOpen`
  
  // Another way: Replace the end of the `filtered` map loop empty check in the grid.
  const regex = /(<div className="col-span-full.*?>.*?<\/div>\s*\)\s*\}\s*<\/div>\s*\)\})/;
  
  // If we can't do that simply, let's just do a specific manual replace! We will just write a function that injects it.
}
