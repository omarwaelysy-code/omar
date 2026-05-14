const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  { 
    path: 'src/pages/PurchaseInvoices.tsx', 
    moduleName: 'purchase_invoices', 
    numField: 'invoice_number',
    genFnName: 'generateInvoiceNumber',
    pageTitleKey: 'purchaseInvoices.title',
    pageSubtitleKey: 'purchaseInvoices.subtitle',
    currencyKey: 'purchaseInvoices.currency',
    thFields: [
      { key: 'invoice_number', label: 'purchaseInvoices.column_number' },
      { key: 'supplier_name', label: 'purchaseInvoices.column_supplier' },
      { key: 'date', label: 'purchaseInvoices.column_date' },
      { key: 'payment_type', label: 'purchaseInvoices.form_payment_type' },
      { key: 'total_amount', label: 'purchaseInvoices.column_amount' }
    ]
  },
  { 
    path: 'src/pages/Returns.tsx', 
    moduleName: 'returns', 
    numField: 'return_number',
    genFnName: 'generateReturnNumber',
    pageTitleKey: 'returns.title',
    pageSubtitleKey: 'returns.subtitle',
    currencyKey: 'returns.currency',
    thFields: [
      { key: 'return_number', label: 'returns.column_number' },
      { key: 'customer_name', label: 'returns.column_customer' },
      { key: 'date', label: 'returns.column_date' },
      { key: 'payment_type', label: 'returns.column_type' },
      { key: 'total_amount', label: 'returns.column_total' }
    ]
  },
  { 
    path: 'src/pages/PurchaseReturns.tsx', 
    moduleName: 'purchase_returns', 
    numField: 'return_number',
    genFnName: 'generateReturnNumber',
    pageTitleKey: 'purchaseReturns.title',
    pageSubtitleKey: 'purchaseReturns.subtitle',
    currencyKey: 'purchaseReturns.currency',
    thFields: [
      { key: 'return_number', label: 'purchaseReturns.column_number' },
      { key: 'supplier_name', label: 'purchaseReturns.column_supplier' },
      { key: 'date', label: 'purchaseReturns.column_date' },
      { key: 'payment_type', label: 'purchaseReturns.column_type' },
      { key: 'total_amount', label: 'purchaseReturns.column_total' }
    ]
  },
  { 
    path: 'src/pages/PaymentVouchers.tsx', 
    moduleName: 'payment_vouchers', 
    numField: 'voucher_number',
    genFnName: 'generateVoucherNumber',
    pageTitleKey: 'paymentVouchers.title',
    pageSubtitleKey: 'paymentVouchers.subtitle',
    currencyKey: 'paymentVouchers.currency',
    thFields: [
      { key: 'voucher_number', label: 'paymentVouchers.column_number' },
      { key: 'date', label: 'paymentVouchers.column_date' },
      { key: 'supplier_name', label: 'paymentVouchers.column_supplier' },
      { key: 'amount', label: 'paymentVouchers.column_amount' }
    ]
  },
  { 
    path: 'src/pages/Receipts.tsx', 
    moduleName: 'receipt_vouchers', 
    numField: 'voucher_number',
    genFnName: 'generateVoucherNumber',
    pageTitleKey: 'receipts.title',
    pageSubtitleKey: 'receipts.subtitle',
    currencyKey: 'receipts.currency',
    thFields: [
      { key: 'voucher_number', label: 'receipts.column_number' },
      { key: 'date', label: 'receipts.column_date' },
      { key: 'customer_name', label: 'receipts.column_customer' },
      { key: 'amount', label: 'receipts.column_amount' }
    ]
  }
];

