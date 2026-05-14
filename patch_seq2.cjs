const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  { path: 'src/pages/Invoices.tsx', itemsLabel: 'invoices', numField: 'invoice_number', genField:'invoiceNumber', setField: 'setInvoiceNumber' },
  { path: 'src/pages/PurchaseInvoices.tsx', itemsLabel: 'purchaseInvoices', numField: 'invoice_number', genField:'invoiceNumber', setField: 'setInvoiceNumber' },
  { path: 'src/pages/Returns.tsx', itemsLabel: 'returns', numField: 'return_number', genField:'returnNumber', setField: 'setReturnNumber' },
  { path: 'src/pages/PurchaseReturns.tsx', itemsLabel: 'purchaseReturns', numField: 'return_number', genField:'returnNumber', setField: 'setReturnNumber' },
  { path: 'src/pages/PaymentVouchers.tsx', itemsLabel: 'vouchers', numField: 'voucher_number', genField:'voucherNumber', setField: 'setVoucherNumber' },
  { path: 'src/pages/Receipts.tsx', itemsLabel: 'receipts', numField: 'voucher_number', genField:'voucherNumber', setField: 'setVoucherNumber' },
  { path: 'src/pages/JournalEntries.tsx', itemsLabel: 'entries', numField: 'entry_number', genField:'entryNumber', setField: 'setEntryNumber' }
];

for (const fileDef of filesToUpdate) {
  const filePath = path.join(__dirname, fileDef.path);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf-8');

  // Let's replace the synchronous generator function with the async version and update the useEffect.
  // Wait, I can just replace the definition of the generator with an async one.
  const fnRegex = new RegExp(`const generate([A-Za-z]+) = \\(dateStr: string\\) => \\{[\\s\\S]*?return \`.*?\`;\\s*\\};`);
  const match = content.match(fnRegex);
  
  if (match) {
    const fnName = 'generate' + match[1];
    let newFn = `const ${fnName} = async (dateStr: string) => {\n    const next = await dbService.getNextSequence('${fileDef.itemsLabel === 'purchaseInvoices' ? 'purchase_invoices' : fileDef.itemsLabel === 'purchaseReturns' ? 'purchase_returns' : fileDef.itemsLabel === 'vouchers' ? 'payment_vouchers' : fileDef.itemsLabel === 'receipts' ? 'receipt_vouchers' : fileDef.itemsLabel === 'entries' ? 'journal_entries' : fileDef.itemsLabel}', dateStr);\n    return next;\n  };`;
    
    content = content.replace(fnRegex, newFn);
  }

  fs.writeFileSync(filePath, content);
  console.log(`Patched Sequence in ${filePath}`);
}
