import { normalizeDocumentData } from '../src/components/TemplateRenderer';
import { generatePDF } from '../src/lib/pdf-generator';
import fs from 'fs';
import path from 'path';

async function testReturnPdfZeroDtoVat() {
  // Test 1: Sales Return (RET-2026-07-000003 from user's latest screenshot)
  const dtoSalesReturnZeroVat = {
    company: { name: 'شركة الاختبار', currency: 'EGP', vat_enabled: true },
    invoice_number: 'RET-2026-07-000003',
    date: '2026-07-19',
    payment_method: 'credit',
    customer_name: 'ABC',
    customer_tax_number: '999000777',
    subtotal: '547983.54',
    vat_amount: '0.00', // ZERO VAT AMOUNT PASSED IN DTO
    net_total: '547983.54',
    currency_code: 'EGP',
    operation_type: 'returns',
    language: 'ar',
    items: [
      { product_code: '-', product_name: 'غسالة ملابس', quantity: 5, unit_price: 606.71, vat_rate: '% 14', vat_amount: 424.70, total: 3033.56 },
      { product_code: '-', product_name: 'سيارة', quantity: 5, unit_price: 54495.00, vat_rate: '% 14', vat_amount: 38146.50, total: 272474.99 },
      { product_code: '-', product_name: 'سيارة', quantity: 5, unit_price: 54495.00, vat_rate: '% 14', vat_amount: 38146.50, total: 272474.99 }
    ]
  };

  const pdfBuffer1 = await generatePDF('SalesInvoicePdf', dtoSalesReturnZeroVat);
  fs.writeFileSync(path.join(process.cwd(), 'scratch', 'test_sales_return_vat.pdf'), pdfBuffer1);

  console.log(`Test 1 PASSED! Sales Return PDF generated with size: ${pdfBuffer1.length} bytes`);
}

testReturnPdfZeroDtoVat().catch(console.error);
