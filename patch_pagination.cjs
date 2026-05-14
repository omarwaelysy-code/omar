const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  { path: 'src/pages/Invoices.tsx', itemsLabel: 'invoices', numField: 'invoice_number', module: 'invoices', summaryTextKey: 'invoices' },
  { path: 'src/pages/PurchaseInvoices.tsx', itemsLabel: 'invoices', numField: 'invoice_number', module: 'purchase_invoices', summaryTextKey: 'invoices' },
  { path: 'src/pages/Returns.tsx', itemsLabel: 'returns', numField: 'return_number', module: 'returns', summaryTextKey: 'returns' },
  { path: 'src/pages/PurchaseReturns.tsx', itemsLabel: 'returns', numField: 'return_number', module: 'purchase_returns', summaryTextKey: 'returns' },
  { path: 'src/pages/PaymentVouchers.tsx', itemsLabel: 'vouchers', numField: 'voucher_number', module: 'payment_vouchers', summaryTextKey: 'vouchers' },
  { path: 'src/pages/Receipts.tsx', itemsLabel: 'receipts', numField: 'voucher_number', module: 'receipt_vouchers', summaryTextKey: 'vouchers' },
  { path: 'src/pages/JournalEntries.tsx', itemsLabel: 'entries', numField: 'entry_number', module: 'journal_entries', summaryTextKey: 'entries' }
];

for (const fileDef of filesToUpdate) {
  const filePath = path.join(__dirname, fileDef.path);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');

  // Add pagination state
  if (!content.includes('const [page, setPage]')) {
    const searchTermRegex = /const \[searchTerm, setSearchTerm\] = useState\(''\);/;
    content = content.replace(searchTermRegex, `const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverSummary, setServerSummary] = useState<any>({});
  const [maxSeqGenerated, setMaxSeqGenerated] = useState<number>(0);`);
  }

  // Update subscription
  const subRegex = new RegExp(`const unsub.* = dbService\\.subscribe[<a-zA-Z>]*\\('${fileDef.module}', user\\.company_id, set${fileDef.itemsLabel.charAt(0).toUpperCase() + fileDef.itemsLabel.slice(1)}\\);`);
  
  if (content.match(subRegex)) {
    content = content.replace(subRegex, `const unsubItems = dbService.subscribePaginated('${fileDef.module}', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result: any) => {
        set${fileDef.itemsLabel.charAt(0).toUpperCase() + fileDef.itemsLabel.slice(1)}(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });`);
  }

  // Rewrite generate{File}Number logic safely to avoid depending on local state
  // We'll replace the inside of the function with an async version.
  const fnRegex = new RegExp(`const generate([A-Za-z]+Number) = \\(dateStr: string\\) => \\{[\\s\\S]*?return \`.*?\`;\\s*\\};`);
  const match = content.match(fnRegex);
  if (match) {
    const fnName = match[1];
    // This is tricky because we need it to be async, but replacing the sync call in useEffect might break it.
    // Instead of replacing the generic logic entirely, we'll patch the useEffect directly later if needed.
    // Since we're using paginated data, maybe we can fetch the maxSequence synchronously by storing it during the paginated fetch? No.
  }

  fs.writeFileSync(filePath, content);
  console.log(`Patched ${filePath}`);
}
