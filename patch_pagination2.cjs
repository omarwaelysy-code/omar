const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  { path: 'src/pages/PurchaseInvoices.tsx', setter: 'setPurchaseInvoices', module: 'purchase_invoices' },
  { path: 'src/pages/Returns.tsx', setter: 'setReturns', module: 'returns' },
  { path: 'src/pages/PurchaseReturns.tsx', setter: 'setPurchaseReturns', module: 'purchase_returns' },
  { path: 'src/pages/PaymentVouchers.tsx', setter: 'setVouchers', module: 'payment_vouchers' },
  { path: 'src/pages/Receipts.tsx', setter: 'setReceipts', module: 'receipt_vouchers' },
  { path: 'src/pages/JournalEntries.tsx', setter: 'setEntries', module: 'journal_entries' }
];

for (const fileDef of filesToUpdate) {
  const filePath = path.join(__dirname, fileDef.path);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf-8');

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

  // Update subscription - find any dynamic unsubscribe name
  const subRegex = new RegExp(`const\\s+(unsub[A-Za-z]+)\\s*=\\s*dbService\\.subscribe\\[.*?\\]?\\('${fileDef.module}',\\s*user\\.company_id,\\s*${fileDef.setter}\\);`);
  const match = content.match(subRegex);
  
  if (match) {
    const unsubVar = match[1];
    content = content.replace(subRegex, `const ${unsubVar} = dbService.subscribePaginated('${fileDef.module}', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result: any) => {
        ${fileDef.setter}(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });`);
      
    // also update useEffect dependencies
    const depsRegex = /\}, \[user\]\);/;
    if (content.match(depsRegex)) {
        content = content.replace(depsRegex, `}, [user, page, limit, sortBy, sortOrder, searchTerm]);`);
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`Patched ${filePath}`);
}