for (const fileDef of filesToUpdate) {
  const filePath = path.join(__dirname, fileDef.path);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping missing file: ${filePath}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1. Ensure PaginationControls import
  if (!content.includes('import { PaginationControls }')) {
    content = content.replace(/import \{ dbService \} from '\.\.\/services\/dbService';/, "import { dbService } from '../services/dbService';\nimport { PaginationControls } from '../components/PaginationControls';");
  }

  // 2. Fix generate function to be async
  const genFnRegex = new RegExp(`const ${fileDef.genFnName} = \\(.*?\\) => \\{[\\s\\S]*?return .*?;\\s*\\};`);
  const newGenFn = `const ${fileDef.genFnName} = async (dateStr: string) => {\n    const next = await dbService.getNextSequence('${fileDef.moduleName}', dateStr);\n    return next;\n  };`;
  content = content.replace(genFnRegex, newGenFn);

  // 3. Update useEffect and openModal to await the number
  // useEffect call: setInvoiceNumber(generateInvoiceNumber(date))
  const effectRegex = new RegExp(`if \\(!editing[A-Za-z]+\\) \\{\\s+set[A-Za-z]+Number\\(${fileDef.genFnName}\\(date\\)\\);\\s+\\}`);
  const newEffect = `if (!editing${fileDef.genFnName.replace('generate', '')}) {\n      const updateNum = async () => {\n        const num = await ${fileDef.genFnName}(date);\n        set${fileDef.genFnName.replace('generate', '')}(num);\n      };\n      updateNum();\n    }`;
  content = content.replace(effectRegex, newEffect);

  // openModal call: setInvoiceNumber(generateInvoiceNumber(newDate))
  const openModalRegex = new RegExp(`const openModal = \\(.*?\\) => \\{([\\s\\S]*?)set[A-Za-z]+Number\\(${fileDef.genFnName}\\(newDate\\)\\);`);
  const newOpenModal = `const openModal = async (data?: any) => {$1const num = await ${fileDef.genFnName}(newDate);\n    set${fileDef.genFnName.replace('generate', '')}(num);`;
  content = content.replace(openModalRegex, newOpenModal);

  // 4. Inject PaginationControls component
  if (!content.includes('<PaginationControls')) {
    // Inject before the modal or at the end of the list div
    if (content.includes('</table>\n          </div>')) {
       content = content.replace('</table>\n          </div>', '</table>\n          </div>\n\n        <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />');
    } else {
       // fallback for mobile view or card view
       content = content.replace('</div>\n\n      {/* Create ', '</div>\n\n        <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />\n\n      {/* Create ');
    }
  }

  // 5. Sorting Indicators in Table Headers
  fileDef.thFields.forEach(field => {
    // Try to find the exact th line. This is tricky due to translations and dir classes.
    // We'll search for the t(label) inside <th>
    const thRegex = new RegExp(`<th className={\`px-6 py-4 \\$\{dir === 'rtl' \\? 'text-right' : 'text-left'\}\`}>\\{t\\('${field.label}'\\)\\}</th>`, 'g');
    const replacement = `<th className={\`px-6 py-4 \$\{dir === 'rtl' ? 'text-right' : 'text-left'\} cursor-pointer hover:text-emerald-600 transition-colors group\`} onClick={() => handleSort('${field.key}')}>
                    <div className="flex items-center gap-1">
                      {t('${field.label}')}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === '${field.key}' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>`;
    content = content.replace(thRegex, replacement);
  });

  // 6. Summary Header (Server Summary)
  const headerSearch = new RegExp(`<div>\\s*<h2 className="text-3xl font-bold tracking-tight .*?">\\{t\\('${fileDef.pageTitleKey}'\\)\\}</h2>\\s*<p className=".*?">\\{t\\('${fileDef.pageSubtitleKey}'\\)\\}</p>\\s*</div>`);
  const summaryHeader = `<div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 italic serif">{t('${fileDef.pageTitleKey}')}</h2>
          <p className="text-slate-500">{t('${fileDef.pageSubtitleKey}')}</p>
          {(serverSummary.total_amount !== undefined || serverSummary.amount !== undefined) && (
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">إجمالي المبالغ: {formatMoney(serverSummary.total_amount || serverSummary.amount || 0)} {t('${fileDef.currencyKey}')}</span>
              {serverSummary.total_discount !== undefined && (
                <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100 font-bold">إجمالي الخصومات: {formatMoney(serverSummary.total_discount || 0)} {t('${fileDef.currencyKey}')}</span>
              )}
              {serverSummary.total_discount !== undefined && (
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 font-bold">الصافي: {formatMoney((serverSummary.total_amount || 0) - (serverSummary.total_discount || 0))} {t('${fileDef.currencyKey}')}</span>
              )}
            </div>
          )}
        </div>`;
  content = content.replace(headerSearch, summaryHeader);

  fs.writeFileSync(filePath, content);
  console.log(`Finalized Table in ${filePath}`);
}
