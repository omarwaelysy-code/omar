if (typeof global.localStorage === 'undefined') {
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
}

import { dbService } from '../src/services/dbService';

async function diagnose() {
  console.log('=== DIAGNOSING PRODUCTS IN DB ===');
  const products = await dbService.listAll<any>('products');
  console.log(`Found ${products.length} products in DB:`);
  products.forEach(p => {
    console.log(`Product ID: ${p.id} | Name: "${p.name}" | code: "${p.code}" | barcode: "${p.barcode}" | sku: "${p.sku}" | item_code: "${p.item_code}" | Keys: ${Object.keys(p).join(', ')}`);
  });

  console.log('\n=== DIAGNOSING INVOICES IN DB ===');
  const invoices = await dbService.listAll<any>('invoices');
  console.log(`Found ${invoices.length} invoices in DB`);
  const inv = invoices.find(i => i.invoice_number === 'INV-2026-08-000002' || i.invoice_number === 'INV-2026-07-000003') || invoices[invoices.length - 1];
  if (inv) {
    console.log(`Invoice Number: ${inv.invoice_number} | ID: ${inv.id}`);
    console.log('Items:', JSON.stringify(inv.items || inv.invoice_items, null, 2));
  } else {
    console.log('No invoice found');
  }
}

diagnose().catch(console.error);
