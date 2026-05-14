const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  { path: 'src/pages/Invoices.tsx', headFields: ['invoice_number', 'customer_name', 'date', '', 'payment_type', 'total_amount'] },
  { path: 'src/pages/PurchaseInvoices.tsx', headFields: ['invoice_number', 'supplier_name', 'date', '', 'payment_type', 'total_amount'] },
  { path: 'src/pages/Returns.tsx', headFields: ['return_number', 'customer_name', 'date', '', 'payment_type', 'total_amount'] },
  { path: 'src/pages/PurchaseReturns.tsx', headFields: ['return_number', 'supplier_name', 'date', '', 'payment_type', 'total_amount'] },
  { path: 'src/pages/PaymentVouchers.tsx', headFields: ['voucher_number', 'date', 'supplier_name', '', '', 'amount'] },
  { path: 'src/pages/Receipts.tsx', headFields: ['voucher_number', 'date', 'customer_name', '', '', 'amount'] },
  { path: 'src/pages/JournalEntries.tsx', headFields: ['entry_number', 'date', 'reference_number', '', 'total_debit', 'total_credit'] }
];

for (const fileDef of filesToUpdate) {
  const filePath = path.join(__dirname, fileDef.path);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf-8');

  // Let's add the sorting handler if missing:
  const sortHandler = `
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };
  `;

  if (!content.includes('const handleSort =')) {
    content = content.replace(/const \[searchTerm, setSearchTerm\] = useState\(''\);/, `const [searchTerm, setSearchTerm] = useState('');${sortHandler}`);
  }

  fs.writeFileSync(filePath, content);
  console.log(`Patched Sort Handler in ${filePath}`);
}
