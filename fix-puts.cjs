const fs = require('fs');

let content = fs.readFileSync('src/lib/erp-api.ts', 'utf8');

function swapPutWithPostLoop(putPath, putItemTable, postPath, idVarName) {
    const putStart = content.indexOf(`router.put('${putPath}'`);
    if(putStart === -1) { console.log('not found PUT', putPath); return; }
    
    // We want to replace the `// Sync Items` section up to `await client.query('COMMIT');`
    let syncStart = content.indexOf(`await client.query('DELETE FROM ${putItemTable}`, putStart);
    let syncEnd = content.indexOf(`await client.query('COMMIT');`, syncStart);
    if(syncStart === -1 || syncEnd === -1) { console.log('sync bounds not found', putPath); return; }

    const postStart = content.indexOf(`router.post('${postPath}'`);
    if(postStart === -1) { console.log('post not found', postPath); return; }

    let postLoopStart = content.indexOf('for (const item of (items || [])) {', postStart);
    let postLoopEnd = content.indexOf(`await client.query('COMMIT');`, postLoopStart);
    if(postLoopStart === -1 || postLoopEnd === -1) { console.log('post loop bounds not found', postPath); return; }

    let replacementLoop = content.substring(postLoopStart, postLoopEnd);

    // In PUT, we have `invoiceData`, in POST it might be `invData`. We need to normalize this or just inject variables.
    let prefix = `await client.query('DELETE FROM ${putItemTable} WHERE ${putItemTable.replace('_items','').replace('return', 'return').replace('invoice', 'invoice')}_id = $1', [${idVarName}]);\n    await reverseAndRecalculate(client, companyId || '', ${idVarName});\n\n`;

    if (putPath === '/invoices/:id') {
       prefix += `    const invData = invoiceData;\n    const invoiceId = req.params.id;\n`;
    } else if (putPath === '/purchase_invoices/:id') {
       prefix += `    const invData = invoiceData;\n    const invoiceId = req.params.id;\n`;
    } else if (putPath === '/returns/:id') {
       prefix += `    const returnDataFinal = returnData;\n    const returnId = req.params.id;\n`;
       replacementLoop = replacementLoop.replace(/returnData\./g, 'returnDataFinal.');
    } else if (putPath === '/purchase_returns/:id') {
       prefix += `    const returnDataFinal = returnData;\n    const returnId = req.params.id;\n`;
       replacementLoop = replacementLoop.replace(/returnData\./g, 'returnDataFinal.');
    }

    content = content.substring(0, syncStart) + prefix + replacementLoop + '\n    ' + content.substring(syncEnd);
    console.log('Replaced', putPath);
}

// 1. Invoices
swapPutWithPostLoop('/invoices/:id', 'invoice_items', '/invoices', 'invoiceId');

// 2. Purchase Invoices
swapPutWithPostLoop('/purchase_invoices/:id', 'purchase_invoice_items', '/purchase_invoices', 'invoiceId');

// 3. Returns
swapPutWithPostLoop('/returns/:id', 'return_items', '/returns', 'returnId');

// 4. Purchase Returns
swapPutWithPostLoop('/purchase_returns/:id', 'purchase_return_items', '/purchase_returns', 'returnId');

fs.writeFileSync('src/lib/erp-api.ts', content);
console.log('Done');
